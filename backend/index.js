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
const { redis, connectRedis } = require('./redis');
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

// ── Redis-Backed Room Helpers ─────────────────────────────
// Each room stored as Redis hash  room:{roomId}  with fields: roomName, members (JSON)

async function getRoom(roomId) {
    const data = await redis.hgetall(`room:${roomId}`);
    if (!data || !data.roomName) return null;
    return {
        roomName: data.roomName,
        members: JSON.parse(data.members || '[]')
    };
}

async function setRoom(roomId, roomName, members = []) {
    await redis.hset(`room:${roomId}`, 'roomName', roomName, 'members', JSON.stringify(members));
}

async function addMember(roomId, member) {
    const room = await getRoom(roomId);
    if (!room) return null;
    const exists = room.members.some(m => m.id === member.id);
    if (!exists) {
        room.members.push(member);
        await redis.hset(`room:${roomId}`, 'members', JSON.stringify(room.members));
    }
    return room;
}

async function removeMember(roomId, socketId) {
    const room = await getRoom(roomId);
    if (!room) return null;
    room.members = room.members.filter(m => m.id !== socketId);
    if (room.members.length === 0) {
        await redis.del(`room:${roomId}`);
    } else {
        await redis.hset(`room:${roomId}`, 'members', JSON.stringify(room.members));
    }
    return room;
}
// ──────────────────────────────────────────────────────────

// ── Redis-Backed Rate Limiter ─────────────────────────────
// Uses INCR + EXPIRE — Redis TTL handles cleanup automatically.

