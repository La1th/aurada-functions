const AWS = require('aws-sdk');

// Configure AWS region (Lambda uses IAM role for credentials)
AWS.config.update({ 
  region: process.env.AWS_REGION || 'us-east-1'
});
const dynamodb = new AWS.DynamoDB.DocumentClient();

const SESSION_CARTS_TABLE = 'session-carts';
const PHONE_NUMBER_CLIENT_MAP_TABLE = 'phoneNumberClientMap';
const CLIENT_MENU_TABLE = 'clientMenu';

// Session cart helper functions
function extractCallId(body) {
  return body.call?.call_id;
}

function extractPhoneNumber(body) {
  // Extract the restaurant phone number (the number customer called)
  return body.call?.to_number;
}

async function getLocationFromPhoneNumber(phoneNumber) {
  if (!phoneNumber) {
    throw new Error('Phone number is required for location lookup');
  }

  const params = {
    TableName: PHONE_NUMBER_CLIENT_MAP_TABLE,
    Key: { phoneNumber: phoneNumber }
  };

  try {
    console.log(`Looking up location for phone number: ${phoneNumber}`);
    const result = await dynamodb.get(params).promise();
    
    if (!result.Item) {
      throw new Error(`No location found for phone number: ${phoneNumber}`);
    }

    console.log(`Found location: ${result.Item.restaurantName} - ${result.Item.locationId}`);
    return {
      locationId: result.Item.locationId,
      restaurantName: result.Item.restaurantName
    };
  } catch (error) {
    console.error('Error looking up location:', error);
    throw error;
  }
}

