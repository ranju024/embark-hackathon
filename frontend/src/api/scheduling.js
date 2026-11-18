import api from "../api";

export const getWardSchedules = async () => {
  const res = await api.get("/ward-schedules/");
  return res.data;
};

export const getEffectiveSchedule = async (ward, date) => {
  const res = await api.get("/schedule-notices/effective/", { params: { ward, date } });
  return res.data;
};

export const createWardSchedule = async (ward, day, time) => {
  const res = await api.post("/ward-schedules/", {
    ward_number: Number(ward),
    pickup_day: Number(day),
    pickup_time: time,
  });
  return res.data;
};

export const updateWardSchedule = async (id, day, time) => {
  const res = await api.patch(`/ward-schedules/${id}/`, {
    pickup_day: Number(day),
    pickup_time: time,
  });
  return res.data;
};

// With a ward: that ward's notices plus citywide ones. Without: all notices.
export const getScheduleNotices = async (ward) => {
  const res = await api.get("/schedule-notices/", { params: ward ? { ward } : {} });
  return res.data;
};

export const createScheduleNotice = async (ward, date, type, delayTime, reason) => {
  const res = await api.post("/schedule-notices/", {
    ward_number: ward ? Number(ward) : null,
    date,
    notice_type: type,
    delayed_to_time: type === "delay" ? delayTime || null : null,
    reason,
  });
  return res.data;
};

export const deleteScheduleNotice = async (id) => {
  await api.delete(`/schedule-notices/${id}/`);
};