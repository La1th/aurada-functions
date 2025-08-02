// Script to store Square OAuth credentials in AWS Secrets Manager
require('dotenv').config();
const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ 
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const secretsManager = new AWS.SecretsManager();

async function storeSquareOAuthSecrets() {
  console.log('🔐 Storing Square OAuth credentials in AWS Secrets Manager...\n');
  
  // Check if required environment variables exist
  if (!process.env.SQUARE_APPLICATION_ID || !process.env.SQUARE_APPLICATION_SECRET) {
    console.error('❌ Missing Square OAuth credentials in .env file');
    console.error('Required: SQUARE_APPLICATION_ID, SQUARE_APPLICATION_SECRET');
    console.error('');
    console.error('These credentials come from your Square Developer Console:');
    console.error('1. Go to https://developer.squareup.com/apps');
    console.error('2. Select your application');
    console.error('3. Find Application ID and Application Secret');
    console.error('4. Add them to your .env file');
    process.exit(1);
  }
  
  const secretName = 'square-oauth-keys';
  const secretValue = {
    SQUARE_APPLICATION_ID: process.env.SQUARE_APPLICATION_ID,
    SQUARE_APPLICATION_SECRET: process.env.SQUARE_APPLICATION_SECRET,
    SQUARE_ENVIRONMENT: process.env.SQUARE_ENVIRONMENT || 'sandbox'
  };
  
  try {
    // Try to create the secret
    const params = {
      Name: secretName,
      Description: 'Square OAuth credentials for restaurant authorization flow',
      SecretString: JSON.stringify(secretValue)
    };
    
    await secretsManager.createSecret(params).promise();
    console.log('✅ Successfully created secret:', secretName);
    
  } catch (error) {
    if (error.code === 'ResourceExistsException') {
      // Secret already exists, update it
      console.log('ℹ️ Secret already exists, updating...');
      
      const updateParams = {
        SecretId: secretName,
        SecretString: JSON.stringify(secretValue)
      };
      
      await secretsManager.updateSecret(updateParams).promise();
      console.log('✅ Successfully updated secret:', secretName);
      
    } else {
      console.error('❌ Error storing secret:', error.message);
      throw error;
    }
  }
  
  console.log('\n🎉 Square OAuth credentials are now securely stored in AWS Secrets Manager!');
  console.log('Secret name:', secretName);
  console.log('Region:', process.env.AWS_REGION || 'us-east-1');
  console.log('');
  console.log('📋 Next steps:');
  console.log('1. Deploy your functions: serverless deploy');
  console.log('2. Get your callback URL from the deployment output');
  console.log('3. Set the redirect URI in Square Developer Console');
  console.log('4. Test the OAuth flow');
}

// Run the script
storeSquareOAuthSecrets().catch(error => {
  console.error('💥 Failed to store OAuth secrets:', error);
  process.exit(1);
}); 