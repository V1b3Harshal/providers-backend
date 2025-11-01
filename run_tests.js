#!/usr/bin/env node

/**
 * Enhanced Test Runner for Watch Together API
 * This script uses .env values for configuration
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Load environment variables
const loadEnv = () => {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  } else {
    console.log('⚠️  .env file not found, using defaults');
  }
};

// Configuration from .env or defaults
const config = {
  mainBackendUrl: process.env.MAIN_BACKEND_URL || 'http://localhost:3000',
  providersBackendUrl: process.env.PORT ? `http://localhost:${process.env.PORT}` : 'http://localhost:3001',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret-key',
  maxParticipants: parseInt(process.env.WATCH_TOGETHER_MAX_PARTICIPANTS) || 10,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379'
};

console.log('🎬 Watch Together API Test Runner');
console.log('=================================');
console.log('');

// Test user data
let userData = {
  user1: { email: 'test1@example.com', password: 'testpass123', username: 'testuser1' },
  user2: { email: 'test2@example.com', password: 'testpass123', username: 'testuser2' },
  user3: { email: 'test3@example.com', password: 'testpass123', username: 'testuser3' }
};

let tokens = {};
let roomId = null;

async function registerUser(userKey) {
  const user = userData[userKey];
  try {
    const response = await fetch(`${config.mainBackendUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        username: user.username,
        password: user.password
      })
    });
    
    const result = await response.json();
    if (result.accessToken) {
      tokens[userKey] = result.accessToken;
      console.log(`✅ ${userKey} registered successfully`);
      return true;
    } else {
      console.log(`❌ ${userKey} registration failed:`, result.error);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${userKey} registration error:`, error.message);
    return false;
  }
}

async function loginUser(userKey) {
  const user = userData[userKey];
  try {
    const response = await fetch(`${config.mainBackendUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        password: user.password
      })
    });
    
    const result = await response.json();
    if (result.accessToken) {
      tokens[userKey] = result.accessToken;
      console.log(`✅ ${userKey} logged in successfully`);
      return true;
    } else {
      console.log(`❌ ${userKey} login failed:`, result.error);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${userKey} login error:`, error.message);
    return false;
  }
}

async function createRoom() {
  if (!tokens.user1) {
    console.log('❌ User 1 not authenticated');
    return false;
  }

  try {
    const shareableLink = `${config.frontendUrl}/watch-together/${roomId || 'temp'}`;
    
    const response = await fetch(`${config.providersBackendUrl}/api/watch-together/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens.user1}`
      },
      body: JSON.stringify({
        name: 'Test Movie Night',
        mediaId: '12345',
        mediaType: 'movie',
        adminId: 'user1-id',
        providerId: 'vidnest',
        token: tokens.user1,
        isPublic: true,
        maxParticipants: config.maxParticipants
      })
    });

    const result = await response.json();
    if (result.data && result.data.id) {
      roomId = result.data.id;
      console.log(`✅ Room created successfully: ${roomId}`);
      console.log(`🔗 Shareable link: ${result.data.shareableLink || shareableLink}`);
      return true;
    } else {
      console.log(`❌ Room creation failed:`, result.error);
      return false;
    }
  } catch (error) {
    console.log(`❌ Room creation error:`, error.message);
    return false;
  }
}

async function joinRoom(userKey) {
  if (!roomId || !tokens[userKey]) {
    console.log(`❌ Cannot join room - missing room ID or ${userKey} token`);
    return false;
  }

  try {
    const response = await fetch(`${config.providersBackendUrl}/api/watch-together/rooms/${roomId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens[userKey]}`
      },
      body: JSON.stringify({
        userId: userKey + '-id',
        token: tokens[userKey]
      })
    });

    const result = await response.json();
    if (result.success) {
      console.log(`✅ ${userKey} joined room successfully`);
      return true;
    } else {
      console.log(`❌ ${userKey} join failed:`, result.error);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${userKey} join error:`, error.message);
    return false;
  }
}

async function testAdminAction(action, userKey = 'user1', data = {}) {
  if (!roomId || !tokens[userKey]) {
    console.log(`❌ Cannot perform admin action - missing room ID or ${userKey} token`);
    return false;
  }

  try {
    const requestBody = {
      adminId: userKey + '-id',
      ...data
    };

    const response = await fetch(`${config.providersBackendUrl}/api/watch-together/rooms/${roomId}/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens[userKey]}`
      },
      body: JSON.stringify(requestBody)
    });

    const result = await response.json();
    if (result.success) {
      console.log(`✅ ${action} performed successfully by ${userKey}`);
      return true;
    } else {
      console.log(`❌ ${action} failed:`, result.error);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${action} error:`, error.message);
    return false;
  }
}

async function getRoomInfo() {
  if (!roomId || !tokens.user1) {
    console.log('❌ Missing room ID or user token');
    return null;
  }

  try {
    const response = await fetch(`${config.providersBackendUrl}/api/watch-together/rooms/${roomId}`, {
      headers: { 'Authorization': `Bearer ${tokens.user1}` }
    });
    return await response.json();
  } catch (error) {
    console.log('❌ Error getting room info:', error.message);
    return null;
  }
}

async function runQuickTest() {
  console.log('🚀 Running Quick Test...');
  console.log('');

  // Register and login users
  const success1 = await registerUser('user1');
  const success2 = await registerUser('user2');
  const success3 = await registerUser('user3');

  if (!success1 || !success2 || !success3) {
    console.log('❌ User setup failed');
    return;
  }

  // Create room
  const roomSuccess = await createRoom();
  if (!roomSuccess) {
    console.log('❌ Room creation failed');
    return;
  }

  // Users join room
  await joinRoom('user2');
  await joinRoom('user3');

  // Test admin actions
  await testAdminAction('skip-time', 'user1', { skipType: 'forward', skipAmount: 30 });
  await testAdminAction('admin-stop-playback', 'user1');

  // Get room info
  const roomInfo = await getRoomInfo();
  if (roomInfo) {
    console.log('\n📋 Room Information:');
    console.log(`   Participants: ${roomInfo.data.participants.length}`);
    console.log(`   Max Participants: ${roomInfo.data.maxParticipants}`);
    console.log(`   Is Public: ${roomInfo.data.isPublic}`);
    console.log(`   Shareable Link: ${roomInfo.data.shareableLink || 'None'}`);
  }

  console.log('');
  console.log('🎉 Quick test completed!');
}

function showMenu() {
  console.log('');
  console.log('🔧 Test Options:');
  console.log('1. Run Quick Test');
  console.log('2. Register Users');
  console.log('3. Create Room');
  console.log('4. Users Join Room');
  console.log('5. Test Admin Actions');
  console.log('6. Get Room Info');
  console.log('7. Test Shareable Links');
  console.log('8. Test Error Cases');
  console.log('9. Show Configuration');
  console.log('10. Exit');
  console.log('');

  rl.question('Select an option (1-10): ', async (answer) => {
    switch (answer) {
      case '1':
        await runQuickTest();
        showMenu();
        break;
      case '2':
        console.log('Registering users...');
        await registerUser('user1');
        await registerUser('user2');
        await registerUser('user3');
        showMenu();
        break;
      case '3':
        await createRoom();
        showMenu();
        break;
      case '4':
        await joinRoom('user2');
        await joinRoom('user3');
        showMenu();
        break;
      case '5':
        console.log('Testing admin actions...');
        await testAdminAction('skip-time', 'user1', { skipType: 'forward', skipAmount: 30 });
        await testAdminAction('skip-time', 'user1', { skipType: 'backward', skipAmount: 15 });
        await testAdminAction('admin-stop-playback', 'user1');
        showMenu();
        break;
      case '6':
        const roomInfo = await getRoomInfo();
        if (roomInfo) {
          console.log('Room Info:', JSON.stringify(roomInfo, null, 2));
        }
        showMenu();
        break;
      case '7':
        if (roomId) {
          const response = await fetch(`${config.providersBackendUrl}/api/watch-together/rooms/${roomId}/share-link`, {
            headers: { 'Authorization': `Bearer ${tokens.user1}` }
          });
          const result = await response.json();
          console.log('Shareable Link Info:', JSON.stringify(result, null, 2));
        } else {
          console.log('❌ No room created yet');
        }
        showMenu();
        break;
      case '8':
        console.log('Testing error cases...');
        // Test invalid room
        const invalidResponse = await fetch(`${config.providersBackendUrl}/api/watch-together/rooms/invalid-room`, {
          headers: { 'Authorization': `Bearer ${tokens.user1}` }
        });
        const invalidResult = await invalidResponse.json();
        console.log('Invalid room test:', invalidResult);

        // Test admin action without admin rights
        if (tokens.user2) {
          const adminResponse = await fetch(`${config.providersBackendUrl}/api/watch-together/rooms/${roomId}/skip-time`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${tokens.user2}`
            },
            body: JSON.stringify({
              adminId: 'user2-id',
              skipType: 'forward',
              skipAmount: 30
            })
          });
          const adminResult = await adminResponse.json();
          console.log('Non-admin action test:', adminResult);
        }
        showMenu();
        break;
      case '9':
        console.log('📋 Current Configuration:');
        console.log(`   Main Backend: ${config.mainBackendUrl}`);
        console.log(`   Providers Backend: ${config.providersBackendUrl}`);
        console.log(`   Frontend URL: ${config.frontendUrl}`);
        console.log(`   Max Participants: ${config.maxParticipants}`);
        console.log(`   Redis URL: ${config.redisUrl}`);
        showMenu();
        break;
      case '10':
        console.log('👋 Goodbye!');
        rl.close();
        break;
      default:
        console.log('❌ Invalid option');
        showMenu();
        break;
    }
  });
}

// Load environment variables
loadEnv();

// Show configuration
console.log('🔧 Configuration loaded:');
console.log(`   Main Backend: ${config.mainBackendUrl}`);
console.log(`   Providers Backend: ${config.providersBackendUrl}`);
console.log(`   Frontend URL: ${config.frontendUrl}`);
console.log(`   Max Participants: ${config.maxParticipants}`);
console.log('');

// Start the test runner
console.log('🚀 Make sure both backends are running:');
console.log(`   - Main backend: ${config.mainBackendUrl}`);
console.log(`   - Providers backend: ${config.providersBackendUrl}`);
console.log('');

showMenu();