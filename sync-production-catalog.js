// Sync production Square catalog to clientMenu DynamoDB table
require('dotenv').config();
const AWS = require('aws-sdk');
const { SquareClient, SquareEnvironment } = require('square');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

// Function to create clientMenu table
async function createClientMenuTable() {
  const dynamodbService = new AWS.DynamoDB();
  
  const params = {
    TableName: 'clientMenu',
    KeySchema: [
      { AttributeName: 'restaurantName', KeyType: 'HASH' },  // Partition key
      { AttributeName: 'locationID', KeyType: 'RANGE' }       // Sort key
    ],
    AttributeDefinitions: [
      { AttributeName: 'restaurantName', AttributeType: 'S' },
      { AttributeName: 'locationID', AttributeType: 'S' }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  };

  try {
    await dynamodbService.createTable(params).promise();
    console.log('✅ clientMenu table created successfully');
    
    // Wait for table to be active
    await dynamodbService.waitFor('tableExists', { TableName: 'clientMenu' }).promise();
    console.log('✅ clientMenu table is now active');
  } catch (error) {
    if (error.code === 'ResourceInUseException') {
      console.log('📋 clientMenu table already exists');
    } else {
      console.error('❌ Error creating table:', error);
      throw error;
    }
  }
}

// Function to convert BigInt values to Numbers recursively
function convertBigIntToNumber(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return Number(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(convertBigIntToNumber);
  }
  
  if (typeof obj === 'object') {
    const converted = {};
    for (const [key, value] of Object.entries(obj)) {
      converted[key] = convertBigIntToNumber(value);
    }
    return converted;
  }
  
  return obj;
}

async function syncProductionCatalog() {
  try {
    console.log('🚀 Starting production catalog sync...');
    
    // 1. Create table if needed
    await createClientMenuTable();
    
    // 2. Use direct access token for testing
    console.log('📊 Using direct access token for testing...');
    const ACCESS_TOKEN = 'EAAAlvB4ZbupoYBu5C_apVLJdlj4GYdcdlpgc2pgMJvKVAz9V-fpab4LthuGDmGM';
    const restaurantName = 'The Red Bird Hot Chicken & Fries';
    
    // 3. Initialize Square client for production
    console.log('🔌 Connecting to Square Production API...');
    const squareClient = new SquareClient({
      token: ACCESS_TOKEN,
      environment: SquareEnvironment.Production
    });
    
    console.log('🌍 Environment check:', SquareEnvironment.Production);
    
    // 4. Focus on Vienna location only
    console.log('📍 Fetching merchant locations...');
    const locationsResponse = await squareClient.locations.list();
    const allLocations = locationsResponse.locations || [];
    console.log(`📍 Found ${allLocations.length} total locations`);
    
    // Filter to just Vienna location
    const viennaLocation = allLocations.find(loc => loc.name.includes('Vienna'));
    if (!viennaLocation) {
      throw new Error('Vienna location not found!');
    }
    console.log(`📍 Focusing on Vienna location: ${viennaLocation.name} (${viennaLocation.id})`);
    
    // 5. Fetch catalog
    console.log('📋 Fetching catalog from Square...');
    const catalogResponse = await squareClient.catalog.list();
    
    console.log('📋 Raw catalog response structure:', Object.keys(catalogResponse));
    console.log('📋 catalogResponse.objects:', catalogResponse.objects?.length || 'undefined');
    console.log('📋 catalogResponse.response:', typeof catalogResponse.response);
    console.log('📋 catalogResponse.data:', typeof catalogResponse.data);
    
    // Check if objects are in the response property
    if (catalogResponse.response && catalogResponse.response.objects) {
      console.log('📋 Found objects in response.objects:', catalogResponse.response.objects.length);
    }
    
    // 6. Get catalog objects from response
    const catalogItems = catalogResponse.objects || catalogResponse.response?.objects || [];
    console.log(`📋 Found ${catalogItems.length} total catalog objects`);
    
    // 7. Filter for ITEM type objects only
    const items = catalogItems.filter(obj => obj.type === 'ITEM');
    console.log(`🍽️ Found ${items.length} menu items`);
    
    // 8. Process items for Vienna location only
    const viennaMenu = {};
    let itemsProcessed = 0;
    
    for (const item of items) {
      const itemData = item.itemData;
      if (!itemData || !itemData.name) {
        console.log('⚠️ Item missing itemData or name, skipping');
        continue;
      }
      
      // Debug the first few items to see structure
      if (itemsProcessed < 3) {
        console.log(`🔍 DEBUGGING ITEM ${itemsProcessed + 1} (${itemData.name}):`);
        console.log('🔍 item keys:', Object.keys(item));
        console.log('🔍 itemData keys:', Object.keys(itemData));
        console.log('🔍 item.presentAtAllLocations:', item.presentAtAllLocations);
        console.log('🔍 item.presentAtLocationIds:', item.presentAtLocationIds);
        console.log('🔍 itemData.presentAtAllLocations:', itemData.presentAtAllLocations);
        console.log('🔍 itemData.presentAtLocationIds:', itemData.presentAtLocationIds);
      }
      
      // Check if item is available at Vienna location
      let availableAtVienna = false;
      
      if (item.presentAtAllLocations === true) {
        availableAtVienna = true;
        console.log(`📍 Item "${itemData.name}" present at ALL locations (including Vienna)`);
      } else if (item.presentAtLocationIds && Array.isArray(item.presentAtLocationIds) && 
                 item.presentAtLocationIds.includes(viennaLocation.id)) {
        availableAtVienna = true;
        console.log(`📍 Item "${itemData.name}" present at Vienna specifically`);
      } else {
        // If no location info specified, assume it's available everywhere (common Square default)
        if (!item.presentAtAllLocations && (!item.presentAtLocationIds || item.presentAtLocationIds.length === 0)) {
          availableAtVienna = true;
          console.log(`📍 Item "${itemData.name}" has no location restrictions (assuming available everywhere)`);
        } else {
          console.log(`⚠️ Item "${itemData.name}" not available at Vienna, skipping`);
          itemsProcessed++;
          continue;
        }
      }
      
      // Convert BigInt values to Numbers
      const processedItem = convertBigIntToNumber({
        name: itemData.name,
        description: itemData.description || '',
        price: itemData.variations?.[0]?.itemVariationData?.priceMoney?.amount || 0,
        currency: itemData.variations?.[0]?.itemVariationData?.priceMoney?.currency || 'USD',
        categoryId: itemData.categoryId || '',
        isTaxable: itemData.isTaxable || false,
        productType: itemData.productType || '',
        isArchived: itemData.isArchived || false,
        modifierListInfo: itemData.modifierListInfo || [],
        skipModifierScreen: itemData.skipModifierScreen || false,
        variations: itemData.variations || []
      });
      
      console.log(`🍽️ Adding to Vienna menu: ${processedItem.name} (Price: $${(processedItem.price/100).toFixed(2)})`);
      
      viennaMenu[processedItem.name] = processedItem;
      itemsProcessed++;
    }
    
    console.log(`📊 Vienna location menu has ${Object.keys(viennaMenu).length} items`);
    
    // 9. Store Vienna menu in DynamoDB
    if (Object.keys(viennaMenu).length > 0) {
      console.log(`💾 Storing Vienna menu with ${Object.keys(viennaMenu).length} items`);
      
      const dbItem = {
        restaurantName: restaurantName,
        locationID: viennaLocation.id,
        locationName: viennaLocation.name,
        lastUpdated: new Date().toISOString(),
        itemCount: Object.keys(viennaMenu).length,
        ...viennaMenu // Spread all menu items as individual attributes
      };
      
      const params = {
        TableName: 'clientMenu',
        Item: dbItem
      };
      
      try {
        await dynamodb.put(params).promise();
        console.log(`✅ Successfully stored Vienna menu!`);
      } catch (error) {
        console.error(`❌ Error storing Vienna menu:`, error);
      }
    } else {
      console.log(`⚠️ No items found for Vienna location`);
    }
    
    console.log('🎉 Vienna catalog sync completed successfully!');
    
  } catch (error) {
    console.error('❌ Error syncing catalog:', error);
    throw error;
  }
}

// Run the sync
syncProductionCatalog(); 