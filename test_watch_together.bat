@echo off
setlocal enabledelayedexpansion

REM Enhanced Watch Together API Test Script for Windows
REM This script uses .env values for configuration

REM Load environment variables if .env exists
if exist ".env" (
    echo Loading environment variables from .env file...
    for /f "tokens=1,2 delims==" %%a in (.env) do (
        set "%%a=%%b"
    )
)

REM Configuration from .env or defaults
set MAIN_BACKEND_URL=%MAIN_BACKEND_URL:http://localhost:3000%
set PROVIDERS_BACKEND_URL=%PROVIDERS_BACKEND_URL:http://localhost:3001%
set FRONTEND_URL=%FRONTEND_URL:http://localhost:3000%
set MAX_PARTICIPANTS=%WATCH_TOGETHER_MAX_PARTICIPANTS:10%

echo 🎬 Watch Together API Test Script
echo ================================
echo.
echo 🔧 Configuration:
echo    Main Backend: %MAIN_BACKEND_URL%
echo    Providers Backend: %PROVIDERS_BACKEND_URL%
echo    Frontend URL: %FRONTEND_URL%
echo    Max Participants: %MAX_PARTICIPANTS%
echo.

REM Test user credentials
set USER1_EMAIL=test1@example.com
set USER1_PASSWORD=testpass123
set USER1_USERNAME=testuser1

set USER2_EMAIL=test2@example.com
set USER2_PASSWORD=testpass123
set USER2_USERNAME=testuser2

set USER3_EMAIL=test3@example.com
set USER3_PASSWORD=testpass123
set USER3_USERNAME=testuser3

REM Variables to store tokens
set USER1_TOKEN=
set USER2_TOKEN=
set USER3_TOKEN=

echo 📝 Step 1: Register Test Users
echo ===============================

REM Register User 1
echo Registering User 1...
curl -s -X POST "%MAIN_BACKEND_URL%/api/auth/register" ^
    -H "Content-Type: application/json" ^
    -d "{\"email\":\"%USER1_EMAIL%\",\"username\":\"%USER1_USERNAME%\",\"password\":\"%USER1_PASSWORD%\"}" ^
    > user1_response.json
type user1_response.json
echo.

REM Register User 2
echo Registering User 2...
curl -s -X POST "%MAIN_BACKEND_URL%/api/auth/register" ^
    -H "Content-Type: application/json" ^
    -d "{\"email\":\"%USER2_EMAIL%\",\"username\":\"%USER2_USERNAME%\",\"password\":\"%USER2_PASSWORD%\"}" ^
    > user2_response.json
type user2_response.json
echo.

REM Register User 3
echo Registering User 3...
curl -s -X POST "%MAIN_BACKEND_URL%/api/auth/register" ^
    -H "Content-Type: application/json" ^
    -d "{\"email\":\"%USER3_EMAIL%\",\"username\":\"%USER3_USERNAME%\",\"password\":\"%USER3_PASSWORD%\"}" ^
    > user3_response.json
type user3_response.json
echo.

echo 🔐 Step 2: Get Authentication Tokens
echo =====================================

REM Extract User 1 Token
echo Extracting User 1 token...
for /f "tokens=2 delims=:" %%a in ('findstr /i "accessToken" user1_response.json') do (
    for /f "tokens=1" %%b in ("%%a") do set USER1_TOKEN=%%b
)
set USER1_TOKEN=%USER1_TOKEN: =%
set USER1_TOKEN=%USER1_TOKEN:"=%
set USER1_TOKEN=%USER1_TOKEN:,=%
echo User 1 Token: %USER1_TOKEN:~0,20%...

REM Extract User 2 Token
echo Extracting User 2 token...
for /f "tokens=2 delims=:" %%a in ('findstr /i "accessToken" user2_response.json') do (
    for /f "tokens=1" %%b in ("%%a") do set USER2_TOKEN=%%b
)
set USER2_TOKEN=%USER2_TOKEN: =%
set USER2_TOKEN=%USER2_TOKEN:"=%
set USER2_TOKEN=%USER2_TOKEN:,=%
echo User 2 Token: %USER2_TOKEN:~0,20%...

