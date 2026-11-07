import api from "../api";

// history: [{ role: "user" | "assistant", content: "..." }, ...] (most recent last)
export const sendChatMessage = async (message, history = []) => {
  const res = await api.post("/chat/", { message, history });
  return res.data.reply;
};