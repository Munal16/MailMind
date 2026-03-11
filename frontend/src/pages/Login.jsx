import { Link } from "react-router-dom";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { loginUser } from "../api/auth";

export default function Login() {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
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
      setError(JSON.stringify(err.response?.data || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-300/20 bg-white/80 p-8 shadow-xl dark:border-slate-700 dark:bg-slate-900/80">
        <h1 className="text-2xl font-bold">Login</h1>
        <p className="mt-1 text-sm text-slate-500">Access your MailMind workspace</p>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Email</label>
            <input
              value={emailOrUsername}
              onChange={(e) => setEmailOrUsername(e.target.value)}
              className="w-full rounded-xl border border-slate-300/20 bg-white px-3 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-300/20 bg-white px-3 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <button type="submit" disabled={loading} className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
            {loading ? "Logging in..." : "Login"}
          </button>
          <button type="button" className="w-full rounded-xl border border-slate-300/20 px-4 py-2.5 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
            Login with Google
          </button>
        </form>

        {error && <div className="mt-4 rounded-xl border border-red-300/40 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">{error}</div>}

        <div className="mt-4 text-sm text-slate-500">
          New to MailMind?{" "}
          <Link className="font-semibold text-indigo-600" to="/register">
            Register
          </Link>
        </div>
      </div>
    </div>
  );
}
