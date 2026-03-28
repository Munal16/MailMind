import api from "./client";

export async function registerUser(payload) {
  const res = await api.post("/api/users/register/", payload);
  return res.data;
}

export function setAuthTokens(access, refresh) {
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
}

export async function loginUser(payload) {
  const res = await api.post("/api/auth/login/", payload);
  setAuthTokens(res.data.access, res.data.refresh);
  return res.data;
}

export async function getGoogleLoginUrl() {
  const res = await api.get("/api/users/google/login-url/");
  return res.data.authorization_url;
}

export async function getMe() {
  const res = await api.get("/api/users/me/");
  return res.data;
}

export function getDefaultAppRoute(profile) {
  if (profile?.is_staff || profile?.is_superuser) {
    return "/app/admin";
  }
  return "/app/dashboard";
}

export function logout() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}
