# Chatrr

Chatrr is a simple real-time chat application built with React, Vite, Node.js, Express, and Socket.IO.

## Features

- Join the chat with a username
- See who is online
- Send and receive messages instantly
- Clean, responsive chat interface

## Project Structure

- `backend/` - Express and Socket.IO server
- `chat-app-frontend/` - React and Vite client

## Getting Started

### Backend

1. Open a terminal in the `backend` folder.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   node index.js
   ```

The backend runs on `http://localhost:3000`.

### Frontend

1. Open a terminal in the `chat-app-frontend` folder.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

The frontend runs on `http://localhost:5173`.

## Notes

Make sure both the backend and frontend are running so the chat can connect through Socket.IO.
