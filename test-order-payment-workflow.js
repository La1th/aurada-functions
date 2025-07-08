// Test script for the complete order and payment link workflow
require('dotenv').config();

const { createOrderAndPaymentLink } = require('./createOrderAndPaymentLink');

async function testCompleteWorkflow() {
  console.log('🧪 Testing complete order and payment link workflow...\n');

  // Test 1: Simple order with payment link
  console.log('Test 1: Simple order with payment link creation');
  const simpleOrder = {
    body: JSON.stringify({
      locationId: process.env.SQUARE_LOCATION_ID, // Required for Square
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
        phone: '+17039699580'
      },
      description: 'Voice AI Order - Simple Lunch'
    })
  };

  try {
    const result = await createOrderAndPaymentLink(simpleOrder);
    console.log('✅ Simple order workflow result:');
    const parsed = JSON.parse(result.body);
    console.log('- Success:', parsed.success);
    console.log('- Message:', parsed.message);
    console.log('- Order Total:', `$${(parsed.orderSummary.total/100).toFixed(2)}`);
    console.log('- Items Count:', parsed.orderSummary.itemCount);
    console.log('- Payment Link URL:', parsed.paymentLink.url);
    console.log('- Order ID:', parsed.paymentLink.orderId);
  } catch (error) {
    console.error('❌ Simple order workflow failed:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 2: Family order with variations
  console.log('Test 2: Large family order with variations');
  const familyOrder = {
    body: JSON.stringify({
      locationId: process.env.SQUARE_LOCATION_ID,
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
        phone: '+17039699580'
      },
      description: 'Voice AI Order - Family Dinner',
      checkoutOptions: {
        enableCoupon: true,
        enableLoyalty: false,
        redirectUrl: 'https://redbird-chicken.com/order-complete'
      }
    })
  };

  try {
    const result = await createOrderAndPaymentLink(familyOrder);
    console.log('✅ Family order workflow result:');
    const parsed = JSON.parse(result.body);
    console.log('- Success:', parsed.success);
    console.log('- Message:', parsed.message);
    console.log('- Order Total:', `$${(parsed.orderSummary.total/100).toFixed(2)}`);
    console.log('- Items Count:', parsed.orderSummary.itemCount);
    console.log('- Payment Link URL:', parsed.paymentLink.url);
    console.log('- Order ID:', parsed.paymentLink.orderId);
    
    // Show detailed items
    console.log('\n📋 Order Details:');
    parsed.orderSummary.items.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.name} - ${item.variation} x${item.quantity} = $${(item.lineTotal/100).toFixed(2)}`);
      if (item.specialInstructions) {
        console.log(`     Note: ${item.specialInstructions}`);
      }
    });
    console.log(`\n💰 Subtotal: $${(parsed.orderSummary.subtotal/100).toFixed(2)}`);
    console.log(`💰 Tax: $${(parsed.orderSummary.taxAmount/100).toFixed(2)}`);
    console.log(`💰 Total: $${(parsed.orderSummary.total/100).toFixed(2)}`);
    
  } catch (error) {
    console.error('❌ Family order workflow failed:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 3: Order with invalid items (should handle gracefully)
  console.log('Test 3: Order with some invalid menu items');
  const mixedOrder = {
    body: JSON.stringify({
      locationId: process.env.SQUARE_LOCATION_ID,
      items: [
        {
          name: 'Pizza', // This doesn't exist
          quantity: 1
        },
        {
          name: 'Single Sandwich', // This exists
          quantity: 1
        },
        {
          name: 'Burger', // This doesn't exist
          quantity: 1
        },
        {
          name: 'Soda', // This exists
          quantity: 2
        }
      ],
      customerInfo: {
        name: 'Test Customer',
        phone: '+17039699580'
      },
      description: 'Voice AI Order - Mixed Items Test'
    })
  };

  try {
    const result = await createOrderAndPaymentLink(mixedOrder);
    console.log('✅ Mixed order workflow result:');
    const parsed = JSON.parse(result.body);
    console.log('- Success:', parsed.success);
    console.log('- Valid items processed:', parsed.orderSummary.items.length);
    console.log('- Order Total:', `$${(parsed.orderSummary.total/100).toFixed(2)}`);
    console.log('- Payment Link URL:', parsed.paymentLink.url);
    
    console.log('\n📋 Valid Items Found:');
    parsed.orderSummary.items.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.name} - ${item.variation} x${item.quantity}`);
    });
    
  } catch (error) {
    console.error('❌ Mixed order workflow failed:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 4: Error case - no location ID
  console.log('Test 4: Error handling - missing location ID');
  const errorOrder = {
    body: JSON.stringify({
      // Missing locationId
      items: [
        {
          name: 'Single Sandwich',
          quantity: 1
        }
      ]
    })
  };

  try {
    const result = await createOrderAndPaymentLink(errorOrder);
    const parsed = JSON.parse(result.body);
    console.log('✅ Error handling result:');
    console.log('- Status Code:', result.statusCode);
    console.log('- Error Message:', parsed.error);
  } catch (error) {
    console.error('❌ Error test failed:', error.message);
  }
}

// Run the tests
testCompleteWorkflow(); 