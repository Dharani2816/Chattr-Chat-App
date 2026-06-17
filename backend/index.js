const express = require('express');
const app = express();
const { Server } = require('socket.io');
const http = require('http');

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:5173'
    }
});
let onlineUsers = [];
io.on('connection', (socket) => {
    socket.on('join', (username) => {
        socket.username = username;
        const exist = onlineUsers.find(u => u.id == socket.id);
        if (!exist)
            onlineUsers.push({ id: socket.id, username: socket.username });
        io.emit('online', onlineUsers);
        console.log(onlineUsers);
        console.log(`${socket.username} connected`);
    })
    socket.on('message', (msg) => {
        console.log(msg);
        socket.broadcast.emit('displayMsg', { user: socket.username, text: msg });
    })
    socket.on('disconnect', () => {
        console.log(`${socket.username} disconnected`);
        onlineUsers = onlineUsers.filter(user => user.id !== socket.id);
        io.emit('online', onlineUsers);
        console.log(onlineUsers);
    })
})
server.listen(3000, () => {
    console.log('server running at port 3000');
})