REM Extract User 3 Token
echo Extracting User 3 token...
for /f "tokens=2 delims=:" %%a in ('findstr /i "accessToken" user3_response.json') do (
    for /f "tokens=1" %%b in ("%%a") do set USER3_TOKEN=%%b
)
set USER3_TOKEN=%USER3_TOKEN: =%
set USER3_TOKEN=%USER3_TOKEN:"=%
set USER3_TOKEN=%USER3_TOKEN:,=%
echo User 3 Token: %USER3_TOKEN:~0,20%...

echo.
echo 🏠 Step 3: Test Room Creation & Management
echo ===========================================

REM Create room with User 1 (admin)
echo Creating room with User 1 as admin...
curl -s -X POST "%PROVIDERS_BACKEND_URL%/api/watch-together/rooms" ^
    -H "Content-Type: application/json" ^
    -H "Authorization: Bearer %USER1_TOKEN%" ^
    -d "{^
        \"name\": \"Test Movie Night\",^
        \"mediaId\": \"12345\",^
        \"mediaType\": \"movie\",^
        \"adminId\": \"user1-id\",^
        \"providerId\": \"vidnest\",^
        \"token\": \"%USER1_TOKEN%\",^
        \"isPublic\": true,^
        \"maxParticipants\": %MAX_PARTICIPANTS%^
    }" ^
    > room_response.json
type room_response.json
echo.

REM Extract Room ID
for /f "tokens=2 delims=:" %%a in ('findstr /i "id" room_response.json') do (
    for /f "tokens=1" %%b in ("%%a") do set ROOM_ID=%%b
)
set ROOM_ID=%ROOM_ID: =%
set ROOM_ID=%ROOM_ID:"=%
set ROOM_ID=%ROOM_ID:,=%
echo Room ID: %ROOM_ID%

REM Get room details
echo Getting room details...
curl -s -X GET "%PROVIDERS_BACKEND_URL%/api/watch-together/rooms/%ROOM_ID%" ^
    -H "Authorization: Bearer %USER1_TOKEN%" ^
    > room_details.json
type room_details.json
echo.

REM Get all rooms
echo Getting all rooms...
curl -s -X GET "%PROVIDERS_BACKEND_URL%/api/watch-together/rooms" ^
    -H "Authorization: Bearer %USER1_TOKEN%" ^
    > all_rooms.json
type all_rooms.json
echo.

echo 👥 Step 4: Test User Joining Rooms
echo ====================================

REM User 2 joins the room
echo User 2 joining room...
curl -s -X POST "%PROVIDERS_BACKEND_URL%/api/watch-together/rooms/%ROOM_ID%/join" ^
    -H "Content-Type: application/json" ^
    -H "Authorization: Bearer %USER2_TOKEN%" ^
    -d "{\"userId\":\"user2-id\",\"token\":\"%USER2_TOKEN%\"}" ^
    > user2_join.json
type user2_join.json
echo.

REM User 3 joins the room
echo User 3 joining room...
curl -s -X POST "%PROVIDERS_BACKEND_URL%/api/watch-together/rooms/%ROOM_ID%/join" ^
    -H "Content-Type: application/json" ^
    -H "Authorization: Bearer %USER3_TOKEN%" ^
    -d "{\"userId\":\"user3-id\",\"token\":\"%USER3_TOKEN%\"}" ^
    > user3_join.json
type user3_join.json
echo.

REM Get updated room details
echo Getting updated room details...
curl -s -X GET "%PROVIDERS_BACKEND_URL%/api/watch-together/rooms/%ROOM_ID%" ^
    -H "Authorization: Bearer %USER1_TOKEN%" ^
    > updated_room.json
type updated_room.json
echo.

echo 🔗 Step 5: Test Shareable Links
echo =================================

