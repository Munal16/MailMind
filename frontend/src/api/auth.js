import api from "./client";
import {
  getActiveSession,
  getSessionAppRoute,
  getStoredSessions,
  logoutCurrentSession,
  saveSession,
  setActiveSession,
  setTemporaryTokens,
} from "./sessionStore";

export async function registerUser(payload) {
  const res = await api.post("/api/users/register/", payload);
  return res.data;
}

export function setAuthTokens(access, refresh) {
  setTemporaryTokens(access, refresh);
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

export function finalizeSession(profile, access, refresh) {
  return saveSession(profile, access, refresh);
}

export function getDefaultAppRoute(profile) {
  return getSessionAppRoute(profile);
}

export function getSignedInSessions() {
  return getStoredSessions();
}

export function getCurrentSession() {
  return getActiveSession();
}

export function switchMailMindSession(sessionId) {
  return setActiveSession(sessionId);
}

export function logout() {
  return logoutCurrentSession();
}
