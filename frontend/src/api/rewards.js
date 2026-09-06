import api from "../api";

export const getMyPoints = async () => {
  const res = await api.get("/points-entries/");
  return res.data;
};