import { useState, useEffect } from "react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function App() {
  const [message, setMessage] = useState("Loading...");

  useEffect(() => {
    fetch(API_URL)
      .then((res) => res.json())
      .then((data) => setMessage(data.message))
      .catch(() => setMessage("Failed to connect to backend"));
  }, []);

  return (
    <div className="app">
      <h1>Agent 311</h1>
      <p>{message}</p>
    </div>
  );
}

export default App;
