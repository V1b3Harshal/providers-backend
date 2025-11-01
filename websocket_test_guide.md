# WebSocket Testing Guide for Watch Together

## Overview

This guide explains how to test the WebSocket functionality of your watch together system using various tools.

## Prerequisites

1. Both backends must be running:

   - Main backend: `http://localhost:3000`
   - Providers backend: `http://localhost:3001`

2. You need valid JWT tokens from your main backend authentication

## Step 1: Get JWT Tokens

First, authenticate with your main backend to get JWT tokens:

```bash
# Register users
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user1@example.com","username":"user1","password":"testpass123"}'

# Login to get tokens
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user1@example.com","password":"testpass123"}'
```

## Step 2: WebSocket Connection

Connect to the WebSocket server:

```javascript
// WebSocket connection URL
const ws = new WebSocket("ws://localhost:3001");
```

## Step 3: Authentication

Send authentication event:

```javascript
// Authenticate with JWT token
ws.send(
  JSON.stringify({
    event: "authenticate",
    data: {
      token: "YOUR_JWT_TOKEN_HERE",
    },
  })
);
```

## Step 4: Test Room Creation

Create a new room:

```javascript
// Create room
ws.send(
  JSON.stringify({
    event: "create_room",
    data: {
      name: "Test Movie Night",
      mediaId: "12345",
      mediaType: "movie",
      adminId: "user1-id",
      providerId: "vidnest",
      token: "YOUR_JWT_TOKEN",
      isPublic: true,
      maxParticipants: 10,
    },
  })
);
```

## Step 5: Test User Joining

Another user joins the room:

```javascript
// Join room
ws.send(
  JSON.stringify({
    event: "join_room",
    data: {
      roomId: "ROOM_ID_FROM_RESPONSE",
      userId: "user2-id",
      token: "USER2_JWT_TOKEN",
    },
  })
);
```

## Step 6: Test Playback Actions

Admin controls playback:

```javascript
// Play
ws.send(
  JSON.stringify({
    event: "playback_action",
    data: {
      roomId: "ROOM_ID",
      action: {
        type: "play",
      },
      userId: "user1-id",
      isAdmin: true,
      timestamp: new Date().toISOString(),
    },
  })
);

// Pause
ws.send(
  JSON.stringify({
    event: "playback_action",
    data: {
      roomId: "ROOM_ID",
      action: {
        type: "pause",
      },
      userId: "user1-id",
      isAdmin: true,
      timestamp: new Date().toISOString(),
    },
  })
);

// Seek
ws.send(
  JSON.stringify({
    event: "playback_action",
    data: {
      roomId: "ROOM_ID",
      action: {
        type: "seek",
        data: {
          currentTime: 1200, // 20 minutes
        },
      },
      userId: "user1-id",
      isAdmin: true,
      timestamp: new Date().toISOString(),
    },
  })
);

// Skip forward
ws.send(
  JSON.stringify({
    event: "playback_action",
    data: {
      roomId: "ROOM_ID",
      action: {
        type: "fastForward",
        data: {
          skipAmount: 30,
        },
      },
      userId: "user1-id",
      isAdmin: true,
      timestamp: new Date().toISOString(),
    },
  })
);

// Skip backward
ws.send(
  JSON.stringify({
    event: "playback_action",
    data: {
      roomId: "ROOM_ID",
      action: {
        type: "rewind",
        data: {
          skipAmount: 30,
        },
      },
      userId: "user1-id",
      isAdmin: true,
      timestamp: new Date().toISOString(),
    },
  })
);
```

## Step 7: Test Sync Requests

Users request sync:

```javascript
// Request sync
ws.send(
  JSON.stringify({
    event: "sync_request",
    data: {
      roomId: "ROOM_ID",
      userId: "user2-id",
    },
  })
);
```

## Step 8: Test Heartbeat

Keep connection alive:

```javascript
// Send heartbeat
ws.send(
  JSON.stringify({
    event: "heartbeat",
    data: {
      roomId: "ROOM_ID",
      userId: "user2-id",
    },
  })
);
```

## Step 9: Test User Status

Get user presence status:

```javascript
// Get user status
ws.send(
  JSON.stringify({
    event: "get_user_status",
    data: {
      roomId: "ROOM_ID",
    },
  })
);
```

## Step 10: Test Invitations

