# Falafel Inc Order Processor

A serverless Lambda function built with Serverless Framework 4 and Node.js 22 that processes food orders from voice AI agents and sends SMS notifications via Twilio.

## Features

- ✅ Receives order data via HTTP POST endpoint
- ✅ Validates order information
- ✅ Sends SMS notifications with order total and payment link
- ✅ Built with Node.js 22 and Serverless Framework 4
- ✅ Integrated with Twilio for SMS delivery
- ✅ CORS enabled for web integration

## Setup

### Prerequisites

- Node.js 22 or higher
- AWS CLI configured with appropriate permissions
- Twilio account with SMS capabilities
- Serverless Framework CLI

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your Twilio credentials:
   ```
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=your_twilio_phone_number
   ```

3. **Install Serverless CLI globally (if not already installed):**
   ```bash
   npm install -g serverless@4
   ```

## Usage

### Local Development

Run the function locally for testing:
```bash
npm run offline
```

Test with sample data:
```bash
npm test
```

### Deployment

Deploy to AWS:
```bash
npm run deploy
```

## API Documentation

### POST /process-order

Processes a food order and sends SMS notification.

**Request Body:**
```json
{
  "total": "23.45",
  "customerPhone": "+1234567890",
  "orderId": "ORD-001",
  "items": [
    "2x Falafel Wrap",
    "1x Hummus Bowl"
  ]
}
```

**Required Fields:**
- `total`: Order total amount (string or number)
- `customerPhone`: Customer's phone number in E.164 format

**Response (Success):**
```json
{
  "message": "Order processed and SMS sent successfully",
  "messageSid": "SM1234567890abcdef",
  "total": "23.45",
  "customerPhone": "+1234567890"
}
```

**Response (Error):**
```json
{
  "error": "Missing required fields: total and customerPhone"
}
```

## SMS Message Format

The SMS sent to customers follows this format:
```
Thank you for choosing Falafel Inc! 🥙 Your order total is $23.45. Please complete your payment here: https://stripe.com
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `TWILIO_ACCOUNT_SID` | Your Twilio Account SID | Yes |
| `TWILIO_AUTH_TOKEN` | Your Twilio Auth Token | Yes |
| `TWILIO_PHONE_NUMBER` | Your Twilio phone number | Yes |

## Testing

### Local Testing

1. Set up your `.env` file with valid Twilio credentials
2. Update the phone number in `test-local.js` to your test number
3. Run: `npm test`

### Integration with Voice AI

Your voice AI agent should send a POST request to the deployed endpoint with the order data. Example using curl:

```bash
curl -X POST https://your-api-gateway-url/process-order \
  -H "Content-Type: application/json" \
  -d '{
    "total": "23.45",
    "customerPhone": "+1234567890"
  }'
```

## Architecture

```
Voice AI Agent → API Gateway → Lambda Function → Twilio SMS
```

## Error Handling

The function includes comprehensive error handling for:
- Missing or invalid request data
- Twilio API errors
- JSON parsing errors
- Network issues

All errors are logged and return appropriate HTTP status codes.

## Security Considerations

- Environment variables are used for sensitive Twilio credentials
- CORS is configured for web integration
- Input validation prevents malformed requests
- Phone numbers should be in E.164 format (+1234567890)

## Future Enhancements

- [ ] Real payment link integration (Stripe, PayPal, etc.)
- [ ] Order tracking system
- [ ] Customer opt-out handling
- [ ] Multi-language support
- [ ] Order confirmation emails 