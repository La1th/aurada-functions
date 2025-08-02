// Test script for the new cart-based workflow
require('dotenv').config();

const { addToCart, getCartSummary } = require('./cart');
const { createOrderAndPaymentLink } = require('./createOrderAndPaymentLink');

async function testCartWorkflow() {
  console.log('🧪 Testing new cart-based workflow...\n');

  // Step 1: Start with empty cart and add items
  console.log('Step 1: Adding items to cart with DynamoDB validation');
  
  // Add first item
  const addItem1 = {
    body: JSON.stringify({
      call: {
        call_id: "test_workflow_123",
        to_number: "+17037057917"  // Vienna location phone number
      },
      args: {
        itemName: 'SINGLE SANDWICH',
        quantity: 2,
        specialInstructions: 'No pickles'
      }
    })
  };
  
  try {
    const result1 = await addToCart(addItem1);
    const parsed1 = JSON.parse(result1.body);
    console.log('✅ Added Single Sandwich:', parsed1.message);
  } catch (error) {
    console.error('❌ Error adding first item:', error.message);
    return;
  }

  // Add second item
  const addItem2 = {
    body: JSON.stringify({
      call: {
        call_id: "test_workflow_123",
        to_number: "+17037057917"  // Vienna location phone number
      },
      args: {
        itemName: 'SODA',
        quantity: 1,
        specialInstructions: 'Coca Cola'
      }
    })
  };
  
  try {
    const result2 = await addToCart(addItem2);
    const parsed2 = JSON.parse(result2.body);
    console.log('✅ Added Soda:', parsed2.message);
    
    // Get cart summary to see final cart
    console.log('\n📋 Getting Cart Summary:');
    const cartSummaryRequest = {
      body: JSON.stringify({
        call: {
          call_id: "test_workflow_123",
          to_number: "+17037057917"  // Vienna location phone number
        }
      })
    };
    
    const summaryResult = await getCartSummary(cartSummaryRequest);
    const summaryParsed = JSON.parse(summaryResult.body);
    console.log('Cart Summary:', summaryParsed.message);
    
    // Step 2: Create payment link from session cart
    console.log('\n' + '='.repeat(60));
    console.log('Step 2: Creating payment link from session cart');
    
    const paymentRequest = {
      body: JSON.stringify({
        call: {
          call_id: "test_workflow_123",
          to_number: "+17037057917"  // Vienna location phone number
        },
        customerInfo: {
          name: 'John Doe',
          phone: '+17039699580'
        },
        description: 'Voice AI Order - Cart Workflow Test'
      })
    };
    
    const paymentResult = await createOrderAndPaymentLink(paymentRequest);
    const paymentParsed = JSON.parse(paymentResult.body);
    
    if (paymentParsed.success) {
      console.log('✅ Payment link created successfully!');
      console.log('- Payment URL:', paymentParsed.paymentLink.url);
      console.log('- Order ID:', paymentParsed.paymentLink.orderId);
      console.log('- SMS Result:', paymentParsed.smsResult ? 'Sent' : 'Not sent');
      console.log('- Subtotal:', `$${(paymentParsed.orderSummary.subtotal / 100).toFixed(2)} + tax by Square`);
    } else {
      console.error('❌ Payment link creation failed:', paymentParsed.error);
    }
    
  } catch (error) {
    console.error('❌ Error in workflow:', error.message);
  }

  console.log('\n🎉 Cart workflow test completed!');
  console.log('\n💡 New Workflow Summary:');
  console.log('1. Voice agent uses addToCart (validates against DynamoDB)');
  console.log('2. Agent can use removeFromCart / getCartSummary as needed');
  console.log('3. When ready to checkout, use createOrderAndPaymentLink with cart data');
  console.log('4. No duplicate validation - faster and more efficient!');
}

// Run the test
testCartWorkflow().catch(console.error); 