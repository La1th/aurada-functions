// Test script for complete order and payment link workflow
require('dotenv').config();
const { createOrderAndPaymentLink } = require('./createOrderAndPaymentLink');
const { randomUUID } = require('crypto');

async function testCompleteWorkflow() {
  console.log('🧪 Testing Complete Order and Payment Link Workflow\n');

  // Test complete workflow: cart → order → payment link → SMS
  console.log('--- Complete Workflow Test ---');
  const cartData = {
    updatedCart: [
      {
        item_name: "Single Sandwich",
        price_money: { amount: "499", currency: "USD" },
        square_item_id: "test-item-1",
        square_variation_id: "test-variation-1",
        description: "Delicious chicken sandwich",
        quantity: 2,
        specialInstructions: "",
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
        description: "Refreshing beverage",
        quantity: 1,
        specialInstructions: "",
        unitPrice: 2.29,
        lineTotal: 2.29,
        itemId: "test-variation-2",
        name: "Soda"
      }
    ],
    cartSummary: {
      items: [], // Simplified for testing
      itemCount: 3,
      subtotal: 12.27,
      message: "Tax will be calculated by Square at checkout"
    },
    customerInfo: {
      name: "Test Customer",
      phone: "+17039699580"
    },
    locationId: process.env.SQUARE_LOCATION_ID,
    description: "Test order via Voice AI"
  };

  try {
    const event = {
      rawPath: "/create-order-payment-link",
      requestContext: { http: { method: "POST" } },
      body: JSON.stringify(cartData)
    };
    
    const result = await createOrderAndPaymentLink(event);
    const responseBody = JSON.parse(result.body);

    if (!responseBody.success || !responseBody.paymentLink || !responseBody.paymentLink.url) {
      console.error('❌ FAILED! Complete workflow test failed.');
      console.error('Response:', responseBody);
      throw new Error('Complete workflow test failed.');
    }

    console.log('✅ SUCCESS! Complete workflow executed successfully!');
    console.log(`🆔 Order ID: ${responseBody.paymentLink.orderId}`);
    console.log(`💳 Payment URL: ${responseBody.paymentLink.url}`);
    console.log(`💰 Subtotal: $${(responseBody.orderSummary.subtotal / 100).toFixed(2)}`);
    console.log(`📦 Items: ${responseBody.orderSummary.itemCount}`);
    console.log(`📱 SMS Result:`, responseBody.smsResult ? '✅ Sent' : '⚠️ Not sent');

  } catch (error) {
    console.error('❌ Complete workflow test failed:', error.message);
    throw error;
  }
}

async function testSandboxEnvironment() {
  console.log('\n🧪 Testing Sandbox Environment\n');
  
  console.log('--- Sandbox Environment Test ---');
  const sandboxCartData = {
    updatedCart: [
      {
        item_name: "Chicken Rice Bowl",
        price_money: { amount: "799", currency: "USD" },
        square_item_id: "sandbox-item-1",
        square_variation_id: "sandbox-variation-1",
        description: "Chicken bowl with rice",
        quantity: 1,
        specialInstructions: "Extra sauce",
        unitPrice: 7.99,
        lineTotal: 7.99,
        itemId: "sandbox-variation-1",
        name: "Chicken Rice Bowl"
      }
    ],
    cartSummary: {
      items: [],
      itemCount: 1,
      subtotal: 7.99,
      message: "Tax will be calculated by Square at checkout"
    },
    customerInfo: {
      name: "Sandbox Customer",
      phone: "+15551234567"
    },
    locationId: process.env.SQUARE_LOCATION_ID
  };

  try {
    const event = {
      rawPath: "/sandbox/create-order-payment-link", // Sandbox path
      requestContext: { http: { method: "POST" } },
      body: JSON.stringify(sandboxCartData)
    };
    
    const result = await createOrderAndPaymentLink(event);
    const responseBody = JSON.parse(result.body);

    if (!responseBody.success || !responseBody.paymentLink || !responseBody.paymentLink.url) {
      console.error('❌ FAILED! Sandbox test failed.');
      console.error('Response:', responseBody);
      throw new Error('Sandbox test failed.');
    }

    console.log('✅ SUCCESS! Sandbox environment works correctly!');
    console.log(`💳 Sandbox Payment URL: ${responseBody.paymentLink.url}`);

  } catch (error) {
    console.error('❌ Sandbox test failed:', error.message);
    throw error;
  }
}

async function testErrorHandling() {
  console.log('\n🧪 Testing Error Handling\n');
  
  console.log('--- Error Handling Test ---');
  const invalidCartData = {
    // Missing required updatedCart field
    cartSummary: {
      items: [],
      itemCount: 0,
      subtotal: 0,
      message: "Empty cart"
    }
  };

  try {
    const event = {
      rawPath: "/create-order-payment-link",
      requestContext: { http: { method: "POST" } },
      body: JSON.stringify(invalidCartData)
    };
    
    const result = await createOrderAndPaymentLink(event);
    const responseBody = JSON.parse(result.body);

    if (result.statusCode === 400 && responseBody.error) {
      console.log('✅ SUCCESS! Error handling works correctly!');
      console.log(`⚠️ Expected error: ${responseBody.error}`);
    } else {
      console.error('❌ FAILED! Expected 400 error but got:', result.statusCode);
      console.error('Response:', responseBody);
    }

  } catch (error) {
    console.error('❌ Error handling test failed:', error.message);
  }
}

// Main execution
(async () => {
  if (!process.env.SQUARE_ACCESS_TOKEN || !process.env.SQUARE_LOCATION_ID) {
    console.error('🔴 Missing Square credentials in .env file. Please add SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID.');
    process.exit(1);
  }
  
  console.log('🟢 Square credentials found, running complete workflow tests...\n');
  
  try {
    // Test complete workflow
    await testCompleteWorkflow();
    
    console.log('\n' + '='.repeat(50));
    
    // Test sandbox environment
    await testSandboxEnvironment();
    
    console.log('\n' + '='.repeat(50));
    
    // Test error handling
    await testErrorHandling();
    
    console.log('\n🎉 All workflow tests completed successfully!');
  } catch (error) {
    console.error('\n💥 One or more tests failed.');
    process.exit(1);
  }
})(); 