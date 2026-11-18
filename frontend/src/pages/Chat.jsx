import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { clearChatHistory, getChatHistory, sendChatMessage } from "../api/chat";
import { getMyHousehold } from "../api/households";
import { isLoggedIn } from "../auth";
import Icon from "../components/Icon";
import { WasteBag } from "../components/Illustrations";
import { PageHeader, Spinner } from "../components/ui";

const HISTORY_SENT = 6;
const GUEST_KEY = "ww_guest_chat";
const GUEST_MAX = 50;

const RESIDENT_SUGGESTIONS = [
  "What goes in the organic bag?",
  "Where do I throw old batteries?",
  "When is my next pickup?",
  "How do I earn GreenPoints?",
];

const STAFF_SUGGESTIONS = [
  "How do I record a waste check?",
  "What needs my attention today?",
  "How do I resolve an appeal?",
  "Which wards have no schedule?",
];

// Guests have no account, so their chat lives in this browser only.
function loadGuestLog() {
  try {
    const parsed = JSON.parse(localStorage.getItem(GUEST_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m) => m && (m.role === "user" || m.role === "bot") && typeof m.text === "string")
      .slice(-GUEST_MAX);
  } catch {
    return [];
  }
}

function saveGuestLog(log) {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(log.filter((m) => !m.isError).slice(-GUEST_MAX)));
  } catch {
    // storage full or blocked: not worth interrupting the chat for
  }
}

function Chat({ isStaff }) {
  const loggedIn = isLoggedIn();
  const [personalized, setPersonalized] = useState(false);
  const [input, setInput] = useState("");
  const [log, setLog] = useState(() => (loggedIn ? [] : loadGuestLog()));
  const [historyLoading, setHistoryLoading] = useState(loggedIn);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const suggestions = isStaff ? STAFF_SUGGESTIONS : RESIDENT_SUGGESTIONS;

  // Logged in: load the conversation saved on the server.
  useEffect(() => {
    if (!loggedIn) return;
    setHistoryLoading(true);
    getChatHistory()
      .then((messages) =>
        setLog(messages.map((m) => ({ role: m.role === "user" ? "user" : "bot", text: m.content })))
      )
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [loggedIn]);

  useEffect(() => {
    if (!loggedIn || isStaff) return;
    getMyHousehold()
      .then((household) => setPersonalized(!!household))
      .catch(() => setPersonalized(false));
  }, [loggedIn, isStaff]);

  // Guest: keep the conversation in this browser.
  useEffect(() => {
    if (!loggedIn) saveGuestLog(log);
  }, [log, loggedIn]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log, loading, historyLoading]);

  const send = async (text) => {
    const userMsg = text.trim();
    if (!userMsg || loading || historyLoading) return;

    // Only guests need to send history; the server uses its saved copy for logged-in users.
    const history = log
      .filter((m) => !m.isError)
      .slice(-HISTORY_SENT)
      .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));

    setLog((prev) => [...prev, { role: "user", text: userMsg }]);
    setLoading(true);
    try {
      const reply = await sendChatMessage(userMsg, history);
      setLog((prev) => [...prev, { role: "bot", text: reply }]);
    } catch (err) {
      const message =
        err.response?.status === 429
          ? "You're sending messages too quickly. Wait a few seconds and try again."
          : err.response?.data?.error || "Couldn't reach the assistant. Please try again.";
      setLog((prev) => [...prev, { role: "bot", text: message, isError: true }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = input;
    setInput("");
    send(text);
  };

  const handleClear = async () => {
    if (!log.length || !window.confirm("Clear this conversation?")) return;
    try {
      if (loggedIn) await clearChatHistory();
      else localStorage.removeItem(GUEST_KEY);
      setLog([]);
    } catch {
      // leave the conversation as it is if clearing failed
    }
  };

  return (
    <div className="page-container">
      <PageHeader
        eyebrow={isStaff ? "STAFF ASSISTANT" : "ASK WASTE WARRIOR"}
        title={isStaff ? "Staff assistant" : "Chat assistant"}
        subtitle={
          isStaff
            ? "Ask how to do a task, or what needs attention today."
            : "Ask about waste types, pickups, points, plans or complaints."
        }
        actions={
          log.length > 0 && (
            <button type="button" className="btn btn-outline btn-sm" onClick={handleClear}>
              Clear chat
            </button>
          )
        }
      />

      {isStaff ? (
        <p className="pill pill-success mb">Uses today's work summary</p>
      ) : personalized ? (
        <p className="pill pill-success mb">Personalized to your household</p>
      ) : (
        <p className="muted mb">
          {loggedIn ? (
            <>Register your household to get answers about your own pickups and points. <Link to="/onboarding">Register</Link></>
          ) : (
            <><Link to="/login">Log in</Link> to get answers personalized to your household, and to keep your chats on your account.</>
          )}
        </p>
      )}

      <div className="chat-window" aria-live="polite">
        {historyLoading && <Spinner label="Loading your chat..." />}

        {!historyLoading && log.length === 0 && (
          <div className="chat-empty">
            {isStaff ? (
              <div className="feature-icon" aria-hidden="true"><Icon name="clipboard" size={26} /></div>
            ) : (
              <div className="bag-row" aria-hidden="true">
                <WasteBag kind="organic" />
                <WasteBag kind="dry" />
                <WasteBag kind="special" />
              </div>
            )}
            <p style={{ margin: 0 }}>
              {isStaff ? "What do you need help with?" : "Not sure where something goes? Just ask."}
            </p>
            <div className="chat-suggestions">
              {suggestions.map((s) => (
                <button key={s} type="button" className="chip" onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {log.map((msg, i) => (
          <div key={i} className={msg.role === "user" ? "chat-bubble chat-bubble-user" : "chat-bubble chat-bubble-bot"}>
            {msg.text}
          </div>
        ))}
        {loading && <div className="chat-bubble chat-bubble-bot"><em>typing...</em></div>}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="chat-input-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your question..."
          aria-label="Your message"
          maxLength={1000}
          disabled={historyLoading}
        />
        <button type="submit" className="btn btn-primary" disabled={loading || historyLoading || !input.trim()}>
          Send
        </button>
      </form>
      <p className="note">
        {loggedIn
          ? "Your chat is saved to your account. Use Clear chat to delete it."
          : "Your chat is saved on this device only."}
      </p>
    </div>
  );
}

export default Chat;