// Test script for Square order creation and payment link
require('dotenv').config();
const { createSquareOrder } = require('./createSquareOrder');
const { createPaymentLink } = require('./createPaymentLink');
const { randomUUID } = require('crypto');

async function testEndToEnd() {
  console.log('🧪 Testing End-to-End Order and Payment Link Creation\n');

  // Step 1: Create the Order
  console.log('--- Step 1: Creating Square Order ---');
  const orderPayload = {
    idempotencyKey: randomUUID(),
    order: {
      locationId: process.env.SQUARE_LOCATION_ID,
      lineItems: [
        { name: "Single Sandwich", quantity: "2", basePriceMoney: { amount: 499, currency: "USD" } },
        { name: "Soda", quantity: "1", basePriceMoney: { amount: 229, currency: "USD" } }
      ],
      customerName: "Test Customer",
      customerPhone: "+15005550006"
    }
  };

  try {
    const orderEvent = { body: JSON.stringify(orderPayload) };
    const orderResult = await createSquareOrder(orderEvent);
    const orderBody = JSON.parse(orderResult.body);

    if (!orderBody.success || !orderBody.order || !orderBody.order.id) {
      console.error('❌ FAILED! Square order creation failed.');
      console.error('Response:', orderBody);
      throw new Error('Order creation test failed.');
    }

    console.log('✅ SUCCESS! Square order created successfully!');
    console.log(`🆔 Order ID: ${orderBody.order.id}`);
    console.log(`💰 Total Amount: $${(parseInt(orderBody.order.totalMoney.amount) / 100).toFixed(2)}\n`);

    // Store the original order payload for later use in creating the payment link
    global.originalOrderPayload = orderPayload;

  } catch (error) {
    console.error('❌ Test failed during order creation:', error.message);
    throw error;
  }
  
  // Step 2: Create the Payment Link using the original order payload (remapped to expected format)
  console.log('--- Step 2: Creating Payment Link (order-based) ---');

  const originalOrder = global.originalOrderPayload.order;
  const orderForPaymentLink = {
    locationId: originalOrder.locationId,
    lineItems: originalOrder.lineItems.map(item => ({
      name: item.name,
      quantity: item.quantity,
      basePriceMoney: {
        amount: item.basePriceMoney.amount,
        currency: item.basePriceMoney.currency
      }
    }))
  };

  const linkPayload = {
    order: orderForPaymentLink,
    customerName: originalOrder.customerName,
    customerPhone: originalOrder.customerPhone
  };

  try {
    const linkEvent = { body: JSON.stringify(linkPayload) };
    const linkResult = await createPaymentLink(linkEvent);
    const linkBody = JSON.parse(linkResult.body);

    if (!linkBody.success || !linkBody.paymentLink || !linkBody.paymentLink.url) {
      console.error('❌ FAILED! Payment link creation test failed.');
      console.error('Response:', linkBody);
      throw new Error('Payment link test failed.');
    }

    console.log('✅ SUCCESS! Payment link created successfully!');
    console.log(`💳 Payment URL: ${linkBody.paymentLink.url}`);

  } catch (error) {
    console.error('❌ Test failed during payment link creation:', error.message);
    throw error;
  }
}

// Modify testPaymentLinkOnly to use the global original order payload
async function testPaymentLinkOnly() {
  console.log('🧪 Testing Payment Link Creation Only\n');
  
  if (!global.originalOrderPayload) {
    console.error('No original order payload found from previous order creation test.');
    throw new Error('Missing global original order payload');
  }

  const linkPayload = {
    order: global.originalOrderPayload.order,
    customerName: global.originalOrderPayload.order.customerName,
    customerPhone: global.originalOrderPayload.order.customerPhone
  };

  try {
    const linkEvent = { body: JSON.stringify(linkPayload) };
    const linkResult = await createPaymentLink(linkEvent);
    const linkBody = JSON.parse(linkResult.body);

    if (!linkBody.success || !linkBody.paymentLink || !linkBody.paymentLink.url) {
      console.error('❌ FAILED! Payment link creation test failed.');
      console.error('Response:', linkBody);
      throw new Error('Payment link test failed.');
    }

    console.log('✅ SUCCESS! Payment link created successfully!');
    console.log(`💳 Payment URL: ${linkBody.paymentLink.url}`);
  } catch (error) {
    console.error('❌ Test failed during payment link creation:', error.message);
    throw error;
  }
}

// Main execution
(async () => {
  if (!process.env.SQUARE_ACCESS_TOKEN || !process.env.SQUARE_LOCATION_ID) {
    console.error('🔴 Missing Square credentials in .env file. Please add SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID.');
    process.exit(1);
  }
  
  console.log('🟢 Square credentials found, running tests...\n');
  
  try {
    // Test both order creation and payment link creation together
    await testEndToEnd();
    
    console.log('\n' + '='.repeat(50));
    
    // Test payment link creation only using the original order payload
    await testPaymentLinkOnly();
    
    console.log('\n🎉 All tests passed successfully!');
  } catch (error) {
    console.error('\n💥 One or more tests failed.');
    process.exit(1);
  }
})(); 