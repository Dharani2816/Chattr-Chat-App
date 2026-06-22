import { useState, useEffect, useRef, useCallback } from "react";
import socket from "./socket";
import "./ChatPage.css";
import { useNavigate } from "react-router-dom";

function ChatPage() {
    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState([]);
    const [onlineUsers, setOnlineUsers] = useState(socket.onlineUsers || []);
    const [typingUsers, setTypingUsers] = useState([]);
    const [copied, setCopied] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const nav = useNavigate();

    function disconnectUser() {
        socket.off("displayMsg");
        socket.disconnect();
        nav('/');
    }

    useEffect(() => {
        // Safe check for direct URL access without username session
        if (!socket.username || socket.username.trim() === "") {
            nav("/");
            return;
        }

        const handleOnline = (users) => {
            setOnlineUsers(users);
        };

        const handleDisplayMsg = (msg) => {
            setMessages(prev => [...prev, msg]);
        };

        const handleHistory = (history) => {
            const formattedHistory = history.map(h => ({
                user: h.username === socket.username ? 'You' : h.username,
                text: h.text
            }));
            setMessages(formattedHistory);
        };

        const handleTyping = ({ username, isTyping }) => {
            if (username === socket.username) return;

            setTypingUsers(prev => {
                if (isTyping) {
                    // Add user if not already in list
                    return prev.includes(username) ? prev : [...prev, username];
                } else {
                    // Remove user from list
                    return prev.filter(u => u !== username);
                }
            });
        };

        socket.on('online', handleOnline);
        socket.on("displayMsg", handleDisplayMsg);
        socket.on('typing', handleTyping);
        socket.onChatHistoryReceived = handleHistory;

        // Consume history if it was received before component mounted
        if (socket.initialHistory) {
            handleHistory(socket.initialHistory);
            socket.initialHistory = null;
        }

        return () => {
            socket.onChatHistoryReceived = null;
            socket.initialHistory = null;
            socket.off('online', handleOnline);
            socket.off("displayMsg", handleDisplayMsg);
            socket.off('typing', handleTyping);
            // Do NOT disconnect here — only disconnect via the Leave button
        };
    }, [nav]);

    // Auto-scroll on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const emitTyping = useCallback((isTyping) => {
        socket.emit("typing", { username: socket.username, isTyping });
    }, []);

    const handleInputChange = (e) => {
        setMessage(e.target.value);

        // Emit typing started
        emitTyping(true);

        // Clear previous timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Set a new timeout to stop typing after 2 seconds of inactivity
        typingTimeoutRef.current = setTimeout(() => {
            emitTyping(false);
        }, 2000);
    };

    const sendMessage = () => {
        if (message.trim() === "") return;

        // Stop typing indicator when sending
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        emitTyping(false);

        let msg = {};
        msg.text = message;
        msg.user = 'You';
        setMessages(prev => [...prev, msg]);
        socket.emit("message", message);
        setMessage("");
    };

    const copyRoomId = async () => {
        if (!socket.roomId) return;

        try {
            await navigator.clipboard.writeText(socket.roomId);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
        } catch {
            setCopied(false);
        }
    };

    return (
        <div className="chat-container">
            <div className="chat-header">
                <div className="chat-title-block">
                    <div className="chat-branding">
                        <span className="chat-kicker">Chat Room</span>
                        <h2>Welcome, {socket.username}!</h2>
                        <p className="chat-room-name">Inside #{socket.roomName}</p>
                    </div>

                    <div className="room-id-panel">
                        <span className="room-id-label">Room ID</span>
                        <div className="room-id-row">
                            <code className="room-id-value">{socket.roomId}</code>
                            <button
                                type="button"
                                className={`copy-room-btn ${copied ? "copied" : ""}`}
                                onClick={copyRoomId}
                            >
                                {copied ? (
                                    <>
                                        <svg className="btn-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                        </svg>
                                        <span>Copied</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="btn-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-3a2.251 2.251 0 0 0-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.375c0-.621.504-1.125 1.125-1.125h9.75c.621 0 1.125.504 1.125 1.125v.375m-12 1.5h12m-.002 0v11.25c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V10.25Z" />
                                        </svg>
                                        <span>Copy ID</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="chat-header-actions">
                    <button 
                        type="button"
                        className={`sidebar-toggle-btn ${sidebarOpen ? 'active' : ''}`}
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        aria-label="Toggle Online Users"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.109A11.386 11.386 0 0 1 10.089 20.03l-.015-.015a11.386 11.386 0 0 1-4.985-1.8v-.12c0-1.113.285-2.16.786-3.07M3 14.135a4.125 4.125 0 0 1 7.533-2.493m0 0a9.049 9.049 0 0 1 2.224.022M3 14.135a10.025 10.025 0 0 0 4.122.952 9.352 9.352 0 0 0 4.125-.953M3 14.135v-.003c0-1.113.285-2.16.786-3.07m0 0A3.375 3.375 0 1 0 3 8.25m6.878 1.455a3.375 3.375 0 1 0-1.125-5.047M16.5 9a3.375 3.375 0 1 0 0-6.75M21 8.25a3.375 3.375 0 1 0-3.375-3.375" />
                        </svg>
                        <span className="toggle-badge">{onlineUsers.length}</span>
                    </button>

                    <button
                        className="leave-btn"
                        onClick={disconnectUser}
                    >
                        <svg className="btn-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                        </svg>
                        <span>Leave</span>
                    </button>
                </div>
            </div>

            <div className="chat-body">
                {/* Online Users Sidebar */}
                <div className={`online-users ${sidebarOpen ? "active" : ""}`}>
                    <div className="online-users-title">
                        <h3>Online Users</h3>
                        <span className="online-count">{onlineUsers.length}</span>
                    </div>
                    <div className="online-users-list">
                        {onlineUsers.map((user, index) => (
                            <div key={user.id ?? index} className="online-user-item">
                                <span className="status-dot"></span>
                                <span className="online-username">{user.username}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main Chat Area */}
                <div className="chat-main-area" onClick={() => sidebarOpen && setSidebarOpen(false)}>
                    <div className="chat-messages">
                        {messages.length === 0 ? (
                            <div className="empty-chat-state">
                                <div className="empty-chat-icon">💬</div>
                                <h3>No messages yet</h3>
                                <p>Be the first one to say hi in #{socket.roomName}!</p>
                            </div>
                        ) : (
                            messages.map((msg, index) => (
                                <div
                                    key={index}
                                    className={`message ${msg.user === "You" ? "sent" : "received"}`}
                                >
                                    <span className="user">{msg.user}</span>
                                    <p>{msg.text}</p>
                                </div>
                            ))
                        )}
                        {typingUsers.length > 0 && (
                            <div className="typing-indicator">
                                <span className="typing-dots">
                                    <span className="dot"></span>
                                    <span className="dot"></span>
                                    <span className="dot"></span>
                                </span>
                                <span className="typing-text">
                                    {typingUsers.length === 1
                                        ? `${typingUsers[0]} is typing...`
                                        : typingUsers.length === 2
                                        ? `${typingUsers[0]} and ${typingUsers[1]} are typing...`
                                        : `${typingUsers[0]} and ${typingUsers.length - 1} others are typing...`
                                    }
                                </span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="chat-input-panel">
                        <input
                            type="text"
                            placeholder={`Message #${socket.roomName}...`}
                            value={message}
                            onChange={handleInputChange}
                            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                            autoComplete="off"
                        />
                        <button onClick={sendMessage} className="send-btn" disabled={message.trim() === ""}>
                            <svg className="btn-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                            </svg>
                            <span>Send</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ChatPage;