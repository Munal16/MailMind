import { Link } from "react-router-dom";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser, registerUser } from "../api/auth";

export default function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await registerUser({ username: name || email, email, password });
      await loginUser({ username: name || email, password });
      navigate("/app/dashboard", { replace: true });
    } catch (err) {
      setError(JSON.stringify(err.response?.data || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-300/20 bg-white/80 p-8 shadow-xl dark:border-slate-700 dark:bg-slate-900/80">
        <h1 className="text-2xl font-bold">Create Account</h1>
        <p className="mt-1 text-sm text-slate-500">Start using AI-powered email triage</p>

        <form onSubmit={handleRegister} className="mt-6 space-y-4">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="w-full rounded-xl border border-slate-300/20 bg-white px-3 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-950" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className="w-full rounded-xl border border-slate-300/20 bg-white px-3 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-950" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" className="w-full rounded-xl border border-slate-300/20 bg-white px-3 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-950" />
          <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm Password" type="password" className="w-full rounded-xl border border-slate-300/20 bg-white px-3 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-950" />
          <button type="submit" disabled={loading} className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
            {loading ? "Creating..." : "Create Account"}
          </button>
        </form>

        {error && <div className="mt-4 rounded-xl border border-red-300/40 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">{error}</div>}

        <div className="mt-4 text-sm text-slate-500">
          Already have an account?{" "}
          <Link className="font-semibold text-indigo-600" to="/login">
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}
