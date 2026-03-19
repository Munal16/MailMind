import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { setAuthTokens } from "../api/auth";
import BrandLogo from "../components/BrandLogo";

export default function GoogleAuthCallback() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const access = params.get("access");
  const refresh = params.get("refresh");
  const error = !access || !refresh ? "Google login did not return valid tokens." : "";

  useEffect(() => {
    if (!access || !refresh) return;
    setAuthTokens(access, refresh);
    navigate("/app/dashboard", { replace: true });
  }, [access, refresh, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-card">
        <BrandLogo size="sm" className="justify-center" />
        {error ? (
          <>
            <h1 className="mt-6 text-xl font-semibold text-foreground">Google login failed</h1>
            <p className="mt-3 text-sm text-muted-foreground">{error}</p>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto mt-6 h-10 w-10 animate-spin text-primary" />
            <h1 className="mt-4 text-xl font-semibold text-foreground">Signing you in</h1>
            <p className="mt-3 text-sm text-muted-foreground">MailMind is finishing your Google login.</p>
          </>
        )}
      </div>
    </div>
  );
}
