import api from "../api";

// Logged-in users: the server keeps the conversation. Guests: pass recent history.
export const getChatHistory = async () => {
  const res = await api.get("/chat/");
  return res.data.messages;
};

export const clearChatHistory = async () => {
  await api.delete("/chat/");
};

// history: [{ role: "user" | "assistant", content: "..." }, ...] (guests only; ignored when logged in)
export const sendChatMessage = async (message, history = []) => {
  const res = await api.post("/chat/", { message, history });
  return res.data.reply;
};