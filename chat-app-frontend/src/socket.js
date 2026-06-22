import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
    autoConnect: false,
    auth: (cb) => {
        cb({
            token: sessionStorage.getItem('token')
        });
    }
});

socket.on('connect_error', (err) => {
    if (err.message !== 'Already logged in from another tab') {
        return;
    }

    sessionStorage.removeItem('token');
    sessionStorage.removeItem('username');

    window.dispatchEvent(new CustomEvent('socket-auth-blocked', {
        detail: { message: err.message }
    }));
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