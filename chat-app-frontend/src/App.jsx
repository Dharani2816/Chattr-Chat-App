import { useState, useEffect } from "react";
import socket from "./socket";
import "./App.css";
import { useNavigate } from "react-router-dom";

function App() {
  const [username, setUsername] = useState("");
  const [roomid, setRoomid] = useState("");
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    const handleRoomInfo = ({ roomId, roomName, members }) => {
      socket.roomId = roomId;
      socket.roomName = roomName;
      socket.onlineUsers = members || [];
      setError(null);
      setIsLoading(false);
      nav("/chat");
    };

    const handleError = (errorMsg) => {
      setError(errorMsg);
      setIsLoading(false);
    };

    socket.on('room-info', handleRoomInfo);
    socket.on('error', handleError);

    return () => {
      socket.off('room-info', handleRoomInfo);
      socket.off('error', handleError);
    };
  }, [nav]);

  const connect = () => {
    if (username.trim() === "") {
      setError('Enter Username');
      return;
    }
    if (roomid.trim() === "") {
      setError('Enter Room ID');
      return;
    }
    setError(null);
    setIsLoading(true);
    socket.connect();
    socket.username = username;
    socket.roomid = roomid;
    socket.emit("join-room", username, roomid);
  };

  const createRoom = () => {
    if (username.trim() === "") {
      setError('Enter Username');
      return;
    }
    socket.username = username;
    nav('/create-room');
  };

  return (
    <div className="auth-page-wrapper">
      <div className="container">
        <div className="auth-header">
          <h1>Chatrr</h1>
          <p className="subtitle">Looking for someone to chat with? Start here 😉</p>
        </div>

        {error && (
          <div className="error-banner" role="alert">
            <svg className="alert-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="username">Username</label>
          <div className="input-wrapper">
            <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
            <input
              id="username"
              type="text"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && connect()}
              disabled={isLoading}
              autoComplete="off"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="roomid">Room ID</label>
          <div className="input-wrapper">
            <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5-3.9 19.5m-2.1-19.5-3.9 19.5" />
            </svg>
            <input
              id="roomid"
              type="text"
              placeholder="Enter room id"
              value={roomid}
              onChange={(e) => setRoomid(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && connect()}
              disabled={isLoading}
              autoComplete="off"
            />
          </div>
        </div>

        <button className="btn-primary" onClick={connect} disabled={isLoading}>
          {isLoading ? (
            <span className="loading-spinner-wrapper">
              <svg className="animate-spin spinner" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Joining Room...</span>
            </span>
          ) : (
            "Join Room"
          )}
        </button>

        <div className="divider">
          <span>OR</span>
        </div>

        <button className="btn-secondary" onClick={createRoom} disabled={isLoading}>
          Create Room
        </button>
      </div>
    </div>
  );
}

export default App;