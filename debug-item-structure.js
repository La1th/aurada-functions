// Debug the structure of catalog items to understand BigInt and missing location issues
require('dotenv').config();
const { SquareClient, SquareEnvironment } = require('square');

const ACCESS_TOKEN = 'EAAAlvB4ZbupoYBu5C_apVLJdlj4GYdcdlpgc2pgMJvKVAz9V-fpab4LthuGDmGM';

async function debugItemStructures() {
  console.log('🔍 Debugging catalog item structures...\n');
  
  try {
    const squareClient = new SquareClient({
      token: ACCESS_TOKEN,
      environment: SquareEnvironment.Production
    });
    
    const catalogResponse = await squareClient.catalog.list();
    
    // Convert indexed response data to array
    const allObjects = [];
    if (catalogResponse.data) {
      const dataKeys = Object.keys(catalogResponse.data);
      dataKeys.forEach(key => {
        if (!isNaN(key)) {
          allObjects.push(catalogResponse.data[key]);
        }
      });
    }
    
    const items = allObjects.filter(obj => obj && obj.type === 'ITEM');
    console.log(`Found ${items.length} total items\n`);
    
    // Find specific items that were missing
    const missingItems = ['TENDERS W/ FRIES (2pc)', 'CHICKEN RICE BOWL', 'CHICKEN CHEESE FRIES'];
    
    missingItems.forEach(itemName => {
      console.log(`🔍 Looking for: ${itemName}`);
      const item = items.find(i => i.itemData?.name === itemName);
      
      if (item) {
        console.log(`✅ Found: ${item.itemData.name}`);
        console.log(`   presentAtLocationIds:`, item.presentAtLocationIds);
        console.log(`   presentAtAllLocations:`, item.presentAtAllLocations);
        
        if (item.itemData.variations && item.itemData.variations.length > 0) {
          const variation = item.itemData.variations[0];
          console.log(`   Variation presentAtLocationIds:`, variation.presentAtLocationIds);
          console.log(`   Variation type:`, typeof variation.itemVariationData?.priceMoney?.amount);
          console.log(`   Variation amount:`, variation.itemVariationData?.priceMoney?.amount);
          
          // Try to convert BigInt to number
          const amount = variation.itemVariationData?.priceMoney?.amount;
          if (typeof amount === 'bigint') {
            console.log(`   Converted amount:`, Number(amount));
          }
        }
        console.log('');
      } else {
        console.log(`❌ NOT FOUND: ${itemName}\n`);
      }
    });
    
    // Check which items DO have presentAtLocationIds
    console.log('\n📍 Items WITH locations:');
    let itemsWithLocations = 0;
    let itemsWithoutLocations = 0;
    
    items.forEach(item => {
      const locations = item.presentAtLocationIds || [];
      if (locations.length > 0) {
        itemsWithLocations++;
        if (itemsWithLocations <= 3) {
          console.log(`✅ ${item.itemData?.name}: ${locations.length} locations`);
        }
      } else {
        itemsWithoutLocations++;
        if (itemsWithoutLocations <= 3) {
          console.log(`❌ ${item.itemData?.name}: NO locations`);
        }
      }
    });
    
    console.log(`\n📊 Summary:`);
    console.log(`   Items with locations: ${itemsWithLocations}`);
    console.log(`   Items without locations: ${itemsWithoutLocations}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugItemStructures(); 