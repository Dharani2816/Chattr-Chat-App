import { useState, useEffect } from "react";
import socket from "./socket";
import "./ChatPage.css";
import { useNavigate } from "react-router-dom";

function ChatPage() {
    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState([
    ]);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const nav = useNavigate();
    function disconnectUser() {
        socket.off("displayMsg");
        socket.disconnect();
        nav('/');
    }
    useEffect(() => {
        socket.on('online',(users)=>{
            setOnlineUsers(users);
        })
        socket.on("displayMsg", (msg) => {
            setMessages(prev => [...prev, msg]);
        });

        return () => {
            socket.off("displayMsg");
            socket.disconnect();
        };

    }, []);
    const sendMessage = () => {
        if(message.trim() === "") return;
        let msg = {};
        msg.text = message;
        msg.user = 'You';
        setMessages(prev => [...prev, msg])
        socket.emit("message", message);
        setMessage("");
    };

    return (
        <div className="chat-container">
            <div className="chat-header">
                <h2>
                    Hi {socket.username}...
                    This is your Chat Room
                </h2>

                <button
                    className="leave-btn"
                    onClick={disconnectUser}
                >
                    Leave Room
                </button>
            </div>
            <div className="online-users">
                <h3>Online Users:</h3>
                {onlineUsers.map((user, index) => (
                    <p key={index}>{user.username}</p>
                ))}
            </div>
            <div className="chat-messages">
                {messages.map((msg, index) => (
                    <div
                        key={index}
                        className={`message ${msg.user === "You" ? "sent" : "received"
                            }`}
                    >
                        <span className="user">{msg.user}</span>
                        <p>{msg.text}</p>
                    </div>
                ))}
            </div>

            <div className="chat-input">
                <input
                    type="text"
                    placeholder="Type a message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) =>
                        e.key === "Enter" && sendMessage()
                    }
                />

                <button onClick={sendMessage}>
                    Send
                </button>
            </div>
        </div>
    );
}

export default ChatPage;