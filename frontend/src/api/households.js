import api from "../api";  //api.js

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export const getHouseholds = async () => {
  const res = await api.get("/households/");
  return res.data;
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