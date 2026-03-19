import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser, registerUser } from "../api/auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import BrandLogo from "../components/BrandLogo";

const fields = [
  { key: "name", label: "Name", type: "text", placeholder: "Munal Pandey" },
  { key: "email", label: "Email", type: "email", placeholder: "Munal16@gmail.com" },
  { key: "password", label: "Password", type: "password", placeholder: "Create a password" },
  { key: "confirmPassword", label: "Confirm Password", type: "password", placeholder: "Re-Enter your password" },
];

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await registerUser({ username: form.name || form.email, email: form.email, password: form.password });
      await loginUser({ username: form.name || form.email, password: form.password });
      navigate("/connect-email", { replace: true });
    } catch (err) {
      setError(typeof err.response?.data === "string" ? err.response.data : JSON.stringify(err.response?.data || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <BrandLogo size="lg" className="justify-center" />
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-foreground">Create your account</h1>
          <p className="mt-2 text-sm text-muted-foreground">Start managing your inbox with MailMind</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          <form onSubmit={handleRegister} className="space-y-4">
            {fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <label className="text-sm font-medium text-card-foreground">{field.label}</label>
                <Input type={field.type} value={form[field.key]} onChange={(e) => handleChange(field.key, e.target.value)} placeholder={field.placeholder} />
              </div>
            ))}
            <Button type="submit" variant="hero" className="w-full" disabled={loading}>{loading ? "Creating account..." : "Create Account"}</Button>
          </form>

          {error ? <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div> : null}

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account? <Link to="/login" className="font-semibold text-primary hover:underline">Login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
