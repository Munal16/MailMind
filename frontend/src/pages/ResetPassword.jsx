import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, House, LockKeyhole } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import BrandLogo from "../components/BrandLogo";
import api from "../api/client";
import "./Login.css";

function PasswordField({ label, value, onChange, placeholder, visible, onToggle }) {
  return (
    <div className="login-page__field-group">
      <label className="login-page__label">{label}</label>
      <div className="login-page__field-shell">
        <LockKeyhole className="login-page__field-icon" />
        <Input
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="login-page__input"
          style={{ paddingRight: "3rem" }}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? "Hide password" : "Show password"}
          style={{
            position: "absolute",
            right: "1rem",
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "hsl(var(--muted-foreground))",
            display: "flex",
            alignItems: "center",
          }}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const uid = searchParams.get("uid") || "";
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const invalidLink = !uid || !token;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!newPassword.trim()) {
      setError("Enter a new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/api/users/reset-password/", {
        uid,
        token,
        new_password: newPassword,
      });
      setDone(true);
    } catch (err) {
      const data = err?.response?.data;
      const msg =
        (Array.isArray(data?.new_password) ? data.new_password[0] : null) ||
        (Array.isArray(data?.token) ? data.token[0] : null) ||
        data?.message ||
        data?.error ||
        "Could not reset your password. Please request a new link.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-page__glow login-page__glow--primary" />
      <div className="login-page__glow login-page__glow--secondary" />

      <div className="login-page__container">
        <div className="login-page__intro">
          <Link to="/login" className="login-page__backlink">
            <House className="h-4 w-4" />
            Back to sign in
          </Link>

          <div className="login-page__header">
            <div className="login-page__eyebrow">Password recovery</div>
            <h1 className="login-page__title">
              {done ? "Password reset" : "Set a new password"}
            </h1>
            <p className="login-page__description">
              {done
                ? "Your password has been updated. You can now sign in with your new password."
                : invalidLink
                ? "This reset link is missing required information. Please request a new one."
                : "Choose a strong new password for your MailMind account."}
            </p>
          </div>
        </div>

        <section className="login-page__card">
          <div className="login-page__brand-wrap">
            <BrandLogo size="lg" className="justify-center" />
          </div>

          {done ? (
            <div style={{ marginTop: "1.5rem" }}>
              <Button
                variant="hero"
                className="login-page__primary-action"
                onClick={() => navigate("/login")}
              >
                Sign in now
              </Button>
            </div>
          ) : invalidLink ? (
            <div style={{ marginTop: "1.5rem" }}>
              <Link to="/forgot-password" style={{ display: "block" }}>
                <Button variant="hero" className="login-page__primary-action">
                  Request a new link
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="login-page__form">
              <PasswordField
                label="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Create a new password"
                visible={showNew}
                onToggle={() => setShowNew((v) => !v)}
              />
              <PasswordField
                label="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your new password"
                visible={showConfirm}
                onToggle={() => setShowConfirm((v) => !v)}
              />

              <Button type="submit" variant="hero" className="login-page__primary-action" disabled={loading}>
                {loading ? "Resetting..." : "Reset password"}
              </Button>
            </form>
          )}

          {error ? <div className="login-page__error">{error}</div> : null}

          <div className="login-page__footer-note">
            <Link to="/forgot-password">Request a new link</Link>
            {" · "}
            <Link to="/login">Sign in</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
