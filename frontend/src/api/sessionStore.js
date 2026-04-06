const LEGACY_ACCESS_KEY = "access_token";
const LEGACY_REFRESH_KEY = "refresh_token";
const SESSIONS_KEY = "mailmind_sessions_v1";
const ACTIVE_SESSION_KEY = "mailmind_active_session_v1";

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeProfile(profile = {}) {
  return {
    id: profile.id,
    username: profile.username || "MailMind User",
    email: profile.email || "",
    is_staff: Boolean(profile.is_staff),
    is_superuser: Boolean(profile.is_superuser),
    job_title: profile.job_title || "",
    profile_photo_url: profile.profile_photo_url || null,
  };
}

function readSessions() {
  const raw = localStorage.getItem(SESSIONS_KEY);
  const parsed = safeJsonParse(raw, []);
  return Array.isArray(parsed) ? parsed : [];
}

function writeSessions(sessions) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function getStoredSessions() {
  return readSessions();
}

export function getSessionAppRoute(session) {
  if (session?.is_staff || session?.is_superuser) {
    return "/app/admin";
  }
  return "/app/dashboard";
}

export function getActiveSessionId() {
  return localStorage.getItem(ACTIVE_SESSION_KEY);
}

export function getActiveSession() {
  const sessions = readSessions();
  const activeId = getActiveSessionId();
  if (activeId) {
    const active = sessions.find((session) => String(session.id) === String(activeId));
    if (active) {
      return active;
    }
  }
  return sessions[0] || null;
}

export function setTemporaryTokens(access, refresh) {
  localStorage.setItem(LEGACY_ACCESS_KEY, access);
  localStorage.setItem(LEGACY_REFRESH_KEY, refresh);
}

export function clearTemporaryTokens() {
  localStorage.removeItem(LEGACY_ACCESS_KEY);
  localStorage.removeItem(LEGACY_REFRESH_KEY);
}

export function getAccessToken() {
  return getActiveSession()?.access || localStorage.getItem(LEGACY_ACCESS_KEY);
}

export function getRefreshToken() {
  return getActiveSession()?.refresh || localStorage.getItem(LEGACY_REFRESH_KEY);
}

export function saveSession(profile, access, refresh) {
  const normalized = normalizeProfile(profile);
  const sessions = readSessions();
  const nextSession = {
    ...normalized,
    access,
    refresh,
    lastUsedAt: new Date().toISOString(),
  };

  const existingIndex = sessions.findIndex((session) => String(session.id) === String(normalized.id));
  if (existingIndex >= 0) {
    sessions[existingIndex] = {
      ...sessions[existingIndex],
      ...nextSession,
    };
  } else {
    sessions.unshift(nextSession);
  }

  writeSessions(sessions);
  localStorage.setItem(ACTIVE_SESSION_KEY, String(normalized.id));
  clearTemporaryTokens();
  return nextSession;
}

export function setActiveSession(sessionId) {
  const sessions = readSessions();
  const target = sessions.find((session) => String(session.id) === String(sessionId));
  if (!target) {
    return null;
  }

  localStorage.setItem(ACTIVE_SESSION_KEY, String(target.id));
  const nextSessions = sessions.map((session) =>
    String(session.id) === String(sessionId)
      ? { ...session, lastUsedAt: new Date().toISOString() }
      : session
  );
  writeSessions(nextSessions);
  clearTemporaryTokens();
  return nextSessions.find((session) => String(session.id) === String(sessionId)) || target;
}

export function updateActiveAccessToken(access) {
  const active = getActiveSession();
  if (!active) {
    localStorage.setItem(LEGACY_ACCESS_KEY, access);
    return null;
  }

  const sessions = readSessions().map((session) =>
    String(session.id) === String(active.id)
      ? { ...session, access, lastUsedAt: new Date().toISOString() }
      : session
  );
  writeSessions(sessions);
  return sessions.find((session) => String(session.id) === String(active.id)) || null;
}

export function removeSession(sessionId) {
  const sessions = readSessions();
  const remaining = sessions.filter((session) => String(session.id) !== String(sessionId));
  writeSessions(remaining);

  const activeId = getActiveSessionId();
  if (String(activeId) === String(sessionId)) {
    if (remaining.length) {
      localStorage.setItem(ACTIVE_SESSION_KEY, String(remaining[0].id));
    } else {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    }
  }

  if (!remaining.length) {
    clearTemporaryTokens();
  }

  return remaining[0] || null;
}

export function logoutCurrentSession() {
  const active = getActiveSession();
  if (!active) {
    clearTemporaryTokens();
    localStorage.removeItem(ACTIVE_SESSION_KEY);
    return null;
  }
  return removeSession(active.id);
}

export function hasStoredSession() {
  return Boolean(getActiveSession() || localStorage.getItem(LEGACY_ACCESS_KEY));
}
