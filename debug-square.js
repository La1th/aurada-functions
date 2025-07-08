// Debug script to test Square authentication
require('dotenv').config();
const { SquareClient, SquareEnvironment, SquareError } = require('square');

async function debugSquareAuth() {
  console.log('🔍 Debug Square Authentication\n');
  
  console.log('Environment Variables:');
  console.log('SQUARE_ACCESS_TOKEN:', process.env.SQUARE_ACCESS_TOKEN?.substring(0, 20) + '...');
  console.log('SQUARE_LOCATION_ID:', process.env.SQUARE_LOCATION_ID);
  console.log('SQUARE_ENVIRONMENT:', process.env.SQUARE_ENVIRONMENT);
  console.log('');

  // Initialize Square client
  const squareClient = new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN,
    environment: process.env.SQUARE_ENVIRONMENT === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox
  });

  // Test 1: List locations (simplest API call)
  console.log('🧪 Test 1: List Locations');
  try {
    const locationsResponse = await squareClient.locations.list();
    console.log('✅ Locations API call successful!');
    console.log('Number of locations:', locationsResponse.locations?.length || 0);
    if (locationsResponse.locations && locationsResponse.locations.length > 0) {
      console.log('First location ID:', locationsResponse.locations[0].id);
      console.log('First location name:', locationsResponse.locations[0].name);
    }
  } catch (error) {
    console.log('❌ Locations API call failed');
    if (error instanceof SquareError) {
      console.log('Error details:', {
        statusCode: error.statusCode,
        errors: error.errors
      });
    } else {
      console.log('Unexpected error:', error.message);
    }
  }

  console.log('\n');

  // Test 2: Get specific location  
  console.log('🧪 Test 2: Get Specific Location');
  try {
    const locationResponse = await squareClient.locations.get({
      locationId: process.env.SQUARE_LOCATION_ID
    });
    console.log('✅ Get location API call successful!');
    console.log('Location name:', locationResponse.location?.name);
    console.log('Location status:', locationResponse.location?.status);
  } catch (error) {
    console.log('❌ Get location API call failed');
    if (error instanceof SquareError) {
      console.log('Error details:', {
        statusCode: error.statusCode,
        errors: error.errors
      });
    } else {
      console.log('Unexpected error:', error.message);
    }
  }

  console.log('\n');

  // Test 3: Simple catalog search (another basic API)
  console.log('🧪 Test 3: Search Catalog');
  try {
    const catalogResponse = await squareClient.catalog.list({
      types: 'ITEM'
    });
    console.log('✅ Catalog API call successful!');
    console.log('Number of catalog items:', catalogResponse.objects?.length || 0);
    
    // Try with different types format
    console.log('\n🧪 Test 3b: Search Catalog with array format');
    const catalogResponse2 = await squareClient.catalog.list({
      types: ['ITEM', 'ITEM_VARIATION']
    });
    console.log('✅ Catalog API call successful!');
    console.log('Number of catalog items (array):', catalogResponse2.objects?.length || 0);
    
    // Try with no types filter
    console.log('\n🧪 Test 3c: List all catalog objects');
    const catalogResponse3 = await squareClient.catalog.list();
    console.log('✅ Catalog API call successful!');
    console.log('Number of all catalog objects:', catalogResponse3.objects?.length || 0);
    
    if (catalogResponse3.objects && catalogResponse3.objects.length > 0) {
      console.log('First object type:', catalogResponse3.objects[0].type);
      console.log('First object id:', catalogResponse3.objects[0].id);
    }
    
  } catch (error) {
    console.log('❌ Catalog API call failed');
    if (error instanceof SquareError) {
      console.log('Error details:', {
        statusCode: error.statusCode,
        errors: error.errors
      });
    } else {
      console.log('Unexpected error:', error.message);
    }
  }
}

// Run the debug
debugSquareAuth(); 