import { useState, useRef, useEffect } from "react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function App() {
  const [token, setToken] = useState(() => localStorage.getItem("auth_token"));
  const [loginError, setLoginError] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError("");
    const form = new FormData(e.target);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Login failed (${res.status})`);
      }
      const data = await res.json();
      localStorage.setItem("auth_token", data.token);
      setToken(data.token);
    } catch (err) {
      setLoginError(err.message);
    }
  }

  function handleLogout() {
    localStorage.removeItem("auth_token");
    setToken(null);
    setMessages([]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim() || streaming) return;

    const userMsg = { id: Date.now(), role: "user", text: input };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setStreaming(true);

    const assistantId = Date.now() + 1;
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", text: "" }]);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: allMessages.map((m) => ({ role: m.role, content: m.text })),
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("auth_token");
          setToken(null);
          throw new Error("Session expired. Please log in again.");
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;

          try {
            const event = JSON.parse(data);
            if (event.type === "text-delta") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, text: m.text + event.delta } : m
                )
              );
            }
          } catch {
            // skip non-JSON lines
          }
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, text: "Failed to get response: " + err.message }
            : m
        )
      );
    }

    setStreaming(false);
  }

  if (!token) {
    return (
      <div className="app">
        <h1>Agent 311</h1>
        <div className="login-container">
          <form onSubmit={handleLogin} className="login-form">
            <input name="email" type="email" placeholder="Email" defaultValue="default@agentaustin.org" required />
            <input name="password" type="password" placeholder="Password" defaultValue="password" required />
            {loginError && <div className="error">{loginError}</div>}
            <button type="submit">Log In</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="header">
        <h1>Agent 311</h1>
        <button className="logout-btn" onClick={handleLogout}>Log Out</button>
      </div>

      <div className="messages">
        {messages.length === 0 && (
          <div className="welcome">
            <p>Welcome! Ask me anything about Austin 311 data.</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <span className="role">
              {msg.role === "user" ? "You" : "Agent 311"}
            </span>
            <p>{msg.text}</p>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="input-form">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about Austin 311 data..."
          disabled={streaming}
        />
        <button type="submit" disabled={streaming || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

export default App;
