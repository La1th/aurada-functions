// Test catalog fetch with direct access token
require('dotenv').config();
const { SquareClient, SquareEnvironment } = require('square');

const ACCESS_TOKEN = 'EAAAlvB4ZbupoYBu5C_apVLJdlj4GYdcdlpgc2pgMJvKVAz9V-fpab4LthuGDmGM';

async function testCatalogFetch() {
  console.log('🧪 Testing catalog fetch with direct access token...\n');
  
  try {
    // Initialize Square client with production environment
    const squareClient = new SquareClient({
      token: ACCESS_TOKEN,
      environment: SquareEnvironment.Production
    });
    
    console.log('🚨 Using PRODUCTION Square API');
    console.log('🔑 Access token:', ACCESS_TOKEN.substring(0, 20) + '...');
    
    // Test: Fetch catalog and examine the full response
    console.log('\n📦 Fetching catalog...');
    
    const catalogResponse = await squareClient.catalog.list();
    
    console.log('Response keys:', Object.keys(catalogResponse));
    
    // The data is stored as numeric indices, not in an objects array
    if (catalogResponse.data) {
      const dataKeys = Object.keys(catalogResponse.data);
      console.log('Data has', dataKeys.length, 'items');
      
      // Convert the indexed data to an array
      const catalogItems = [];
      dataKeys.forEach(key => {
        if (!isNaN(key)) {  // Only numeric keys
          catalogItems.push(catalogResponse.data[key]);
        }
      });
      
      console.log('✅ Found', catalogItems.length, 'catalog objects');
      
      // Filter for items only
      const items = catalogItems.filter(obj => obj && obj.type === 'ITEM');
      console.log('🍽️ Found', items.length, 'menu items');
      
      // Examine the structure of the first item
      if (items.length > 0) {
        console.log('\n🔍 Examining first item structure:');
        const firstItem = items[0];
        console.log('Item keys:', Object.keys(firstItem));
        
        if (firstItem.itemData) {
          console.log('itemData keys:', Object.keys(firstItem.itemData));
          console.log('Item name (itemData):', firstItem.itemData.name);
        }
        
        if (firstItem.item_data) {
          console.log('item_data keys:', Object.keys(firstItem.item_data));
          console.log('Item name (item_data):', firstItem.item_data.name);
        }
        
        console.log('Present at locations:', firstItem.presentAtLocationIds || firstItem.present_at_location_ids);
        
        // Show the full first item (truncated)
        console.log('\n📄 First item sample:');
        const itemString = JSON.stringify(firstItem, null, 2);
        console.log(itemString.substring(0, 500) + '...');
      }
      
      // Show first few items with corrected field access
      console.log('\n📋 First 3 menu items (corrected):');
      items.slice(0, 3).forEach((item, i) => {
        const name = item.itemData?.name || item.item_data?.name || 'Unknown';
        const locations = item.presentAtLocationIds || item.present_at_location_ids || [];
        const description = item.itemData?.description || item.item_data?.description || 'No description';
        
        console.log(`${i + 1}. ${name}`);
        console.log(`   ID: ${item.id}`);
        console.log(`   Locations: ${locations.length}`);
        console.log(`   Description: ${description.substring(0, 50)}...`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testCatalogFetch(); 