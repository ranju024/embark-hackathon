import { useEffect, useState } from "react";
import api, { getItems, createItem, login, sendChatMessage } from "./api";

function App() {
  const [status, setStatus] = useState("checking...");
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatLog, setChatLog] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    // First thing to test after setup: does the frontend reach the backend?
    api
      .get("/health/")
      .then((res) => setStatus(res.data.message))
      .catch(() => setStatus("cannot reach backend — check it's running on :8000"));
  }, []);

  const loadItems = async () => {
    try {
      const data = await getItems();
      setItems(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await createItem(title, "");
      setTitle("");
      loadItems();
    } catch (e) {
      alert("Failed to add item — are you logged in? Try the login step first.");
    }
  };

  const handleChatSend = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatLog((log) => [...log, { role: "user", text: userMsg }]);
    setChatInput("");
    setChatLoading(true);
    try {
      const reply = await sendChatMessage(userMsg);
      setChatLog((log) => [...log, { role: "bot", text: reply }]);
    } catch (err) {
      setChatLog((log) => [...log, { role: "bot", text: "(error reaching AI service)" }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 480, margin: "40px auto" }}>
      <h1>Hackathon Starter</h1>
      <p>Backend status: <strong>{status}</strong></p>

      <button onClick={loadItems}>Load Items</button>

      <form onSubmit={handleAdd} style={{ marginTop: 16 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New item title"
        />
        <button type="submit">Add</button>
      </form>

      <ul>
        {items.map((item) => (
          <li key={item.id}>{item.title}</li>
        ))}
      </ul>

      <hr style={{ margin: "24px 0" }} />
      <h2>AI Chat</h2>
      <div style={{ border: "1px solid #ccc", padding: 8, minHeight: 80, marginBottom: 8 }}>
        {chatLog.map((msg, i) => (
          <p key={i}>
            <strong>{msg.role === "user" ? "You" : "AI"}:</strong> {msg.text}
          </p>
        ))}
        {chatLoading && <p><em>thinking...</em></p>}
      </div>
      <form onSubmit={handleChatSend}>
        <input
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder="Ask something..."
          style={{ width: "70%" }}
        />
        <button type="submit" disabled={chatLoading}>Send</button>
      </form>
    </div>
  );
}

export default App;
