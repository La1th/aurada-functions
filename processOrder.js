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

    // Extract data - handle both direct format and Retell's nested format
    let total, customerPhone;
    
    if (body.args) {
      // Retell format: data is nested in 'args' object
      total = body.args.total;
      customerPhone = body.args.customerPhone;
      console.log('Using Retell format - args:', body.args);
    } else {
      // Direct format: data is at root level
      total = body.total;
      customerPhone = body.customerPhone;
      console.log('Using direct format');
    }

    console.log('Extracted data:', { total, customerPhone });

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
    const formattedTotal = total.startsWith('$') ? total : `$${total}`;
    console.log('Formatted total:', formattedTotal);

    // Format the SMS message
    const message = `Thank you for choosing Red Bird Chicken! 🐔 Your order total is ${formattedTotal}. You can checkout using this link: squaredotcom.`;

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
        smsResult: smsResult
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