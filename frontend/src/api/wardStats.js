import api from "../api";

export const getWardComplianceStats = async () => {
  const res = await api.get("/ward-stats/");
  return res.data;
};