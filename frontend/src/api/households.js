import api from "../api";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export const getMyHousehold = async () => {
  try {
    const res = await api.get("/households/mine/");
    return res.data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
};

export const createHousehold = async (ward_number, house_number, owner_name, phone_number) => {
  const res = await api.post("/households/", {
    ward_number,
    house_number,
    owner_name,
    phone_number,
  });
  return res.data;
};

export const getHouseholdQrImageUrl = (householdId) => {
  return `${API_BASE}/households/${householdId}/qr_image/`;
};