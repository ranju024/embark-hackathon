import { useEffect, useState } from "react";
import { sendChatMessage } from "../api/chat";
import { getMyHousehold } from "../api/households";
import { isLoggedIn } from "../auth";

function Chat() {
  const [householdQr, setHouseholdQr] = useState("");
  const [input, setInput] = useState("");
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isLoggedIn()) {
      getMyHousehold().then((household) => {
        if (household) setHouseholdQr(household.qr_code);
      });
    }
  }, []);

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
    <div className="page-container">
      <span className="eyebrow">ASK WASTE WARRIOR</span>
      <h2>Chat Assistant</h2>
      {householdQr && (
        <p className="pill pill-success" style={{ marginBottom: 12 }}>Personalized to your household</p>
      )}

      <div className="chat-window">
        {log.map((msg, i) => (
          <div key={i} className={msg.role === "user" ? "chat-bubble chat-bubble-user" : "chat-bubble chat-bubble-bot"}>
            {msg.text}
          </div>
        ))}
        {loading && <div className="chat-bubble chat-bubble-bot"><em>thinking...</em></div>}
      </div>

      <form onSubmit={handleSend} className="chat-input-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about pickup schedule, fines, complaints..."
        />
        <button type="submit" className="btn btn-primary" disabled={loading}>Send</button>
      </form>
    </div>
  );
}

export default Chat;