function firstMessage(value) {
  if (Array.isArray(value) && value.length) {
    return String(value[0]);
  }
  if (value == null) {
    return "";
  }
  return String(value);
}

function messageIncludes(value, phrase) {
  return firstMessage(value).toLowerCase().includes(phrase.toLowerCase());
}

function isBlankField(value) {
  const message = firstMessage(value).toLowerCase();
  return message.includes("may not be blank") || message.includes("required");
}

export function validateLoginForm({ emailOrUsername, password }) {
  const identifier = String(emailOrUsername || "").trim();
  const secret = String(password || "").trim();

  if (!identifier && !secret) {
    return "Enter your email or username and password to sign in.";
  }

  if (!identifier) {
    return "Enter your email or username.";
  }

  if (!secret) {
    return "Enter your password.";
  }

  return "";
}

export function formatLoginError(err) {
  const data = err?.response?.data;

  if (typeof data === "string" && data.trim()) {
    return data;
  }

  if (data?.detail) {
    const detail = String(data.detail);
    if (detail.toLowerCase().includes("no active account")) {
      return "Your email, username, or password is incorrect.";
    }
    return detail;
  }

  if (data?.username || data?.password) {
    if (isBlankField(data.username) && isBlankField(data.password)) {
      return "Enter your email or username and password to sign in.";
    }
    if (isBlankField(data.username)) {
      return "Enter your email or username.";
    }
    if (isBlankField(data.password)) {
      return "Enter your password.";
    }
  }

  return "We could not sign you in. Check your details and try again.";
}

export function validateRegisterForm(form) {
  const fullName = String(form.name || "").trim();
  const email = String(form.email || "").trim();
  const password = String(form.password || "");
  const confirmPassword = String(form.confirmPassword || "");

  if (!fullName) {
    return "Enter your full name.";
  }

  if (!email) {
    return "Enter your email address.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Enter a valid email address.";
  }

  if (!password) {
    return "Create a password.";
  }

  if (password.length < 6) {
    return "Use at least 6 characters for your password.";
  }

  if (!confirmPassword) {
    return "Confirm your password.";
  }

  if (password !== confirmPassword) {
    return "Your passwords do not match.";
  }

  return "";
}

export function formatRegisterError(err) {
  const data = err?.response?.data;

  if (typeof data === "string" && data.trim()) {
    return data;
  }

  if (!data || typeof data !== "object") {
    return "We could not create your account right now. Please try again.";
  }

  if (messageIncludes(data.email, "already exists")) {
    return "That email is already in use. Try signing in instead.";
  }

  if (messageIncludes(data.username, "already exists")) {
    return "That account already exists. Try signing in instead.";
  }

  if (isBlankField(data.email)) {
    return "Enter your email address.";
  }

  if (isBlankField(data.password)) {
    return "Create a password.";
  }

  if (messageIncludes(data.password, "at least")) {
    return "Use at least 6 characters for your password.";
  }

  if (messageIncludes(data.email, "valid")) {
    return "Enter a valid email address.";
  }

  if (isBlankField(data.username)) {
    return "Enter your email address.";
  }

  return "We could not create your account. Review your details and try again.";
}
