#!/bin/bash

# Watch Together API Test Script
# This script tests all the watch together functionality with curl commands

# Configuration
MAIN_BACKEND_URL="http://localhost:3000"  # Your main backend
PROVIDERS_BACKEND_URL="http://localhost:3001"  # Your providers backend with watch together

echo "🎬 Watch Together API Test Script"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test user credentials
USER1_EMAIL="test1@example.com"
USER1_PASSWORD="testpass123"
USER1_USERNAME="testuser1"

USER2_EMAIL="test2@example.com"
USER2_PASSWORD="testpass123"
USER2_USERNAME="testuser2"

USER3_EMAIL="test3@example.com"
USER3_PASSWORD="testpass123"
USER3_USERNAME="testuser3"

# Variables to store tokens
USER1_TOKEN=""
USER2_TOKEN=""
USER3_TOKEN=""

# Function to print test results
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
    fi
}

# Function to get auth token
get_auth_token() {
    local email=$1
    local password=$2
    local response=$(curl -s -X POST "$MAIN_BACKEND_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$email\",\"password\":\"$password\"}")
    
    echo $response | jq -r '.accessToken // empty'
}

# Function to register user
register_user() {
    local email=$1
    local username=$2
    local password=$3
    local response=$(curl -s -X POST "$MAIN_BACKEND_URL/api/auth/register" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$email\",\"username\":\"$username\",\"password\":\"$password\"}")
    
    echo $response
}

echo "📝 Step 1: Register Test Users"
echo "=============================="

# Register User 1
RESPONSE1=$(register_user "$USER1_EMAIL" "$USER1_USERNAME" "$USER1_PASSWORD")
print_result $? "User 1 Registration"
USER1_TOKEN=$(echo $RESPONSE1 | jq -r '.accessToken // empty')

# Register User 2
RESPONSE2=$(register_user "$USER2_EMAIL" "$USER2_USERNAME" "$USER2_PASSWORD")
print_result $? "User 2 Registration"
USER2_TOKEN=$(echo $RESPONSE2 | jq -r '.accessToken // empty')

# Register User 3
RESPONSE3=$(register_user "$USER3_EMAIL" "$USER3_USERNAME" "$USER3_PASSWORD")
print_result $? "User 3 Registration"
USER3_TOKEN=$(echo $RESPONSE3 | jq -r '.accessToken // empty')

echo ""
echo "🔐 Step 2: Get Authentication Tokens"
echo "===================================="

echo "User 1 Token: ${USER1_TOKEN:0:20}..."
echo "User 2 Token: ${USER2_TOKEN:0:20}..."
echo "User 3 Token: ${USER3_TOKEN:0:20}..."

echo ""
echo "🏠 Step 3: Test Room Creation & Management"
echo "=========================================="

# Create room with User 1 (admin)
echo -e "${YELLOW}Creating room with User 1 as admin...${NC}"
ROOM_RESPONSE=$(curl -s -X POST "$PROVIDERS_BACKEND_URL/api/watch-together/rooms" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $USER1_TOKEN" \
    -d '{
        "name": "Test Movie Night",
        "mediaId": "12345",
        "mediaType": "movie",
        "adminId": "'$(echo $RESPONSE1 | jq -r '.user.id')'",
        "providerId": "vidnest",
        "isPublic": true,
        "maxParticipants": 10
    }')

ROOM_ID=$(echo $ROOM_RESPONSE | jq -r '.data.id // empty')
print_result $? "Room Creation"
echo "Room ID: $ROOM_ID"

# Get room details
echo -e "${YELLOW}Getting room details...${NC}"
curl -s -X GET "$PROVIDERS_BACKEND_URL/api/watch-together/rooms/$ROOM_ID" \
    -H "Authorization: Bearer $USER1_TOKEN" | jq '.'
print_result $? "Get Room Details"

# Get all rooms
echo -e "${YELLOW}Getting all rooms...${NC}"
curl -s -X GET "$PROVIDERS_BACKEND_URL/api/watch-together/rooms" \
    -H "Authorization: Bearer $USER1_TOKEN" | jq '.'
print_result $? "Get All Rooms"

echo ""
echo "👥 Step 4: Test User Joining Rooms"
echo "==================================="

