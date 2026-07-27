import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

const api = axios.create({ baseURL: BASE_URL });

// Attach the JWT access token to every request if we have one.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const login = async (username, password) => {
  const res = await api.post("/auth/login/", { username, password });
  localStorage.setItem("access_token", res.data.access);
  localStorage.setItem("refresh_token", res.data.refresh);
  return res.data;
};

export const register = async (username, email, password) => {
  const res = await api.post("/auth/register/", { username, email, password });
  return res.data;
};

export const getItems = async () => {
  const res = await api.get("/items/");
  return res.data;
};

export const createItem = async (title, description) => {
  const res = await api.post("/items/", { title, description });
  return res.data;
};

export const sendChatMessage = async (message) => {
  const res = await api.post("/chat/", { message });
  return res.data.reply;
};

export default api;
