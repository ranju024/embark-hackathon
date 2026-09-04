import api from "../api";

export const getWardSchedules = async () => {
  const res = await api.get("/ward-schedules/");
  return res.data;
};

export const getEffectiveSchedule = async (ward, date) => {
  const res = await api.get(`/schedule-notices/effective/?ward=${ward}&date=${date}`);
  return res.data;
};