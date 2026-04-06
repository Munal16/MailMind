import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { finalizeSession, getDefaultAppRoute, getMe, setAuthTokens } from "../api/auth";
import { Button } from "../components/ui/button";
import BrandLogo from "../components/BrandLogo";

export default function GoogleAuthCallback() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const access = params.get("access");
  const refresh = params.get("refresh");
  const serverError = params.get("error");
  const error = serverError || (!access || !refresh ? "Google login did not return valid tokens." : "");

  useEffect(() => {
    if (!access || !refresh || serverError) return;

    let cancelled = false;

    const finishLogin = async () => {
      try {
        setAuthTokens(access, refresh);
        const profile = await getMe();
        finalizeSession(profile, access, refresh);
        if (!cancelled) {
          if (!profile.connected_gmail_accounts) {
            navigate("/connect-email", { replace: true });
          } else {
            navigate(getDefaultAppRoute(profile), { replace: true });
          }
        }
      } catch {
        if (!cancelled) {
          navigate("/login", { replace: true });
        }
      }
    };

    void finishLogin();

    return () => {
      cancelled = true;
    };
  }, [access, refresh, navigate, serverError]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-card">
        <BrandLogo size="sm" className="justify-center" />
        {error ? (
          <>
            <h1 className="mt-6 text-xl font-semibold text-foreground">Google login failed</h1>
            <p className="mt-3 text-sm text-muted-foreground">{error}</p>
            <div className="mt-6 flex justify-center">
              <Button variant="hero" onClick={() => navigate("/login", { replace: true })}>
                Back to login
              </Button>
            </div>
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
