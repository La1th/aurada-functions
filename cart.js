const AWS = require('aws-sdk');

// Configure AWS region (Lambda uses IAM role for credentials)
AWS.config.update({ 
  region: process.env.AWS_REGION || 'us-east-1'
});
const dynamodb = new AWS.DynamoDB.DocumentClient();

const REDBIRD_MENU_TABLE = 'redbird-menu';

// Default tax rate (8.75% - adjust for your location)
const DEFAULT_TAX_RATE = 0.0875;

// Add item to cart
module.exports.addToCart = async (event) => {
  console.log('Adding item to cart...');
  
  try {
    // Parse the request body
    let body;
    if (typeof event.body === 'string') {
      body = JSON.parse(event.body);
    } else {
      body = event.body;
    }

    // Extract data - handle both direct format and Retell's nested format
    let currentCart, itemName, quantity, specialInstructions;
    
    if (body.args) {
      // Retell format: data is nested in 'args' object
      currentCart = body.args.currentCart || [];
      itemName = body.args.itemName;
      quantity = body.args.quantity || 1;
      specialInstructions = body.args.specialInstructions || '';
      console.log('Using Retell format - args:', body.args);
    } else {
      // Direct format: data is at root level
      currentCart = body.currentCart || [];
      itemName = body.itemName;
      quantity = body.quantity || 1;
      specialInstructions = body.specialInstructions || '';
      console.log('Using direct format');
    }

    console.log('Add to cart request:', { itemName, quantity, specialInstructions });

    // Validate inputs
    if (!itemName) {
      return createErrorResponse(400, 'Missing required field: itemName');
    }

    if (quantity <= 0 || !Number.isInteger(quantity)) {
      return createErrorResponse(400, 'Quantity must be a positive integer');
    }

    // Find item in menu (flexible matching)
    const menuItem = await findMenuItem(itemName);
    if (!menuItem) {
      const suggestions = await getSimilarItems(itemName);
      return createErrorResponse(404, `Item "${itemName}" not found on menu`, { suggestions });
    }

    // Create cart item using DynamoDB data directly (ready for Square)
    const cartItem = {
      // Keep original DynamoDB fields for Square compatibility
      item_name: menuItem.item_name,
      variation: menuItem.variation,
      price_money: menuItem.price_money,
      square_item_id: menuItem.square_item_id,
      square_variation_id: menuItem.square_variation_id,
      description: menuItem.description,
      category_id: menuItem.category_id,
      
      // Add cart-specific fields
      quantity: quantity,
      specialInstructions: specialInstructions,
      unitPrice: parseInt(menuItem.price_money.amount) / 100, // For display purposes
      lineTotal: (parseInt(menuItem.price_money.amount) / 100) * quantity,
      
      // For backward compatibility with existing code
      itemId: menuItem.square_variation_id,
      name: `${menuItem.item_name} - ${menuItem.variation}`
    };

    // Check if item already exists in cart (same item + instructions)
    const updatedCart = [...currentCart];
    const existingIndex = updatedCart.findIndex(item => 
      item.itemId === cartItem.itemId && 
      item.specialInstructions === cartItem.specialInstructions
    );

    if (existingIndex >= 0) {
      // Update existing item
      updatedCart[existingIndex].quantity += quantity;
      updatedCart[existingIndex].lineTotal = updatedCart[existingIndex].unitPrice * updatedCart[existingIndex].quantity;
    } else {
      // Add new item
      updatedCart.push(cartItem);
    }

    // Calculate totals
    const cartSummary = calculateCartTotals(updatedCart);

    console.log('Item added successfully:', cartItem);

    return createSuccessResponse({
      message: `Added ${quantity} ${cartItem.name} to cart`,
      updatedCart: updatedCart,
      cartSummary: cartSummary
    });

  } catch (error) {
    console.error('Error adding to cart:', error);
    return createErrorResponse(500, 'Internal server error', { details: error.message });
  }
};

