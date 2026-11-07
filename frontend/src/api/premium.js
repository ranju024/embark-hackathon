import api from "../api";

export const getServicePreferences = async () => {
  const res = await api.get("/subscriptions/preferences/");
  return res.data;
};

export const updateServicePreferences = async (priorityWindow, compostPickup) => {
  const res = await api.put("/subscriptions/preferences/", {
    priority_window: priorityWindow,
    compost_pickup: compostPickup,
  });
  return res.data;
};

export const getBulkPickups = async (ward) => {
  const res = await api.get("/subscriptions/bulk-pickups/", { params: ward ? { ward } : {} });
  return res.data;
};

export const requestBulkPickup = async (pickupDate, description) => {
  const res = await api.post("/subscriptions/bulk-pickups/", {
    pickup_date: pickupDate,
    description,
  });
  return res.data;
};

export const cancelBulkPickup = async (id) => {
  const res = await api.post(`/subscriptions/bulk-pickups/${id}/cancel/`);
  return res.data;
};

export const completeBulkPickup = async (id) => {
  const res = await api.post(`/subscriptions/bulk-pickups/${id}/complete/`);
  return res.data;
};

export const getServiceLists = async (ward) => {
  const res = await api.get("/subscriptions/service-lists/", { params: ward ? { ward } : {} });
  return res.data;
};

export const getMonthlyReport = async (month) => {
  const res = await api.get("/subscriptions/report/", { params: month ? { month } : {} });
  return res.data;
};