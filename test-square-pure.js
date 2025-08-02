// Test script for payment link creation using cart data format
require('dotenv').config();
const { createOrderAndPaymentLink } = require('./createOrderAndPaymentLink');

async function testOrderAndPaymentLink() {
  console.log('🧪 Testing Order and Payment Link Creation\n');

  // Test with cart data format (like from addToCart function)
  const cartData = {
    updatedCart: [
      {
        item_name: "Single Sandwich",
        price_money: { amount: "499", currency: "USD" },
        square_item_id: "test-item-1",
        square_variation_id: "test-variation-1",
        description: "Delicious chicken sandwich",
        quantity: 2,
        specialInstructions: "No pickles",
        unitPrice: 4.99,
        lineTotal: 9.98,
        itemId: "test-variation-1",
        name: "Single Sandwich"
      },
      {
        item_name: "Soda",
        price_money: { amount: "229", currency: "USD" },
        square_item_id: "test-item-2", 
        square_variation_id: "test-variation-2",
        description: "Refreshing soda",
        quantity: 1,
        specialInstructions: "",
        unitPrice: 2.29,
        lineTotal: 2.29,
        itemId: "test-variation-2",
        name: "Soda"
      }
    ],
    cartSummary: {
      items: [], // Would contain the same items but this is for testing
      itemCount: 3,
      subtotal: 12.27,
      message: "Tax will be calculated by Square at checkout"
    },
    customerInfo: {
      name: "Test Customer",
      phone: "+17039699580"
    },
    locationId: process.env.SQUARE_LOCATION_ID
  };

  const request = {
    rawPath: "/create-order-payment-link", // Production path
    requestContext: { http: { method: "POST" } },
    body: JSON.stringify(cartData)
  };

  try {
    console.log('Testing order and payment link creation...');
    console.log('Request structure:', {
      hasUpdatedCart: !!cartData.updatedCart,
      hasCartSummary: !!cartData.cartSummary,
      itemCount: cartData.updatedCart.length,
      locationId: cartData.locationId
    });
    
    const result = await createOrderAndPaymentLink(request);
    
    console.log('\n--- Order and Payment Link Response ---');
    console.log('Status Code:', result.statusCode);
    
    const responseBody = JSON.parse(result.body);
    console.log('Response Body Keys:', Object.keys(responseBody));
    
    if (result.statusCode === 200) {
      console.log('\n✅ SUCCESS! Order and payment link created successfully!');
      console.log('💳 Payment URL:', responseBody.paymentLink.url);
      console.log('🆔 Order ID:', responseBody.paymentLink.orderId);
      console.log('📦 Items:', responseBody.orderSummary.itemCount);
      console.log('💰 Subtotal: $', (responseBody.orderSummary.subtotal / 100).toFixed(2));
    } else {
      console.log('\n❌ FAILED! Order and payment link creation failed');
      console.log('Error:', responseBody.error);
      console.log('Details:', responseBody.details);
    }
    
  } catch (error) {
    console.error('❌ Test failed with exception:', error);
  }
}

// Test with minimal cart data
async function testMinimalCart() {
  console.log('\n🧪 Testing Minimal Cart Data\n');

  const minimalCartData = {
    updatedCart: [
      {
        item_name: "Chicken Rice Bowl",
        price_money: { amount: "799", currency: "USD" },
        square_item_id: "test-item-3",
        square_variation_id: "test-variation-3", 
        description: "Chicken bowl with rice",
        quantity: 1,
        specialInstructions: "",
        unitPrice: 7.99,
        lineTotal: 7.99,
        itemId: "test-variation-3",
        name: "Chicken Rice Bowl"
      }
    ],
    cartSummary: {
      items: [],
      itemCount: 1,
      subtotal: 7.99,
      message: "Tax will be calculated by Square at checkout"
    },
    locationId: process.env.SQUARE_LOCATION_ID
  };

  const request = {
    rawPath: "/create-order-payment-link",
    requestContext: { http: { method: "POST" } },
    body: JSON.stringify(minimalCartData)
  };

  try {
    console.log('Testing minimal cart order creation...');
    
    const result = await createOrderAndPaymentLink(request);
    
    console.log('\n--- Minimal Cart Response ---');
    console.log('Status Code:', result.statusCode);
    
    const responseBody = JSON.parse(result.body);
    
    if (result.statusCode === 200) {
      console.log('\n✅ SUCCESS! Minimal cart order created successfully!');
      console.log('💳 Payment URL:', responseBody.paymentLink.url);
    } else {
      console.log('\n❌ FAILED! Minimal cart order creation failed');
      console.log('Error:', responseBody.error);
    }
    
  } catch (error) {
    console.error('❌ Minimal test failed:', error);
  }
}

// Only run test if environment variables are set
if (process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_LOCATION_ID) {
  console.log('🟢 Square credentials found, running order and payment link tests...\n');
  testOrderAndPaymentLink().then(() => {
    return testMinimalCart();
  });
} else {
  console.log('⚠️  Please set up your .env file with Square credentials to run tests');
  console.log('Required: SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID');
  console.log('Current environment:', process.env.SQUARE_ENVIRONMENT || 'sandbox');
} 