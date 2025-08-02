require('dotenv').config();
const { SquareClient, SquareEnvironment, SquareError } = require('square');
const AWS = require('aws-sdk');

// Configure AWS
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

// Function to get Square credentials from square-merchants DynamoDB table
async function getSquareCredentials(environment = 'production') {
  if (squareCredentialsCache[environment]) {
    console.log(`Using cached ${environment} credentials`);
    return squareCredentialsCache[environment];
  }
  
  try {
    console.log(`Retrieving Square credentials for Red Bird from square-merchants table...`);
    
    // Query the square-merchants table for Red Bird's credentials
    const params = {
      TableName: MERCHANTS_TABLE,
      Key: {
        restaurant_id: REDBIRD_RESTAURANT_ID
      }
    };
    
    const result = await dynamodb.get(params).promise();
    
    if (!result.Item) {
      throw new Error(`Red Bird credentials not found in square-merchants table. Restaurant ID: ${REDBIRD_RESTAURANT_ID}`);
    }
    
    const merchantData = result.Item;
    
    // Extract credentials in the format the rest of the function expects
    squareCredentialsCache[environment] = {
      SQUARE_ACCESS_TOKEN: merchantData.access_token,
      SQUARE_LOCATION_ID: merchantData.locations?.[0]?.id, // Use first location
      SQUARE_ENVIRONMENT: environment
    };
    
    // Initialize Square client with retrieved credentials
    squareClientCache[environment] = new SquareClient({
      token: merchantData.access_token,
      environment: environment === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox
    });
    
    console.log(`Successfully initialized ${environment} Square client for Red Bird`);
    console.log(`Business: ${merchantData.business_name}`);
    console.log(`Merchant ID: ${merchantData.merchant_id}`);
    console.log(`Locations: ${merchantData.locations?.length || 0}`);
    
    return squareCredentialsCache[environment];
  } catch (error) {
    console.error(`Error retrieving Square credentials for Red Bird:`, error);
    throw new Error(`Failed to retrieve Red Bird Square credentials from square-merchants table: ${error.message}`);
  }
}

// Function to get Square client for specific environment
function getSquareClient(environment = 'production') {
  return squareClientCache[environment];
}

// Comment out multi-restaurant table reference - only using redbird-menu now
// const CATALOG_TABLE_NAME = process.env.CATALOG_TABLE_NAME || 'restaurant-catalog';
const REDBIRD_MENU_TABLE = 'redbird-menu';
const MERCHANTS_TABLE = 'square-merchants';

// Red Bird's restaurant ID in the square-merchants table
const REDBIRD_RESTAURANT_ID = 'test-redbird-2'; // This might need to be updated to match actual ID

/* ===== MULTI-RESTAURANT SYNC FUNCTIONS (COMMENTED OUT FOR FUTURE USE) =====
 * 
 * The following functions sync catalog data from Square to DynamoDB for multiple restaurants.
 * Currently commented out since we're only using Red Bird Chicken with pre-populated data.
 * To re-enable multi-restaurant sync:
 * 1. Uncomment the functions below
 * 2. Uncomment the CATALOG_TABLE_NAME constant above
 * 3. Update the module.exports.syncCatalog to use the syncCatalogMultiRestaurant function
 */

/*
const CATALOG_TABLE_NAME = process.env.CATALOG_TABLE_NAME || 'restaurant-catalog';

module.exports.syncCatalog = async (event) => {
  console.log('Starting catalog sync...');
  
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
    const catalogItems = await fetchAllCatalogItems(squareClient);
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
async function fetchAllCatalogItems(squareClient) {
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
*/

/* ===== END MULTI-RESTAURANT SYNC FUNCTIONS ===== */

