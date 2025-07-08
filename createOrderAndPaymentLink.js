const AWS = require('aws-sdk');
const { SquareClient, SquareEnvironment, SquareError } = require('square');
const https = require('https');

// Configure AWS region (Lambda uses IAM role for credentials)
AWS.config.update({ 
  region: process.env.AWS_REGION || 'us-east-1'
});
const dynamodb = new AWS.DynamoDB.DocumentClient();
const secretsManager = new AWS.SecretsManager();

// Cache for Square credentials
let squareCredentials = null;
let squareClient = null;

// Function to get Square credentials from AWS Secrets Manager
async function getSquareCredentials() {
  if (squareCredentials) {
    return squareCredentials;
  }
  
  try {
    const result = await secretsManager.getSecretValue({ SecretId: 'square-api-keys' }).promise();
    squareCredentials = JSON.parse(result.SecretString);
    
    // Initialize Square client with retrieved credentials
    squareClient = new SquareClient({
      token: squareCredentials.SQUARE_ACCESS_TOKEN,
      environment: squareCredentials.SQUARE_ENVIRONMENT === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox
    });
    
    return squareCredentials;
  } catch (error) {
    console.error('Error retrieving Square credentials from Secrets Manager:', error);
    throw new Error('Failed to retrieve Square API credentials');
  }
}

const REDBIRD_MENU_TABLE = 'redbird-menu';

// Simple UUID alternative using timestamp and random number
function generateIdempotencyKey() {
  return `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

module.exports.createOrderAndPaymentLink = async (event) => {
  console.log('Processing pre-validated cart and creating payment link...');
  
  try {
    // Get Square credentials from Secrets Manager
    await getSquareCredentials();
    
    // Debug logging - see exactly what we're receiving
    console.log('Raw event:', JSON.stringify(event, null, 2));
    console.log('Event body type:', typeof event.body);
    console.log('Event body content:', event.body);
    
    // Parse the request body (expecting cart data from addToCart functions)
    let requestBody;
    if (typeof event.body === 'string') {
      requestBody = JSON.parse(event.body);
    } else {
      requestBody = event.body;
    }

    console.log('Parsed request body:', JSON.stringify(requestBody, null, 2));

    // Handle Retell webhook format - cart data is in 'args' property
    let cartData;
    if (requestBody.args && (requestBody.name === 'payment_link_text' || requestBody.name === 'createOrderAndPaymentLink')) {
      console.log('Detected Retell webhook format, extracting cart data from args...');
      cartData = requestBody.args;
    } else {
      // Direct cart data format
      cartData = requestBody;
    }

    console.log('Payment link request received:', {
      hasCartSummary: !!cartData.cartSummary,
      hasCart: !!cartData.updatedCart,
      itemsCount: cartData.updatedCart?.length || 0,
      hasCustomerInfo: !!cartData.customerInfo,
      hasLocationId: !!cartData.locationId
    });

    // Validate required fields - expecting cart data from addToCart/getCartSummary
    if (!cartData.updatedCart || cartData.updatedCart.length === 0) {
      return createErrorResponse(400, 'Missing required field: updatedCart (from cart functions)');
    }
    if (!cartData.cartSummary) {
      return createErrorResponse(400, 'Missing required field: cartSummary (from cart functions)');
    }

    // Step 1: Convert cart data to Square format (no validation needed)
    const orderResult = convertCartToSquareOrder(cartData.updatedCart, cartData.cartSummary);
    
    // Step 2: Create Square payment link with processed order
    const paymentLinkResult = await createSquarePaymentLink({
      locationId: cartData.locationId || squareCredentials.SQUARE_LOCATION_ID,
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

    console.log(`🎉 Complete workflow successful: ${orderResult.orderSummary.itemCount} items, $${cartData.cartSummary.subtotal.toFixed(2)} subtotal + tax by Square`);

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
    console.error('Request body:', JSON.stringify(requestBody, null, 2));
    
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
  const squareLineItems = cartItems.map(item => ({
    name: `${item.item_name} - ${item.variation}`,
    quantity: item.quantity.toString(),
    variationName: item.variation,
    catalogObjectId: item.square_variation_id,
    basePriceMoney: {
      amount: BigInt(parseInt(item.price_money.amount)), // Already in cents from DynamoDB
      currency: item.price_money.currency || 'USD'
    },
    ...(item.specialInstructions && { note: item.specialInstructions })
  }));

  // Use the cart summary data (Square will calculate tax automatically)
  const orderSummary = {
    items: cartItems,
    subtotal: Math.round(cartSummary.subtotal * 100), // Convert to cents
    itemCount: cartSummary.itemCount,
    // Remove tax fields - Square handles tax calculation
    taxMessage: 'Tax calculated by Square at checkout',
    createdAt: new Date().toISOString()
  };

  console.log(`✅ Converted cart: ${cartItems.length} items, $${cartSummary.subtotal.toFixed(2)} subtotal (+ tax by Square)`);

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
async function createSquarePaymentLink({ locationId, lineItems, customerInfo, orderSummary, checkoutOptions, description }) {
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
      const message = `🐔 Red Bird Chicken Order Ready! ${itemList}Subtotal: $${subtotal} (+ tax). Complete your payment here: ${paymentLinkUrl}`;

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