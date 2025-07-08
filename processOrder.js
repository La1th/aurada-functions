require('dotenv').config();
const https = require('https');

module.exports.processOrder = async (event) => {
  console.log('Processing order request...');
  
  try {
    // Parse the request body
    let body;
    if (typeof event.body === 'string') {
      body = JSON.parse(event.body);
    } else {
      body = event.body;
    }

    // Log only essential info, not the full body with timestamps
    console.log('Processing order request from:', body.name || 'unknown source');

    // Extract data - handle multiple formats
    let total, customerPhone, orderItems = [];
    
    if (body.args) {
      // Retell format: data is nested in 'args' object
      total = body.args.total;
      customerPhone = body.args.customerPhone;
      console.log('Using Retell format - args:', body.args);
    } else if (body.cartSummary) {
      // Cart format: extract from cart summary
      total = body.cartSummary.total;
      customerPhone = body.customerPhone;
      orderItems = body.cartSummary.items || [];
      console.log('Using cart format - items:', orderItems.length);
    } else {
      // Direct format: data is at root level
      total = body.total;
      customerPhone = body.customerPhone;
      console.log('Using direct format');
    }

    console.log('Extracted data:', { total, customerPhone, itemCount: orderItems.length });

    // Validate required fields
    if (!total || !customerPhone) {
      console.error('Missing required fields:', { total, customerPhone });
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({
          error: 'Missing required fields: total and customerPhone',
          received: { total, customerPhone }
        })
      };
    }

    // Format the total - check if dollar sign is already present
    const formattedTotal = total.toString().startsWith('$') ? total : `$${total}`;
    console.log('Formatted total:', formattedTotal);

    // Create order summary for SMS
    let orderSummary = '';
    if (orderItems.length > 0) {
      // Create itemized list
      const itemList = orderItems.map(item => {
        let itemText = `${item.quantity} ${item.name}`;
        if (item.specialInstructions) {
          itemText += ` (${item.specialInstructions})`;
        }
        return itemText;
      }).join(', ');
      
      orderSummary = `Your order: ${itemList}. `;
    }

    // Format the SMS message
    const message = `Thank you for choosing Red Bird Chicken! 🐔 Your order total is ${formattedTotal}.  No checkout needed — this was just a demo. Curious how this AI works? Visit www.aurada.ai to see how we can help your business grow.`;

    // Send SMS using TextBelt
    const smsResult = await sendSMS(customerPhone, message);
    
    console.log('SMS sent successfully:', smsResult);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({
        success: true,
        message: 'Order processed and SMS sent successfully',
        smsResult: smsResult,
        orderTotal: formattedTotal,
        itemCount: orderItems.length
      })
    };

  } catch (error) {
    console.error('Error processing order:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};

// Function to send SMS using TextBelt
async function sendSMS(phoneNumber, message) {
  return new Promise((resolve, reject) => {
    // Prepare form data for TextBelt
    const formData = new URLSearchParams();
    formData.append('phone', phoneNumber);
    formData.append('message', message);
    formData.append('key', process.env.TEXTBELT_API_KEY || 'textbelt');
    formData.append('sender', 'Falafel Inc');

    const postData = formData.toString();

    const options = {
      hostname: 'textbelt.com',
      port: 443,
      path: '/text',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.success) {
            resolve(result);
          } else {
            reject(new Error(`TextBelt error: ${result.error}`));
          }
        } catch (parseError) {
          reject(new Error(`Failed to parse TextBelt response: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
} 