async function isRateLimited(key, maxRequests, windowMs = 60000) {
    const redisKey = `ratelimit:${key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) {
        // First request in this window — set expiry
        await redis.pexpire(redisKey, windowMs);
    }
    return count > maxRequests;
}
// ──────────────────────────────────────────────────────────

// ── Redis-Backed Message Cache (write-through, last 50) ──
// Uses Redis lists — survives restarts, shared across instances.

async function cacheMessage(roomId, { username, text, timestamp }) {
    const entry = JSON.stringify({ username, text, timestamp: timestamp || new Date() });
    await redis.lpush(`msgcache:${roomId}`, entry);
    await redis.ltrim(`msgcache:${roomId}`, 0, 49);
}

async function getCachedMessages(roomId, count = 20) {
    const raw = await redis.lrange(`msgcache:${roomId}`, 0, count - 1);
    return raw.map(entry => JSON.parse(entry));
}

async function primeMsgCache(roomId, messages) {
    // messages should be newest-first
    if (messages.length === 0) return;
    const pipeline = redis.pipeline();
    pipeline.del(`msgcache:${roomId}`);
    for (const m of messages) {
        pipeline.rpush(`msgcache:${roomId}`, JSON.stringify({
            username: m.username,
            text: m.text,
            timestamp: m.timestamp
        }));
    }
    pipeline.ltrim(`msgcache:${roomId}`, 0, 49);
    await pipeline.exec();
}
// ──────────────────────────────────────────────────────────

io.on('connection', async (socket) => {
    // socket.username and socket.userId are automatically populated by socketAuth
    socket.on('create-room', async (usernameArg, roomName) => {
        const roomId = crypto.randomUUID().slice(0, 8).toUpperCase();
        socket.roomName = roomName;
        socket.roomId = roomId;
        socket.join(roomId);

        const members = [{ id: socket.id, username: socket.username }];
        await setRoom(roomId, roomName, members);

        socket.emit('room-info', { roomId, roomName, members });
        io.to(roomId).emit('online', members);
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
        let liveRoom = await getRoom(roomId);

        if (liveRoom) {
            // Room is already in Redis
            roomName = liveRoom.roomName;
        } else {
            // Room not in Redis, query database (allows rejoining after server restart)
            try {
                const dbRoom = await Room.findOne({ roomId });
                if (!dbRoom) {
                    socket.emit('error', `Room doesnt exist`);
                    console.log(`Room doesnt exist: ${roomId}`);
                    return;
                }
                roomName = dbRoom.roomName;
                await setRoom(roomId, roomName, []);
            } catch (error) {
                console.error('Database query error on join-room:', error);
                socket.emit('error', 'Database connection issue');
                return;
            }
        }

        const alreadyInRoom = socket.rooms.has(roomId);

        if (!alreadyInRoom) {
            socket.join(roomId);
            socket.roomId = roomId;
            socket.roomName = roomName;
            const room = await addMember(roomId, { id: socket.id, username: socket.username });

            socket.emit('room-info', { roomId, roomName, members: room.members });
            io.to(roomId).emit('online', room.members);
            io.to(roomId).emit('displayMsg', { user: 'System', text: `${socket.username} has joined the room`, timestamp: new Date() });
            console.log(`${socket.username} with ${socket.id} connected to room ID: ${roomId}`);
        } else {
            console.log(`${socket.username} with ${socket.id} already in room ID: ${roomId} (skipping duplicate join actions)`);
            const room = await getRoom(roomId);
            if (room) {
                socket.emit('room-info', { roomId, roomName, members: room.members });
            }
        }

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

            // Prime the Redis message cache with this room's history
            await primeMsgCache(roomId, [...history].reverse().map(m => ({
                username: m.username,
                text: m.text,
                timestamp: m.timestamp
            })));
        } catch (error) {
            console.error('Error loading chat history:', error);
            socket.emit('chat-history', []);
        }
    });

    socket.on('typing', ({ username, isTyping }) => {
        socket.broadcast.to(socket.roomId).emit('typing', { username, isTyping });
    });

    // Helper: call Google Gemini API
    async function callGemini(prompt, retries = 3) {
        const API_KEY = process.env.GEMINI_API_KEY;
        if (!API_KEY) {
            console.warn('GEMINI_API_KEY not set in .env');
            return null;
        }

        // Fallback models if primary is overloaded
        const models = [
            'gemini-2.5-flash',
            'gemini-2.0-flash',
            'gemini-flash-latest',
            'gemini-2.0-flash-lite'
        ];

        for (let attempt = 0; attempt <= retries; attempt++) {
            const model = models[Math.min(attempt, models.length - 1)];
            try {
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`,
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
                if (response.ok) {
                    const data = await response.json();
                    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                    return text?.trim() || '...';
                }

                const errData = await response.json();

                if (response.status === 429) {
                    // Extract retry delay from API response if available
                    const retryDelay = errData?.error?.details?.find(d => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo')?.retryDelay;
                    let waitMs = 5000 * (attempt + 1); // default: 5s, 10s, 15s, 20s
                    if (retryDelay) {
                        const seconds = parseInt(retryDelay.replace('s', ''), 10);
                        if (!isNaN(seconds)) waitMs = Math.min(seconds * 1000 + 1000, 60000);
                    }
                    console.warn(`Gemini ${model} rate limited. Waiting ${waitMs / 1000}s before retry...`);
                    await new Promise(r => setTimeout(r, waitMs));
                    continue;
                }

                if (response.status === 503) {
                    console.warn(`Gemini ${model} overloaded (503). Waiting 3s...`);
                    await new Promise(r => setTimeout(r, 3000));
                    continue;
                }

                console.error(`Gemini ${model} unexpected error:`, response.status, JSON.stringify(errData));
                throw new Error(`Gemini returned ${response.status}`);
            } catch (error) {
                if (error.message.startsWith('Gemini returned')) throw error;
                if (attempt >= retries) throw error;
                console.warn(`Gemini attempt ${attempt + 1} failed: ${error.message}. Retrying...`);
                await new Promise(r => setTimeout(r, 2000));
            }
        }
        return null;
    }

    socket.on('message', async (msg) => {
        console.log(msg);

        // Guard: user must be in a room to send messages
        if (!socket.roomId) {
            socket.emit('error', 'You must join a room before sending messages.');
            return;
        }

        // Apply rate limiting: 30 normal messages or 5 bot queries per minute
        const isBotMessage = /^@ChatrrBot\b/i.test(msg.trim()) || /^@chatrrbot\b/i.test(msg.trim());

        if (isBotMessage && await isRateLimited(`${socket.id}-bot`, 5)) {
            socket.emit('displayMsg', { user: 'ChatrrBot', text: '⏳ You are using the bot too fast. Please wait a moment before asking again.', timestamp: new Date() });
            return;
        }

        if (!isBotMessage && await isRateLimited(`${socket.id}-msg`, 30)) {
            socket.emit('error', 'You are sending messages too fast. Please slow down.');
            return;
        }

        if (isBotMessage) {
            try {
                // Read context from Redis cache
                let history = await getCachedMessages(socket.roomId, 20);

                // Fallback to DB on cache miss (e.g. after server restart)
                if (!history || history.length === 0) {
                    const dbHistory = await Message.find({ roomId: socket.roomId })
                        .sort({ timestamp: -1 })
                        .limit(20)
                        .lean();
                    history = dbHistory;
                    await primeMsgCache(socket.roomId, dbHistory);
                }

                const contextLines = history
                    .reverse()
                    .map(m => `${m.username}: ${m.text}`)
                    .join('\n');

                const userQuestion = msg.replace(/^@ChatrrBot\s*/i, '').trim() || msg.replace(/^@chatrrbot\s*/i, '').trim();

                const room = await getRoom(socket.roomId);
                const prompt = [
                    `You are ChatrrBot, a helpful AI assistant. You are in the room "#${socket.roomName}".`,
                    `Current online users: ${room?.members.map(m => m.username).join(', ') || 'none'}`,
                    ``,
                    `Recent conversation:`,
                    contextLines || '(no messages yet)',
                    ``,
                    `User ${socket.username} asks: ${userQuestion}`,
                    ``,
                    `Respond concisely and naturally. Keep it short — 2-3 sentences max.`
                ].join('\n');

                // "Bot is thinking..." indicator shown only to the asking user
                socket.emit('displayMsg', { user: 'ChatrrBot', text: '...', timestamp: new Date(), isTyping: true });

                const aiResponse = await callGemini(prompt);

                if (aiResponse) {
                    // Send bot response ONLY to the user who asked
                    socket.emit('displayMsg', { user: 'ChatrrBot', text: aiResponse, timestamp: new Date() });
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
        // Persist message to database + write-through to Redis cache
        try {
            const saved = await Message.create({
                roomId: socket.roomId,
                username: socket.username,
                text: msg
            });
            // Push to Redis cache (instant reads for future bot queries)
            await cacheMessage(socket.roomId, {
                username: socket.username,
                text: msg,
                timestamp: saved.timestamp || new Date()
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

        if (!socket.roomId) return;

        const room = await getRoom(socket.roomId);
        if (!room) return;

        io.to(socket.roomId).emit('displayMsg', { user: 'System', text: `${socket.username} has left the room`, timestamp: new Date() });

        const updated = await removeMember(socket.roomId, socket.id);

        // Room was deleted because it's empty
        if (!updated || updated.members.length === 0) return;

        io.to(socket.roomId).emit('online', updated.members);
        console.log(updated.members);
    });
});

// Connect to database and Redis before listening
Promise.all([connectDB(), connectRedis()])
    .then(() => {
        server.listen(3000, () => {
            console.log('server running at port 3000');
        });
    })
    .catch((err) => {
        console.error('Startup connection failed:', err);
        server.listen(3000, () => {
            console.log('server running at port 3000 (degraded mode — check Redis/MongoDB)');
        });
    });
