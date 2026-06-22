# Chatrr

Chatrr is a real-time chat app built with React, Vite, Node.js, Express, Socket.IO, and MongoDB.

It supports user registration and login, room creation and joining, live online presence, typing indicators, message history with timestamps, system notifications for join/leave events, and persisted room/message data.

## Features

- Register with a username, email, and password
- Log in with either email or username
- Create chat rooms with automatic room ID generation
- Join existing rooms by room ID
- See online users in a room in real time with a toggleable sidebar
- Send and receive messages instantly through Socket.IO
- **Typing indicator** — see who is typing in real time with animated bouncing dots
- **Message timestamps** — each message displays the time it was sent (HH:MM format)
- **Join/Leave notifications** — system messages announce when users join or leave the room (displayed as centered, muted banners)
- Load the last 50 messages when joining a room
- Persist users, rooms, and messages in MongoDB
- Remember rooms you have joined so you can rejoin them quickly
- Prevent the same account from staying logged in in multiple tabs at once
- Copy room ID to clipboard with a single click

## Project Structure

- `backend/` - Express API, Socket.IO server, MongoDB models, and auth middleware
- `chat-app-frontend/` - React frontend built with Vite

## Requirements

- Node.js
- npm
- MongoDB connection string

## Environment Variables

Create a `.env` file in `backend/` with:

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
```

## Getting Started

### 1. Start the backend

```bash
cd backend
npm install
node index.js
```

The backend listens on `http://localhost:3000`.

If you prefer, you can also run it with `nodemon`:

```bash
npx nodemon index.js
```

### 2. Start the frontend

```bash
cd chat-app-frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173`.

## How It Works

### Authentication

- `POST /auth/register` creates a new account
- `POST /auth/login` signs a user in and returns a JWT

The frontend stores the token in `sessionStorage` and the user's joined rooms in `localStorage`.

### Socket Flow

- The frontend connects to Socket.IO at `http://localhost:3000`
- Authentication is passed through the socket handshake
- On successful auth, users can create or join rooms
- Room members, messages, and room metadata update in real time

### Typing Indicator

- As a user types, a `typing` event with `{ username, isTyping: true }` is emitted to the room
- After 2 seconds of inactivity, `{ username, isTyping: false }` is emitted automatically
- Sending a message also immediately stops the typing indicator
- Other users see animated bouncing dots with the typing user's name (e.g., "Alice is typing...")

### System Notifications

- When a user creates or joins a room, a system message "X has joined the room" appears
- When a user disconnects, a system message "X has left the room" appears
- System messages are styled as centered, muted, italic banners (no chat bubble)

### Message Timestamps

- Every message stores a `timestamp` in MongoDB
- Both sent and received messages display the time in HH:MM format
- Timestamps are shown in small muted text below each message

### Room Persistence

- Rooms are stored in MongoDB
- Messages are stored per room and sorted by timestamp
- When a user joins a room, the last 50 messages are loaded

## Main Routes

- `/` - Login and registration screen
- `/create-room` - Create a new chat room
- `/chat` - Active room chat interface

## Backend Models

- `User` - username, email, password hash, joined rooms, socket status, and last seen
- `Room` - room ID, room name, creator, and creation time
- `Message` - room ID, username, message text, and timestamp

## Notes

- Make sure MongoDB is running and `MONGO_URI` is valid before starting the backend.
- The frontend and backend both assume the local development ports shown above.
- If a user is already logged in from another tab, the socket connection is rejected to enforce single-session behavior.