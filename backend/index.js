require('dotenv').config();
const express = require('express');
const app = express();
const { Server } = require('socket.io');
const http = require('http');
const crypto = require('crypto');
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:5173'
    }
});

const connectDB = require('./db');
const Message = require('./models/Message');

let rooms = new Map();

io.on('connection', (socket) => {
    socket.on('create-room', async (username, roomName) => {
        const roomId = crypto.randomUUID().slice(0, 8).toUpperCase();
        socket.username = username;
        socket.roomName = roomName;
        socket.roomId = roomId;
        socket.join(roomId);
        rooms.set(roomId, {
            roomName,
            members: []
        });
        rooms.get(roomId).members.push({ id: socket.id, username: socket.username });
        socket.emit('room-info', { roomId, roomName, members: rooms.get(roomId).members });
        io.to(roomId).emit('online', rooms.get(roomId).members);
        console.log(`${socket.username} joined the ${socket.roomName} room with ${socket.roomId}`);
        
        // New room has no history, emit empty array for consistency
        socket.emit('chat-history', []);
    });

    socket.on('join-room', async (username, roomId) => {
        socket.username = username;
        const exist = rooms.get(roomId);
        if (!exist) {
            socket.emit('error', `Room doesnt exist`);
            console.log(`Room doesnt exist`);
            return;
        }
        socket.join(roomId);
        socket.roomId = roomId;
        socket.roomName = exist.roomName;
        rooms.get(roomId).members.push({ id: socket.id, username: socket.username });
        socket.emit('room-info', { roomId, roomName: exist.roomName, members: rooms.get(roomId).members });
        console.log(rooms.get(roomId).members);
        console.log(`${socket.username} connected`);

        // Fetch and send the last 50 messages for this room
        try {
            const history = await Message.find({ roomId })
                .sort({ timestamp: 1 })
                .limit(50)
                .lean();
            socket.emit('chat-history', history);
        } catch (error) {
            console.error('Error loading chat history:', error);
            socket.emit('chat-history', []);
        }
    });

    socket.on('message', async (msg) => {
        console.log(msg);

        // Persist message to database
        try {
            await Message.create({
                roomId: socket.roomId,
                username: socket.username,
                text: msg
            });
        } catch (error) {
            console.error('Error persisting message:', error);
        }

        socket.broadcast.to(socket.roomId).emit('displayMsg', { user: socket.username, text: msg });
    });

    socket.on('disconnect', () => {
        console.log(`${socket.username} disconnected`);
        const room = rooms.get(socket.roomId);
        if (!room) {
            return;
        }

        rooms.get(socket.roomId).members = room.members.filter(user => user.id !== socket.id);

        if (rooms.get(socket.roomId).members.length === 0) {
            rooms.delete(socket.roomId);
            return;
        }

        io.to(socket.roomId).emit('online', rooms.get(socket.roomId).members);
        console.log(room.members);
    });
});

// Connect to database before listening
connectDB().then(() => {
    server.listen(3000, () => {
        console.log('server running at port 3000');
    });
}).catch((err) => {
    console.error('Database connection failed:', err);
    // Listen anyway so the server is not completely offline
    server.listen(3000, () => {
        console.log('server running at port 3000 (no DB connection)');
    });
});