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
    // Handle all connection errors, not just "already logged in"
    if (err.message === 'Already logged in from another tab') {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('username');
        window.dispatchEvent(new CustomEvent('socket-auth-blocked', {
            detail: { message: err.message }
        }));
        return;
    }

    // For auth/connection errors, notify the app via custom event
    window.dispatchEvent(new CustomEvent('socket-connection-error', {
        detail: { message: err.message }
    }));
});

// Auto-rejoin room if socket reconnects — re-fetch room info from server
socket.on('connect', () => {
    const savedRoomId = socket.roomId;
    const savedUsername = sessionStorage.getItem('username');
    if (savedRoomId && savedUsername) {
        if (socket.isManualJoin) {
            // Initial manual connection has already emitted 'join-room' explicitly.
            // Reset the flag so that future automatic reconnects trigger the auto-rejoin logic.
            socket.isManualJoin = false;
            return;
        }
        // Brief delay to let the server's rooms map be rebuilt if restart happened
        setTimeout(() => {
            if (socket.roomId === savedRoomId) {
                socket.emit('join-room', savedUsername, savedRoomId);
            }
        }, 500);
    }
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