Send room invitations:

```javascript
// Send invitation
ws.send(
  JSON.stringify({
    event: "request_invite",
    data: {
      roomId: "ROOM_ID",
      targetUserId: "user3-id",
      requestingUserId: "user1-id",
      isAdmin: true,
    },
  })
);
```

## Step 11: Test Room Leaving

Users leave the room:

```javascript
// Leave room
ws.send(
  JSON.stringify({
    event: "leave_room",
    data: {
      roomId: "ROOM_ID",
      userId: "user2-id",
    },
  })
);
```

## WebSocket Events Reference

### Events to Send

- `authenticate` - Authenticate WebSocket connection
- `create_room` - Create a new watch together room
- `join_room` - Join an existing room
- `leave_room` - Leave a room
- `playback_action` - Control playback (admin only)
- `sync_request` - Request current playback state
- `heartbeat` - Keep connection alive
- `get_user_status` - Get user presence status
- `request_invite` - Send room invitation

### Events to Receive

- `authenticated` - Authentication successful
- `room_created` - Room created successfully
- `user_joined` - User joined the room
- `user_left` - User left the room
- `admin_changed` - Admin ownership transferred
- `playback_updated` - Playback state changed
- `sync_response` - Current state sync data
- `user_status` - User presence information
- `room_invite` - Received room invitation
- `session_ended` - Session ended by admin
- `error` - Error message

## Testing Tools

### 1. Browser Console

```javascript
// Open browser console and run:
const ws = new WebSocket("ws://localhost:3001");

ws.onopen = () => {
  console.log("Connected to WebSocket");
  // Send authentication
  ws.send(
    JSON.stringify({
      event: "authenticate",
      data: { token: "YOUR_JWT_TOKEN" },
    })
  );
};

ws.onmessage = (event) => {
  console.log("Received:", JSON.parse(event.data));
};

ws.onerror = (error) => {
  console.error("WebSocket error:", error);
};
```

### 2. WebSocket Client Tools

- **Postman**: Has WebSocket testing support
- **Insomnia**: Supports WebSocket connections
- **wscat**: Command line WebSocket client
  ```bash
  npm install -g wscat
  wscat -c ws://localhost:3001
  ```

### 3. Simple HTML Test Page

Create `websocket_test.html`:

```html
<!DOCTYPE html>
<html>
  <head>
    <title>WebSocket Test</title>
  </head>
  <body>
    <h1>WebSocket Test</h1>
    <div id="messages"></div>
    <script>
      const ws = new WebSocket("ws://localhost:3001");
      const messagesDiv = document.getElementById("messages");

      ws.onopen = () => {
        log("Connected to WebSocket");
        // Send authentication
        ws.send(
          JSON.stringify({
            event: "authenticate",
            data: { token: "YOUR_JWT_TOKEN" },
          })
        );
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        log("Received: " + JSON.stringify(data, null, 2));
      };

      ws.onerror = (error) => {
        log("Error: " + error);
      };

      function log(message) {
        const div = document.createElement("div");
        div.textContent = message;
        messagesDiv.appendChild(div);
      }
    </script>
  </body>
</html>
```

## Expected Flow

1. **Connection**: Connect to WebSocket server
2. **Authentication**: Send JWT token for authentication
3. **Room Creation**: Create a room as admin
4. **User Join**: Other users join the room
5. **Playback Control**: Admin controls playback
6. **State Sync**: All users receive sync updates
7. **User Activity**: Heartbeats and presence tracking
8. **Room Management**: Users leave or get kicked
9. **Session End**: Admin ends the session

## Error Handling

Common errors and their meanings:

- `Authentication failed`: Invalid JWT token
- `Room not found`: Invalid room ID
- `Only admin can perform this action`: Non-admin tried admin action
- `Room is full`: Maximum participants reached
- `User already in room`: User already participating
- `Invalid shareable link`: Wrong or expired link

## Performance Testing

Test with multiple users:

1. Create rooms with maximum participants
2. Test rapid playback actions
3. Test connection drops and reconnections
4. Test concurrent WebSocket connections
5. Monitor Redis memory usage

## Security Testing

1. Test with invalid JWT tokens
2. Test admin actions without admin privileges
3. Test joining private rooms without proper access
4. Test rate limiting on WebSocket events
5. Test connection hijacking scenarios