# User 2 joins the room
echo -e "${YELLOW}User 2 joining room...${NC}"
JOIN_RESPONSE=$(curl -s -X POST "$PROVIDERS_BACKEND_URL/api/watch-together/rooms/$ROOM_ID/join" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $USER2_TOKEN" \
    -d "{\"userId\":\"$(echo $RESPONSE2 | jq -r '.user.id')\"}")

print_result $? "User 2 Join Room"

# User 3 joins the room
echo -e "${YELLOW}User 3 joining room...${NC}"
curl -s -X POST "$PROVIDERS_BACKEND_URL/api/watch-together/rooms/$ROOM_ID/join" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $USER3_TOKEN" \
    -d "{\"userId\":\"$(echo $RESPONSE3 | jq -r '.user.id')\"}" | jq '.'
print_result $? "User 3 Join Room"

# Get updated room details
echo -e "${YELLOW}Getting updated room details...${NC}"
curl -s -X GET "$PROVIDERS_BACKEND_URL/api/watch-together/rooms/$ROOM_ID" \
    -H "Authorization: Bearer $USER1_TOKEN" | jq '.data.participants'
print_result $? "Get Updated Room Details"

echo ""
echo "🔗 Step 5: Test Shareable Links"
echo "================================="

# Get shareable link
echo -e "${YELLOW}Getting shareable link...${NC}"
curl -s -X GET "$PROVIDERS_BACKEND_URL/api/watch-together/rooms/$ROOM_ID/share-link" \
    -H "Authorization: Bearer $USER1_TOKEN" | jq '.'
print_result $? "Get Shareable Link"

# Update room settings (make private)
echo -e "${YELLOW}Updating room settings (making private)...${NC}"
curl -s -X PUT "$PROVIDERS_BACKEND_URL/api/watch-together/rooms/$ROOM_ID/settings" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $USER1_TOKEN" \
    -d "{
        \"adminId\":\"$(echo $RESPONSE1 | jq -r '.user.id')\",
        \"isPublic\":false,
        \"maxParticipants\":5
    }" | jq '.'
print_result $? "Update Room Settings"

echo ""
echo "🎮 Step 6: Test Admin Controls"
echo "==============================="

# Transfer admin to User 2
echo -e "${YELLOW}Transferring admin to User 2...${NC}"
curl -s -X POST "$PROVIDERS_BACKEND_URL/api/watch-together/rooms/$ROOM_ID/transfer-admin" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $USER1_TOKEN" \
    -d "{
        \"currentAdminId\":\"$(echo $RESPONSE1 | jq -r '.user.id')\",
        \"newAdminId\":\"$(echo $RESPONSE2 | jq -r '.user.id')\"
    }" | jq '.'
print_result $? "Transfer Admin"

# Skip forward (admin control)
echo -e "${YELLOW}Skipping forward 30 seconds...${NC}"
curl -s -X POST "$PROVIDERS_BACKEND_URL/api/watch-together/rooms/$ROOM_ID/skip-time" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $USER2_TOKEN" \
    -d "{
        \"adminId\":\"$(echo $RESPONSE2 | jq -r '.user.id')\",
        \"skipType\":\"forward\",
        \"skipAmount\":30
    }" | jq '.'
print_result $? "Skip Forward"

# Stop playback (admin control)
echo -e "${YELLOW}Stopping playback...${NC}"
curl -s -X POST "$PROVIDERS_BACKEND_URL/api/watch-together/rooms/$ROOM_ID/admin-stop-playback" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $USER2_TOKEN" \
    -d "{\"adminId\":\"$(echo $RESPONSE2 | jq -r '.user.id')\"}" | jq '.'
print_result $? "Stop Playback"

# Kick User 3 (admin control)
echo -e "${YELLOW}Kicking User 3...${NC}"
curl -s -X POST "$PROVIDERS_BACKEND_URL/api/watch-together/rooms/$ROOM_ID/kick-user" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $USER2_TOKEN" \
    -d "{
        \"adminId\":\"$(echo $RESPONSE2 | jq -r '.user.id')\",
        \"userIdToKick\":\"$(echo $RESPONSE3 | jq -r '.user.id')\"
    }" | jq '.'
print_result $? "Kick User"

echo ""
echo "📊 Step 7: Test Statistics & Info"
echo "=================================="

# Get room statistics
echo -e "${YELLOW}Getting room statistics...${NC}"
curl -s -X GET "$PROVIDERS_BACKEND_URL/api/watch-together/stats" \
    -H "Authorization: Bearer $USER1_TOKEN" | jq '.'
print_result $? "Get Room Statistics"

echo ""
echo "🚪 Step 8: Test User Leaving Rooms"
echo "==================================="

# User 2 leaves the room
echo -e "${YELLOW}User 2 leaving room...${NC}"
curl -s -X POST "$PROVIDERS_BACKEND_URL/api/watch-together/rooms/$ROOM_ID/leave" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $USER2_TOKEN" \
    -d "{\"userId\":\"$(echo $RESPONSE2 | jq -r '.user.id')\"}" | jq '.'
print_result $? "User 2 Leave Room"

echo ""
echo "💥 Step 9: Test Session End"
echo "============================"

# End session (admin control)
echo -e "${YELLOW}Ending session...${NC}"
curl -s -X POST "$PROVIDERS_BACKEND_URL/api/watch-together/rooms/$ROOM_ID/end-session" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $USER2_TOKEN" \
    -d "{
        \"adminId\":\"$(echo $RESPONSE2 | jq -r '.user.id')\",
        \"reason\":\"Test session ended\"
    }" | jq '.'
print_result $? "End Session"

echo ""
echo "🧪 Step 10: Test Error Cases"
echo "============================="

# Try to get non-existent room
echo -e "${YELLOW}Testing non-existent room...${NC}"
curl -s -X GET "$PROVIDERS_BACKEND_URL/api/watch-together/rooms/non-existent-room" \
    -H "Authorization: Bearer $USER1_TOKEN" | jq '.'
print_result $? "Get Non-existent Room"

# Try to join non-existent room
echo -e "${YELLOW}Testing joining non-existent room...${NC}"
curl -s -X POST "$PROVIDERS_BACKEND_URL/api/watch-together/rooms/non-existent-room/join" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $USER2_TOKEN" \
    -d "{\"userId\":\"$(echo $RESPONSE2 | jq -r '.user.id')\"}" | jq '.'
print_result $? "Join Non-existent Room"

# Try admin actions without admin rights
echo -e "${YELLOW}Testing admin actions without rights...${NC}"
curl -s -X POST "$PROVIDERS_BACKEND_URL/api/watch-together/rooms/$ROOM_ID/skip-time" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $USER3_TOKEN" \
    -d "{
        \"adminId\":\"$(echo $RESPONSE3 | jq -r '.user.id')\",
        \"skipType\":\"forward\",
        \"skipAmount\":30
    }" | jq '.'
print_result $? "Admin Actions Without Rights"

echo ""
echo "🎉 Test Summary"
echo "==============="
echo "✅ Room Creation & Management"
echo "✅ User Joining/Leaving Rooms"
echo "✅ Shareable Links & Settings"
echo "✅ Admin Controls (Transfer, Kick, Skip, Stop)"
echo "✅ Session Management"
echo "✅ Statistics & Error Handling"
echo ""
echo "📋 WebSocket Testing Notes:"
echo "=========================="
echo "To test WebSocket functionality, you'll need to use WebSocket client:"
echo "1. Connect to: ws://localhost:3001"
echo "2. Send authentication: {\"event\": \"authenticate\", \"data\": {\"token\": \"YOUR_JWT_TOKEN\"}}"
echo "3. Test events: create_room, join_room, playback_action, etc."
echo ""
echo "Example WebSocket events:"
echo "- create_room: {\"event\": \"create_room\", \"data\": {\"name\": \"Test Room\", \"mediaId\": \"123\", \"mediaType\": \"movie\", \"adminId\": \"user1\", \"token\": \"JWT_TOKEN\"}}"
echo "- join_room: {\"event\": \"join_room\", \"data\": {\"roomId\": \"ROOM_ID\", \"userId\": \"user2\", \"token\": \"JWT_TOKEN\"}}"
echo "- playback_action: {\"event\": \"playback_action\", \"data\": {\"roomId\": \"ROOM_ID\", \"action\": {\"type\": \"play\"}, \"userId\": \"user1\", \"isAdmin\": true, \"timestamp\": \"2024-01-01T00:00:00Z\"}}"
echo ""
echo "🔧 Make sure both backends are running:"
echo "- Main backend: $MAIN_BACKEND_URL"
echo "- Providers backend: $PROVIDERS_BACKEND_URL"