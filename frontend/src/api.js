import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

const api = axios.create({ baseURL: BASE_URL });

// Plain client with no interceptors, used only for refreshing tokens,
// so a failed refresh can never trigger another refresh (infinite loop).
const refreshClient = axios.create({ baseURL: BASE_URL });

// Attach the JWT access token to every request if we have one.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If several requests hit 401 at once, they all wait on ONE refresh call.
let refreshPromise = null;

const refreshAccessToken = () => {
  if (!refreshPromise) {
    const refresh = localStorage.getItem("refresh_token");
    refreshPromise = refreshClient
      .post("/auth/refresh/", { refresh })
      .then((res) => {
        localStorage.setItem("access_token", res.data.access);
        if (res.data.refresh) {
          localStorage.setItem("refresh_token", res.data.refresh);
        }
        return res.data.access;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

const AUTH_PATHS = ["/auth/login/", "/auth/register/", "/auth/refresh/"];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const isAuthCall = AUTH_PATHS.some((p) => original?.url?.includes(p));

    if (
      status === 401 &&
      original &&
      !original._retried &&
      !isAuthCall &&
      localStorage.getItem("refresh_token")
    ) {
      original._retried = true;
      try {
        const newAccess = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch (refreshError) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.dispatchEvent(new Event("auth:logout"));
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

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

export const getMe = async () => {
  const res = await api.get("/auth/me/");
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