// Sync Red Bird Chicken catalog from Square production to DynamoDB
module.exports.syncCatalog = async (event) => {
  console.log('Starting Red Bird Chicken catalog sync from Square production...');
  
  try {
    // Force production environment for Red Bird sync
    const environment = 'production';
    console.log(`Operating in ${environment} environment`);
    
    // Get Square credentials for production
    await getSquareCredentials(environment);
    const squareClient = getSquareClient(environment);
    
    if (!squareClient) {
      throw new Error(`Square client not initialized for ${environment} environment`);
    }

    console.log('Fetching catalog from Square production API...');

    // Fetch all catalog items from Square
    const catalogItems = await fetchAllCatalogItems(squareClient);
    console.log(`Fetched ${catalogItems.length} catalog items from Square`);

    // Filter for ITEM types only
    const itemObjects = catalogItems.filter(obj => obj.type === 'ITEM');
    console.log(`Found ${itemObjects.length} ITEM objects`);

    // Clear existing menu items and populate with fresh data
    const syncedCount = await syncRedbirdMenuTable(itemObjects);

    console.log(`Successfully synced ${syncedCount} items to redbird-menu table`);

    return createSuccessResponse({
      success: true,
      message: 'Red Bird Chicken catalog sync completed successfully',
      environment: environment,
      totalItemsFetched: catalogItems.length,
      itemObjectsFound: itemObjects.length,
      itemsSynced: syncedCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error syncing Red Bird catalog:', error);
    
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
async function fetchAllCatalogItems(squareClient) {
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
    
    const response = await squareClient.catalog.list(request);
    
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

// Function to sync Red Bird menu table with Square catalog data
async function syncRedbirdMenuTable(itemObjects) {
  console.log('💾 Syncing redbird-menu table with Square catalog...\n');
  
  // First, clear existing items (optional - comment out if you want to merge instead)
  await clearRedbirdMenuTable();
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const item of itemObjects) {
    try {
      const itemData = item.item_data;
      if (!itemData || !itemData.name) {
        console.warn('⚠️ Skipping item without name:', item.id);
        continue;
      }
      
      // Process each variation within the item
      if (itemData.variations && itemData.variations.length > 0) {
        for (const variation of itemData.variations) {
          const variationData = variation.item_variation_data;
          
          const menuRecord = {
            item_name: itemData.name,                    // PK
            variation: variationData?.name || 'Default', // SK
            square_item_id: item.id,
            square_variation_id: variation.id,
            description: itemData.description || '',
            category_ids: itemData.categories?.map(cat => cat.id) || [],
            product_type: itemData.product_type || 'FOOD_AND_BEV',
            is_taxable: itemData.is_taxable || false,
            sku: variationData?.sku || '',
            price_money: variationData?.price_money ? {
              amount: variationData.price_money.amount?.toString() || '0',
              currency: variationData.price_money.currency || 'USD'
            } : null,
            ordinal: variationData?.ordinal || 0,
            pricing_type: variationData?.pricing_type || 'FIXED_PRICING',
            sellable: variationData?.sellable || false,
            stockable: variationData?.stockable || false,
            created_at: new Date().toISOString(),
            updated_at: item.updated_at || new Date().toISOString(),
            version: item.version || 1
          };
          
          // Store in DynamoDB
          const params = {
            TableName: REDBIRD_MENU_TABLE,
            Item: menuRecord
          };
          
          await dynamodb.put(params).promise();
          successCount++;
          
          const priceDisplay = menuRecord.price_money 
            ? `$${(parseInt(menuRecord.price_money.amount) / 100).toFixed(2)}`
            : 'No price';
          
          console.log(`✅ ${menuRecord.item_name} - ${menuRecord.variation} (${priceDisplay})`);
        }
      } else {
        // Item has no variations, create single record
        const menuRecord = {
          item_name: itemData.name,           // PK
          variation: 'Default',               // SK
          square_item_id: item.id,
          square_variation_id: null,
          description: itemData.description || '',
          category_ids: itemData.categories?.map(cat => cat.id) || [],
          product_type: itemData.product_type || 'FOOD_AND_BEV',
          is_taxable: itemData.is_taxable || false,
          sku: '',
          price_money: null,
          ordinal: 0,
          pricing_type: 'FIXED_PRICING',
          sellable: false,
          stockable: false,
          created_at: new Date().toISOString(),
          updated_at: item.updated_at || new Date().toISOString(),
          version: item.version || 1
        };
        
        // Store in DynamoDB
        const params = {
          TableName: REDBIRD_MENU_TABLE,
          Item: menuRecord
        };
        
        await dynamodb.put(params).promise();
        successCount++;
        
        console.log(`✅ ${menuRecord.item_name} - ${menuRecord.variation} (No price)`);
      }
      
    } catch (error) {
      errorCount++;
      console.error(`❌ Error processing item ${item.id}:`, error.message);
    }
  }
  
  console.log(`\n📊 Sync Results:`);
  console.log(`✅ Successfully synced: ${successCount} records`);
  console.log(`❌ Errors: ${errorCount} items`);
  
  return successCount;
}

// Helper function to clear existing menu items (optional)
async function clearRedbirdMenuTable() {
  console.log('🗑️ Clearing existing menu items...');
  
  try {
    // Scan to get all items
    const scanParams = {
      TableName: REDBIRD_MENU_TABLE,
      ProjectionExpression: 'item_name, variation'
    };
    
    const result = await dynamodb.scan(scanParams).promise();
    
    if (!result.Items || result.Items.length === 0) {
      console.log('No existing items to clear');
      return;
    }
    
    // Delete items in batches
    const batchSize = 25;
    for (let i = 0; i < result.Items.length; i += batchSize) {
      const batch = result.Items.slice(i, i + batchSize);
      
      const deleteRequests = batch.map(item => ({
        DeleteRequest: {
          Key: {
            item_name: item.item_name,
            variation: item.variation
          }
        }
      }));
      
      const batchParams = {
        RequestItems: {
          [REDBIRD_MENU_TABLE]: deleteRequests
        }
      };
      
      await dynamodb.batchWrite(batchParams).promise();
      console.log(`Deleted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(result.Items.length / batchSize)}`);
    }
    
    console.log(`✅ Cleared ${result.Items.length} existing items`);
    
  } catch (error) {
    console.error('Error clearing table:', error.message);
    // Continue anyway - might be first sync
  }
}

// Function to get catalog for a specific agent (query function)
module.exports.getCatalog = async (event) => {
  console.log('Getting Red Bird Chicken menu...');
  
  try {
    // Query DynamoDB for all Red Bird menu items
    const params = {
      TableName: REDBIRD_MENU_TABLE
    };
    
    const result = await dynamodb.scan(params).promise();
    
    console.log(`Found ${result.Items.length} menu items for Red Bird Chicken`);
    
    // Group items by category for better organization
    const categorizedItems = groupRedbirdItemsByCategory(result.Items);
    
    return createSuccessResponse({
      success: true,
      restaurant: 'Red Bird Chicken',
      totalItems: result.Items.length,
      items: result.Items,
      categorizedItems: categorizedItems,
      lastEvaluatedKey: result.LastEvaluatedKey
    });
    
  } catch (error) {
    console.error('Error getting Red Bird menu:', error);
    return createErrorResponse(500, 'Internal server error', { 
      details: error.message 
    });
  }
};

// Helper function to group Red Bird menu items by category 
function groupRedbirdItemsByCategory(items) {
  const grouped = {};
  
  for (const item of items) {
    // Red Bird menu uses category_ids array, take first category or use item name pattern
    let category = 'uncategorized';
    
    if (item.category_ids && item.category_ids.length > 0) {
      category = item.category_ids[0];
    } else {
      // Fallback: categorize by item name patterns
      const itemName = item.item_name.toLowerCase();
      if (itemName.includes('sandwich')) {
        category = 'sandwiches';
      } else if (itemName.includes('tender')) {
        category = 'tenders';
      } else if (itemName.includes('nugget')) {
        category = 'nuggets';
      } else if (itemName.includes('fries') || itemName.includes('mac') || itemName.includes('slaw')) {
        category = 'sides';
      } else if (itemName.includes('bowl') || itemName.includes('rice')) {
        category = 'rice_bowls';
      } else if (itemName.includes('soda') || itemName.includes('water')) {
        category = 'drinks';
      } else if (itemName.includes('cake')) {
        category = 'desserts';
      }
    }
    
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