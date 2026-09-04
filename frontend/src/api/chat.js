import api from "../api";

export const sendChatMessage = async (message, householdQr) => {
  const res = await api.post("/chat/", {
    message,
    household_qr: householdQr,
  });
  return res.data.reply;
};