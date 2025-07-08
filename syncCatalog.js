require('dotenv').config();
const { SquareClient, SquareEnvironment, SquareError } = require('square');
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

// Initialize Square client
const squareClient = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN,
  environment: process.env.SQUARE_ENVIRONMENT === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox
});

const CATALOG_TABLE_NAME = process.env.CATALOG_TABLE_NAME || 'restaurant-catalog';

module.exports.syncCatalog = async (event) => {
  console.log('Starting catalog sync...');
  
  try {
    // Parse the request body
    let body;
    if (typeof event.body === 'string') {
      body = JSON.parse(event.body);
    } else {
      body = event.body;
    }

    // Extract agent number from request
    const agentNumber = body.agentNumber || body.agent_number || body.restaurantPhone;
    if (!agentNumber) {
      return createErrorResponse(400, 'Missing required field: agentNumber (or agent_number/restaurantPhone)');
    }

    console.log('Syncing catalog for agent:', agentNumber);

    // Fetch all catalog items from Square
    const catalogItems = await fetchAllCatalogItems();
    console.log(`Fetched ${catalogItems.length} catalog items from Square`);

    // Filter for ITEM types and process
    const itemObjects = catalogItems.filter(obj => obj.type === 'ITEM');
    console.log(`Found ${itemObjects.length} ITEM objects`);

    // Store items in DynamoDB
    const storedCount = await storeCatalogItems(agentNumber, itemObjects);

    console.log(`Successfully stored ${storedCount} items for agent ${agentNumber}`);

    return createSuccessResponse({
      success: true,
      message: 'Catalog sync completed successfully',
      agentNumber: agentNumber,
      totalItemsFetched: catalogItems.length,
      itemObjectsFound: itemObjects.length,
      itemsStored: storedCount
    });

  } catch (error) {
    console.error('Error syncing catalog:', error);
    
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

// Function to fetch all catalog items with pagination
async function fetchAllCatalogItems() {
  const allItems = [];
  let cursor = null;
  
  do {
    console.log('Fetching catalog page...');
    
    const request = {
      // Request only ITEM, CATEGORY, MODIFIER_LIST, and related types
      types: 'ITEM,ITEM_VARIATION,CATEGORY,MODIFIER,MODIFIER_LIST,TAX,DISCOUNT'
    };
    
    if (cursor) {
      request.cursor = cursor;
    }
    
    const response = await squareClient.catalog.listCatalog(request);
    
    if (response.result.errors && response.result.errors.length > 0) {
      throw new Error(`Square API errors: ${JSON.stringify(response.result.errors)}`);
    }
    
    const objects = response.result.objects || [];
    allItems.push(...objects);
    
    cursor = response.result.cursor;
    console.log(`Fetched ${objects.length} items, cursor: ${cursor ? 'has more' : 'end'}`);
    
  } while (cursor);
  
  return allItems;
}

// Function to store catalog items in DynamoDB
async function storeCatalogItems(agentNumber, itemObjects) {
  const writePromises = [];
  const timestamp = new Date().toISOString();
  
  for (const item of itemObjects) {
    const itemData = item.itemData;
    if (!itemData || !itemData.name) {
      console.warn('Skipping item without name:', item.id);
      continue;
    }
    
    // Extract relevant item information
    const catalogItem = {
      agent_number: agentNumber,           // Partition Key
      item_name: itemData.name,            // Sort Key
      item_id: item.id,
      category_id: itemData.categoryId || null,
      description: itemData.description || '',
      product_type: itemData.productType || 'REGULAR',
      skip_modifier_screen: itemData.skipModifierScreen || false,
      item_options: itemData.itemOptions || [],
      modifiers: itemData.modifierListInfo || [],
      variations: [],
      available_online: itemData.availableOnline !== false, // Default true
      available_for_pickup: itemData.availableForPickup !== false, // Default true
      is_deleted: item.isDeleted || false,
      present_at_all_locations: item.presentAtAllLocations || false,
      present_at_location_ids: item.presentAtLocationIds || [],
      updated_at: item.updatedAt || timestamp,
      created_at: item.createdAt || timestamp,
      version: item.version || 1,
      synced_at: timestamp
    };
    
    // Process variations if they exist
    if (itemData.variations && itemData.variations.length > 0) {
      catalogItem.variations = itemData.variations.map(variation => {
        const variationData = variation.itemVariationData;
        return {
          id: variation.id,
          name: variationData?.name || itemData.name,
          sku: variationData?.sku || '',
          ordinal: variationData?.ordinal || 0,
          pricing_type: variationData?.pricingType || 'FIXED_PRICING',
          price_money: variationData?.priceMoney ? {
            amount: variationData.priceMoney.amount?.toString() || '0',
            currency: variationData.priceMoney.currency || 'USD'
          } : null,
          available_for_booking: variationData?.availableForBooking !== false,
          stockable: variationData?.stockable !== false,
          measurement_unit_id: variationData?.measurementUnitId || null,
          sellable: variationData?.sellable !== false,
          stockable_conversion: variationData?.stockableConversion || null
        };
      });
    }
    
    // Create DynamoDB put request
    const putRequest = {
      TableName: CATALOG_TABLE_NAME,
      Item: catalogItem
    };
    
    writePromises.push(dynamodb.put(putRequest).promise());
  }
  
  // Execute all writes in batches of 25 (DynamoDB limit for batch writes)
  const batchSize = 25;
  let completedWrites = 0;
  
  for (let i = 0; i < writePromises.length; i += batchSize) {
    const batch = writePromises.slice(i, i + batchSize);
    try {
      await Promise.all(batch);
      completedWrites += batch.length;
      console.log(`Completed ${completedWrites}/${writePromises.length} writes`);
    } catch (error) {
      console.error(`Error in batch ${i / batchSize + 1}:`, error);
      // Continue with other batches
    }
  }
  
  return completedWrites;
}

// Function to get catalog for a specific agent (query function)
module.exports.getCatalog = async (event) => {
  console.log('Getting catalog for agent...');
  
  try {
    // Parse the request body or query parameters
    let agentNumber;
    
    if (event.queryStringParameters && event.queryStringParameters.agentNumber) {
      agentNumber = event.queryStringParameters.agentNumber;
    } else if (event.body) {
      const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      agentNumber = body.agentNumber || body.agent_number || body.restaurantPhone;
    }
    
    if (!agentNumber) {
      return createErrorResponse(400, 'Missing required parameter: agentNumber');
    }
    
    console.log('Fetching catalog for agent:', agentNumber);
    
    // Query DynamoDB for all items for this agent
    const params = {
      TableName: CATALOG_TABLE_NAME,
      KeyConditionExpression: 'agent_number = :agentNumber',
      ExpressionAttributeValues: {
        ':agentNumber': agentNumber
      }
    };
    
    const result = await dynamodb.query(params).promise();
    
    console.log(`Found ${result.Items.length} catalog items for agent ${agentNumber}`);
    
    // Group items by category for better organization
    const categorizedItems = groupItemsByCategory(result.Items);
    
    return createSuccessResponse({
      success: true,
      agentNumber: agentNumber,
      totalItems: result.Items.length,
      items: result.Items,
      categorizedItems: categorizedItems,
      lastEvaluatedKey: result.LastEvaluatedKey
    });
    
  } catch (error) {
    console.error('Error getting catalog:', error);
    return createErrorResponse(500, 'Internal server error', { 
      details: error.message 
    });
  }
};

// Helper function to group items by category
function groupItemsByCategory(items) {
  const grouped = {};
  
  for (const item of items) {
    const category = item.category_id || 'uncategorized';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(item);
  }
  
  return grouped;
}

// Helper function to create success response
function createSuccessResponse(data) {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
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
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
    },
    body: JSON.stringify({
      error: message,
      ...additionalData
    })
  };
} 