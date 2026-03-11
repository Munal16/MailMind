import api from "./client";

export async function registerUser(payload) {
  const res = await api.post("/api/users/register/", payload);
  return res.data;
}

export async function loginUser(payload) {
  const res = await api.post("/api/auth/login/", payload);
  // Save tokens
  localStorage.setItem("access_token", res.data.access);
  localStorage.setItem("refresh_token", res.data.refresh);
  return res.data;
}

export async function getMe() {
  const res = await api.get("/api/users/me/");
  return res.data;
}

export function logout() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}
