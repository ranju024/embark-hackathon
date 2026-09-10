import api from "../api";

export const getPublicStats = async () => {
  const res = await api.get("/stats/summary/");
  return res.data;
};