require('dotenv').config();
const { SquareClient, SquareEnvironment } = require('square');

console.log('🔧 Token Debug Test\n');

// Check raw environment variables
console.log('Raw .env check:');
console.log('SQUARE_ACCESS_TOKEN length:', process.env.SQUARE_ACCESS_TOKEN?.length);
console.log('SQUARE_ACCESS_TOKEN first 20 chars:', process.env.SQUARE_ACCESS_TOKEN?.substring(0, 20));
console.log('SQUARE_ACCESS_TOKEN last 10 chars:', process.env.SQUARE_ACCESS_TOKEN?.slice(-10));
console.log('');

// Test with the exact token from curl that worked
const WORKING_TOKEN = 'EAAAl6y0kff32vTU11-W3l1HDOKp7VKaOTIzeSK4quk3-RgZlaENcXz_qIIuZocX';

console.log('Comparing tokens:');
console.log('ENV token === WORKING token:', process.env.SQUARE_ACCESS_TOKEN === WORKING_TOKEN);
console.log('');

// Test with working token directly
const squareClient = new SquareClient({
  accessToken: WORKING_TOKEN,
  environment: SquareEnvironment.Sandbox
});

async function testWithWorkingToken() {
  try {
    console.log('🧪 Testing with hardcoded working token...');
    const response = await squareClient.locations.list();
    console.log('✅ SUCCESS! Token works with SDK');
    console.log('Locations found:', response.locations?.length || 0);
  } catch (error) {
    console.log('❌ FAILED with working token');
    console.log('Error:', error.message);
  }
}

testWithWorkingToken();