module.exports.handleInboundCall = async (event) => {
  console.log('Handling inbound call webhook...');
  
  try {
    // Parse the request body
    let body;
    if (typeof event.body === 'string') {
      body = JSON.parse(event.body);
    } else {
      body = event.body;
    }

    console.log('Inbound call payload:', JSON.stringify(body, null, 2));

    // Validate that this is a call_inbound event
    if (body.event !== 'call_inbound') {
      console.error('Invalid event type:', body.event);
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({
          error: 'Invalid event type. Expected call_inbound',
          received: body.event
        })
      };
    }

    // Extract the from_number from the call_inbound object
    const fromNumber = body.call_inbound?.from_number;
    
    if (!fromNumber) {
      console.error('Missing from_number in call_inbound payload');
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({
          error: 'Missing from_number in call_inbound payload',
          received: body.call_inbound
        })
      };
    }

    console.log('Extracted from_number:', fromNumber);

    // Return the response with caller_number as dynamic variable
    const response = {
      call_inbound: {
        dynamic_variables: {
          caller_number: fromNumber
        }
      }
    };

    console.log('Returning response:', JSON.stringify(response, null, 2));

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('Error handling inbound call:', error);
    
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