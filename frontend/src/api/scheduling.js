import api from "../api";

export const getWardSchedules = async () => {
  const res = await api.get("/ward-schedules/");
  return res.data;
};

export const getEffectiveSchedule = async (ward, date) => {
  const res = await api.get(`/schedule-notices/effective/?ward=${ward}&date=${date}`);
  return res.data;
};

export const createWardSchedule = async (wardNumber, pickupDay, pickupTime) => {
  const res = await api.post("/ward-schedules/", {
    ward_number: wardNumber,
    pickup_day: pickupDay,
    pickup_time: pickupTime,
  });
  return res.data;
};

export const updateWardSchedule = async (id, pickupDay, pickupTime) => {
  const res = await api.patch(`/ward-schedules/${id}/`, {
    pickup_day: pickupDay,
    pickup_time: pickupTime,
  });
  return res.data;
};

export const createScheduleNotice = async (wardNumber, date, noticeType, delayedToTime, reason) => {
  const res = await api.post("/schedule-notices/", {
    ward_number: wardNumber || null,
    date,
    notice_type: noticeType,
    delayed_to_time: delayedToTime || null,
    reason,
  });
  return res.data;
};