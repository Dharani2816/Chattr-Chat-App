import { useEffect, useState } from "react";
import socket from "./socket";
import "./Room.css";
import { useNavigate } from "react-router-dom";

function Room() {
  const [roomName, setRoomName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    // If user navigates directly to /create-room but socket has no username, send back
    if (!socket.username || socket.username.trim() === "") {
      nav("/");
      return;
    }

    const handleRoomInfo = ({ roomId, roomName, members }) => {
      socket.roomId = roomId;
      socket.roomName = roomName;
      socket.onlineUsers = members || [];
      setError("");
      setIsLoading(false);
      nav("/chat");
    };

    const handleError = (message) => {
      setError(message);
      setIsLoading(false);
    };

    socket.on('room-info', handleRoomInfo);
    socket.on('error', handleError);

    return () => {
      socket.off('room-info', handleRoomInfo);
      socket.off('error', handleError);
    };
  }, [nav]);

  const createRoom = () => {
    if (roomName.trim() === "") {
      setError('Enter Room Name');
      return;
    }
    if (!socket.username || socket.username.trim() === "") {
      setError('Enter Username First');
      return;
    }

    setError("");
    setIsLoading(true);
    socket.connect();
    socket.roomName = roomName;
    socket.emit("create-room", socket.username, socket.roomName);
  };

  return (
    <div className="auth-page-wrapper">
      <div className="room-card">
        <div className="room-header">
          <span className="room-kicker">Create a new space</span>
          <h1>Create Room</h1>
          <p className="subtitle">Choose a room name and we’ll generate the room ID for you automatically.</p>
        </div>

        {error && (
          <div className="error-banner room-error" role="alert">
            <svg className="alert-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div className="room-form">
          <div className="form-group">
            <label htmlFor="roomName">Room Name</label>
            <div className="input-wrapper">
              <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5-3.9 19.5m-2.1-19.5-3.9 19.5" />
              </svg>
              <input
                id="roomName"
                type="text"
                placeholder="Enter room name"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createRoom()}
                disabled={isLoading}
                autoComplete="off"
              />
            </div>
          </div>

          <button className="btn-primary" onClick={createRoom} disabled={isLoading}>
            {isLoading ? (
              <span className="loading-spinner-wrapper">
                <svg className="animate-spin spinner" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Creating Room...</span>
              </span>
            ) : (
              "Create Room"
            )}
          </button>

          <button className="btn-secondary" onClick={() => nav("/")} disabled={isLoading}>
            Back to Join
          </button>
        </div>
      </div>
    </div>
  );
}

export default Room;