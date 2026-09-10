import api from "../api";

export const getAllRoutes = async () => {
  const res = await api.get("/collector-routes/");
  return res.data;
};

export const createCollectorRoute = async (wardNumber, collectorId, date) => {
  const res = await api.post("/collector-routes/", {
    ward_number: wardNumber,
    collector: collectorId,
    date,
  });
  return res.data;
};

export const updateRouteStatus = async (routeId, statusValue) => {
  const res = await api.post(`/collector-routes/${routeId}/mark_status/`, { status: statusValue });
  return res.data;
};

export const updateRouteLocation = async (routeId, lat, lng) => {
  const res = await api.post(`/collector-routes/${routeId}/update_location/`, {
    current_lat: lat,
    current_lng: lng,
  });
  return res.data;
};

export const getMyRoutes = async () => {
  const res = await api.get("/collector-routes/mine/");
  return res.data;
};

export const getStaffUsers = async () => {
  const res = await api.get("/staff-users/");
  return res.data;
};