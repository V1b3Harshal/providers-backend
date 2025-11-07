require('dotenv').config();
const { connectToRedis } = require('./dist/config/redis');

async function testRedis() {
  try {
    console.log('Testing Redis connection...');
    const result = await connectToRedis();
    console.log('Redis connection successful:', result.type);
    
    // Test basic operations
    const client = result.client;
    await client.set('test_key', 'test_value');
    const value = await client.get('test_key');
    console.log('Test value:', value);
    
    await client.del('test_key');
    console.log('Redis test completed successfully');
  } catch (error) {
    console.error('Redis test failed:', error);
  }
}

testRedis();