import { useState } from "react";
import socket from "./socket";
import "./App.css";
import { useNavigate } from "react-router-dom";

function App() {
  const [username, setUsername] = useState("");
  const nav = useNavigate();

  const connect = () => {
    if (username.trim() === "") return;
    socket.connect();
    socket.username = username;
    socket.emit("join", username);
    nav("/chat");
  };

  return (
    <div className="container">
      <h1>Chatrr</h1>
      <h2>Looking for someone to chat with? Start here 😉</h2>
      <input
        type="text"
        placeholder="Enter username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && connect()}
      />

      <button onClick={connect}>
        Join
      </button>
    </div>
  )
}
export default App;