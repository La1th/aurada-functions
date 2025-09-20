const AWS = require('aws-sdk');
const { SquareClient, SquareEnvironment, SquareError } = require('square');
const https = require('https');

// Configure AWS region (Lambda uses IAM role for credentials)
AWS.config.update({ 
  region: process.env.AWS_REGION || 'us-east-1'
});
const dynamodb = new AWS.DynamoDB.DocumentClient();
const secretsManager = new AWS.SecretsManager();

// Cache for Square credentials (separate cache for each environment)
let squareCredentialsCache = {
  sandbox: null,
  production: null
};
let squareClientCache = {
  sandbox: null,
  production: null
};

// Function to detect environment from request path
function detectEnvironmentFromPath(event) {
  const path = event.rawPath || event.path || '';
  console.log('Detecting environment from path:', path);
  
  if (path.includes('/sandbox/')) {
    console.log('Environment detected: sandbox');
    return 'sandbox';
  } else {
    console.log('Environment detected: production (default)');
    return 'production';
  }
}

// Function to get Square credentials from AWS Secrets Manager
async function getSquareCredentials(environment = 'production') {
  if (squareCredentialsCache[environment]) {
    console.log(`Using cached ${environment} credentials`);
    return squareCredentialsCache[environment];
  }
  
  try {
    // Use environment-specific secret names
    const secretId = `square-api-keys-${environment}`;
    console.log(`Retrieving Square credentials from secret: ${secretId}`);
    
    const result = await secretsManager.getSecretValue({ SecretId: secretId }).promise();
    squareCredentialsCache[environment] = JSON.parse(result.SecretString);
    
    // Initialize Square client with retrieved credentials
    squareClientCache[environment] = new SquareClient({
      token: squareCredentialsCache[environment].SQUARE_ACCESS_TOKEN,
      environment: environment === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox
    });
    
    console.log(`Successfully initialized ${environment} Square client`);
    return squareCredentialsCache[environment];
  } catch (error) {
    console.error(`Error retrieving Square credentials for ${environment}:`, error);
    throw new Error(`Failed to retrieve Square API credentials for ${environment}`);
  }
}

// Function to get Square client for specific environment
function getSquareClient(environment = 'production') {
  return squareClientCache[environment];
}

const REDBIRD_MENU_TABLE = 'redbird-menu';
const SESSION_CARTS_TABLE = 'session-carts';

