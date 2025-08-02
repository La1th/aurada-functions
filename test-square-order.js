// Test script for the createOrderAndPaymentLink function with cart data
require('dotenv').config();

const { createOrderAndPaymentLink } = require('./createOrderAndPaymentLink');

async function testOrderAndPaymentLink() {
  console.log('🧪 Testing createOrderAndPaymentLink with cart data...\n');

  // Test 1: Simple cart with menu items (simulating addToCart output)
  console.log('Test 1: Simple cart with existing menu items');
  const simpleCartData = {
    updatedCart: [
      {
        item_name: 'Single Sandwich',
        price_money: { amount: "499", currency: "USD" },
        square_item_id: 'test-item-1',
        square_variation_id: 'test-variation-1',
        description: 'Delicious chicken sandwich',
        quantity: 2,
        specialInstructions: 'No pickles',
        unitPrice: 4.99,
        lineTotal: 9.98,
        itemId: 'test-variation-1',
        name: 'Single Sandwich'
      },
      {
        item_name: 'Soda',
        price_money: { amount: "229", currency: "USD" },
        square_item_id: 'test-item-2',
        square_variation_id: 'test-variation-2',
        description: 'Refreshing beverage',
        quantity: 1,
        specialInstructions: 'Coca Cola',
        unitPrice: 2.29,
        lineTotal: 2.29,
        itemId: 'test-variation-2',
        name: 'Soda'
      },
      {
        item_name: 'Regular Fries',
        price_money: { amount: "299", currency: "USD" },
        square_item_id: 'test-item-3',
        square_variation_id: 'test-variation-3',
        description: 'Crispy potato fries',
        quantity: 1,
        specialInstructions: '',
        unitPrice: 2.99,
        lineTotal: 2.99,
        itemId: 'test-variation-3',
        name: 'Regular Fries'
      }
    ],
    cartSummary: {
      items: [], // Would contain same items but simplified for testing
      itemCount: 4,
      subtotal: 15.26,
      message: 'Tax will be calculated by Square at checkout'
    },
    customerInfo: {
      name: 'John Doe',
      phone: '+17039699580'
    },
    locationId: process.env.SQUARE_LOCATION_ID
  };

  const simpleRequest = {
    rawPath: "/create-order-payment-link",
    requestContext: { http: { method: "POST" } },
    body: JSON.stringify(simpleCartData)
  };

  try {
    const result = await createOrderAndPaymentLink(simpleRequest);
    console.log('✅ Simple cart result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Simple cart failed:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 2: Cart with multiple items
  console.log('Test 2: Cart with different menu items');
  const variationCartData = {
    updatedCart: [
      {
        item_name: 'Single Sandwich',
        price_money: { amount: "599", currency: "USD" },
        square_item_id: 'test-item-1',
        square_variation_id: 'test-variation-1-large',
        description: 'Large chicken sandwich',
        quantity: 1,
        specialInstructions: '',
        unitPrice: 5.99,
        lineTotal: 5.99,
        itemId: 'test-variation-1-large',
        name: 'Single Sandwich'
      },
      {
        item_name: 'Chicken Rice Bowl',
        price_money: { amount: "799", currency: "USD" },
        square_item_id: 'test-item-4',
        square_variation_id: 'test-variation-4',
        description: 'Chicken bowl with rice',
        quantity: 1,
        specialInstructions: 'Extra sauce',
        unitPrice: 7.99,
        lineTotal: 7.99,
        itemId: 'test-variation-4',
        name: 'Chicken Rice Bowl'
      },
      {
        item_name: 'Single Tender',
        price_money: { amount: "199", currency: "USD" },
        square_item_id: 'test-item-5',
        square_variation_id: 'test-variation-5',
        description: 'Crispy chicken tender',
        quantity: 3,
        specialInstructions: '',
        unitPrice: 1.99,
        lineTotal: 5.97,
        itemId: 'test-variation-5',
        name: 'Single Tender'
      }
    ],
    cartSummary: {
      items: [],
      itemCount: 5,
      subtotal: 19.95,
      message: 'Tax will be calculated by Square at checkout'
    },
    locationId: process.env.SQUARE_LOCATION_ID
  };

  const variationRequest = {
    rawPath: "/create-order-payment-link",
    requestContext: { http: { method: "POST" } },
    body: JSON.stringify(variationCartData)
  };

  try {
    const result = await createOrderAndPaymentLink(variationRequest);
    console.log('✅ Variation cart result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Variation cart failed:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 3: Test error handling with invalid cart data
  console.log('Test 3: Cart with missing required fields');
  const invalidCartData = {
    updatedCart: [
      {
        // Missing required fields like price_money
        item_name: 'Pizza',
        quantity: 1
      }
    ],
    cartSummary: {
      items: [],
      itemCount: 1,
      subtotal: 10.00,
      message: 'Tax will be calculated by Square at checkout'
    }
  };

  const invalidRequest = {
    rawPath: "/create-order-payment-link",
    requestContext: { http: { method: "POST" } },
    body: JSON.stringify(invalidCartData)
  };

  try {
    const result = await createOrderAndPaymentLink(invalidRequest);
    console.log('✅ Invalid cart result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Invalid cart failed:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 4: Large family cart
  console.log('Test 4: Large family cart');
  const familyCartData = {
    updatedCart: [
      {
        item_name: '2pc Sandwich w/ Fries',
        price_money: { amount: "1299", currency: "USD" },
        square_item_id: 'test-item-6',
        square_variation_id: 'test-variation-6',
        description: 'Two sandwiches with fries',
        quantity: 2,
        specialInstructions: 'Extra crispy',
        unitPrice: 12.99,
        lineTotal: 25.98,
        itemId: 'test-variation-6',
        name: '2pc Sandwich w/ Fries'
      },
      {
        item_name: 'Nuggets w/ Fries',
        price_money: { amount: "899", currency: "USD" },
        square_item_id: 'test-item-7',
        square_variation_id: 'test-variation-7',
        description: 'Nuggets with fries',
        quantity: 2,
        specialInstructions: '',
        unitPrice: 8.99,
        lineTotal: 17.98,
        itemId: 'test-variation-7',
        name: 'Nuggets w/ Fries'
      },
      {
        item_name: '10pc Nuggets',
        price_money: { amount: "1099", currency: "USD" },
        square_item_id: 'test-item-8',
        square_variation_id: 'test-variation-8',
        description: 'Ten piece nuggets',
        quantity: 1,
        specialInstructions: '',
        unitPrice: 10.99,
        lineTotal: 10.99,
        itemId: 'test-variation-8',
        name: '10pc Nuggets'
      },
      {
        item_name: 'Cheese Fries',
        price_money: { amount: "399", currency: "USD" },
        square_item_id: 'test-item-9',
        square_variation_id: 'test-variation-9',
        description: 'Fries with cheese sauce',
        quantity: 1,
        specialInstructions: 'Extra cheese',
        unitPrice: 3.99,
        lineTotal: 3.99,
        itemId: 'test-variation-9',
        name: 'Cheese Fries'
      },
      {
        item_name: 'Soda',
        price_money: { amount: "229", currency: "USD" },
        square_item_id: 'test-item-2',
        square_variation_id: 'test-variation-2',
        description: 'Refreshing beverage',
        quantity: 4,
        specialInstructions: 'Mixed sodas',
        unitPrice: 2.29,
        lineTotal: 9.16,
        itemId: 'test-variation-2',
        name: 'Soda'
      },
      {
        item_name: 'Toffee Cake',
        price_money: { amount: "349", currency: "USD" },
        square_item_id: 'test-item-10',
        square_variation_id: 'test-variation-10',
        description: 'Sweet toffee cake',
        quantity: 2,
        specialInstructions: '',
        unitPrice: 3.49,
        lineTotal: 6.98,
        itemId: 'test-variation-10',
        name: 'Toffee Cake'
      }
    ],
    cartSummary: {
      items: [],
      itemCount: 12,
      subtotal: 75.08,
      message: 'Tax will be calculated by Square at checkout'
    },
    customerInfo: {
      name: 'Smith Family',
      phone: '+17039699580',
      email: 'smith@example.com'
    },
    locationId: process.env.SQUARE_LOCATION_ID
  };

  const familyRequest = {
    rawPath: "/create-order-payment-link",
    requestContext: { http: { method: "POST" } },
    body: JSON.stringify(familyCartData)
  };

  try {
    const result = await createOrderAndPaymentLink(familyRequest);
    console.log('✅ Family cart result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Family cart failed:', error.message);
  }
}

// Run the tests
testOrderAndPaymentLink(); 