// Remove item from cart
module.exports.removeFromCart = async (event) => {
  console.log('Removing item from cart...');
  
  try {
    // Parse the request body
    let body;
    if (typeof event.body === 'string') {
      body = JSON.parse(event.body);
    } else {
      body = event.body;
    }

    // Extract data - handle both direct format and Retell's nested format
    let currentCart, itemName, quantityToRemove;
    
    if (body.args) {
      // Retell format: data is nested in 'args' object
      currentCart = body.args.currentCart || [];
      itemName = body.args.itemName;
      quantityToRemove = body.args.quantityToRemove;
      console.log('Using Retell format - args:', body.args);
    } else {
      // Direct format: data is at root level
      currentCart = body.currentCart || [];
      itemName = body.itemName;
      quantityToRemove = body.quantityToRemove;
      console.log('Using direct format');
    }

    console.log('Remove from cart request:', { itemName, quantityToRemove });

    // Validate inputs
    if (!itemName) {
      return createErrorResponse(400, 'Missing required field: itemName');
    }

    if (!currentCart.length) {
      return createErrorResponse(400, 'Cart is empty');
    }

    // Find item in cart (flexible matching)
    const cartIndex = currentCart.findIndex(item => 
      item.name.toLowerCase().includes(itemName.toLowerCase()) ||
      itemName.toLowerCase().includes(item.name.toLowerCase())
    );

    if (cartIndex === -1) {
      const cartItemNames = currentCart.map(item => item.name);
      return createErrorResponse(404, `Item "${itemName}" not found in cart`, { currentItems: cartItemNames });
    }

    const updatedCart = [...currentCart];
    const cartItem = updatedCart[cartIndex];

    // Determine how much to remove
    const removeQty = quantityToRemove || cartItem.quantity; // Remove all if not specified

    if (removeQty >= cartItem.quantity) {
      // Remove entire item
      updatedCart.splice(cartIndex, 1);
    } else {
      // Reduce quantity
      updatedCart[cartIndex].quantity -= removeQty;
      updatedCart[cartIndex].lineTotal = updatedCart[cartIndex].unitPrice * updatedCart[cartIndex].quantity;
    }

    // Calculate totals
    const cartSummary = calculateCartTotals(updatedCart);

    console.log('Item removed successfully');

    return createSuccessResponse({
      message: `Removed ${removeQty} ${cartItem.name} from cart`,
      updatedCart: updatedCart,
      cartSummary: cartSummary
    });

  } catch (error) {
    console.error('Error removing from cart:', error);
    return createErrorResponse(500, 'Internal server error', { details: error.message });
  }
};

// Get cart summary with totals
module.exports.getCartSummary = async (event) => {
  console.log('Getting cart summary...');
  
  try {
    // Parse the request body
    let body;
    if (typeof event.body === 'string') {
      body = JSON.parse(event.body);
    } else {
      body = event.body;
    }

    // Extract data - handle both direct format and Retell's nested format
    let currentCart, taxRate;
    
    if (body.args) {
      // Retell format: data is nested in 'args' object
      currentCart = body.args.currentCart || [];
      taxRate = body.args.taxRate || DEFAULT_TAX_RATE;
      console.log('Using Retell format - args:', body.args);
    } else {
      // Direct format: data is at root level
      currentCart = body.currentCart || [];
      taxRate = body.taxRate || DEFAULT_TAX_RATE;
      console.log('Using direct format');
    }

    if (!currentCart.length) {
      return createSuccessResponse({
        message: 'Cart is empty',
        updatedCart: [],
        cartSummary: {
          items: [],
          itemCount: 0,
          subtotal: 0,
          message: 'Tax will be calculated by Square at checkout'
        }
      });
    }

    // Calculate totals
    const cartSummary = calculateCartTotals(currentCart);

    // Create readable summary for AI
    const readableSummary = createReadableSummary(currentCart, cartSummary);

    console.log('Cart summary generated');

    return createSuccessResponse({
      message: readableSummary,
      updatedCart: currentCart,
      cartSummary: cartSummary
    });

  } catch (error) {
    console.error('Error getting cart summary:', error);
    return createErrorResponse(500, 'Internal server error', { details: error.message });
  }
};

