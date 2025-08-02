// Test script for cart management functions
const { addToCart, removeFromCart, getCartSummary } = require('./cart');

async function runCartTests() {
  console.log('🧪 Starting Cart Function Tests\n');

  // Test 1: Add items to empty cart
  console.log('--- Test 1: Adding items to empty cart ---');
  
  let event1 = {
    body: JSON.stringify({
      call: {
        call_id: "test_call_123",
        to_number: "+17037057917"  // Vienna location phone number
      },
      args: {
        itemName: "SINGLE SANDWICH",
        quantity: 1,
        specialInstructions: ""
      }
    })
  };

  let result1 = await addToCart(event1);
  console.log('Add single sandwich result:', JSON.parse(result1.body));

  // Test 2: Add more items
  console.log('\n--- Test 2: Adding nuggets ---');
  
  let event2 = {
    body: JSON.stringify({
      call: {
        call_id: "test_call_123",
        to_number: "+17037057917"  // Vienna location phone number
      },
      args: {
        itemName: "10 PC NUGGETS",
        quantity: 1,
        specialInstructions: ""
      }
    })
  };

  let result2 = await addToCart(event2);
  console.log('Add 10pc nuggets result:', JSON.parse(result2.body));

  // Test 3: Add same item (should increase quantity)
  console.log('\n--- Test 3: Adding same item again ---');
  
  let event3 = {
    body: JSON.stringify({
      call: {
        call_id: "test_call_123",
        to_number: "+17037057917"  // Vienna location phone number
      },
      args: {
        itemName: "SINGLE SANDWICH",
        quantity: 2,
        specialInstructions: ""
      }
    })
  };

  let result3 = await addToCart(event3);
  console.log('Add more sandwiches result:', JSON.parse(result3.body));

  // Test 4: Add item with special instructions
  console.log('\n--- Test 4: Adding item with special instructions ---');
  
  let event4 = {
    body: JSON.stringify({
      call: {
        call_id: "test_call_123",
        to_number: "+17037057917"  // Vienna location phone number
      },
      args: {
        itemName: "CHICKEN RICE BOWL",
        quantity: 1,
        specialInstructions: "extra sauce"
      }
    })
  };

  let result4 = await addToCart(event4);
  console.log('Add rice bowl with special instructions:', JSON.parse(result4.body));

  // Test 5: Get cart summary
  console.log('\n--- Test 5: Getting cart summary ---');
  
  let event5 = {
    body: JSON.stringify({
      call: {
        call_id: "test_call_123",
        to_number: "+17037057917"  // Vienna location phone number
      }
    })
  };

  let result5 = await getCartSummary(event5);
  console.log('Cart summary result:', JSON.parse(result5.body));

  // Test 6: Remove some items
  console.log('\n--- Test 6: Removing items ---');
  
  let event6 = {
    body: JSON.stringify({
      call: {
        call_id: "test_call_123",
        to_number: "+17037057917"  // Vienna location phone number
      },
      args: {
        itemName: "SINGLE SANDWICH",
        quantityToRemove: 1
      }
    })
  };

  let result6 = await removeFromCart(event6);
  console.log('Remove 1 sandwich result:', JSON.parse(result6.body));

  // Test 7: Remove entire item
  console.log('\n--- Test 7: Removing entire item ---');
  
  let event7 = {
    body: JSON.stringify({
      call: {
        call_id: "test_call_123",
        to_number: "+17037057917"  // Vienna location phone number
      },
      args: {
        itemName: "NUGGETS"
      }
    })
  };

  let result7 = await removeFromCart(event7);
  console.log('Remove all nuggets result:', JSON.parse(result7.body));

  // Test 8: Test flexible item matching
  console.log('\n--- Test 8: Testing flexible item matching ---');
  
  let event8 = {
    body: JSON.stringify({
      call: {
        call_id: "test_call_123",
        to_number: "+17037057917"  // Vienna location phone number
      },
      args: {
        itemName: "FRIES",
        quantity: 1
      }
    })
  };

  let result8 = await addToCart(event8);
  console.log('Add "fries" (should match regular fries):', JSON.parse(result8.body));

  // Test 9: Test error case - invalid item
  console.log('\n--- Test 9: Testing invalid item ---');
  
  let event9 = {
    body: JSON.stringify({
      call: {
        call_id: "test_call_123",
        to_number: "+17037057917"  // Vienna location phone number
      },
      args: {
        itemName: "pizza",
        quantity: 1
      }
    })
  };

  let result9 = await addToCart(event9);
  console.log('Add invalid item result:', JSON.parse(result9.body));

  // Test 10: Final cart summary
  console.log('\n--- Test 10: Final cart summary ---');
  
  let event10 = {
    body: JSON.stringify({
      call: {
        call_id: "test_call_123",
        to_number: "+17037057917"  // Vienna location phone number
      }
    })
  };

  let result10 = await getCartSummary(event10);
  console.log('Final cart summary:', JSON.parse(result10.body));

  console.log('\n✅ All cart tests completed!');
}

// Run all tests
async function runAllTests() {
  try {
    await runCartTests();
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = { runCartTests }; 