async function getLocationMenu(restaurantName, locationId) {
  if (!restaurantName || !locationId) {
    throw new Error('Restaurant name and location ID are required');
  }

  const params = {
    TableName: CLIENT_MENU_TABLE,
    Key: { 
      restaurantName: restaurantName,
      locationID: locationId 
    }
  };

  try {
    console.log(`Getting menu for: ${restaurantName} at location: ${locationId}`);
    const result = await dynamodb.get(params).promise();
    
    if (!result.Item) {
      throw new Error(`No menu found for ${restaurantName} at location ${locationId}`);
    }

    console.log(`Found menu with ${result.Item.itemCount || 'unknown'} items`);
    return result.Item;
  } catch (error) {
    console.error('Error getting location menu:', error);
    throw error;
  }
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

async function saveSessionCart(callId, cartItems) {
  if (!callId) {
    throw new Error('Call ID required for session cart');
  }
  
  const params = {
    TableName: SESSION_CARTS_TABLE,
    Item: {
      call_id: callId,
      cart_items: cartItems,
      updated_at: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + (2 * 60 * 60) // 2 hours
    }
  };
  
  try {
    await dynamodb.put(params).promise();
    console.log(`Session cart saved for call: ${callId}`);
  } catch (error) {
    console.error('Error saving session cart:', error);
    throw error;
  }
}

// Helper function to convert technical modifier names to natural speech
function convertModifierToSpeech(modifierName) {
  // Spice levels
  if (modifierName === 'Original') return 'original';
  if (modifierName === 'Mild') return 'mild';
  if (modifierName === 'Medium') return 'medium';
  if (modifierName === 'Hot') return 'hot';
  if (modifierName === 'Extra Hot') return 'extra hot';
  if (modifierName === 'FCK YOU CRA') return 'f you cray';
  
  // Add/Remove modifiers (remove piece numbers)
  if (modifierName.includes('Add cheese')) return 'with cheese';
  if (modifierName.includes('No cheese')) return 'no cheese';
  if (modifierName.includes('No Pickles')) return 'no pickles';
  if (modifierName.includes('No Slaw')) return 'no slaw';
  if (modifierName.includes('No Big Bird Sauce')) return 'no sauce';
  if (modifierName === 'Add tender') return 'with extra tender';
  
  // Side options
  if (modifierName === 'Pickles on the side') return 'pickles on the side';
  if (modifierName === 'Slaw on the side') return 'slaw on the side';
  if (modifierName === 'Chicken & Bun Only') return 'chicken and bun only';
  
  // Substitutions
  if (modifierName === 'Substitute fries with mac & cheese') return 'substitute fries with mac and cheese';
  if (modifierName === 'Substitute fries with slaw') return 'substitute fries with slaw';
  if (modifierName.includes('Substitute Slaw with Lettuce')) return 'substitute slaw with lettuce';
  
  // Default: return cleaned up version
  return modifierName.toLowerCase().replace(/\d+$/, '').trim();
}

// Helper function to group modifiers by piece and create speech descriptions
function createModifierDescription(modifiers) {
  if (!modifiers || modifiers.length === 0) {
    return '';
  }
  
  // Group modifiers by piece number
  const piece1Modifiers = [];
  const piece2Modifiers = [];
  const wholeItemModifiers = [];
  
  modifiers.forEach(modifier => {
    const speechText = convertModifierToSpeech(modifier.optionName);
    
    // Extract piece number from modifier name
    if (modifier.optionName.endsWith(' 1')) {
      piece1Modifiers.push(speechText);
    } else if (modifier.optionName.endsWith(' 2')) {
      piece2Modifiers.push(speechText);
    } else {
      wholeItemModifiers.push(speechText);
    }
  });
  
  const descriptions = [];
  
  // Add piece-specific descriptions
  if (piece1Modifiers.length > 0) {
    descriptions.push(`first sandwich ${piece1Modifiers.join(' ')}`);
  }
  
  if (piece2Modifiers.length > 0) {
    descriptions.push(`second sandwich ${piece2Modifiers.join(' ')}`);
  }
  
  // Add whole-item descriptions
  if (wholeItemModifiers.length > 0) {
    descriptions.push(...wholeItemModifiers);
  }
  
  return descriptions.length > 0 ? ` - ${descriptions.join(', ')}` : '';
}

function createSpeechFriendlySummary(sessionCart, subtotal) {
  if (!sessionCart || sessionCart.length === 0) {
    return "Your cart is empty.";
  }

  // Create speech-friendly item descriptions with modifiers
  const speechItems = sessionCart.map(item => {
    let itemName = item.item_name || item.name || 'Unknown Item';
    
    // Apply speech transformations
    itemName = itemName.replace(/(\d+)pc\b/g, '$1 piece'); // 2pc -> 2 piece
    itemName = itemName.replace(/\bw\//g, 'with'); // w/ -> with
    itemName = itemName.replace(/FCK YOU CRA/g, 'F You Cray'); // FCK YOU CRA -> F You Cray
    
    const quantity = item.quantity || 1;
    
    // Add modifier description
    const modifierDescription = createModifierDescription(item.modifiers);
    
    return `${quantity} ${itemName}${modifierDescription}`;
  });

  // Create the summary message
  const itemsText = speechItems.join(', ');
  const formattedSubtotal = (subtotal || 0).toFixed(2);
  
  return `${itemsText}. Your total is $${formattedSubtotal} plus tax`;
}

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

    // Extract call ID and item data
    const callId = extractCallId(body);
    if (!callId) {
      return createErrorResponse(400, 'Missing call ID in request');
    }

    // Extract phone number from Retell payload
    const phoneNumber = extractPhoneNumber(body);
    if (!phoneNumber) {
      return createErrorResponse(400, 'Missing phone number in request - cannot determine location');
    }

    // Extract item data from args (preserve original order payload)
    const itemName = body.args?.itemName;
    const quantity = body.args?.quantity || 1;
    const specialInstructions = body.args?.specialInstructions || '';

    console.log(`Adding to cart for call ${callId}:`, { 
      phoneNumber, 
      itemName, 
      quantity, 
      specialInstructions 
    });

    // Validate inputs
    if (!itemName) {
      return createErrorResponse(400, 'Missing required field: itemName');
    }

    if (quantity <= 0 || !Number.isInteger(quantity)) {
      return createErrorResponse(400, 'Quantity must be a positive integer');
    }

    // Step 1: Get location from phone number
    let locationData;
    try {
      locationData = await getLocationFromPhoneNumber(phoneNumber);
    } catch (error) {
      return createErrorResponse(404, `Location lookup failed: ${error.message}`);
    }

    // Step 2: Get location-specific menu
    let locationMenu;
    try {
      locationMenu = await getLocationMenu(locationData.restaurantName, locationData.locationId);
    } catch (error) {
      return createErrorResponse(404, `Menu lookup failed: ${error.message}`);
    }

    // Step 3: Find item in location menu
    const menuItem = findMenuItemInLocationMenu(itemName, locationMenu);
    if (!menuItem) {
      return createErrorResponse(404, `Item "${itemName}" not found in ${locationData.restaurantName} ${locationData.locationId} menu`);
    }

    // Get existing session cart
    const sessionCart = await getSessionCart(callId);

    // Create cart item with full DynamoDB data
    const cartItem = {
      // Keep original DynamoDB fields for Square compatibility
      item_name: menuItem.item_name,
      price_money: menuItem.price_money,
      square_item_id: menuItem.square_item_id,
      square_variation_id: menuItem.square_variation_id,
      description: menuItem.description,
      category_id: menuItem.category_id,
      
      // Add cart-specific fields
      quantity: quantity,
      specialInstructions: specialInstructions,
      unitPrice: parseInt(menuItem.price_money.amount) / 100,
      lineTotal: (parseInt(menuItem.price_money.amount) / 100) * quantity,
      
      // For backward compatibility
      itemId: menuItem.square_variation_id,
      name: menuItem.item_name
    };

    // Check if item already exists in cart (same item + instructions)
    const existingIndex = sessionCart.findIndex(item => 
      item.itemId === cartItem.itemId && 
      item.specialInstructions === cartItem.specialInstructions
    );

    if (existingIndex >= 0) {
      // Update existing item
      sessionCart[existingIndex].quantity += quantity;
      sessionCart[existingIndex].lineTotal = sessionCart[existingIndex].unitPrice * sessionCart[existingIndex].quantity;
    } else {
      // Add new item
      sessionCart.push(cartItem);
    }

    // Save updated cart to session
    await saveSessionCart(callId, sessionCart);

    console.log('Item added successfully to session cart');

    return createSuccessResponse({
      message: `Added ${quantity} ${menuItem.item_name} to cart for ${locationData.restaurantName} ${locationData.locationId}`
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

    // Extract call ID and item data
    const callId = extractCallId(body);
    if (!callId) {
      return createErrorResponse(400, 'Missing call ID in request');
    }

    const itemName = body.args?.itemName;
    const quantityToRemove = body.args?.quantityToRemove;

    console.log(`Removing from cart for call ${callId}:`, { itemName, quantityToRemove });

    // Validate inputs
    if (!itemName) {
      return createErrorResponse(400, 'Missing required field: itemName');
    }

    // Get session cart
    const sessionCart = await getSessionCart(callId);

    if (!sessionCart.length) {
      return createErrorResponse(400, 'Cart is empty');
    }

    // Find item in cart (flexible matching)
    const cartIndex = sessionCart.findIndex(item => 
      item.name.toLowerCase().includes(itemName.toLowerCase()) ||
      itemName.toLowerCase().includes(item.name.toLowerCase())
    );

    if (cartIndex === -1) {
      const cartItemNames = sessionCart.map(item => item.name);
      return createErrorResponse(404, `Item "${itemName}" not found in cart`, { currentItems: cartItemNames });
    }

    const cartItem = sessionCart[cartIndex];
    const removeQty = quantityToRemove || cartItem.quantity; // Remove all if not specified

    if (removeQty >= cartItem.quantity) {
      // Remove entire item
      sessionCart.splice(cartIndex, 1);
    } else {
      // Reduce quantity
      sessionCart[cartIndex].quantity -= removeQty;
      sessionCart[cartIndex].lineTotal = sessionCart[cartIndex].unitPrice * sessionCart[cartIndex].quantity;
    }

    // Save updated cart to session
    await saveSessionCart(callId, sessionCart);

    console.log('Item removed successfully from session cart');

    return createSuccessResponse({
      message: `Removed ${removeQty} ${cartItem.name} from cart`
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

    // Extract call ID
    const callId = extractCallId(body);
    if (!callId) {
      return createErrorResponse(400, 'Missing call ID in request');
    }

    console.log(`Getting cart summary for call: ${callId}`);

    // Get session cart
    const sessionCart = await getSessionCart(callId);

    if (!sessionCart.length) {
      return createSuccessResponse({
        message: 'Your cart is empty'
      });
    }

    // Calculate totals
    const subtotal = sessionCart.reduce((sum, item) => sum + item.lineTotal, 0);
    const itemCount = sessionCart.reduce((sum, item) => sum + item.quantity, 0);

    // Create speech-friendly summary
    const speechSummary = createSpeechFriendlySummary(sessionCart, subtotal);

    console.log('Cart summary generated for session cart');

    return createSuccessResponse({
      message: speechSummary
    });

  } catch (error) {
    console.error('Error getting cart summary:', error);
    return createErrorResponse(500, 'Internal server error', { details: error.message });
  }
};

// Generate upsell suggestions based on current cart
module.exports.upsell = async (event) => {
  console.log('Generating upsell suggestions...');
  
  try {
    // Parse the request body
    let body;
    if (typeof event.body === 'string') {
      body = JSON.parse(event.body);
    } else {
      body = event.body;
    }

    // Extract call ID
    const callId = extractCallId(body);
    if (!callId) {
      return createErrorResponse(400, 'Missing call ID in request');
    }

    console.log(`Generating upsells for call: ${callId}`);

    // Get session cart
    const sessionCart = await getSessionCart(callId);

    // Check what's already in cart
    const cartItemNames = sessionCart.map(item => (item.item_name || item.name || '').toLowerCase());
    
    // Check for items in cart
    const hasFries = cartItemNames.some(item => item.includes('fries'));
    const hasMac = cartItemNames.some(item => item.includes('mac'));
    const hasSlaw = cartItemNames.some(item => item.includes('slaw'));
    const hasToffee = cartItemNames.some(item => item.includes('toffee'));

    // Start with base sentence and remove parts
    let message = "Before I confirm, would you like to add ";
    let parts = [];
    
    // Add fries if not in cart
    if (!hasFries) {
      parts.push("regular fries, cheese fries");
    }
    
    // Add mac & cheese if not in cart
    if (!hasMac) {
      parts.push("mac & cheese");
    }
    
    // Add slaw if not in cart
    if (!hasSlaw) {
      parts.push("slaw");
    }
    
    // Add dessert part if toffee cake not in cart
    let dessertPart = "";
    if (!hasToffee) {
      dessertPart = ", we also have toffee cake for dessert";
    }
    
    // Build final message
    if (parts.length === 0) {
      message = "";
    } else if (parts.length === 1) {
      message += parts[0] + dessertPart + "?";
    } else {
      // Join with commas and add "or" before the last item
      const lastItem = parts.pop();
      message += parts.join(", ") + ", or " + lastItem + dessertPart + "?";
    }

    console.log('Upsell suggestions generated');

    return createSuccessResponse({
      message: message
    });

  } catch (error) {
    console.error('Error generating upsell suggestions:', error);
    return createErrorResponse(500, 'Internal server error', { details: error.message });
  }
};

// Add modifier to cart
module.exports.addModifierToCart = async (event) => {
  console.log('Adding modifier to cart...');
  
  try {
    // Parse the request body
    let body;
    if (typeof event.body === 'string') {
      body = JSON.parse(event.body);
    } else {
      body = event.body;
    }

    // Extract call ID
    const callId = extractCallId(body);
    if (!callId) {
      return createErrorResponse(400, 'Missing call ID in request');
    }

    // Extract phone number from Retell payload
    const phoneNumber = extractPhoneNumber(body);
    if (!phoneNumber) {
      return createErrorResponse(400, 'Missing phone number in request - cannot determine location');
    }

    // Extract modifier data from args
    const itemName = body.args?.itemName;
    const modification = body.args?.modification;

    console.log(`Adding modifier for call ${callId}:`, { 
      phoneNumber, 
      itemName, 
      modification
    });

    // Validate inputs
    if (!itemName) {
      return createErrorResponse(400, 'Missing required field: itemName');
    }

    if (!modification) {
      return createErrorResponse(400, 'Missing required field: modification');
    }

    // Step 1: Get location from phone number
    let locationData;
    try {
      locationData = await getLocationFromPhoneNumber(phoneNumber);
    } catch (error) {
      return createErrorResponse(404, `Location lookup failed: ${error.message}`);
    }

    // Step 2: Get location-specific menu
    let locationMenu;
    try {
      locationMenu = await getLocationMenu(locationData.restaurantName, locationData.locationId);
    } catch (error) {
      return createErrorResponse(404, `Menu lookup failed: ${error.message}`);
    }

    // Step 3: Find item in location menu
    const menuItem = findMenuItemInLocationMenu(itemName, locationMenu);
    if (!menuItem) {
      return createErrorResponse(404, `Item "${itemName}" not found in ${locationData.restaurantName} menu`);
    }

    // Step 4: Get raw menu item data for modifier access
    const metadataFields = ['restaurantName', 'locationID', 'locationName', 'lastUpdated', 'itemCount'];
    let rawMenuItemData = null;
    
    for (const [menuItemName, menuItemData] of Object.entries(locationMenu)) {
      if (metadataFields.includes(menuItemName)) continue;
      
      if (menuItemName.toLowerCase().trim() === itemName.toLowerCase().trim()) {
        rawMenuItemData = menuItemData;
        break;
      }
    }

    if (!rawMenuItemData) {
      return createErrorResponse(404, `Raw menu data not found for "${itemName}"`);
    }

    // Step 5: Validate modification exists in item's modifiers
    let modifierFound = false;
    let modifierDetails = null;

    // Create list of modifiers to try
    const modifiersToTry = [modification]; // Start with exact match

    // If modification ends with " 1" or " 2", also try the base version
    if (modification.endsWith(' 1') || modification.endsWith(' 2')) {
      const baseModification = modification.slice(0, -2); // Remove " 1" or " 2"
      modifiersToTry.push(baseModification);
    }

    if (rawMenuItemData.modifiers && Object.keys(rawMenuItemData.modifiers).length > 0) {
      // Search through all modifier lists for this item
      for (const [modifierListId, modifierList] of Object.entries(rawMenuItemData.modifiers)) {
        if (!modifierList.options) continue;

        // Try each modifier variation
        for (const modToTry of modifiersToTry) {
          const option = modifierList.options.find(opt => opt.name === modToTry);
          
          if (option) {
            modifierFound = true;
            modifierDetails = {
              modifierListId: modifierListId,
              modifierListName: modifierList.name,
              optionId: option.id,
              optionName: option.name,
              price: option.price || 0,
              currency: option.currency || 'USD'
            };
            console.log(`Modifier matched: requested "${modification}", found "${option.name}"${modToTry !== modification ? ' (fallback)' : ''}`);
            break; // Exit inner loop
          }
        }
        
        if (modifierFound) break; // Exit outer loop if found
      }
    }

    if (!modifierFound) {
      return createErrorResponse(404, `Modifier "${modification}" not available for "${itemName}"`);
    }

    // Step 6: Get session cart and find most recent matching item
    const sessionCart = await getSessionCart(callId);
    
    // Find the most recent cart item with matching name (reverse search)
    let targetCartItemIndex = -1;
    for (let i = sessionCart.length - 1; i >= 0; i--) {
      if (sessionCart[i].item_name === itemName || sessionCart[i].name === itemName) {
        targetCartItemIndex = i;
        break;
      }
    }

    if (targetCartItemIndex === -1) {
      return createErrorResponse(404, `No "${itemName}" found in cart to modify. Add the item first.`);
    }

    // Step 7: Add modifier to cart item
    const cartItem = sessionCart[targetCartItemIndex];
    
    // Initialize modifiers array if it doesn't exist
    if (!cartItem.modifiers) {
      cartItem.modifiers = [];
    }

    // Check if this modifier already exists (prevent duplicates)
    const existingModifier = cartItem.modifiers.find(mod => 
      mod.optionId === modifierDetails.optionId
    );
    
    if (existingModifier) {
      return createErrorResponse(400, `Modifier "${modifierDetails.optionName}" already applied to this item`);
    }

    // Add the new modifier
    const newModifier = {
      modifierListId: modifierDetails.modifierListId,
      modifierListName: modifierDetails.modifierListName,
      optionId: modifierDetails.optionId,
      optionName: modifierDetails.optionName,
      price: modifierDetails.price / 100, // Convert cents to dollars
      currency: modifierDetails.currency
    };

    cartItem.modifiers.push(newModifier);

    // Step 8: Recalculate total price
    const modifierTotal = cartItem.modifiers.reduce((sum, mod) => sum + (mod.price || 0), 0);
    cartItem.lineTotal = (cartItem.unitPrice + modifierTotal) * cartItem.quantity;

    // Step 9: Save updated cart
    await saveSessionCart(callId, sessionCart);

    console.log('Modifier added successfully to cart item');

    return createSuccessResponse({
      message: `Added "${modifierDetails.optionName}" to ${itemName}`,
      modifierAdded: {
        name: modifierDetails.optionName,
        price: newModifier.price
      },
      newItemTotal: cartItem.lineTotal
    });

  } catch (error) {
    console.error('Error adding modifier to cart:', error);
    return createErrorResponse(500, 'Internal server error', { details: error.message });
  }
};

// Helper function to find menu item by name in location menu object (exact matching only)
function findMenuItemInLocationMenu(itemName, locationMenu) {
  try {
    console.log(`Searching for item "${itemName}" in location menu`);
    
    // Normalize search term
    const normalizedSearch = itemName.toLowerCase().trim();
    
    // Search through all menu items (excluding metadata fields)
    const metadataFields = ['restaurantName', 'locationID', 'locationName', 'lastUpdated', 'itemCount'];
    
    for (const [menuItemName, menuItemData] of Object.entries(locationMenu)) {
      // Skip metadata fields
      if (metadataFields.includes(menuItemName)) {
        continue;
      }
      
      // Normalize menu item name
      const normalizedMenuName = menuItemName.toLowerCase().trim();
      
      // Check for exact match
      if (normalizedMenuName === normalizedSearch) {
        console.log(`Found exact match: ${menuItemName}`);
        
        // Transform to old format for compatibility
        return {
          item_name: menuItemData.name,
          price_money: {
            amount: menuItemData.price,
            currency: menuItemData.currency
          },
          square_item_id: menuItemData.variations?.[0]?.itemVariationData?.itemId || '',
          square_variation_id: menuItemData.variations?.[0]?.id || '',
          description: menuItemData.description || '',
          category_id: menuItemData.categoryId || ''
        };
      }
    }
    
    // If no exact match, log available items
    console.log(`No exact match found for: ${itemName}`);
    console.log('Available menu items:');
    Object.keys(locationMenu).forEach(key => {
      if (!metadataFields.includes(key)) {
        console.log(`  - ${key}`);
      }
    });
    
    return null;
    
  } catch (error) {
    console.error('Error finding menu item in location menu:', error);
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