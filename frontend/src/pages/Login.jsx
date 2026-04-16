import { useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { House, LockKeyhole, Mail } from "lucide-react";
import { finalizeSession, getDefaultAppRoute, getGoogleLoginUrl, getMe, loginUser } from "../api/auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import BrandLogo from "../components/BrandLogo";
import { formatLoginError, validateLoginForm } from "../utils/authFeedback";
import "./Login.css";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.3-1.6 3.8-5.4 3.8-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.8 0 3 .8 3.7 1.5l2.5-2.4C16.6 3.5 14.5 2.7 12 2.7 6.9 2.7 2.8 6.8 2.8 12s4.1 9.3 9.2 9.3c5.3 0 8.8-3.7 8.8-8.9 0-.6-.1-1.1-.2-1.6H12Z" />
      <path fill="#34A853" d="M2.8 7.6 6 10c.9-2.7 3.3-4.3 6-4.3 1.8 0 3 .8 3.7 1.5l2.5-2.4C16.6 3.5 14.5 2.7 12 2.7c-3.5 0-6.6 2-8.1 4.9Z" />
      <path fill="#FBBC05" d="M12 21.3c2.4 0 4.4-.8 5.9-2.2l-2.7-2.2c-.7.5-1.8 1-3.2 1-2.7 0-5-1.8-5.8-4.3l-3.1 2.4c1.5 3 4.6 5.3 8.9 5.3Z" />
      <path fill="#4285F4" d="M20.8 12.4c0-.6-.1-1.1-.2-1.6H12v3.9h5.4c-.3 1.1-.9 1.9-1.8 2.5l2.7 2.2c1.6-1.5 2.5-3.8 2.5-7Z" />
    </svg>
  );
}

export default function Login() {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const addingAccount = searchParams.get("mode") === "add-account";

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    const validationMessage = validateLoginForm({ emailOrUsername, password });
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setLoading(true);
    try {
      const auth = await loginUser({ username: emailOrUsername.trim(), password });
      const profile = await getMe();
      finalizeSession(profile, auth.access, auth.refresh);
      const next = location.state?.from;
      if (!next && !profile.connected_gmail_accounts) {
        navigate("/connect-email", { replace: true });
      } else {
        navigate(next || getDefaultAppRoute(profile), { replace: true });
      }
    } catch (err) {
      setError(formatLoginError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      const authorizationUrl = await getGoogleLoginUrl();
      window.location.href = authorizationUrl;
    } catch (err) {
      setError(formatLoginError(err));
      setGoogleLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-page__glow login-page__glow--primary" />
      <div className="login-page__glow login-page__glow--secondary" />

      <div className="login-page__container">
        <div className="login-page__intro">
          <Link to="/" className="login-page__backlink">
            <House className="h-4 w-4" />
            Back to home
          </Link>

          <div className="login-page__header">
            <div className="login-page__eyebrow">Sign in</div>
            <h1 className="login-page__title">{addingAccount ? "Add another MailMind account" : "Welcome back to MailMind"}</h1>
            <p className="login-page__description">
              {addingAccount
                ? "Sign in to keep another MailMind workspace available on this device."
                : "Sign in to check your inbox, tasks, and attachments."}
            </p>
            <p className="login-page__helper-note">
              {addingAccount ? "This account will be added alongside your current session." : "Google sign-in logs you into MailMind first."}
            </p>
          </div>
        </div>

        <section className="login-page__card">
          <div className="login-page__brand-wrap">
            <BrandLogo size="lg" className="justify-center" />
          </div>

          <form onSubmit={handleLogin} className="login-page__form">
            <div className="login-page__field-group">
              <label className="login-page__label">Email or username</label>
              <div className="login-page__field-shell">
                <Mail className="login-page__field-icon" />
                <Input
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  placeholder="email@gmail.com"
                  className="login-page__input"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="login-page__field-group">
              <div className="login-page__label-row">
                <label className="login-page__label">Password</label>
                <Link to="/forgot-password" className="login-page__forgot-link">
                  Forgot password?
                </Link>
              </div>
              <div className="login-page__field-shell">
                <LockKeyhole className="login-page__field-icon" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="login-page__input"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <Button type="submit" variant="hero" className="login-page__primary-action" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>

            <Button type="button" variant="outline" className="login-page__secondary-action" onClick={handleGoogleLogin} disabled={googleLoading}>
              <GoogleIcon />
              <span>{googleLoading ? "Redirecting to Google..." : "Continue with Google"}</span>
            </Button>
          </form>

          {error ? <div className="login-page__error">{error}</div> : null}

          <div className="login-page__footer-note">
            Need an account? <Link to="/register">Create one</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
