require('dotenv').config();
const { SquareClient, SquareEnvironment, SquareError } = require('square');
const { v4: uuidv4 } = require('uuid');

// Initialize Square client
const squareClient = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN,
  environment: process.env.SQUARE_ENVIRONMENT === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox
});

module.exports.createPaymentLink = async (event) => {
  console.log('Creating payment link with order...');
  
  try {
    let requestBody;
    if (typeof event.body === 'string') {
      requestBody = JSON.parse(event.body);
    } else {
      requestBody = event.body;
    }

    console.log('Payment link request received:', {
      hasOrder: !!requestBody.order,
      hasLineItems: !!requestBody.order?.lineItems,
      lineItemsCount: requestBody.order?.lineItems?.length || 0,
      hasLocationId: !!requestBody.order?.locationId
    });

    // Validate required fields for order-based payment link
    if (!requestBody.order) {
      return createErrorResponse(400, 'Missing required field: order');
    }
    if (!requestBody.order.locationId) {
      return createErrorResponse(400, 'Missing required field: order.locationId');
    }
    if (!requestBody.order.lineItems || requestBody.order.lineItems.length === 0) {
      return createErrorResponse(400, 'Missing required field: order.lineItems (must have at least one item)');
    }

    // Validate and process line items
    for (let i = 0; i < requestBody.order.lineItems.length; i++) {
      const item = requestBody.order.lineItems[i];
      if (!item.name) {
        return createErrorResponse(400, `Missing required field: order.lineItems[${i}].name`);
      }
      if (!item.quantity) {
        return createErrorResponse(400, `Missing required field: order.lineItems[${i}].quantity`);
      }
      if (!item.basePriceMoney || !item.basePriceMoney.amount) {
        return createErrorResponse(400, `Missing required field: order.lineItems[${i}].basePriceMoney.amount`);
      }
      
      // Convert amount to BigInt for the SDK
      if (typeof item.basePriceMoney.amount !== 'bigint') {
        item.basePriceMoney.amount = BigInt(item.basePriceMoney.amount);
      }
      
      // Default currency to USD if not provided
      if (!item.basePriceMoney.currency) {
        item.basePriceMoney.currency = 'USD';
      }
    }

    console.log(`Creating payment link for order with ${requestBody.order.lineItems.length} line items`);

    // Create payment link using order approach
    const response = await squareClient.checkout.paymentLinks.create({
      idempotencyKey: requestBody.idempotencyKey || uuidv4(),
      description: requestBody.description || 'Payment for your order',
      order: {
        locationId: requestBody.order.locationId,
        lineItems: requestBody.order.lineItems,
        // Optional order fields
        ...(requestBody.order.referenceId && { referenceId: requestBody.order.referenceId }),
        ...(requestBody.order.customerId && { customerId: requestBody.order.customerId }),
        ...(requestBody.order.source && { source: requestBody.order.source }),
        ...(requestBody.order.fulfillments && { fulfillments: requestBody.order.fulfillments }),
        ...(requestBody.order.metadata && { metadata: requestBody.order.metadata }),
        ...(requestBody.order.taxes && { taxes: requestBody.order.taxes }),
        ...(requestBody.order.discounts && { discounts: requestBody.order.discounts }),
        ...(requestBody.order.serviceCharges && { serviceCharges: requestBody.order.serviceCharges })
      },
      // Optional: Add checkout options
      ...(requestBody.checkoutOptions && { checkoutOptions: requestBody.checkoutOptions }),
      // Optional: Pre-populate customer data
      ...(requestBody.prePopulatedData && { prePopulatedData: requestBody.prePopulatedData }),
      // Optional: Payment note
      ...(requestBody.paymentNote && { paymentNote: requestBody.paymentNote })
    });

    console.log('Payment link API call successful');
    console.log('Response status:', response.paymentLink ? 'success' : 'no payment link');

    if (!response.paymentLink) {
      throw new Error('Payment link not found in API response');
    }

    const paymentLink = response.paymentLink;
    console.log(`Payment link created successfully: ${paymentLink.url}`);

    // Return the complete response including related resources
    return createSuccessResponse({
      success: true,
      message: 'Payment link created successfully',
      paymentLink: {
        id: paymentLink.id,
        version: paymentLink.version,
        orderId: paymentLink.orderId,
        url: paymentLink.url,
        longUrl: paymentLink.longUrl,
        createdAt: paymentLink.createdAt
      },
      // Include related order information if available
      ...(response.relatedResources && {
        relatedResources: response.relatedResources
      })
    });

  } catch (error) {
    console.error("--- RAW API ERROR RESPONSE ---");
    console.error(JSON.stringify(error, null, 2));
    console.error("--- END RAW API ERROR RESPONSE ---");

    console.error('Error creating payment link:', error.message);
    
    if (error instanceof SquareError) {
      console.error('Square API Error Details:', {
        statusCode: error.statusCode,
        errors: error.errors
      });
      return createErrorResponse(error.statusCode || 500, 'Square API Error', {
        details: error.message,
        errors: error.errors
      });
    }
    
    return createErrorResponse(500, 'Internal server error', { 
      details: error.message 
    });
  }
};

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