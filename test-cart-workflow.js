// Test script for the new cart-based workflow
require('dotenv').config();

const { addToCart } = require('./cart');
const { createOrderAndPaymentLink } = require('./createOrderAndPaymentLink');

async function testCartWorkflow() {
  console.log('🧪 Testing new cart-based workflow...\n');

  // Step 1: Start with empty cart and add items
  console.log('Step 1: Adding items to cart with DynamoDB validation');
  
  let currentCart = [];
  
  // Add first item
  const addItem1 = {
    body: {
      currentCart: currentCart,
      itemName: 'Single Sandwich',
      quantity: 2,
      specialInstructions: 'No pickles'
    }
  };
  
  try {
    const result1 = await addToCart(addItem1);
    const parsed1 = JSON.parse(result1.body);
    console.log('✅ Added Single Sandwich:', parsed1.message);
    currentCart = parsed1.updatedCart;
  } catch (error) {
    console.error('❌ Error adding first item:', error.message);
    return;
  }

  // Add second item
  const addItem2 = {
    body: {
      currentCart: currentCart,
      itemName: 'Soda',
      quantity: 1,
      specialInstructions: 'Coca Cola'
    }
  };
  
  try {
    const result2 = await addToCart(addItem2);
    const parsed2 = JSON.parse(result2.body);
    console.log('✅ Added Soda:', parsed2.message);
    currentCart = parsed2.updatedCart;
    
    console.log('\n📋 Final Cart:');
    currentCart.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.name} x${item.quantity} = $${item.lineTotal.toFixed(2)}`);
      if (item.specialInstructions) {
        console.log(`     Note: ${item.specialInstructions}`);
      }
    });
    console.log(`💰 Cart Subtotal: $${parsed2.cartSummary.subtotal} (+ tax by Square)`);
    
    // Step 2: Create payment link from validated cart
    console.log('\n' + '='.repeat(60));
    console.log('Step 2: Creating payment link from validated cart');
    
    const paymentRequest = {
      body: {
        updatedCart: parsed2.updatedCart,
        cartSummary: parsed2.cartSummary,
        customerInfo: {
          name: 'John Doe',
          phone: '+17039699580'
        },
        description: 'Voice AI Order - Cart Workflow Test'
      }
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