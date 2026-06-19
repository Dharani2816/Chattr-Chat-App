import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
    autoConnect: false
});

// Race-free chat history catcher
socket.on('chat-history', (history) => {
    if (socket.onChatHistoryReceived) {
        socket.onChatHistoryReceived(history);
    } else {
        socket.initialHistory = history;
    }
});

export default socket;