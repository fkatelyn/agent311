import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const transport = new DefaultChatTransport({
  api: `${API_URL}/api/chat`,
});

function App() {
  const { messages, input, handleInputChange, handleSubmit, status } = useChat({
    transport,
  });

  return (
    <div className="app">
      <h1>Agent 311</h1>

      <div className="messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <span className="role">{msg.role === "user" ? "You" : "Agent 311"}</span>
            <p>{msg.parts?.map((p) => p.text).join("") || msg.content}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="input-form">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask about Austin 311 data..."
          disabled={status === "streaming"}
        />
        <button type="submit" disabled={status === "streaming" || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

export default App;
