import { useState, useEffect } from "react";
import socket from "./socket";
import "./App.css";
import { useNavigate } from "react-router-dom";

function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('token'));
  const [username, setUsername] = useState(() => sessionStorage.getItem('username') || "");
  const [authUsername, setAuthUsername] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState("login"); // 'login' or 'register'
  const [roomid, setRoomid] = useState("");
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [savedRooms, setSavedRooms] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('rooms')) || [];
    } catch {
      return [];
    }
  });

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

      // If socket is rejected due to authentication or duplicate login, redirect to login
      if (errorMsg && (errorMsg.toLowerCase().includes("authentication") || 
          errorMsg.toLowerCase().includes("already logged in"))) {
        handleLogout();
      }
    };

    const handleSocketAuthBlocked = (event) => {
      setError(event.detail?.message || 'You are already logged in from another tab.');
      setIsLoading(false);
      setToken(null);
      setUsername("");
      setPassword("");
      setAuthUsername("");
      setAuthEmail("");
      setIdentifier("");
    };

    socket.on('room-info', handleRoomInfo);
    socket.on('error', handleError);
    const handleSocketConnectionError = (event) => {
      setError(event.detail?.message || 'Connection error. Please try again.');
      setIsLoading(false);
    };

    window.addEventListener('socket-auth-blocked', handleSocketAuthBlocked);
    window.addEventListener('socket-connection-error', handleSocketConnectionError);

    return () => {
      socket.off('room-info', handleRoomInfo);
      socket.off('error', handleError);
      window.removeEventListener('socket-auth-blocked', handleSocketAuthBlocked);
      window.removeEventListener('socket-connection-error', handleSocketConnectionError);
    };
  }, [nav]);

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('username');
    localStorage.removeItem('rooms');
    setToken(null);
    setUsername("");
    setAuthUsername("");
    setAuthEmail("");
    setIdentifier("");
    setPassword("");
    setSavedRooms([]);
    setError(null);
    socket.disconnect();
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    if (password.trim() === "") {
      setError("Enter Password");
      return;
    }
    if (authMode === "register") {
      if (authUsername.trim() === "") {
        setError("Enter Username");
        return;
      }
      if (authEmail.trim() === "") {
        setError("Enter Email");
        return;
      }
    } else if (identifier.trim() === "") {
      setError("Enter Email or Username");
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      const url = `http://localhost:3000/auth/${authMode}`;
      const body = authMode === "register"
        ? { username: authUsername, email: authEmail, password }
        : { identifier, password };
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      sessionStorage.setItem('token', data.token);
      sessionStorage.setItem('username', data.username);
      
      const userRooms = data.rooms || [];
      localStorage.setItem('rooms', JSON.stringify(userRooms));

      setToken(data.token);
      setUsername(data.username);
      setSavedRooms(userRooms);
      setPassword("");
      if (authMode === "register") {
        setAuthUsername("");
        setAuthEmail("");
      } else {
        setIdentifier("");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const connect = (targetRoomId) => {
    const finalRoomId = targetRoomId || roomid;
    if (!finalRoomId || finalRoomId.trim() === "") {
      setError('Enter Room ID');
      return;
    }
    setError(null);
    setIsLoading(true);

    socket.username = username;
    socket.roomId = finalRoomId;
    
    // Explicitly update socket auth token before connecting
    socket.auth = { token: sessionStorage.getItem('token') };
    
    // Set flag so the connect listener knows this was a manual join
    socket.isManualJoin = true;
    
    socket.connect();
    socket.emit("join-room", username, finalRoomId);
  };

  const createRoom = () => {
    nav('/create-room');
  };

  // Render Authentication screen (Login / Register)
  if (!token) {
    return (
      <div className="auth-page-wrapper">
        <div className="container">
          <div className="auth-header">
            <h1>Chatrr</h1>
            <p className="subtitle">
              {authMode === "login" 
                ? "Sign in to connect with rooms and start chatting" 
                : "Create a new account to join the discussion"}
            </p>
          </div>

          {error && (
            <div className="error-banner" role="alert">
              <svg className="alert-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="auth-form">
            {authMode === "register" ? (
              <>
                <div className="form-group">
                  <label htmlFor="register-username">Username</label>
                  <div className="input-wrapper">
                    <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                    </svg>
                    <input
                      id="register-username"
                      type="text"
                      placeholder="Enter username"
                      value={authUsername}
                      onChange={(e) => setAuthUsername(e.target.value)}
                      disabled={isLoading}
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="register-email">Email</label>
                  <div className="input-wrapper">
                    <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m21.75 8.25-9 5.25-9-5.25M3 6.75h18v10.5H3V6.75Z" />
                    </svg>
                    <input
                      id="register-email"
                      type="email"
                      placeholder="Enter email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      disabled={isLoading}
                      autoComplete="email"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="form-group">
                <label htmlFor="identifier">Email or Username</label>
                <div className="input-wrapper">
                  <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                  <input
                    id="identifier"
                    type="text"
                    placeholder="Enter email or username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    disabled={isLoading}
                    autoComplete="username"
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="input-wrapper">
                <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
                <input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? (
                <span className="loading-spinner-wrapper">
                  <svg className="animate-spin spinner" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{authMode === "login" ? "Logging In..." : "Registering..."}</span>
                </span>
              ) : (
                authMode === "login" ? "Log In" : "Register"
              )}
            </button>
          </form>

          <div className="auth-toggle">
            {authMode === "login" ? (
              <p>
                Don't have an account?{" "}
                <button className="toggle-mode-btn" onClick={() => { setAuthMode("register"); setError(null); }}>
                  Register
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{" "}
                <button className="toggle-mode-btn" onClick={() => { setAuthMode("login"); setError(null); }}>
                  Log In
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render Session dashboard (Join / Create Room)
  return (
    <div className="auth-page-wrapper">
      <div className="container">
        <div className="auth-header">
          <div className="user-profile-badge">
            <span className="user-profile-avatar">{username.slice(0, 2).toUpperCase()}</span>
            <div className="user-profile-info">
              <span className="user-profile-name">{username}</span>
              <button className="logout-btn" onClick={handleLogout}>Log Out</button>
            </div>
          </div>
          <h1>Join Room</h1>
          <p className="subtitle">Enter a Room ID to start chatting, or spin up a new space.</p>
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

        <button className="btn-primary" onClick={() => connect()} disabled={isLoading}>
          {isLoading ? (
            <span className="loading-spinner-wrapper">
              <svg className="animate-spin spinner" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Connecting...</span>
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

        {savedRooms.length > 0 && (
          <div className="saved-rooms-section">
            <h3>Rejoin a room</h3>
            <div className="saved-rooms-list">
              {savedRooms.map((rId) => (
                <button
                  key={rId}
                  className="saved-room-item"
                  onClick={() => connect(rId)}
                  disabled={isLoading}
                >
                  <span className="room-item-hash">#</span>
                  <span className="room-item-id">{rId}</span>
                  <svg className="room-item-arrow" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
