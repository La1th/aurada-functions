// Script to store Square API keys in AWS Secrets Manager
require('dotenv').config();
const AWS = require('aws-sdk');

// Configure AWS region
AWS.config.update({ 
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const secretsManager = new AWS.SecretsManager();

async function storeSquareSecrets() {
  console.log('🔐 Storing Square API keys in AWS Secrets Manager...\n');
  
  // Check if required environment variables exist
  if (!process.env.SQUARE_ACCESS_TOKEN || !process.env.SQUARE_APPLICATION_ID || !process.env.SQUARE_LOCATION_ID) {
    console.error('❌ Missing Square credentials in .env file');
    console.error('Required: SQUARE_ACCESS_TOKEN, SQUARE_APPLICATION_ID, SQUARE_LOCATION_ID');
    process.exit(1);
  }
  
  const secretName = 'square-api-keys';
  const secretValue = {
    SQUARE_ACCESS_TOKEN: process.env.SQUARE_ACCESS_TOKEN,
    SQUARE_APPLICATION_ID: process.env.SQUARE_APPLICATION_ID,
    SQUARE_LOCATION_ID: process.env.SQUARE_LOCATION_ID,
    SQUARE_ENVIRONMENT: process.env.SQUARE_ENVIRONMENT || 'sandbox'
  };
  
  try {
    // Try to create the secret
    const params = {
      Name: secretName,
      Description: 'Square API credentials for Red Bird Chicken ordering system',
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
  
  console.log('\n🎉 Square API keys are now securely stored in AWS Secrets Manager!');
  console.log('Secret name:', secretName);
  console.log('Region:', process.env.AWS_REGION || 'us-east-1');
}

// Run the script
storeSquareSecrets().catch(console.error); 