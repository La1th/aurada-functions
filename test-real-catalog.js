// Quick script to test fetching real catalog from authorized restaurant
require('dotenv').config();
const AWS = require('aws-sdk');
const { SquareClient, SquareEnvironment } = require('square');

// Configure AWS
AWS.config.update({ 
  region: process.env.AWS_REGION || 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const MERCHANTS_TABLE = 'square-merchants';

async function fetchRealCatalog(restaurantId) {
  console.log(`🔍 Fetching real catalog for restaurant: ${restaurantId}\n`);
  
  try {
    // 1. Get restaurant's stored tokens from DynamoDB
    console.log('📊 Looking up restaurant tokens...');
    const params = {
      TableName: MERCHANTS_TABLE,
      Key: {
        restaurant_id: restaurantId
      }
    };
    
    const result = await dynamodb.get(params).promise();
    
    if (!result.Item) {
      throw new Error(`Restaurant ${restaurantId} not found in merchants table`);
    }
    
    const merchant = result.Item;
    console.log(`✅ Found merchant: ${merchant.business_name}`);
    console.log(`🏪 Merchant ID: ${merchant.merchant_id}`);
    console.log(`📍 Locations: ${merchant.locations?.length || 0}`);
    
    // 2. Initialize Square client with their access token
    console.log('\n🔌 Connecting to Square API...');
    
    // CRITICAL: Make sure we use PRODUCTION environment
    const squareClient = new SquareClient({
      token: merchant.access_token,
      environment: SquareEnvironment.Production  // PRODUCTION - not sandbox!
    });
    
    // Verify we're hitting production endpoints
    console.log('🚨 ENVIRONMENT CHECK: Using PRODUCTION Square API (connect.squareup.com)');
    console.log('🚨 NOT using sandbox (connect.squareupsandbox.com)');
    
    // 3. Fetch their catalog from PRODUCTION
    console.log('📦 Fetching catalog from Square PRODUCTION API...');
    const catalogResponse = await squareClient.catalog.list({
      types: 'ITEM,ITEM_VARIATION,CATEGORY'
    });
    
    console.log('✅ Catalog API call successful!');
    
    // Try getting ALL objects (no filter)
    console.log('\n📦 Trying to fetch ALL catalog objects...');
    const allCatalogResponse = await squareClient.catalog.list();
    
    console.log('📊 Filtered response objects:', catalogResponse.objects?.length || 0);
    console.log('📊 All objects response:', allCatalogResponse.objects?.length || 0);
    
    // Check what types of objects exist
    if (allCatalogResponse.objects && allCatalogResponse.objects.length > 0) {
      const objectTypes = [...new Set(allCatalogResponse.objects.map(obj => obj.type))];
      console.log('🏷️ Object types found:', objectTypes);
    }
    
    const allObjects = catalogResponse.objects || [];
    const items = allObjects.filter(obj => obj.type === 'ITEM');
    
    console.log(`\n📋 REAL CATALOG RESULTS:`);
    console.log(`═══════════════════════════`);
    console.log(`Total objects: ${allObjects.length}`);
    console.log(`Menu items: ${items.length}`);
    console.log(`Restaurant: ${merchant.business_name}`);
    console.log(`\n🍽️ MENU ITEMS:`);
    
    // Display items
    items.forEach((item, index) => {
      const itemData = item.itemData || item.item_data;
      console.log(`\n${index + 1}. ${itemData.name}`);
      console.log(`   ID: ${item.id}`);
      console.log(`   Description: ${itemData.description || 'No description'}`);
      
      if (itemData.variations && itemData.variations.length > 0) {
        console.log(`   Variations:`);
        itemData.variations.forEach(variation => {
          const varData = variation.itemVariationData || variation.item_variation_data;
          const price = varData.priceMoney || varData.price_money;
          const priceDisplay = price ? `$${(parseInt(price.amount) / 100).toFixed(2)}` : 'No price';
          console.log(`     - ${varData.name || 'Default'}: ${priceDisplay}`);
        });
      }
    });
    
    return {
      restaurant: merchant.business_name,
      totalItems: items.length,
      items: items
    };
    
  } catch (error) {
    console.error('❌ Error fetching real catalog:', error.message);
    throw error;
  }
}

// Run the script
const restaurantId = process.argv[2] || 'redbird-prod';
fetchRealCatalog(restaurantId).catch(console.error); 