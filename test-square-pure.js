// Test script for Square order creation using pure Square API format
require('dotenv').config();
const { createSquareOrder } = require('./createSquareOrder');

async function testPureSquareOrderCreation() {
  console.log('🧪 Testing Pure Square Order Creation\n');

  // Test with exact Square API format
  const squareOrderData = {
    idempotencyKey: `test-order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    order: {
      locationId: process.env.SQUARE_LOCATION_ID,
      lineItems: [
        {
          uid: "line-item-1",
          name: "Single Sandwich",
          quantity: "2",
          basePriceMoney: {
            amount: 499, // $4.99 in cents - will be converted to BigInt in the function
            currency: "USD"
          }
        },
        {
          uid: "line-item-2", 
          name: "Soda",
          quantity: "1",
          basePriceMoney: {
            amount: 229, // $2.29 in cents - will be converted to BigInt in the function
            currency: "USD"
          }
        }
      ],
      metadata: {
        customerPhone: "+17039699580",
        customerName: "Test Customer",
        source: "Voice AI Order"
      },
      fulfillments: [{
        type: "PICKUP",
        state: "PROPOSED",
        pickupDetails: {
          recipient: {
            displayName: "Test Customer"
          },
          note: "Order placed via Voice AI system"
        }
      }]
    }
  };

  const squareOrderRequest = {
    body: JSON.stringify(squareOrderData)
  };

  try {
    console.log('Testing Square order creation with pure Square format...');
    console.log('Request structure:', {
      hasIdempotencyKey: !!squareOrderData.idempotencyKey,
      hasOrder: !!squareOrderData.order,
      lineItemsCount: squareOrderData.order.lineItems.length,
      locationId: squareOrderData.order.locationId
    });
    
    const result = await createSquareOrder(squareOrderRequest);
    
    console.log('\n--- Pure Square Order Creation Response ---');
    console.log('Status Code:', result.statusCode);
    
    const responseBody = JSON.parse(result.body);
    console.log('Response Body:', responseBody);
    
    if (result.statusCode === 200) {
      console.log('\n✅ SUCCESS! Pure Square order created successfully!');
      console.log('🆔 Order ID:', responseBody.order.id);
      console.log('📍 Location ID:', responseBody.order.locationId);
      console.log('💰 Total Amount:', responseBody.order.totalMoney.amount, responseBody.order.totalMoney.currency);
      console.log('📦 Line Items:', responseBody.order.lineItems.length);
      console.log('🏷️  Order State:', responseBody.order.state);
    } else {
      console.log('\n❌ FAILED! Square order creation failed');
      console.log('Error:', responseBody.error);
      console.log('Details:', responseBody.details);
      if (responseBody.errors) {
        console.log('Square Errors:', responseBody.errors);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed with exception:', error);
  }
}

// Test with minimum required fields
async function testMinimalSquareOrder() {
  console.log('\n🧪 Testing Minimal Square Order\n');

  const minimalOrderData = {
    idempotencyKey: `minimal-order-${Date.now()}`,
    order: {
      locationId: process.env.SQUARE_LOCATION_ID,
      lineItems: [
        {
          name: "Chicken Rice Bowl",
          quantity: "1",
          basePriceMoney: {
            amount: 799, // $7.99 in cents - will be converted to BigInt in the function
            currency: "USD"
          }
        }
      ]
    }
  };

  const minimalOrderRequest = {
    body: JSON.stringify(minimalOrderData)
  };

  try {
    console.log('Testing minimal Square order creation...');
    
    const result = await createSquareOrder(minimalOrderRequest);
    
    console.log('\n--- Minimal Square Order Response ---');
    console.log('Status Code:', result.statusCode);
    
    const responseBody = JSON.parse(result.body);
    console.log('Response Body:', responseBody);
    
    if (result.statusCode === 200) {
      console.log('\n✅ SUCCESS! Minimal Square order created successfully!');
      console.log('🆔 Order ID:', responseBody.order.id);
    } else {
      console.log('\n❌ FAILED! Minimal Square order creation failed');
      console.log('Error:', responseBody.error);
    }
    
  } catch (error) {
    console.error('❌ Minimal test failed:', error);
  }
}

// Only run test if environment variables are set
if (process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_LOCATION_ID) {
  console.log('🟢 Square credentials found, running pure Square API tests...\n');
  testPureSquareOrderCreation().then(() => {
    return testMinimalSquareOrder();
  });
} else {
  console.log('⚠️  Please set up your .env file with Square credentials to run tests');
  console.log('Required: SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID');
  console.log('Current environment:', process.env.SQUARE_ENVIRONMENT || 'sandbox');
} 