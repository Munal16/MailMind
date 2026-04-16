import { useState } from "react";
import { Link } from "react-router-dom";
import { House, Mail } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import BrandLogo from "../components/BrandLogo";
import api from "../api/client";
import "./Login.css";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Enter your account email address.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/api/users/forgot-password/", { email: email.trim() });
      setSubmitted(true);
    } catch (err) {
      const data = err?.response?.data;
      const msg =
        (Array.isArray(data?.email) ? data.email[0] : null) ||
        data?.message ||
        data?.error ||
        "Something went wrong. Please try again.";
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
            <h1 className="login-page__title">Forgot your password?</h1>
            <p className="login-page__description">
              {submitted
                ? "Check your inbox — if that email is registered you will receive a recovery link shortly."
                : "Enter the email address you used to create your MailMind account and we will send you a recovery link."}
            </p>
          </div>
        </div>

        <section className="login-page__card">
          <div className="login-page__brand-wrap">
            <BrandLogo size="lg" className="justify-center" />
          </div>

          {submitted ? (
            <div style={{ marginTop: "1.5rem", display: "grid", gap: "1rem" }}>
              <p style={{ color: "hsl(var(--muted-foreground))", fontSize: "0.92rem", lineHeight: 1.7, textAlign: "center" }}>
                A password reset link has been sent to <strong>{email}</strong>.
                Check your spam folder if you do not see it within a few minutes.
              </p>
              <Link to="/login" style={{ display: "block" }}>
                <Button variant="hero" className="login-page__primary-action">
                  Back to sign in
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="login-page__form">
              <div className="login-page__field-group">
                <label className="login-page__label">Email address</label>
                <div className="login-page__field-shell">
                  <Mail className="login-page__field-icon" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@gmail.com"
                    className="login-page__input"
                    autoComplete="email"
                  />
                </div>
              </div>

              <Button type="submit" variant="hero" className="login-page__primary-action" disabled={loading}>
                {loading ? "Sending..." : "Send recovery email"}
              </Button>
            </form>
          )}

          {error ? <div className="login-page__error">{error}</div> : null}

          <div className="login-page__footer-note">
            Remember your password? <Link to="/login">Sign in</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