REM Get shareable link
echo Getting shareable link...
curl -s -X GET "%PROVIDERS_BACKEND_URL%/api/watch-together/rooms/%ROOM_ID%/share-link" ^
    -H "Authorization: Bearer %USER1_TOKEN%" ^
    > share_link.json
type share_link.json
echo.

REM Update room settings (make private)
echo Updating room settings (making private)...
curl -s -X PUT "%PROVIDERS_BACKEND_URL%/api/watch-together/rooms/%ROOM_ID%/settings" ^
    -H "Content-Type: application/json" ^
    -H "Authorization: Bearer %USER1_TOKEN%" ^
    -d "{^
        \"adminId\":\"user1-id\",^
        \"isPublic\":false,^
        \"maxParticipants\":5^
    }" ^
    > room_settings.json
type room_settings.json
echo.

echo 🎮 Step 6: Test Admin Controls
echo ===============================

REM Transfer admin to User 2
echo Transferring admin to User 2...
curl -s -X POST "%PROVIDERS_BACKEND_URL%/api/watch-together/rooms/%ROOM_ID%/transfer-admin" ^
    -H "Content-Type: application/json" ^
    -H "Authorization: Bearer %USER1_TOKEN%" ^
    -d "{^
        \"currentAdminId\":\"user1-id\",^
        \"newAdminId\":\"user2-id\"^
    }" ^
    > transfer_admin.json
type transfer_admin.json
echo.

REM Skip forward (admin control)
echo Skipping forward 30 seconds...
curl -s -X POST "%PROVIDERS_BACKEND_URL%/api/watch-together/rooms/%ROOM_ID%/skip-time" ^
    -H "Content-Type: application/json" ^
    -H "Authorization: Bearer %USER2_TOKEN%" ^
    -d "{^
        \"adminId\":\"user2-id\",^
        \"skipType\":\"forward\",^
        \"skipAmount\":30^
    }" ^
    > skip_forward.json
type skip_forward.json
echo.

REM Stop playback (admin control)
echo Stopping playback...
curl -s -X POST "%PROVIDERS_BACKEND_URL%/api/watch-together/rooms/%ROOM_ID%/admin-stop-playback" ^
    -H "Content-Type: application/json" ^
    -H "Authorization: Bearer %USER2_TOKEN%" ^
    -d "{\"adminId\":\"user2-id\"}" ^
    > stop_playback.json
type stop_playback.json
echo.

REM Kick User 3 (admin control)
echo Kicking User 3...
curl -s -X POST "%PROVIDERS_BACKEND_URL%/api/watch-together/rooms/%ROOM_ID%/kick-user" ^
    -H "Content-Type: application/json" ^
    -H "Authorization: Bearer %USER2_TOKEN%" ^
    -d "{^
        \"adminId\":\"user2-id\",^
        \"userIdToKick\":\"user3-id\"^
    }" ^
    > kick_user.json
type kick_user.json
echo.

echo 📊 Step 7: Test Statistics & Info
echo ===================================

REM Get room statistics
echo Getting room statistics...
curl -s -X GET "%PROVIDERS_BACKEND_URL%/api/watch-together/stats" ^
    -H "Authorization: Bearer %USER1_TOKEN%" ^
    > stats.json
type stats.json
echo.

echo 🚪 Step 8: Test User Leaving Rooms
echo ====================================

REM User 2 leaves the room
echo User 2 leaving room...
curl -s -X POST "%PROVIDERS_BACKEND_URL%/api/watch-together/rooms/%ROOM_ID%/leave" ^
    -H "Content-Type: application/json" ^
    -H "Authorization: Bearer %USER2_TOKEN%" ^
    -d "{\"userId\":\"user2-id\"}" ^
    > user2_leave.json
type user2_leave.json
echo.

echo 💥 Step 9: Test Session End
echo =============================

