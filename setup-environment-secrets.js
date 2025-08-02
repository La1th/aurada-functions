// Script to store environment-specific Square API keys in AWS Secrets Manager
require('dotenv').config();
const AWS = require('aws-sdk');

// Configure AWS region
AWS.config.update({ 
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const secretsManager = new AWS.SecretsManager();

async function setupEnvironmentSecrets() {
  console.log('🔐 Setting up environment-specific Square API secrets...\n');
  
  // Check for environment-specific credentials first
  const hasSeparateCredentials = !!(
    process.env.SQUARE_ACCESS_TOKEN_SANDBOX && 
    process.env.SQUARE_ACCESS_TOKEN_PRODUCTION
  );
  
  console.log('Configuration detected:');
  if (hasSeparateCredentials) {
    console.log('✅ Using separate credentials for each environment');
    console.log('   - SQUARE_ACCESS_TOKEN_SANDBOX found');
    console.log('   - SQUARE_ACCESS_TOKEN_PRODUCTION found');
  } else if (process.env.SQUARE_ACCESS_TOKEN) {
    console.log('✅ Using shared credentials with environment flags');
    console.log('   - SQUARE_ACCESS_TOKEN found (will use for both environments)');
  } else {
    console.error('❌ No Square credentials found in .env file');
    console.error('');
    console.error('Option 1: Separate credentials per environment');
    console.error('Required: SQUARE_ACCESS_TOKEN_SANDBOX, SQUARE_ACCESS_TOKEN_PRODUCTION');
    console.error('Optional: SQUARE_LOCATION_ID_SANDBOX, SQUARE_LOCATION_ID_PRODUCTION');
    console.error('');
    console.error('Option 2: Shared credentials (current setup)'); 
    console.error('Required: SQUARE_ACCESS_TOKEN, SQUARE_APPLICATION_ID, SQUARE_LOCATION_ID');
    process.exit(1);
  }
  
  console.log('');
  
  // Setup sandbox environment
  await setupEnvironmentSecret('sandbox', {
    accessToken: process.env.SQUARE_ACCESS_TOKEN_SANDBOX || process.env.SQUARE_ACCESS_TOKEN,
    applicationId: process.env.SQUARE_APPLICATION_ID_SANDBOX || process.env.SQUARE_APPLICATION_ID,
    locationId: process.env.SQUARE_LOCATION_ID_SANDBOX || process.env.SQUARE_LOCATION_ID
  });
  
  // Setup production environment  
  await setupEnvironmentSecret('production', {
    accessToken: process.env.SQUARE_ACCESS_TOKEN_PRODUCTION || process.env.SQUARE_ACCESS_TOKEN,
    applicationId: process.env.SQUARE_APPLICATION_ID_PRODUCTION || process.env.SQUARE_APPLICATION_ID,
    locationId: process.env.SQUARE_LOCATION_ID_PRODUCTION || process.env.SQUARE_LOCATION_ID
  });
  
  console.log('\n🎉 Environment-specific Square API secrets setup complete!');
  console.log('\n📋 Summary:');
  console.log('   - square-api-keys-sandbox → Sandbox Square API');
  console.log('   - square-api-keys-production → Production Square API');
  console.log('\n💡 Your functions will now automatically:');
  console.log('   - Use sandbox credentials for /sandbox/* paths');
  console.log('   - Use production credentials for other paths');
  console.log('\n🚀 You can now deploy with: npm run deploy');
}

async function setupEnvironmentSecret(environment, credentials) {
  console.log(`📝 Setting up ${environment} environment...`);
  
  // Validate required credentials
  if (!credentials.accessToken || !credentials.applicationId || !credentials.locationId) {
    console.error(`❌ Missing required credentials for ${environment} environment`);
    console.error(`   Access Token: ${credentials.accessToken ? 'Found' : 'Missing'}`);
    console.error(`   Application ID: ${credentials.applicationId ? 'Found' : 'Missing'}`);
    console.error(`   Location ID: ${credentials.locationId ? 'Found' : 'Missing'}`);
    throw new Error(`Incomplete credentials for ${environment} environment`);
  }
  
  const secretName = `square-api-keys-${environment}`;
  const secretValue = {
    SQUARE_ACCESS_TOKEN: credentials.accessToken,
    SQUARE_APPLICATION_ID: credentials.applicationId,
    SQUARE_LOCATION_ID: credentials.locationId,
    SQUARE_ENVIRONMENT: environment // Explicitly set the environment
  };
  
  try {
    // Try to create the secret
    const params = {
      Name: secretName,
      Description: `Square API credentials for Red Bird Chicken ordering system (${environment} environment)`,
      SecretString: JSON.stringify(secretValue)
    };
    
    await secretsManager.createSecret(params).promise();
    console.log(`   ✅ Created secret: ${secretName}`);
    
  } catch (error) {
    if (error.code === 'ResourceExistsException') {
      // Secret already exists, update it
      console.log(`   ℹ️ Secret exists, updating: ${secretName}`);
      
      const updateParams = {
        SecretId: secretName,
        SecretString: JSON.stringify(secretValue)
      };
      
      await secretsManager.updateSecret(updateParams).promise();
      console.log(`   ✅ Updated secret: ${secretName}`);
      
    } else {
      console.error(`   ❌ Error with ${environment} secret:`, error.message);
      throw error;
    }
  }
  
  console.log(`   🔑 Environment: ${environment}`);
  console.log(`   📍 Location ID: ${credentials.locationId}`);
  console.log(`   🏷️ Token ending in: ...${credentials.accessToken.slice(-8)}`);
  console.log('');
}

// Add helper function to check current secrets
async function checkExistingSecrets() {
  console.log('🔍 Checking existing Square secrets...\n');
  
  const secretsToCheck = [
    'square-api-keys',
    'square-api-keys-sandbox', 
    'square-api-keys-production'
  ];
  
  for (const secretName of secretsToCheck) {
    try {
      const result = await secretsManager.getSecretValue({ SecretId: secretName }).promise();
      const secretData = JSON.parse(result.SecretString);
      console.log(`✅ Found: ${secretName}`);
      console.log(`   Environment: ${secretData.SQUARE_ENVIRONMENT || 'not set'}`);
      console.log(`   Location ID: ${secretData.SQUARE_LOCATION_ID || 'not set'}`);
    } catch (error) {
      if (error.code === 'ResourceNotFoundException') {
        console.log(`❌ Missing: ${secretName}`);
      } else {
        console.log(`⚠️ Error checking ${secretName}: ${error.message}`);
      }
    }
  }
  console.log('');
}

// Main execution with options
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--check')) {
    await checkExistingSecrets();
    return;
  }
  
  if (args.includes('--help')) {
    console.log('Environment-specific Square Secrets Setup\n');
    console.log('Usage:');
    console.log('  node setup-environment-secrets.js          # Setup environment secrets');
    console.log('  node setup-environment-secrets.js --check  # Check existing secrets');
    console.log('  node setup-environment-secrets.js --help   # Show this help');
    console.log('');
    console.log('Environment Variables:');
    console.log('  Option 1: Separate credentials');
    console.log('    SQUARE_ACCESS_TOKEN_SANDBOX');
    console.log('    SQUARE_ACCESS_TOKEN_PRODUCTION'); 
    console.log('    SQUARE_LOCATION_ID_SANDBOX');
    console.log('    SQUARE_LOCATION_ID_PRODUCTION');
    console.log('');
    console.log('  Option 2: Shared credentials');
    console.log('    SQUARE_ACCESS_TOKEN');
    console.log('    SQUARE_APPLICATION_ID');
    console.log('    SQUARE_LOCATION_ID');
    return;
  }
  
  await setupEnvironmentSecrets();
}

// Run the script
main().catch(console.error); 