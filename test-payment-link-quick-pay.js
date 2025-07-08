// Test script for Square payment link creation using order approach
require('dotenv').config();
const { createPaymentLink } = require('./createPaymentLink');

async function testOrderPaymentLink() {
  console.log('🧪 Testing Order-Based Payment Link Creation\n');

  // Test data using actual Red Bird Chicken menu items
  const orderData = {
    description: "Payment for your Red Bird Chicken order",
    order: {
      locationId: process.env.SQUARE_LOCATION_ID,
      referenceId: `order-${Date.now()}`,
      source: {
        name: "Red Bird Chicken Voice AI"
      },
      lineItems: [
        {
          name: "Single Sandwich w/ Fries",
          quantity: "2",
          basePriceMoney: {
            amount: 799, // $7.99 in cents
            currency: "USD"
          }
        },
        {
          name: "2pc Tenders w/ Fries", 
          quantity: "1",
          basePriceMoney: {
            amount: 999, // $9.99 in cents
            currency: "USD"
          }
        },
        {
          name: "Soda",
          quantity: "3",
          basePriceMoney: {
            amount: 229, // $2.29 in cents
            currency: "USD"
          }
        }
      ],
      fulfillments: [
        {
          type: "PICKUP",
          state: "PROPOSED",
          pickupDetails: {
            recipient: {
              displayName: "Test Customer"
            },
            note: "Order placed via Red Bird Chicken voice AI system"
          }
        }
      ],
      metadata: {
        customerPhone: "+15005550006",
        orderSource: "voice-ai",
        specialInstructions: "Extra sauce packets please"
      }
    },
    checkoutOptions: {
      allowTipping: true
    },
    prePopulatedData: {
      buyerPhoneNumber: "+15005550006"
    },
    paymentNote: "Red Bird Chicken order payment via voice AI"
  };

  console.log('Test data:', {
    description: orderData.description,
    locationId: orderData.order.locationId ? 'Set' : 'Missing',
    lineItemsCount: orderData.order.lineItems.length,
    totalItems: orderData.order.lineItems.reduce((sum, item) => sum + parseInt(item.quantity), 0),
    estimatedTotal: `$${(orderData.order.lineItems.reduce((sum, item) => sum + (item.basePriceMoney.amount * parseInt(item.quantity)), 0) / 100).toFixed(2)}`
  });

  try {
    const event = { body: JSON.stringify(orderData) };
    const result = await createPaymentLink(event);
    
    console.log('\n--- Order Payment Link Response ---');
    console.log('Status Code:', result.statusCode);
    
    const responseBody = JSON.parse(result.body);
    
    if (result.statusCode === 200) {
      console.log('\n✅ SUCCESS! Payment link created successfully!');
      console.log('🆔 Payment Link ID:', responseBody.paymentLink.id);
      console.log('🔗 Payment URL:', responseBody.paymentLink.url);
      console.log('📱 Long URL:', responseBody.paymentLink.longUrl);
      console.log('📋 Order ID:', responseBody.paymentLink.orderId);
      console.log('📅 Created At:', responseBody.paymentLink.createdAt);
      
      if (responseBody.relatedResources) {
        console.log('\n📦 Related Order Information:');
        if (responseBody.relatedResources.orders && responseBody.relatedResources.orders.length > 0) {
          const order = responseBody.relatedResources.orders[0];
          console.log('  - Order State:', order.state);
          console.log('  - Total Amount:', order.totalMoney ? `$${(parseInt(order.totalMoney.amount) / 100).toFixed(2)}` : 'N/A');
          console.log('  - Line Items:', order.lineItems ? order.lineItems.length : 0);
          if (order.lineItems && order.lineItems.length > 0) {
            console.log('  - Items:');
            order.lineItems.forEach(item => {
              console.log(`    * ${item.quantity}x ${item.name} - $${(parseInt(item.basePriceMoney.amount) / 100).toFixed(2)}`);
            });
          }
        }
      }
    } else {
      console.log('\n❌ FAILED! Payment link creation failed');
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

async function testMinimalOrder() {
  console.log('\n🧪 Testing Minimal Order (Required Fields Only)\n');

  const minimalOrderData = {
    order: {
      locationId: process.env.SQUARE_LOCATION_ID,
      lineItems: [
        {
          name: "Single Sandwich",
          quantity: "1",
          basePriceMoney: {
            amount: 499 // $4.99 in cents, currency defaults to USD
          }
        }
      ]
    }
  };

  console.log('Minimal test data:', {
    locationId: minimalOrderData.order.locationId ? 'Set' : 'Missing',
    lineItemsCount: minimalOrderData.order.lineItems.length,
    itemName: minimalOrderData.order.lineItems[0].name,
    amount: `$${(minimalOrderData.order.lineItems[0].basePriceMoney.amount / 100).toFixed(2)}`
  });

  try {
    const event = { body: JSON.stringify(minimalOrderData) };
    const result = await createPaymentLink(event);
    
    console.log('\n--- Minimal Order Response ---');
    console.log('Status Code:', result.statusCode);
    
    const responseBody = JSON.parse(result.body);
    
    if (result.statusCode === 200) {
      console.log('\n✅ SUCCESS! Minimal order payment link created!');
      console.log('🔗 Payment URL:', responseBody.paymentLink.url);
    } else {
      console.log('\n❌ FAILED! Minimal order payment link creation failed');
      console.log('Error:', responseBody.error);
    }
    
  } catch (error) {
    console.error('❌ Minimal test failed:', error);
  }
}

async function testValidationErrors() {
  console.log('\n🧪 Testing Validation Error Handling\n');

  // Test missing required fields
  const invalidData = {
    description: "Test order",
    // Missing order object entirely
  };

  try {
    const event = { body: JSON.stringify(invalidData) };
    const result = await createPaymentLink(event);
    
    console.log('--- Validation Error Response ---');
    console.log('Status Code:', result.statusCode);
    
    const responseBody = JSON.parse(result.body);
    
    if (result.statusCode === 400) {
      console.log('✅ SUCCESS! Validation error properly handled');
      console.log('Error message:', responseBody.error);
    } else {
      console.log('❌ UNEXPECTED! Expected validation error but got:', responseBody);
    }
    
  } catch (error) {
    console.error('❌ Validation test failed:', error);
  }
}

async function testComplexOrder() {
  console.log('\n🧪 Testing Complex Order with Multiple Items and Options\n');

  const complexOrderData = {
    description: "Large family order from Red Bird Chicken",
    order: {
      locationId: process.env.SQUARE_LOCATION_ID,
      referenceId: `family-order-${Date.now()}`,
      customerId: "test-customer-123", // Optional customer ID
      source: {
        name: "Red Bird Chicken Voice AI System"
      },
      lineItems: [
        {
          name: "2pc Sandwich w/ Fries",
          quantity: "2",
          basePriceMoney: {
            amount: 1299, // $12.99
            currency: "USD"
          }
        },
        {
          name: "Chicken Rice Bowl",
          quantity: "1", 
          basePriceMoney: {
            amount: 799, // $7.99
            currency: "USD"
          }
        },
        {
          name: "10pc Nuggets",
          quantity: "1",
          basePriceMoney: {
            amount: 449, // $4.49
            currency: "USD"
          }
        },
        {
          name: "Cheese Fries",
          quantity: "2",
          basePriceMoney: {
            amount: 519, // $5.19 each
            currency: "USD"
          }
        },
        {
          name: "Soda",
          quantity: "4",
          basePriceMoney: {
            amount: 229, // $2.29 each
            currency: "USD"
          }
        },
        {
          name: "Toffee Cake",
          quantity: "2",
          basePriceMoney: {
            amount: 449, // $4.49 each
            currency: "USD"
          }
        }
      ],
      fulfillments: [
        {
          type: "DELIVERY",
          state: "PROPOSED",
          deliveryDetails: {
            recipient: {
              displayName: "The Johnson Family",
              phoneNumber: "+15005550006"
            },
            note: "Please ring doorbell, family order with kids"
          }
        }
      ],
      metadata: {
        customerPhone: "+15005550006",
        orderType: "family-meal",
        specialInstructions: "Extra napkins and sauce packets for kids",
        deliveryPreference: "contactless"
      }
    },
    checkoutOptions: {
      allowTipping: true,
      customFields: [
        {
          title: "Special Instructions",
          required: false
        }
      ]
    },
    prePopulatedData: {
      buyerPhoneNumber: "+15005550006",
      buyerEmailAddress: "johnson.family@example.com"
    },
    paymentNote: "Red Bird Chicken family dinner - contactless delivery preferred"
  };

  const totalAmount = complexOrderData.order.lineItems.reduce((sum, item) => 
    sum + (item.basePriceMoney.amount * parseInt(item.quantity)), 0
  );

  console.log('Complex order data:', {
    description: complexOrderData.description,
    lineItemsCount: complexOrderData.order.lineItems.length,
    totalItems: complexOrderData.order.lineItems.reduce((sum, item) => sum + parseInt(item.quantity), 0),
    estimatedTotal: `$${(totalAmount / 100).toFixed(2)}`,
    fulfillmentType: complexOrderData.order.fulfillments[0].type,
    allowTipping: complexOrderData.checkoutOptions.allowTipping
  });

  try {
    const event = { body: JSON.stringify(complexOrderData) };
    const result = await createPaymentLink(event);
    
    console.log('\n--- Complex Order Response ---');
    console.log('Status Code:', result.statusCode);
    
    const responseBody = JSON.parse(result.body);
    
    if (result.statusCode === 200) {
      console.log('\n✅ SUCCESS! Complex order payment link created!');
      console.log('🔗 Payment URL:', responseBody.paymentLink.url);
      console.log('📋 Order ID:', responseBody.paymentLink.orderId);
    } else {
      console.log('\n❌ FAILED! Complex order payment link creation failed');
      console.log('Error:', responseBody.error);
      if (responseBody.details) {
        console.log('Details:', responseBody.details);
      }
    }
    
  } catch (error) {
    console.error('❌ Complex order test failed:', error);
  }
}

// Main execution
(async () => {
  if (!process.env.SQUARE_ACCESS_TOKEN || !process.env.SQUARE_LOCATION_ID) {
    console.error('🔴 Missing Square credentials in .env file. Please add SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID.');
    process.exit(1);
  }
  
  console.log('🟢 Square credentials found, running order-based payment link tests...\n');
  
  try {
    // Test the main order functionality
    await testOrderPaymentLink();
    
    console.log('\n' + '='.repeat(60));
    
    // Test minimal required fields
    await testMinimalOrder();
    
    console.log('\n' + '='.repeat(60));
    
    // Test validation error handling
    await testValidationErrors();
    
    console.log('\n' + '='.repeat(60));
    
    // Test complex order with all optional fields
    await testComplexOrder();
    
    console.log('\n🎉 All order-based payment link tests completed!');
  } catch (error) {
    console.error('\n💥 Test suite failed:', error);
    process.exit(1);
  }
})(); 