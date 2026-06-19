# Chatrr

Chatrr is a real-time chat app built with React, Vite, Node.js, Express, Socket.IO, and MongoDB.

It supports user registration and login, room creation and joining, live online presence, message history, and persisted room/message data.

## Features

- Register with a username, email, and password
- Log in with either email or username
- Create chat rooms with automatic room ID generation
- Join existing rooms by room ID
- See online users in a room in real time
- Send and receive messages instantly through Socket.IO
- Load the last 50 messages when joining a room
- Persist users, rooms, and messages in MongoDB
- Remember rooms you have joined so you can rejoin them quickly
- Prevent the same account from staying logged in in multiple tabs at once

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

