import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import api from "../api/client";
import { Button } from "../components/ui/button";
import BrandLogo from "../components/BrandLogo";

function getErrorMessage(err) {
  if (typeof err?.response?.data === "string") {
    return err.response.data;
  }
  if (err?.response?.data?.error) {
    return err.response.data.error;
  }
  return JSON.stringify(err?.response?.data || err?.message || "Unknown error");
}

export default function ConnectEmail() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState(1);
  const [status, setStatus] = useState("");
  const [completed, setCompleted] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const autoSyncStarted = useRef(false);

  const steps = useMemo(
    () => [
      { number: 1, label: "Connect", active: step >= 1 },
      { number: 2, label: "Sync", active: step >= 2 },
    ],
    [step]
  );

  const handleUnauthorized = useCallback(() => {
    navigate("/login", { replace: true });
  }, [navigate]);

  const handleSync = useCallback(async () => {
    if (!gmailConnected) {
      setStatus("Connect your Gmail account before syncing emails.");
      return;
    }

    setStep(2);
    setSyncing(true);
    setCompleted(false);
    setStatus("Fetching emails...");

    try {
      const syncRes = await api.post("/api/gmail/sync/", { max_results: 50 });
      const syncedCount = Number(syncRes.data.saved || 0) + Number(syncRes.data.updated || 0);

      setStatus(`Synced ${syncedCount} emails. Running AI analysis...`);

      try {
        const analysisRes = await api.post("/api/ai/analyze-latest/", { limit: 50 });
        setStatus(`Synced ${syncedCount} emails and analyzed ${analysisRes.data.analyzed || 0} emails.`);
      } catch {
        setStatus(`Synced ${syncedCount} emails. AI analysis can be run again from Inbox or Dashboard.`);
      }

      setCompleted(true);
    } catch (err) {
      if (err.response?.status === 401) {
        handleUnauthorized();
        return;
      }

      if (err.response?.data?.requires_reconnect) {
        setGmailConnected(false);
        setStep(1);
        setCompleted(false);
        autoSyncStarted.current = false;
      }

      setStatus(getErrorMessage(err));
    } finally {
      setSyncing(false);
    }
  }, [gmailConnected, handleUnauthorized]);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const res = await api.get("/api/gmail/status/");
        const connected = Boolean(res.data?.connected);

        const gmailError = params.get("gmail");
        const gmailMessage = params.get("message");

        if (gmailError === "error") {
          setGmailConnected(false);
          setStep(1);
          setStatus(gmailMessage || "Gmail connection failed. Please connect Gmail again.");
          return;
        }

        setGmailConnected(connected);
        setStep(connected ? 2 : 1);
        setStatus(connected ? "Gmail connected successfully. You can sync emails now." : "");
      } catch (err) {
        if (err.response?.status === 401) {
          handleUnauthorized();
          return;
        }

        setStatus(getErrorMessage(err));
      } finally {
        setLoadingStatus(false);
      }
    };

    loadStatus();
  }, [handleUnauthorized, params]);

  useEffect(() => {
    if (loadingStatus || syncing || completed || autoSyncStarted.current) {
      return;
    }

    if (params.get("gmail") === "connected" && gmailConnected) {
      autoSyncStarted.current = true;
      handleSync();
    }
  }, [completed, gmailConnected, handleSync, loadingStatus, params, syncing]);

  const connectGmail = async () => {
    try {
      setStatus("Requesting Gmail authorization...");
      const res = await api.get("/api/gmail/auth-url/");
      window.location.href = res.data.authorization_url;
    } catch (err) {
      if (err.response?.status === 401) {
        handleUnauthorized();
        return;
      }

      setStatus(getErrorMessage(err));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
          <div className="mb-8 flex justify-center">
            <BrandLogo size="md" className="justify-center" />
          </div>
          <div className="mx-auto mb-10 flex max-w-md items-center justify-center gap-4">
            {steps.map((item, index) => (
              <div key={item.number} className="flex items-center gap-4">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
                    item.active ? "gradient-primary text-white" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {item.number}
                </div>
                <div className="text-sm font-medium text-muted-foreground">{item.label}</div>
                {index < steps.length - 1 ? <div className="h-px w-14 bg-border" /> : null}
              </div>
            ))}
          </div>

          {!gmailConnected ? (
            <div className="mx-auto max-w-xl text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-accent text-accent-foreground">
                <Mail className="h-8 w-8" />
              </div>
              <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">Connect your Gmail</h1>
              <p className="mt-3 text-sm text-muted-foreground">
                {loadingStatus
                  ? "Checking your Gmail connection..."
                  : "Connect Gmail via OAuth to start syncing your inbox into MailMind."}
              </p>
              <div className="mt-8 flex items-center justify-center gap-3">
                <Button variant="hero" onClick={connectGmail} disabled={loadingStatus}>
                  Connect Gmail
                </Button>
              </div>
            </div>
          ) : syncing ? (
            <div className="text-center">
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
              <h2 className="mt-6 text-2xl font-semibold text-foreground">Fetching emails...</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                MailMind is syncing your inbox and running AI analysis.
              </p>
            </div>
          ) : completed ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
              <h2 className="mt-6 text-2xl font-semibold text-foreground">All Set!</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Your mailbox is connected, synced, and ready inside MailMind.
              </p>
              <div className="mt-8 flex items-center justify-center gap-3">
                <Button variant="hero" onClick={() => navigate("/app/inbox")}>
                  Open Inbox
                </Button>
                <Button variant="outline" onClick={() => navigate("/app/dashboard")}>
                  Go to Dashboard
                </Button>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-xl text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-accent text-accent-foreground">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">Gmail connected</h1>
              <p className="mt-3 text-sm text-muted-foreground">
                Your Gmail account is linked. Sync now to pull the latest emails into MailMind.
              </p>
              <div className="mt-8 flex items-center justify-center gap-3">
                <Button variant="hero" onClick={handleSync}>
                  Sync Emails Now
                </Button>
                <Button variant="outline" onClick={() => navigate("/app/dashboard")}>
                  Skip for now
                </Button>
              </div>
            </div>
          )}

          {status ? (
            <div className="mt-8 rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
              {status}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
