import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Mail, LockKeyhole } from "lucide-react";
import { getGoogleLoginUrl, loginUser } from "../api/auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import BrandLogo from "../components/BrandLogo";

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

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await loginUser({ username: emailOrUsername, password });
      const next = location.state?.from || "/app/dashboard";
      navigate(next, { replace: true });
    } catch (err) {
      setError(typeof err.response?.data === "string" ? err.response.data : JSON.stringify(err.response?.data || err.message));
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
      setError(typeof err.response?.data === "string" ? err.response.data : JSON.stringify(err.response?.data || err.message));
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <BrandLogo size="lg" className="justify-center" />
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-foreground">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to your MailMind account</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-card-foreground">Email or username</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={emailOrUsername} onChange={(e) => setEmailOrUsername(e.target.value)} placeholder="name@company.com" className="pl-10" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-card-foreground">Password</label>
              <div className="relative">
                <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="pl-10" />
              </div>
            </div>

            <Button type="submit" variant="hero" className="w-full" disabled={loading}>{loading ? "Signing in..." : "Login"}</Button>
            <Button type="button" variant="outline" className="w-full" onClick={handleGoogleLogin} disabled={googleLoading}>
              <GoogleIcon />
              <span className="ml-2">{googleLoading ? "Redirecting to Google..." : "Login with Google"}</span>
            </Button>
          </form>

          {error ? <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div> : null}

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Need an account? <Link to="/register" className="font-semibold text-primary hover:underline">Register</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
