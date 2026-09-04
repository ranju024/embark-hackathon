import { useState } from "react";
import { sendChatMessage } from "../api/chat";

function Chat() {
  const [householdQr, setHouseholdQr] = useState("");
  const [input, setInput] = useState("");
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input;
    setLog((prev) => [...prev, { role: "user", text: userMsg }]);
    setInput("");
    setLoading(true);

    try {
      const reply = await sendChatMessage(userMsg, householdQr);
      setLog((prev) => [...prev, { role: "bot", text: reply }]);
    } catch (err) {
      setLog((prev) => [...prev, { role: "bot", text: "(error reaching AI service)" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Ask Waste Warriors</h2>
      <input
        value={householdQr}
        onChange={(e) => setHouseholdQr(e.target.value)}
        placeholder="Your household QR code (optional, for personalized answers)"
        style={{ width: "100%", marginBottom: 12 }}
      />

      <div style={{ border: "1px solid #ccc", padding: 8, minHeight: 200, marginBottom: 8 }}>
        {log.map((msg, i) => (
          <p key={i}>
            <strong>{msg.role === "user" ? "You" : "Assistant"}:</strong> {msg.text}
          </p>
        ))}
        {loading && <p><em>thinking...</em></p>}
      </div>

      <form onSubmit={handleSend}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about pickup schedule, fines, complaints..."
          style={{ width: "70%" }}
        />
        <button type="submit" disabled={loading}>Send</button>
      </form>
    </div>
  );
}

export default Chat;