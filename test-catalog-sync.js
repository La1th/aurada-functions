// Test script for catalog sync functionality
require('dotenv').config();
const { syncCatalog, getCatalog } = require('./syncCatalog');

async function testSyncCatalog() {
  console.log('🧪 Testing Catalog Sync\n');

  const testAgentNumber = "+17039699580"; // Red Bird Chicken test number

  const syncPayload = {
    agentNumber: testAgentNumber
  };

  console.log('Test data:', {
    agentNumber: testAgentNumber
  });

  try {
    const event = { body: JSON.stringify(syncPayload) };
    const result = await syncCatalog(event);
    
    console.log('\n--- Catalog Sync Response ---');
    console.log('Status Code:', result.statusCode);
    
    const responseBody = JSON.parse(result.body);
    
    if (result.statusCode === 200) {
      console.log('\n✅ SUCCESS! Catalog sync completed successfully!');
      console.log('📊 Agent Number:', responseBody.agentNumber);
      console.log('📦 Total Items Fetched:', responseBody.totalItemsFetched);
      console.log('🍽️ Item Objects Found:', responseBody.itemObjectsFound);
      console.log('💾 Items Stored:', responseBody.itemsStored);
    } else {
      console.log('\n❌ FAILED! Catalog sync failed');
      console.log('Error:', responseBody.error);
      console.log('Details:', responseBody.details);
      if (responseBody.errors) {
        console.log('Square Errors:', responseBody.errors);
      }
    }
    
    return result.statusCode === 200;
    
  } catch (error) {
    console.error('❌ Test failed with exception:', error);
    return false;
  }
}

async function testGetCatalog() {
  console.log('\n🧪 Testing Get Catalog\n');

  const testAgentNumber = "+17039699580"; // Red Bird Chicken test number

  // Test with POST method
  console.log('Testing POST method...');
  
  const getPayload = {
    agentNumber: testAgentNumber
  };

  try {
    const event = { body: JSON.stringify(getPayload) };
    const result = await getCatalog(event);
    
    console.log('\n--- Get Catalog Response (POST) ---');
    console.log('Status Code:', result.statusCode);
    
    const responseBody = JSON.parse(result.body);
    
    if (result.statusCode === 200) {
      console.log('\n✅ SUCCESS! Catalog retrieved successfully!');
      console.log('📊 Agent Number:', responseBody.agentNumber);
      console.log('📦 Total Items:', responseBody.totalItems);
      console.log('🗂️ Categories:', Object.keys(responseBody.categorizedItems || {}));
      
      if (responseBody.items && responseBody.items.length > 0) {
        console.log('\n📋 Sample Items:');
        responseBody.items.slice(0, 3).forEach(item => {
          console.log(`  - ${item.item_name} (${item.variations?.length || 0} variations)`);
        });
      }
    } else {
      console.log('\n❌ FAILED! Get catalog failed');
      console.log('Error:', responseBody.error);
    }
    
  } catch (error) {
    console.error('❌ Get catalog test failed:', error);
  }

  // Test with GET method (query parameters)
  console.log('\n\nTesting GET method (query parameters)...');
  
  try {
    const event = { 
      queryStringParameters: { 
        agentNumber: testAgentNumber 
      } 
    };
    const result = await getCatalog(event);
    
    console.log('\n--- Get Catalog Response (GET) ---');
    console.log('Status Code:', result.statusCode);
    
    const responseBody = JSON.parse(result.body);
    
    if (result.statusCode === 200) {
      console.log('\n✅ SUCCESS! Catalog retrieved via GET successfully!');
      console.log('📦 Total Items:', responseBody.totalItems);
    } else {
      console.log('\n❌ FAILED! Get catalog via GET failed');
      console.log('Error:', responseBody.error);
    }
    
  } catch (error) {
    console.error('❌ Get catalog via GET test failed:', error);
  }
}

async function testMissingAgentNumber() {
  console.log('\n🧪 Testing Missing Agent Number Validation\n');

  // Test sync without agent number
  try {
    const event = { body: JSON.stringify({}) };
    const result = await syncCatalog(event);
    
    console.log('--- Sync Validation Response ---');
    console.log('Status Code:', result.statusCode);
    
    const responseBody = JSON.parse(result.body);
    
    if (result.statusCode === 400) {
      console.log('✅ SUCCESS! Sync validation error properly handled');
      console.log('Error message:', responseBody.error);
    } else {
      console.log('❌ UNEXPECTED! Expected validation error but got:', responseBody);
    }
    
  } catch (error) {
    console.error('❌ Sync validation test failed:', error);
  }

  // Test get without agent number
  try {
    const event = { body: JSON.stringify({}) };
    const result = await getCatalog(event);
    
    console.log('\n--- Get Validation Response ---');
    console.log('Status Code:', result.statusCode);
    
    const responseBody = JSON.parse(result.body);
    
    if (result.statusCode === 400) {
      console.log('✅ SUCCESS! Get validation error properly handled');
      console.log('Error message:', responseBody.error);
    } else {
      console.log('❌ UNEXPECTED! Expected validation error but got:', responseBody);
    }
    
  } catch (error) {
    console.error('❌ Get validation test failed:', error);
  }
}

// Main execution
(async () => {
  if (!process.env.SQUARE_ACCESS_TOKEN || !process.env.SQUARE_LOCATION_ID) {
    console.error('🔴 Missing Square credentials in .env file. Please add SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID.');
    process.exit(1);
  }
  
  console.log('🟢 Square credentials found, running catalog sync tests...\n');
  
  try {
    // Test catalog sync first
    const syncSuccess = await testSyncCatalog();
    
    console.log('\n' + '='.repeat(60));
    
    // Only test get catalog if sync was successful
    if (syncSuccess) {
      await testGetCatalog();
    } else {
      console.log('⚠️ Skipping get catalog test due to sync failure');
    }
    
    console.log('\n' + '='.repeat(60));
    
    // Test validation error handling
    await testMissingAgentNumber();
    
    console.log('\n🎉 All catalog sync tests completed!');
  } catch (error) {
    console.error('\n💥 Test suite failed:', error);
    process.exit(1);
  }
})(); 