import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { House, LockKeyhole, Mail, UserRound } from "lucide-react";
import { loginUser, registerUser } from "../api/auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import BrandLogo from "../components/BrandLogo";
import { formatRegisterError, validateRegisterForm } from "../utils/authFeedback";
import "./Register.css";

const fields = [
  { key: "name", label: "Full name", type: "text", placeholder: "Your name", icon: UserRound, autoComplete: "name" },
  { key: "email", label: "Email", type: "email", placeholder: "email@gmail.com", icon: Mail },
  {
    key: "password",
    label: "Password",
    type: "password",
    placeholder: "Use at least 6 characters",
    icon: LockKeyhole,
    autoComplete: "new-password",
  },
  {
    key: "confirmPassword",
    label: "Confirm password",
    type: "password",
    placeholder: "Re-enter your password",
    icon: LockKeyhole,
    autoComplete: "new-password",
  },
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

    const validationMessage = validateRegisterForm(form);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setLoading(true);
    try {
      const email = form.email.trim().toLowerCase();
      const fullName = form.name.trim();

      await registerUser({
        username: email,
        email,
        password: form.password,
        full_name: fullName,
      });
      await loginUser({ username: email, password: form.password });
      navigate("/connect-email", { replace: true });
    } catch (err) {
      setError(formatRegisterError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-page__glow register-page__glow--primary" />
      <div className="register-page__glow register-page__glow--secondary" />

      <div className="register-page__container">
        <div className="register-page__intro">
          <Link to="/" className="register-page__backlink">
            <House className="h-4 w-4" />
            Back to home
          </Link>

          <div className="register-page__header">
            <div className="register-page__eyebrow">Create account</div>
            <h1 className="register-page__title">Create your MailMind account</h1>
            <p className="register-page__description">Create your account to get started with MailMind.</p>
            <p className="register-page__helper-note">You can connect Gmail in the next step.</p>
          </div>
        </div>

        <section className="register-page__card">
          <div className="register-page__brand-wrap">
            <BrandLogo size="lg" className="justify-center" />
          </div>

          <form onSubmit={handleRegister} className="register-page__form">
            {fields.map((field) => {
              const Icon = field.icon;

              return (
                <div key={field.key} className="register-page__field-group">
                  <label className="register-page__label">{field.label}</label>
                  <div className="register-page__field-shell">
                    <Icon className="register-page__field-icon" />
                    <Input
                      type={field.type}
                      value={form[field.key]}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="register-page__input"
                      autoComplete={field.autoComplete || (field.key === "email" ? "email" : undefined)}
                    />
                  </div>
                </div>
              );
            })}

            <Button type="submit" variant="hero" className="register-page__primary-action" disabled={loading}>
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>

          {error ? <div className="register-page__error">{error}</div> : null}

          <div className="register-page__footer-note">
            Already have an account? <Link to="/login">Sign in</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
