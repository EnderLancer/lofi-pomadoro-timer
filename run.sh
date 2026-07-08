#!/bin/bash

# Find an available port starting at 8080
PORT=8080
while lsof -i :$PORT -sTCP:LISTEN -t >/dev/null ; do
    PORT=$((PORT+1))
done

echo "Starting local server on port $PORT..."

# Start python HTTP server in the background
python3 -m http.server $PORT > /dev/null 2>&1 &
SERVER_PID=$!

# Wait a moment for server to initialize
sleep 0.5

# Open the web app in default browser
open "http://localhost:$PORT"

# Keep script running and handle exit clean-up
trap "kill $SERVER_PID; exit" INT TERM EXIT
echo "Server running at http://localhost:$PORT"
echo "Press Ctrl+C to stop the server."
wait $SERVER_PID
