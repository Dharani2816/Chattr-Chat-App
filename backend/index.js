require('dotenv').config();
const express = require('express');
const cors = require('cors');
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
const User = require('./models/User');
const Room = require('./models/Room');
const authRoutes = require('./routes/auth');
const socketAuth = require('./middleware/auth');

// HTTP Middleware
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());
app.use('/auth', authRoutes);

// Socket.IO Connection Middleware (checks JWT on handshake)
io.use(socketAuth);

let rooms = new Map();

io.on('connection', async (socket) => {
    // socket.username and socket.userId are automatically populated by socketAuth
    socket.on('create-room', async (usernameArg, roomName) => {
        const roomId = crypto.randomUUID().slice(0, 8).toUpperCase();
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
        io.to(roomId).emit('displayMsg', { user: 'System', text: `${socket.username} has joined the room`, timestamp: new Date() });
        console.log(`${socket.username} created and joined the ${roomName} room with ID: ${roomId}`);
        
        try {
            // Persist room to database
            await Room.findOneAndUpdate(
                { roomId },
                { roomId, roomName, createdBy: socket.username },
                { upsert: true }
            );
            
            // Link room to user
            await User.findByIdAndUpdate(socket.userId, {
                $addToSet: { rooms: roomId }
            });
        } catch (error) {
            console.error('Error persisting created room:', error);
        }

        socket.emit('chat-history', []);
    });

    socket.on('join-room', async (usernameArg, roomId) => {
        let roomName;
        const liveRoom = rooms.get(roomId);

        if (liveRoom) {
            // Room is already in memory
            roomName = liveRoom.roomName;
        } else {
            // Room not in memory, query database (allows rejoining after server restart)
            try {
                const dbRoom = await Room.findOne({ roomId });
                if (!dbRoom) {
                    socket.emit('error', `Room doesnt exist`);
                    console.log(`Room doesnt exist: ${roomId}`);
                    return;
                }
                roomName = dbRoom.roomName;
                rooms.set(roomId, { roomName, members: [] });
            } catch (error) {
                console.error('Database query error on join-room:', error);
                socket.emit('error', 'Database connection issue');
                return;
            }
        }

        socket.join(roomId);
        socket.roomId = roomId;
        socket.roomName = roomName;
        rooms.get(roomId).members.push({ id: socket.id, username: socket.username });
        
        socket.emit('room-info', { roomId, roomName, members: rooms.get(roomId).members });
        io.to(roomId).emit('online', rooms.get(roomId).members);
        io.to(roomId).emit('displayMsg', { user: 'System', text: `${socket.username} has joined the room`, timestamp: new Date() });
        console.log(`${socket.username} with ${socket.id} connected to room ID: ${roomId}`);

        try {
            // Link room to user (guarantees update even if room was already linked before)
            await User.findByIdAndUpdate(socket.userId, {
                $addToSet: { rooms: roomId }
            });
        } catch (error) {
            console.error('Error linking room to user:', error);
        }

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

    socket.on('typing', ({ username, isTyping }) => {
        socket.broadcast.to(socket.roomId).emit('typing', { username, isTyping });
    });

    // Helper: call Google Gemini API
    async function callGemini(prompt) {
        const API_KEY = process.env.GEMINI_API_KEY;
        if (!API_KEY) {
            console.warn('GEMINI_API_KEY not set in .env');
            return null;
        }

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            maxOutputTokens: 500,
                            temperature: 0.7
                        }
                    })
                }
            );
            if (!response.ok) {
                const errText = await response.text();
                console.error('Gemini API error:', response.status, errText);
                throw new Error(`Gemini returned ${response.status}`);
            }
            const data = await response.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            return text?.trim() || '...';
        } catch (error) {
            console.error('Gemini error:', error.message);
            return null;
        }
    }

    socket.on('message', async (msg) => {
        console.log(msg);

        // Check if this message is directed at ChatrrBot
        const isBotMessage = /^@ChatrrBot\b/i.test(msg.trim()) || /^@chatrrbot\b/i.test(msg.trim());

        if (isBotMessage) {
            try {
                // Fetch recent chat history for context (last 20 messages)
                const history = await Message.find({ roomId: socket.roomId })
                    .sort({ timestamp: -1 })
                    .limit(20)
                    .lean();

                const contextLines = history
                    .reverse()
                    .map(m => `${m.username}: ${m.text}`)
                    .join('\n');

                const userQuestion = msg.replace(/^@ChatrrBot\s*/i, '').trim() || msg.replace(/^@chatrrbot\s*/i, '').trim();

                const prompt = [
                    `You are ChatrrBot, a helpful AI assistant. You are in the room "#${socket.roomName}".`,
                    `Current online users: ${rooms.get(socket.roomId)?.members.map(m => m.username).join(', ') || 'none'}`,
                    ``,
                    `Recent conversation:`,
                    contextLines || '(no messages yet)',
                    ``,
                    `User ${socket.username} asks: ${userQuestion}`,
                    ``,
                    `Respond concisely and naturally. Keep it short — 2-3 sentences max.`
                ].join('\n');

                // Also persist the user's bot query to DB
                await Message.create({
                    roomId: socket.roomId,
                    username: socket.username,
                    text: msg
                }).catch(() => {});

                // Broadcast that the user asked the bot (so others see the question)
                socket.broadcast.to(socket.roomId).emit('displayMsg', { user: socket.username, text: msg, timestamp: new Date() });

                // "Bot is thinking..." indicator for the asking user
                socket.emit('displayMsg', { user: 'ChatrrBot', text: '...', timestamp: new Date(), isTyping: true });

                const aiResponse = await callGemini(prompt);

                if (aiResponse) {
                    io.to(socket.roomId).emit('displayMsg', { user: 'ChatrrBot', text: aiResponse, timestamp: new Date() });
                } else {
                    socket.emit('displayMsg', { user: 'ChatrrBot', text: '⚠️ Sorry, I could not connect to the AI model. Please check your API key.', timestamp: new Date() });
                }
            } catch (error) {
                console.error('Error processing bot message:', error);
                socket.emit('displayMsg', { user: 'ChatrrBot', text: '⚠️ An error occurred while processing your request.', timestamp: new Date() });
            }
            return;
        }

        // Normal message flow
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

        socket.broadcast.to(socket.roomId).emit('displayMsg', { user: socket.username, text: msg, timestamp: new Date() });
    });

    socket.on('disconnect', async () => {
        console.log(`${socket.username} disconnected`);

        try {
            await User.findByIdAndUpdate(socket.userId, {
                lastSeen: new Date()
            });
        } catch (error) {
            console.error('Error updating lastSeen:', error);
        }

        const room = rooms.get(socket.roomId);
        if (!room) {
            return;
        }

        io.to(socket.roomId).emit('displayMsg', { user: 'System', text: `${socket.username} has left the room`, timestamp: new Date() });

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
connectDB().then(async () => {
    server.listen(3000, () => {
        console.log('server running at port 3000');
    });
}).catch((err) => {
    console.error('Database connection failed:', err);
    server.listen(3000, () => {
        console.log('server running at port 3000 (no DB connection)');
    });
});
