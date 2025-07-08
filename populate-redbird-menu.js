// One-time script to populate redbird-menu DynamoDB table from Square catalog
require('dotenv').config();
const axios = require('axios');
const AWS = require('aws-sdk');

// Configure AWS region and credentials from environment variables
AWS.config.update({ 
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const dynamodbService = new AWS.DynamoDB();

const REDBIRD_MENU_TABLE = 'redbird-menu';

async function createRedbirdMenuTable() {
  console.log('🔧 Creating redbird-menu table...\n');
  
  const dynamodbService = new AWS.DynamoDB();
  
  const params = {
    TableName: REDBIRD_MENU_TABLE,
    KeySchema: [
      {
        AttributeName: 'item_name',
        KeyType: 'HASH' // Partition key
      },
      {
        AttributeName: 'variation',
        KeyType: 'RANGE' // Sort key
      }
    ],
    AttributeDefinitions: [
      {
        AttributeName: 'item_name',
        AttributeType: 'S'
      },
      {
        AttributeName: 'variation',
        AttributeType: 'S'
      }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  };
  
  try {
    await dynamodbService.createTable(params).promise();
    console.log('✅ redbird-menu table created successfully!');
    
    // Wait for table to be active
    console.log('⏳ Waiting for table to be active...');
    await dynamodbService.waitFor('tableExists', { TableName: REDBIRD_MENU_TABLE }).promise();
    console.log('✅ Table is now active!');
    
  } catch (error) {
    if (error.code === 'ResourceInUseException') {
      console.log('ℹ️ redbird-menu table already exists');
    } else {
      console.error('❌ Error creating table:', error.message);
      throw error;
    }
  }
}

async function fetchSquareCatalog() {
  console.log('📦 Fetching catalog from Square...\n');
  
  const allItems = [];
  let cursor = null;
  
  do {
    console.log('Fetching catalog page...');
    
    // Build URL with query parameters exactly like the curl command
    let url = 'https://connect.squareupsandbox.com/v2/catalog/list?types=item%2Citem_variation';
    
    if (cursor) {
      url += `&cursor=${encodeURIComponent(cursor)}`;
    }
    
    try {
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
          'Square-Version': '2025-06-18',
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data.errors && response.data.errors.length > 0) {
        throw new Error(`Square API errors: ${JSON.stringify(response.data.errors)}`);
      }
      
      const objects = response.data.objects || [];
      allItems.push(...objects);
      
      cursor = response.data.cursor;
      console.log(`Fetched ${objects.length} items, cursor: ${cursor ? 'has more' : 'end'}`);
      
    } catch (error) {
      console.error('Error fetching catalog:', error.response?.data || error.message);
      throw error;
    }
    
  } while (cursor);
  
  console.log(`\n📊 Total items fetched: ${allItems.length}`);
  return allItems;
}

async function populateRedbirdMenu(catalogItems) {
  console.log('💾 Populating redbird-menu table...\n');
  
  // Filter for ITEM types only (not ITEM_VARIATION since those are duplicated)
  const itemObjects = catalogItems.filter(obj => obj.type === 'ITEM');
  console.log(`Found ${itemObjects.length} ITEM objects to process`);
  
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
  
  console.log(`\n📊 Population Results:`);
  console.log(`✅ Successfully stored: ${successCount} records`);
  console.log(`❌ Errors: ${errorCount} items`);
  
  return { successCount, errorCount };
}

async function listRedbirdMenu() {
  console.log('\n📋 Current items in redbird-menu table:\n');
  
  try {
    const params = {
      TableName: REDBIRD_MENU_TABLE
    };
    
    const result = await dynamodb.scan(params).promise();
    
    if (!result.Items || result.Items.length === 0) {
      console.log('No items found in table');
      return;
    }
    
    console.log(`Found ${result.Items.length} menu items:`);
    result.Items.forEach((item, index) => {
      const priceInfo = item.price_money 
        ? `$${(parseInt(item.price_money.amount) / 100).toFixed(2)}`
        : 'No price';
      
      console.log(`${index + 1}. ${item.item_name} - ${item.variation}`);
      console.log(`   💰 Price: ${priceInfo}`);
      console.log(`   🆔 Square Item ID: ${item.square_item_id}`);
      console.log(`   🔢 Square Variation ID: ${item.square_variation_id}`);
      console.log(`   📝 Description: ${item.description || 'N/A'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Error listing menu items:', error.message);
  }
}

// Main execution
(async () => {
  if (!process.env.SQUARE_ACCESS_TOKEN || !process.env.SQUARE_LOCATION_ID) {
    console.error('🔴 Missing Square credentials in .env file.');
    console.error('Required variables: SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID');
    process.exit(1);
  }
  
  console.log('🟢 Starting Red Bird menu population from Square catalog\n');
  
  try {
    // Step 1: Create table if it doesn't exist
    await createRedbirdMenuTable();
    
    console.log('\n' + '='.repeat(60));
    
    // Step 2: Fetch catalog from Square
    const catalogItems = await fetchSquareCatalog();
    
    console.log('\n' + '='.repeat(60));
    
    // Step 3: Populate DynamoDB table
    const results = await populateRedbirdMenu(catalogItems);
    
    console.log('\n' + '='.repeat(60));
    
    // Step 4: List what we stored
    await listRedbirdMenu();
    
    console.log('='.repeat(60));
    console.log('🎉 Red Bird menu population completed!');
    console.log('\n💡 Next steps:');
    console.log('1. Use this menu data in your payment link creation');
    console.log('2. Query items by item_name when Retell sends orders');
    console.log('3. This was a one-time setup - menu is now in DynamoDB');
    
  } catch (error) {
    console.error('\n💥 Population failed:', error);
    process.exit(1);
  }
})(); 