// Simple UUID alternative using timestamp and random number
function generateIdempotencyKey() {
  return `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Session cart helper functions
function extractCallId(body) {
  return body.call?.call_id;
}

async function getSessionCart(callId) {
  if (!callId) return [];
  
  const params = {
    TableName: SESSION_CARTS_TABLE,
    Key: { call_id: callId }
  };
  
  try {
    const result = await dynamodb.get(params).promise();
    return result.Item?.cart_items || [];
  } catch (error) {
    console.error('Error getting session cart:', error);
    return [];
  }
}

module.exports.createOrderAndPaymentLink = async (event) => {
  console.log('Processing session cart and creating payment link...');
  
  // Add 500ms buffer as requested
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  let cartData; // Declare for error handling scope
  
  try {
    // Detect environment from request path
    const environment = detectEnvironmentFromPath(event);
    console.log(`Operating in ${environment} environment`);
    
    // Get Square credentials for detected environment
    await getSquareCredentials(environment);
    const squareClient = getSquareClient(environment);
    
    if (!squareClient) {
      throw new Error(`Square client not initialized for ${environment} environment`);
    }

    // Essential logging - clean and focused
    console.log('Request info:', {
      path: event.rawPath,
      method: event.requestContext?.http?.method,
      environment: environment,
      bodyType: typeof event.body
    });
    
    // Parse the request body
    let requestBody;
    if (typeof event.body === 'string') {
      requestBody = JSON.parse(event.body);
    } else {
      requestBody = event.body;
    }

    // Extract call ID for session cart
    const callId = extractCallId(requestBody);
    if (!callId) {
      return createErrorResponse(400, 'Missing call ID in request');
    }

    console.log(`Creating order for call: ${callId}`);

    // Get session cart (contains full DynamoDB data)
    const sessionCart = await getSessionCart(callId);
    
    if (!sessionCart || sessionCart.length === 0) {
      return createErrorResponse(400, 'Cart is empty. Please add items first.');
    }

    // Calculate cart summary from session cart
    const subtotal = sessionCart.reduce((sum, item) => sum + item.lineTotal, 0);
    const itemCount = sessionCart.reduce((sum, item) => sum + item.quantity, 0);
    
    const cartSummary = {
      items: sessionCart,
      subtotal: subtotal,
      itemCount: itemCount,
      message: 'Tax will be calculated at checkout'
    };

    // Extract customer info and other data from request  
    const phone = requestBody.args?.phone || requestBody.phone;
    
    cartData = {
      updatedCart: sessionCart,
      cartSummary: cartSummary,
      customerInfo: requestBody.args?.customerInfo || requestBody.customerInfo || (phone ? { phone: phone } : null),
      locationId: requestBody.args?.locationId || requestBody.locationId,
      checkoutOptions: requestBody.args?.checkoutOptions || requestBody.checkoutOptions,
      description: requestBody.args?.description || requestBody.description
    };

    console.log('Payment link request with session cart:', {
      itemsCount: sessionCart.length,
      subtotal: subtotal,
      hasCustomerInfo: !!cartData.customerInfo,
      hasLocationId: !!cartData.locationId
    });

    // Step 1: Convert cart data to Square format (no validation needed)
    const orderResult = convertCartToSquareOrder(cartData.updatedCart, cartData.cartSummary);
    
    // Step 2: Create Square payment link with processed order
    const paymentLinkResult = await createSquarePaymentLink({
      squareClient: squareClient,
      locationId: cartData.locationId || squareCredentialsCache[environment].SQUARE_LOCATION_ID,
      lineItems: orderResult.squareLineItems,
      customerInfo: cartData.customerInfo,
      orderSummary: orderResult.orderSummary,
      checkoutOptions: cartData.checkoutOptions,
      description: cartData.description
    });

    // Step 3: Send SMS with payment link if customer phone is provided
    let smsResult = null;
    if (cartData.customerInfo && cartData.customerInfo.phone) {
      try {
        smsResult = await sendPaymentLinkSMS(
          cartData.customerInfo.phone,
          paymentLinkResult.paymentLink.url,
          orderResult.orderSummary
        );
        console.log('✅ SMS sent successfully with payment link');
      } catch (smsError) {
        console.error('⚠️ SMS sending failed:', smsError.message);
        // Don't fail the whole process if SMS fails
      }
    }

    console.log(`🎉 Complete workflow successful: ${orderResult.orderSummary.itemCount} items, $${cartData.cartSummary.subtotal.toFixed(2)} subtotal + tax `);

    return createSuccessResponse({
      success: true,
      message: 'Pre-validated cart processed and payment link created successfully',
      orderSummary: orderResult.orderSummary,
      paymentLink: paymentLinkResult.paymentLink,
      smsResult: smsResult,
      squareLineItems: orderResult.squareLineItems
    });

  } catch (error) {
    console.error('Error in payment workflow:', error.message);
    console.error('Error stack:', error.stack);
    
    // Log only essential cart info, not full transcript data
    const errorContext = cartData ? {
      hasCartSummary: !!cartData.cartSummary,
      hasUpdatedCart: !!cartData.updatedCart,
      itemCount: cartData.updatedCart?.length || 0,
      hasCustomerInfo: !!cartData.customerInfo,
      hasLocationId: !!cartData.locationId
    } : { cartData: 'undefined' };
    console.error('Error context:', errorContext);
    
    return createErrorResponse(500, 'Internal server error', { 
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// Helper function to convert pre-validated cart data to Square order format
function convertCartToSquareOrder(cartItems, cartSummary) {
  console.log('Converting cart data to Square order format...');
  
  // Build Square-ready line items from DynamoDB cart data
  const squareLineItems = cartItems.map(item => {
    // Validate required price_money property
    if (!item.price_money || !item.price_money.amount) {
      console.error('Cart item missing price_money:', JSON.stringify(item, null, 2));
      throw new Error(`Cart item "${item.item_name}" is missing price information. Please refresh cart.`);
    }
    
    return {
      name: `${item.item_name} - Regular`,  // Hard-code "Regular" since cart no longer includes variation
      quantity: item.quantity.toString(),
      variationName: "Regular",  // Hard-code "Regular" 
      catalogObjectId: item.square_variation_id,
      basePriceMoney: {
        amount: BigInt(parseInt(item.price_money.amount)), // Already in cents from DynamoDB
        currency: item.price_money.currency || 'USD'
      },
      ...(item.specialInstructions && { note: item.specialInstructions })
    };
  });

  // Use the cart summary data (Square will calculate tax automatically)
  const orderSummary = {
    items: cartItems,
    subtotal: Math.round(cartSummary.subtotal * 100), // Convert to cents
    itemCount: cartSummary.itemCount,
    // Remove tax fields - Square handles tax calculation
    taxMessage: 'Tax will be calculated at checkout',
    createdAt: new Date().toISOString()
  };

  console.log(`✅ Converted cart: ${cartItems.length} items, $${cartSummary.subtotal.toFixed(2)} subtotal (+ tax)`);

  return {
    orderSummary,
    squareLineItems
  };
}

// Helper function to process order with menu data (OLD - now unused)
async function processOrderWithMenu(items) {
  // This function is no longer needed since cart functions handle validation
  throw new Error('This function is deprecated. Use cart functions for validation.');
}

// Helper function to create Square payment link
async function createSquarePaymentLink({ squareClient, locationId, lineItems, customerInfo, orderSummary, checkoutOptions, description }) {
  console.log('Creating Square payment link...');

  const paymentLinkRequest = {
    idempotencyKey: generateIdempotencyKey(),
    description: description || `Red Bird Chicken Order - ${orderSummary.itemCount} items`,
    order: {
      locationId: locationId,
      lineItems: lineItems,
      referenceId: `ORDER-${Date.now()}`,
      source: {
        name: 'Red Bird Chicken Voice AI'
      }
    }
  };

  // Add checkout options if provided
  if (checkoutOptions) {
    paymentLinkRequest.checkoutOptions = checkoutOptions;
  }

  // Customer data pre-population disabled - keeping payment links simple
  // Square payment links work fine without pre-populated customer data
  // The customer can enter their info during checkout

  try {
    const response = await squareClient.checkout.paymentLinks.create(paymentLinkRequest);

    if (!response.paymentLink) {
      throw new Error('Payment link not found in API response');
    }

    const paymentLink = response.paymentLink;
    console.log(`✅ Payment link created: ${paymentLink.url}`);

    return {
      paymentLink: {
        id: paymentLink.id,
        version: paymentLink.version,
        orderId: paymentLink.orderId,
        url: paymentLink.url,
        longUrl: paymentLink.longUrl,
        createdAt: paymentLink.createdAt
      },
      relatedResources: response.relatedResources || null
    };

  } catch (error) {
    console.error('Square payment link creation failed:', error.message);
    if (error instanceof SquareError) {
      console.error('Square API Error Details:', {
        statusCode: error.statusCode,
        errors: error.errors
      });
    }
    throw error;
  }
}

// Helper function to create success response
function createSuccessResponse(data) {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    },
    body: JSON.stringify(data, (key, value) => {
      // Handle BigInt serialization
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    })
  };
}

// Helper function to create error response
function createErrorResponse(statusCode, message, additionalData = {}) {
  return {
    statusCode: statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    },
    body: JSON.stringify({
      error: message,
      ...additionalData
    })
  };
}

// Function to send payment link via SMS using TextBelt
async function sendPaymentLinkSMS(phoneNumber, paymentLinkUrl, orderSummary) {
  return new Promise(async (resolve, reject) => {
    try {
      // Get TextBelt API key from Secrets Manager
      const textbeltResult = await secretsManager.getSecretValue({ SecretId: 'textbelt-api-key' }).promise();
      const textbeltApiKey = textbeltResult.SecretString;

      // Create order summary for SMS
      const itemCount = orderSummary.itemCount;
      const subtotal = (orderSummary.subtotal / 100).toFixed(2);
      
      // Build item list for SMS
      let itemList = '';
      if (orderSummary.items && orderSummary.items.length > 0) {
        const topItems = orderSummary.items.slice(0, 3); // Show first 3 items
        itemList = topItems.map(item => 
          `${item.quantity}x ${item.name}`
        ).join(', ');
        
        if (orderSummary.items.length > 3) {
          itemList += ` +${orderSummary.items.length - 3} more`;
        }
        itemList = `Your order: ${itemList}. `;
      }

      // Format the SMS message with payment link (Square calculates final total)
      const message = `🐔 Red Bird Chicken Order Ready! ${itemList}Subtotal: $${subtotal} (+ tax). Complete your payment here: ${paymentLinkUrl}. Pick up at: 282 Cedar Ln SE, Vienna, VA 22180. `;

      // Prepare form data for TextBelt
      const formData = new URLSearchParams();
      formData.append('phone', phoneNumber);
      formData.append('message', message);
      formData.append('key', textbeltApiKey);
      formData.append('sender', 'Red Bird Chicken');

      const postData = formData.toString();

      const options = {
        hostname: 'textbelt.com',
        port: 443,
        path: '/text',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.success) {
              resolve(result);
            } else {
              reject(new Error(`TextBelt error: ${result.error}`));
            }
          } catch (parseError) {
            reject(new Error(`Failed to parse TextBelt response: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(postData);
      req.end();

    } catch (secretError) {
      reject(new Error(`Failed to get TextBelt API key: ${secretError.message}`));
    }
  });
} 