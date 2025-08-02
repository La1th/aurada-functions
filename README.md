# Yapn Order Processor

A serverless Lambda function built with Serverless Framework 4 and Node.js 22 that processes food orders from voice AI agents and sends SMS notifications via Twilio.

## Features

- ✅ Receives order data via HTTP POST endpoint
- ✅ Validates order information
- ✅ Sends SMS notifications with order total and payment link
- ✅ Built with Node.js 22 and Serverless Framework 4
- ✅ Integrated with Twilio for SMS delivery
- ✅ CORS enabled for web integration
- ✅ **NEW: Stateless cart management system**
- ✅ **NEW: Flexible menu item matching**
- ✅ **NEW: Automatic tax calculation**

## Cart Management System

The cart management system provides three stateless functions that help AI agents manage customer orders accurately without requiring persistent storage.

### How It Works

1. **AI Agent maintains cart state** in its session memory
2. **AI calls cart functions** to add/remove items and calculate totals
3. **Functions return updated cart** which AI stores in memory
4. **No database required** - perfect for call-duration storage

### Cart Functions

#### POST /add-to-cart
Adds items to the cart with flexible name matching.

**Request:**
```json
{
  "currentCart": [],
  "itemName": "single sandwich",
  "quantity": 2,
  "specialInstructions": "no mayo"
}
```

**Response:**
```json
{
  "message": "Added 2 Single Sandwich to cart",
  "updatedCart": [...],
  "cartSummary": {
    "itemCount": 2,
    "subtotal": 9.98,
    "tax": 0.87,
    "total": 10.85
  }
}
```

#### POST /remove-from-cart
Removes or reduces items in the cart.

**Request:**
```json
{
  "currentCart": [...],
  "itemName": "sandwich",
  "quantityToRemove": 1
}
```

#### POST /get-cart-summary
Returns formatted cart summary for AI to read to customers.

**Request:**
```json
{
  "currentCart": [...],
  "taxRate": 0.0875
}
```

**Response:**
```json
{
  "message": "Your order: 2 Single Sandwich, 1 Soda. Subtotal: $12.27, Tax: $1.07, Total: $13.34",
  "cartSummary": {...}
}
```

### Flexible Item Matching

The system intelligently matches customer requests to menu items:

- **"fries"** → Regular Fries
- **"coke"** or **"soda"** → Soda
- **"sandwich"** → Single Sandwich
- **"nuggets"** → 5pc Nuggets
- **"tenders"** → Single Tender
- **"2pc sandwich with fries"** → 2pc Sandwich w/ Fries

### Integration with Voice AI

**AI Session Flow:**
```javascript
// Initialize empty cart when call starts
let currentCart = [];

// Customer: "I want two sandwiches"
const result = await addToCart({
  currentCart: currentCart,
  itemName: "sandwich",
  quantity: 2
});
currentCart = result.updatedCart; // AI updates its memory

// Customer: "What's my total?"
const summary = await getCartSummary({
  currentCart: currentCart
});
// AI reads: "Your order: 2 Single Sandwich. Total: $10.85"
```

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

Test cart functions:
```bash
npm run test-cart
```

Test order processing:
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

Processes a food order and sends SMS notification. Now supports both legacy format and cart-based orders.

**Cart-based Request:**
```json
{
  "cartSummary": {
    "total": 28.23,
    "items": [...]
  },
  "customerPhone": "+1234567890"
}
```

**Legacy Request (still supported):**
```json
{
  "total": "23.45",
  "customerPhone": "+1234567890"
}
```

**Response (Success):**
```json
{
  "message": "Order processed and SMS sent successfully",
  "messageSid": "SM1234567890abcdef",
  "orderTotal": "$28.23",
  "itemCount": 3
}
```

### POST /add-to-cart
See Cart Management System section above.

### POST /remove-from-cart
See Cart Management System section above.

### POST /get-cart-summary
See Cart Management System section above.

### POST /inbound-call
Handles incoming call webhooks from Retell AI.

### POST /postcall-analysis
Processes call analysis data and updates analytics.

## Menu

The system includes Red Bird Chicken's full menu with automatic pricing:

**Sandwiches**
- Single Sandwich – $4.99  
- Single Sandwich w/ Fries – $7.99  
- 2pc Sandwich w/ Fries – $12.99  

**Rice Bowl**
- Chicken Rice Bowl – $7.99  

**Tenders**
- Single Tender – $3.29  
- 2pc Tenders w/ Fries – $9.99  

**Nuggets**
- 5pc Nuggets – $2.29  
- 10pc Nuggets – $4.49  
- Nuggets w/ Fries – $7.99  

**Fries & Sides**
- Cheese Fries – $5.19  
- Regular Fries – $3.49  
- Mac & Cheese – $4.99  
- Slaw – $3.49  

**Loaded Fries**
- Chicken Cheese Fries – $13.99  

**Drinks**
- Soda – $2.29  
- Bottled Water – $1.99  

**Dessert**
- Toffee Cake – $4.49  

## SMS Message Format

**With Cart Items:**
```
Thank you for choosing Red Bird Chicken! 🐔 Your order: 2 Single Sandwich, 1 Soda. Your order total is $12.27. You can checkout using this link: squaredotcom.
```

**Legacy Format:**
```
Thank you for choosing Red Bird Chicken! 🐔 Your order total is $23.45. You can checkout using this link: squaredotcom.
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `TEXTBELT_API_KEY` | Your TextBelt API Key for SMS | Yes |

## Testing

### Cart System Testing

Test all cart functions:
```bash
npm run test-cart
```

### Local Testing

1. Set up your `.env` file with valid TextBelt credentials
2. Update the phone number in `test-local.js` to your test number
3. Run: `npm test`

### Integration with Voice AI

Configure these functions in your AI agent:

**Function Schemas:**
```json
{
  "name": "add_to_cart",
  "parameters": {
    "currentCart": "array",
    "itemName": "string", 
    "quantity": "number",
    "specialInstructions": "string"
  }
},
{
  "name": "remove_from_cart", 
  "parameters": {
    "currentCart": "array",
    "itemName": "string",
    "quantityToRemove": "number"
  }
},
{
  "name": "get_cart_summary",
  "parameters": {
    "currentCart": "array"
  }
}
```

## Architecture

```
Voice AI Agent → Cart Functions → Updated Cart State
     ↓
Final Order → Process Order → SMS via TextBelt
     ↓
Call Analysis → Analytics → DynamoDB
```

## Error Handling

The system includes comprehensive error handling for:
- Missing or invalid request data
- Unknown menu items (with suggestions)
- Invalid quantities
- Empty cart operations
- TextBelt API errors
- Network issues

## Security Considerations

- Environment variables are used for sensitive credentials
- CORS is configured for web integration
- Input validation prevents malformed requests
- Phone numbers should be in E.164 format (+1234567890)

## Future Enhancements

- [ ] Real payment link integration (Stripe, PayPal, etc.)
- [ ] Menu item modifiers (sizes, add-ons)
- [ ] Customer preferences storage
- [ ] Multi-language support
- [ ] Order confirmation emails
- [ ] Loyalty points system 