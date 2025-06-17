// Local test script for the order processing function
require('dotenv').config();
const { processOrder } = require('./processOrder');

async function testOrderProcessing() {
  // Mock event data that your voice AI agent would send
  const mockEvent = {
    body: JSON.stringify({
      total: "420.69",
      customerPhone: "+17039699580", // Replace with your test phone number
    })
  };

  try {
    console.log('Testing order processing...');
    console.log('Mock order data:', JSON.parse(mockEvent.body));
    
    const result = await processOrder(mockEvent);
    
    console.log('\n--- Response ---');
    console.log('Status Code:', result.statusCode);
    console.log('Response Body:', JSON.parse(result.body));
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Only run test if environment variables are set
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  testOrderProcessing();
} else {
  console.log('⚠️  Please set up your .env file with Twilio credentials to run tests');
  console.log('Copy .env.example to .env and fill in your Twilio details');
} 