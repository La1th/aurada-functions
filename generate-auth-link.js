// Script to generate Square OAuth authorization links for restaurant owners
require('dotenv').config();

function generateAuthLink(restaurantId, apiGatewayUrl) {
  if (!restaurantId) {
    console.error('❌ Restaurant ID is required');
    console.error('Usage: node generate-auth-link.js <restaurant_id>');
    process.exit(1);
  }
  
  if (!apiGatewayUrl) {
    console.error('❌ API Gateway URL is required');
    console.error('Usage: node generate-auth-link.js <restaurant_id> <api_gateway_url>');
    console.error('Example: node generate-auth-link.js redbird-chicken https://abc123.execute-api.us-east-1.amazonaws.com');
    process.exit(1);
  }
  
  // Remove trailing slash if present
  const cleanUrl = apiGatewayUrl.replace(/\/$/, '');
  
  // Generate the authorization link
  const authLink = `${cleanUrl}/square/authorize?restaurant_id=${encodeURIComponent(restaurantId)}`;
  
  return authLink;
}

function main() {
  const restaurantId = process.argv[2];
  const apiGatewayUrl = process.argv[3];
  
  if (!restaurantId || !apiGatewayUrl) {
    console.log('🔗 Generate Square OAuth Authorization Links');
    console.log('=====================================\n');
    console.log('Usage: node generate-auth-link.js <restaurant_id> <api_gateway_url>');
    console.log('');
    console.log('Examples:');
    console.log('  node generate-auth-link.js redbird-chicken https://abc123.execute-api.us-east-1.amazonaws.com');
    console.log('  node generate-auth-link.js pizza-palace https://def456.execute-api.us-east-1.amazonaws.com');
    console.log('');
    console.log('💡 Tips:');
    console.log('- Restaurant ID can be any unique identifier for the restaurant');
    console.log('- API Gateway URL comes from your Serverless deployment output');
    console.log('- The restaurant ID will be used to link their Square account to your system');
    console.log('');
    process.exit(0);
  }
  
  try {
    const authLink = generateAuthLink(restaurantId, apiGatewayUrl);
    
    console.log('🔗 Square OAuth Authorization Link Generated');
    console.log('==========================================\n');
    console.log(`🏪 Restaurant ID: ${restaurantId}`);
    console.log(`🔗 Authorization Link:`);
    console.log(`   ${authLink}`);
    console.log('');
    console.log('📋 Instructions for Restaurant Owner:');
    console.log('1. Click the link above');
    console.log('2. Log into their Square account');
    console.log('3. Review and accept the permissions');
    console.log('4. They will be redirected to a success page');
    console.log('');
    console.log('✅ Once authorized, you can create payment links using their Square account');
    console.log('');
    console.log('🔒 Security Note:');
    console.log('- Links are secure and expire after 10 minutes if not used');
    console.log('- Each restaurant gets their own unique authorization flow');
    console.log('- Tokens are stored securely in your AWS account');
    
  } catch (error) {
    console.error('❌ Error generating authorization link:', error.message);
    process.exit(1);
  }
}

// Run the script
main(); 