const AWS = require('aws-sdk');

// Configure AWS region (Lambda uses IAM role for credentials)
AWS.config.update({ 
  region: process.env.AWS_REGION || 'us-east-1'
});
const dynamodb = new AWS.DynamoDB.DocumentClient();

const PHONE_NUMBER_CLIENT_MAP_TABLE = 'phoneNumberClientMap';
const CLIENT_MENU_TABLE = 'clientMenu';

// Helper function to calculate store status based on current time
function calculateStoreStatus() {
  // Get current time in Eastern Time (assuming Red Bird Chicken is in ET)
  const now = new Date();
  const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
  
  const dayOfWeek = easternTime.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const currentHour = easternTime.getHours();
  const currentMinute = easternTime.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;
  
  // Store hours in minutes from midnight
  const openTime = 11 * 60; // 11:00 AM = 660 minutes
  let closeTime;
  
  if (dayOfWeek === 0) {
    // Sunday: 11:00 AM - 9:00 PM
    closeTime = 21 * 60; // 9:00 PM = 1260 minutes
  } else {
    // Monday-Saturday: 11:00 AM - 10:00 PM  
    closeTime = 22 * 60; // 10:00 PM = 1320 minutes
  }
  
  // Check if current time is within operating hours
  if (currentTimeInMinutes >= openTime && currentTimeInMinutes < closeTime) {
    return "store is open.";
  } else {
    return "store is closed. You cannot order at this time. Please call back when we are open to place an order.";
  }
}

module.exports.handleInboundCall = async (event) => {
  console.log('Handling inbound call webhook...');
  
  try {
    // Parse the request body
    let body;
    if (typeof event.body === 'string') {
      body = JSON.parse(event.body);
    } else {
      body = event.body;
    }

    console.log('Inbound call payload:', JSON.stringify(body, null, 2));

    // Validate that this is a call_inbound event
    if (body.event !== 'call_inbound') {
      console.error('Invalid event type:', body.event);
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({
          error: 'Invalid event type. Expected call_inbound',
          received: body.event
        })
      };
    }

    // Extract the from_number (customer) and to_number (restaurant) from the call_inbound object
    const fromNumber = body.call_inbound?.from_number;
    const toNumber = body.call_inbound?.to_number;
    
    if (!fromNumber) {
      console.error('Missing from_number in call_inbound payload');
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({
          error: 'Missing from_number in call_inbound payload',
          received: body.call_inbound
        })
      };
    }

    if (!toNumber) {
      console.error('Missing to_number in call_inbound payload');
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({
          error: 'Missing to_number in call_inbound payload - cannot determine location',
          received: body.call_inbound
        })
      };
    }

    console.log('Extracted from_number (customer):', fromNumber);
    console.log('Extracted to_number (restaurant):', toNumber);

    // Fetch menu items from DynamoDB
    const menuItemNames = await getLocationSpecificMenuItemNames(toNumber);
    
    // Calculate store status
    const storeStatus = calculateStoreStatus();
    console.log('Store status calculated:', storeStatus);

    // Return the response with caller_number and menu_item_names as dynamic variables
    const response = {
      call_inbound: {
        dynamic_variables: {
          caller_number: fromNumber,
          menu_item_names: menuItemNames.join(', '),
          store_status: storeStatus
        },
        metadata: {
          request_timestamp: new Date().toISOString()
        }
      }
    };

    console.log('Returning response with menu items:', JSON.stringify(response, null, 2));

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('Error handling inbound call:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        details: error.message
      })
    };
  }
}; 

// Helper function to get location-specific menu item names from clientMenu table
async function getLocationSpecificMenuItemNames(restaurantPhone) {
  try {
    console.log(`Fetching location-specific menu for restaurant phone: ${restaurantPhone}`);
    
    // Step 1: Get location from phone number
    const locationParams = {
      TableName: PHONE_NUMBER_CLIENT_MAP_TABLE,
      Key: { phoneNumber: restaurantPhone }
    };
    
    const locationResult = await dynamodb.get(locationParams).promise();
    
    if (!locationResult.Item) {
      throw new Error(`No location found for phone number: ${restaurantPhone}`);
    }
    
    const { locationId, restaurantName } = locationResult.Item;
    console.log(`Found location: ${restaurantName} - ${locationId}`);
    
    // Step 2: Get location-specific menu
    const menuParams = {
      TableName: CLIENT_MENU_TABLE,
      Key: { 
        restaurantName: restaurantName,
        locationID: locationId 
      }
    };
    
    const menuResult = await dynamodb.get(menuParams).promise();
    
    if (!menuResult.Item) {
      throw new Error(`No menu found for ${restaurantName} at location ${locationId}`);
    }
    
    console.log(`Found menu with ${menuResult.Item.itemCount || 'unknown'} items`);
    
    // Step 3: Extract menu item names (skip metadata fields)
    const metadataFields = ['restaurantName', 'locationID', 'locationName', 'lastUpdated', 'itemCount'];
    const menuItemNames = Object.entries(menuResult.Item)
      .filter(([key, value]) => !metadataFields.includes(key))
      .map(([itemName, itemData]) => {
        // Extract price from itemData
        const price = itemData.price || 0;
        const formattedPrice = (price / 100).toFixed(2); // Convert cents to dollars
        return `${itemName} $${formattedPrice}`;
      })
      .sort();
    
    console.log(`Retrieved ${menuItemNames.length} unique menu item names for ${restaurantName}`);
    
    return menuItemNames;
    
  } catch (error) {
    console.error('Error fetching location-specific menu items:', error);
    throw error; // No fallback - force proper setup
  }
} 