// Helper function to find menu item by name in DynamoDB (flexible matching)
async function findMenuItem(itemName) {
  try {
    console.log(`Searching for menu item: ${itemName}`);
    
    // First, try exact match by item name
    const exactParams = {
      TableName: REDBIRD_MENU_TABLE,
      KeyConditionExpression: 'item_name = :itemName',
      ExpressionAttributeValues: {
        ':itemName': itemName
      }
    };
    
    let result = await dynamodb.query(exactParams).promise();
    
    if (result.Items && result.Items.length > 0) {
      // Found exact match, return the raw DynamoDB item
      const item = result.Items[0];
      return item; // Return the complete DynamoDB record
    }
    
    // If no exact match, scan for partial matches
    console.log(`No exact match found, searching for partial matches...`);
    
    const scanParams = {
      TableName: REDBIRD_MENU_TABLE
    };
    
    result = await dynamodb.scan(scanParams).promise();
    
    if (!result.Items || result.Items.length === 0) {
      console.log('No items found in menu table');
      return null;
    }
    
    const searchName = itemName.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Try partial matching
    for (const item of result.Items) {
      const menuName = item.item_name.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      if (menuName.includes(searchName) || searchName.includes(menuName)) {
        return item; // Return the complete DynamoDB record
      }
    }
    
    // Special cases for common variations
    const specialCases = {
      'fries': 'Regular Fries',
      'coke': 'Soda',
      'cola': 'Soda',
      'drink': 'Soda',
      'water': 'Bottled Water',
      'sandwich': 'Single Sandwich',
      'nugget': '10pc Nuggets',
      'tender': 'Single Tender',
      'bowl': 'Chicken Rice Bowl',
      'rice': 'Chicken Rice Bowl',
      'mac': 'Mac & Cheese',
      'cheese': 'Cheese Fries',
      'cake': 'Toffee Cake',
      'dessert': 'Toffee Cake'
    };
    
    for (const [variation, menuItemName] of Object.entries(specialCases)) {
      if (searchName.includes(variation) || variation.includes(searchName)) {
        // Try to find this item
        const specialParams = {
          TableName: REDBIRD_MENU_TABLE,
          KeyConditionExpression: 'item_name = :itemName',
          ExpressionAttributeValues: {
            ':itemName': menuItemName
          }
        };
        
        const specialResult = await dynamodb.query(specialParams).promise();
        if (specialResult.Items && specialResult.Items.length > 0) {
          const item = specialResult.Items[0];
          return item;
        }
      }
    }
    
    console.log(`No menu item found for: ${itemName}`);
    return null;
    
  } catch (error) {
    console.error('Error finding menu item:', error);
    throw error;
  }
}

// Helper function to get similar items for suggestions from DynamoDB
async function getSimilarItems(itemName) {
  try {
    const searchName = itemName.toLowerCase();
    const suggestions = [];
    
    // Get all menu items from DynamoDB
    const params = {
      TableName: REDBIRD_MENU_TABLE
    };
    
    const result = await dynamodb.scan(params).promise();
    
    if (result.Items && result.Items.length > 0) {
      for (const item of result.Items) {
        const itemNameLower = item.item_name.toLowerCase();
        const words = searchName.split(/\s+/);
        
        // Check if any word from the search matches any word in the item name
        const hasMatch = words.some(word => 
          itemNameLower.includes(word) || word.includes(itemNameLower.split(' ')[0])
        );
        
        if (hasMatch && !suggestions.includes(item.item_name)) {
          suggestions.push(item.item_name);
        }
      }
    }
    
    // If no matches, return some popular items
    if (suggestions.length === 0) {
      suggestions.push('Single Sandwich', 'Chicken Rice Bowl', '10pc Nuggets');
    }
    
    return suggestions.slice(0, 3); // Return top 3 suggestions
    
  } catch (error) {
    console.error('Error getting similar items:', error);
    return ['Single Sandwich', 'Soda', 'Regular Fries']; // Fallback suggestions
  }
}

// Helper function to calculate cart totals (Square handles tax)
function calculateCartTotals(cartItems, taxRate = null) {
  const subtotal = cartItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return {
    items: cartItems,
    itemCount: itemCount,
    subtotal: Math.round(subtotal * 100) / 100,
    // Remove tax calculation - Square handles this automatically
    message: 'Tax will be calculated by Square at checkout'
  };
}

// Helper function to create readable summary for AI
function createReadableSummary(cartItems, cartSummary) {
  if (!cartItems.length) {
    return 'Your cart is empty.';
  }

  let summary = `Your order: `;
  cartItems.forEach((item, index) => {
    summary += `${item.quantity} ${item.name}`;
    if (item.specialInstructions) {
      summary += ` (${item.specialInstructions})`;
    }
    if (index < cartItems.length - 1) {
      summary += ', ';
    }
  });

  summary += `. Subtotal: $${cartSummary.subtotal}. Tax will be calculated by Square at checkout.`;
  
  return summary;
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
    body: JSON.stringify(data)
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