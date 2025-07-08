// Test script for the new createSquareOrder function
require('dotenv').config();

const { createSquareOrder } = require('./createSquareOrder');

async function testSquareOrder() {
  console.log('🧪 Testing createSquareOrder with menu integration...\n');

  // Test 1: Simple order with menu items
  console.log('Test 1: Simple order with existing menu items');
  const simpleOrder = {
    body: JSON.stringify({
      items: [
        {
          name: 'Single Sandwich',
          variation: 'Regular',
          quantity: 2,
          specialInstructions: 'No pickles'
        },
        {
          name: 'Soda',
          quantity: 1,
          specialInstructions: 'Coca Cola'
        },
        {
          name: 'Regular Fries',
          quantity: 1
        }
      ],
      customerInfo: {
        name: 'John Doe',
        phone: '+1234567890'
      }
    })
  };

  try {
    const result = await createSquareOrder(simpleOrder);
    console.log('✅ Simple order result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Simple order failed:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 2: Order with variations
  console.log('Test 2: Order with different variations');
  const variationOrder = {
    body: JSON.stringify({
      items: [
        {
          name: 'Single Sandwich',
          variation: 'Large',
          quantity: 1
        },
        {
          name: 'Chicken Rice Bowl',
          variation: 'Regular',
          quantity: 1,
          specialInstructions: 'Extra sauce'
        },
        {
          name: 'Single Tender',
          variation: 'Large',
          quantity: 3
        }
      ]
    })
  };

  try {
    const result = await createSquareOrder(variationOrder);
    console.log('✅ Variation order result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Variation order failed:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 3: Order with non-existent item (should handle gracefully)
  console.log('Test 3: Order with non-existent menu item');
  const invalidOrder = {
    body: JSON.stringify({
      items: [
        {
          name: 'Pizza', // This doesn't exist in our menu
          quantity: 1
        },
        {
          name: 'Single Sandwich', // This exists
          quantity: 1
        }
      ]
    })
  };

  try {
    const result = await createSquareOrder(invalidOrder);
    console.log('✅ Invalid item order result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Invalid item order failed:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 4: Large family order
  console.log('Test 4: Large family order');
  const familyOrder = {
    body: JSON.stringify({
      items: [
        {
          name: '2pc Sandwich w/ Fries',
          variation: 'Large',
          quantity: 2,
          specialInstructions: 'Extra crispy'
        },
        {
          name: 'Nuggets w/ Fries',
          quantity: 2
        },
        {
          name: '10pc Nuggets',
          quantity: 1
        },
        {
          name: 'Cheese Fries',
          quantity: 1,
          specialInstructions: 'Extra cheese'
        },
        {
          name: 'Soda',
          quantity: 4,
          specialInstructions: 'Mixed sodas'
        },
        {
          name: 'Toffee Cake',
          quantity: 2
        }
      ],
      customerInfo: {
        name: 'Smith Family',
        phone: '+1987654321',
        email: 'smith@example.com'
      }
    })
  };

  try {
    const result = await createSquareOrder(familyOrder);
    console.log('✅ Family order result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Family order failed:', error.message);
  }
}

// Run the tests
testSquareOrder(); 