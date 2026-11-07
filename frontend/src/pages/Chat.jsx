import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { sendChatMessage } from "../api/chat";
import { getMyHousehold } from "../api/households";
import { isLoggedIn } from "../auth";

const HISTORY_SENT = 6;

function Chat() {
  const [personalized, setPersonalized] = useState(false);
  const [input, setInput] = useState("");
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!isLoggedIn()) return;
    getMyHousehold()
      .then((household) => setPersonalized(!!household))
      .catch(() => setPersonalized(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log, loading]);

  const handleSend = async (e) => {
    e.preventDefault();
    const userMsg = input.trim();
    if (!userMsg || loading) return;

    // Previous turns only (the new message is sent separately); errors aren't real answers.
    const history = log
      .filter((m) => !m.isError)
      .slice(-HISTORY_SENT)
      .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));

    setLog((prev) => [...prev, { role: "user", text: userMsg }]);
    setInput("");
    setLoading(true);
    try {
      const reply = await sendChatMessage(userMsg, history);
      setLog((prev) => [...prev, { role: "bot", text: reply }]);
    } catch (err) {
      const message =
        err.response?.status === 429
          ? "You're sending messages too quickly — wait a few seconds and try again."
          : err.response?.data?.error || "Couldn't reach the assistant. Please try again.";
      setLog((prev) => [...prev, { role: "bot", text: message, isError: true }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <span className="eyebrow">ASK WASTE WARRIOR</span>
      <h2>Chat Assistant</h2>

      {personalized ? (
        <p className="pill pill-success" style={{ marginBottom: 12 }}>Personalized to your household</p>
      ) : (
        <p style={{ color: "var(--color-text-muted)", marginBottom: 12 }}>
          {isLoggedIn() ? (
            <>Register your household to get answers about your own pickups and points. <Link to="/onboarding">Register →</Link></>
          ) : (
            <><Link to="/login">Log in</Link> to get answers personalized to your household.</>
          )}
        </p>
      )}

      <div className="chat-window">
        {log.length === 0 && (
          <div className="chat-bubble chat-bubble-bot">
            Hi! Ask me about pickup schedules, holiday notices, fines, GreenPoints, or complaints.
          </div>
        )}
        {log.map((msg, i) => (
          <div key={i} className={msg.role === "user" ? "chat-bubble chat-bubble-user" : "chat-bubble chat-bubble-bot"}>
            {msg.text}
          </div>
        ))}
        {loading && <div className="chat-bubble chat-bubble-bot"><em>thinking...</em></div>}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="chat-input-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about pickup schedule, fines, complaints..."
          maxLength={1000}
        />
        <button type="submit" className="btn btn-primary" disabled={loading || !input.trim()}>Send</button>
      </form>
    </div>
  );
}

export default Chat;