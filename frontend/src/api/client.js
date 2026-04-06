import axios from "axios";
import {
  getAccessToken,
  getRefreshToken,
  getSessionAppRoute,
  logoutCurrentSession,
  updateActiveAccessToken,
} from "./sessionStore";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? window.location.origin : "http://127.0.0.1:8000");

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest?._retry) {
      originalRequest._retry = true;

      const refresh = getRefreshToken();
      if (!refresh) {
        return Promise.reject(error);
      }

      try {
        const res = await axios.post(`${API_BASE_URL}/api/auth/refresh/`, { refresh });
        updateActiveAccessToken(res.data.access);
        originalRequest.headers.Authorization = `Bearer ${res.data.access}`;
        return api(originalRequest);
      } catch (refreshError) {
        const nextSession = logoutCurrentSession();
        if (typeof window !== "undefined") {
          window.location.href = nextSession ? getSessionAppRoute(nextSession) : "/login";
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
