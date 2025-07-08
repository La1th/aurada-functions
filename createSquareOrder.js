const AWS = require('aws-sdk');

// Configure AWS region and credentials from environment variables
AWS.config.update({ 
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});
const dynamodb = new AWS.DynamoDB.DocumentClient();

const REDBIRD_MENU_TABLE = 'redbird-menu';

module.exports.createSquareOrder = async (event) => {
  console.log('Processing order with Square menu items...');
  
  try {
    // Parse the request body (same format as addToCart)
    let requestBody;
    if (typeof event.body === 'string') {
      requestBody = JSON.parse(event.body);
    } else {
      requestBody = event.body;
    }

    console.log('Order request received:', {
      hasItems: !!requestBody.items,
      itemsCount: requestBody.items?.length || 0,
      hasCustomerInfo: !!requestBody.customerInfo
    });

    // Validate required fields
    if (!requestBody.items || requestBody.items.length === 0) {
      return createErrorResponse(400, 'Missing required field: items');
    }

    // Process each item and get Square menu data
    const processedItems = [];
    let totalAmount = 0;

    for (const item of requestBody.items) {
      try {
        // Query DynamoDB for the menu item
        const menuItem = await getMenuItemFromDynamoDB(item.name, item.variation || 'Regular');
        
        if (!menuItem) {
          console.warn(`Menu item not found: ${item.name} - ${item.variation || 'Regular'}`);
          continue;
        }

        // Calculate line total
        const unitPrice = parseInt(menuItem.price_money.amount);
        const quantity = item.quantity || 1;
        const lineTotal = unitPrice * quantity;
        totalAmount += lineTotal;

        // Build processed item with Square data
        const processedItem = {
          name: menuItem.item_name,
          variation: menuItem.variation,
          quantity: quantity,
          unitPrice: unitPrice,
          lineTotal: lineTotal,
          specialInstructions: item.specialInstructions || '',
          square_item_id: menuItem.square_item_id,
          square_variation_id: menuItem.square_variation_id,
          sku: menuItem.sku,
          description: menuItem.description
        };

        processedItems.push(processedItem);
        
        console.log(`✅ Processed: ${processedItem.name} - ${processedItem.variation} x${quantity} = $${(lineTotal/100).toFixed(2)}`);

      } catch (itemError) {
        console.error(`Error processing item ${item.name}:`, itemError.message);
        return createErrorResponse(400, `Error processing item: ${item.name}`, {
          details: itemError.message
        });
      }
    }

    if (processedItems.length === 0) {
      return createErrorResponse(400, 'No valid menu items found in order');
    }

    // Calculate tax (8.75% like in cart.js)
    const taxRate = 0.0875;
    const subtotal = totalAmount;
    const taxAmount = Math.round(subtotal * taxRate);
    const finalTotal = subtotal + taxAmount;

    // Build order summary
    const orderSummary = {
      items: processedItems,
      subtotal: subtotal,
      taxAmount: taxAmount,
      taxRate: taxRate,
      total: finalTotal,
      itemCount: processedItems.reduce((sum, item) => sum + item.quantity, 0),
      customerInfo: requestBody.customerInfo || null,
      createdAt: new Date().toISOString()
    };

    console.log(`📊 Order Summary: ${processedItems.length} items, $${(finalTotal/100).toFixed(2)} total`);

    return createSuccessResponse({
      success: true,
      message: 'Order processed successfully with Square menu data',
      orderSummary: orderSummary,
      // Include Square-ready line items for payment link creation
      squareLineItems: processedItems.map(item => ({
        name: `${item.name} - ${item.variation}`,
        quantity: item.quantity.toString(),
        itemType: 'ITEM_VARIATION',
        variationName: item.variation,
        catalogObjectId: item.square_variation_id,
        basePriceMoney: {
          amount: item.unitPrice,
          currency: 'USD'
        },
        note: item.specialInstructions || undefined
      }))
    });

  } catch (error) {
    console.error('Error processing order:', error.message);
    return createErrorResponse(500, 'Internal server error', { 
      details: error.message 
    });
  }
};

// Helper function to get menu item from DynamoDB
async function getMenuItemFromDynamoDB(itemName, variation = 'Regular') {
  const params = {
    TableName: REDBIRD_MENU_TABLE,
    Key: {
      item_name: itemName,
      variation: variation
    }
  };

  try {
    const result = await dynamodb.get(params).promise();
    return result.Item || null;
  } catch (error) {
    console.error(`Error querying menu item ${itemName} - ${variation}:`, error.message);
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