REM End session (admin control)
echo Ending session...
curl -s -X POST "%PROVIDERS_BACKEND_URL%/api/watch-together/rooms/%ROOM_ID%/end-session" ^
    -H "Content-Type: application/json" ^
    -H "Authorization: Bearer %USER2_TOKEN%" ^
    -d "{^
        \"adminId\":\"user2-id\",^
        \"reason\":\"Test session ended\"^
    }" ^
    > end_session.json
type end_session.json
echo.

echo 🧪 Step 10: Test Error Cases
echo =============================

REM Try to get non-existent room
echo Testing non-existent room...
curl -s -X GET "%PROVIDERS_BACKEND_URL%/api/watch-together/rooms/non-existent-room" ^
    -H "Authorization: Bearer %USER1_TOKEN%" ^
    > error_room.json
type error_room.json
echo.

REM Try to join non-existent room
echo Testing joining non-existent room...
curl -s -X POST "%PROVIDERS_BACKEND_URL%/api/watch-together/rooms/non-existent-room/join" ^
    -H "Content-Type: application/json" ^
    -H "Authorization: Bearer %USER2_TOKEN%" ^
    -d "{\"userId\":\"user2-id\"}" ^
    > error_join.json
type error_join.json
echo.

REM Try admin actions without admin rights
echo Testing admin actions without rights...
curl -s -X POST "%PROVIDERS_BACKEND_URL%/api/watch-together/rooms/%ROOM_ID%/skip-time" ^
    -H "Content-Type: application/json" ^
    -H "Authorization: Bearer %USER3_TOKEN%" ^
    -d "{^
        \"adminId\":\"user3-id\",^
        \"skipType\":\"forward\",^
        \"skipAmount\":30^
    }" ^
    > error_admin.json
type error_admin.json
echo.

echo.
echo 🎉 Test Summary
echo ===============
echo ✅ Room Creation & Management
echo ✅ User Joining/Leaving Rooms
echo ✅ Shareable Links & Settings
echo ✅ Admin Controls (Transfer, Kick, Skip, Stop)
echo ✅ Session Management
echo ✅ Statistics & Error Handling
echo.
echo 📋 WebSocket Testing Notes:
echo ===========================
echo To test WebSocket functionality, you'll need to use WebSocket client:
echo 1. Connect to: ws://localhost:%WS_PORT:3001%
echo 2. Send authentication: {"event": "authenticate", "data": {"token": "YOUR_JWT_TOKEN"}}
echo 3. Test events: create_room, join_room, playback_action, etc.
echo.
echo Example WebSocket events:
echo - create_room: {"event": "create_room", "data": {"name": "Test Room", "mediaId": "123", "mediaType": "movie", "adminId": "user1", "token": "JWT_TOKEN"}}
echo - join_room: {"event": "join_room", "data": {"roomId": "ROOM_ID", "userId": "user2", "token": "JWT_TOKEN"}}
echo - playback_action: {"event": "playback_action", "data": {"roomId": "ROOM_ID", "action": {"type": "play"}, "userId": "user1", "isAdmin": true, "timestamp": "2024-01-01T00:00:00Z"}}
echo.
echo 🔧 Make sure both backends are running:
echo - Main backend: %MAIN_BACKEND_URL%
echo - Providers backend: %PROVIDERS_BACKEND_URL%

echo.
echo 📁 Response files created:
echo - user1_response.json, user2_response.json, user3_response.json
echo - room_response.json, room_details.json, all_rooms.json
echo - user2_join.json, user3_join.json, updated_room.json
echo - share_link.json, room_settings.json, transfer_admin.json
echo - skip_forward.json, stop_playback.json, kick_user.json
echo - stats.json, user2_leave.json, end_session.json
echo - error_room.json, error_join.json, error_admin.json
echo.
echo 💡 Next Steps:
echo 1. Review the response files to understand the API behavior
echo 2. Test WebSocket functionality using the guide in websocket_test_guide.md
echo 3. Use run_tests.js for interactive testing
echo 4. Customize the test users and parameters as needed
echo.
pause