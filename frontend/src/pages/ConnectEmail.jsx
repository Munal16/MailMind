import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  House,
  Inbox,
  Loader2,
  Mail,
  ShieldCheck,
} from "lucide-react";
import api from "../api/client";
import { Button } from "../components/ui/button";
import BrandLogo from "../components/BrandLogo";
import "./ConnectEmail.css";

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
  const [connectedEmail, setConnectedEmail] = useState("");
  const [loadingStatus, setLoadingStatus] = useState(true);
  const autoSyncStarted = useRef(false);

  const steps = useMemo(
    () => [
      { number: 1, label: "Connect", active: step >= 1 },
      { number: 2, label: "Sync", active: step >= 2 },
    ],
    [step]
  );

  const statusVariant = useMemo(() => {
    const normalized = status.toLowerCase();

    if (!status) {
      return "info";
    }

    if (
      normalized.includes("error") ||
      normalized.includes("failed") ||
      normalized.includes("reconnect") ||
      normalized.includes("not connected")
    ) {
      return "error";
    }

    if (completed || normalized.includes("synced") || normalized.includes("connected successfully")) {
      return "success";
    }

    return "info";
  }, [completed, status]);

  const benefitItems = useMemo(
    () => [
      {
        icon: ShieldCheck,
        title: "Secure Gmail access",
        description: "Connect safely with Google OAuth.",
      },
      {
        icon: Mail,
        title: "Focused sync flow",
        description: "Bring recent emails into MailMind.",
      },
      {
        icon: Inbox,
        title: "AI-ready workspace",
        description: "Your inbox is ready for review after sync.",
      },
    ],
    []
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
      const syncRes = await api.post("/api/gmail/sync/", { max_results: 120 });
      const syncedCount = Number(syncRes.data.saved || 0) + Number(syncRes.data.updated || 0);

      setStatus(`Synced ${syncedCount} emails. Running AI analysis...`);

      try {
        const analysisRes = await api.post("/api/ai/analyze-latest/", { limit: 80 });
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
        setConnectedEmail("");
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
        const backendMessage = res.data?.message;
        const connectedMailbox = res.data?.email_address || "";

        const gmailError = params.get("gmail");
        const gmailMessage = params.get("message");

        if (gmailError === "error") {
          setGmailConnected(false);
          setConnectedEmail("");
          setStep(1);
          setStatus(gmailMessage || "Gmail connection failed. Please connect Gmail again.");
          return;
        }

        if (params.get("gmail") === "connected" && !connected) {
          setGmailConnected(false);
          setConnectedEmail("");
          setStep(1);
          setStatus(
            backendMessage ||
              "MailMind could not verify a Gmail connection for this account. Please reconnect Gmail and try again."
          );
          return;
        }

        setGmailConnected(connected);
        setConnectedEmail(connectedMailbox);
        setStep(connected ? 2 : 1);
        setStatus(
          connected
            ? connectedMailbox
              ? `Gmail connected successfully for ${connectedMailbox}. You can sync emails now.`
              : backendMessage || "Gmail connected successfully. You can sync emails now."
            : backendMessage || ""
        );
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

  const renderActionPanel = () => {
    if (!gmailConnected) {
      return (
        <>
          <div className="connect-email-page__state-icon">
            <Mail className="h-8 w-8" />
          </div>
          <h2 className="connect-email-page__state-title">Connect your Gmail</h2>
          <p className="connect-email-page__state-description">
            {loadingStatus
              ? "Checking whether your Gmail account is already connected."
              : "Connect Gmail with Google OAuth so MailMind can sync your latest emails into one organized workspace."}
          </p>
          <div className="connect-email-page__actions">
            <Button variant="hero" onClick={connectGmail} disabled={loadingStatus}>
              Connect Gmail
            </Button>
          </div>
        </>
      );
    }

    if (syncing) {
      return (
        <>
          <div className="connect-email-page__state-icon connect-email-page__state-icon--loading">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
          <h2 className="connect-email-page__state-title">Syncing your mailbox</h2>
          <p className="connect-email-page__state-description">
            MailMind is importing recent emails and preparing them for urgency analysis, tasks, and attachment review.
          </p>
          {connectedEmail ? <div className="connect-email-page__account-chip">{connectedEmail}</div> : null}
        </>
      );
    }

    if (completed) {
      return (
        <>
          <div className="connect-email-page__state-icon connect-email-page__state-icon--success">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="connect-email-page__state-title">Mailbox ready</h2>
          <p className="connect-email-page__state-description">
            Your Gmail account is connected and synced. You can go straight into Inbox or continue from Dashboard.
          </p>
          {connectedEmail ? <div className="connect-email-page__account-chip">{connectedEmail}</div> : null}
          <div className="connect-email-page__actions">
            <Button variant="hero" onClick={() => navigate("/app/inbox")}>
              Open Inbox
            </Button>
            <Button variant="outline" onClick={() => navigate("/app/dashboard")}>
              Go to Dashboard
            </Button>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="connect-email-page__state-icon connect-email-page__state-icon--success">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="connect-email-page__state-title">Gmail connected</h2>
        <p className="connect-email-page__state-description">
          {connectedEmail
            ? `Your account ${connectedEmail} is linked. Start a sync to pull the latest emails into MailMind.`
            : "Your Gmail account is linked. Start a sync to pull the latest emails into MailMind."}
        </p>
        {connectedEmail ? <div className="connect-email-page__account-chip">{connectedEmail}</div> : null}
        <div className="connect-email-page__actions">
          <Button variant="hero" onClick={handleSync}>
            Sync Emails Now
          </Button>
          <Button variant="outline" onClick={() => navigate("/app/dashboard")}>
            Skip for now
          </Button>
        </div>
      </>
    );
  };

  return (
    <div className="connect-email-page">
      <div className="connect-email-page__glow connect-email-page__glow--primary" />
      <div className="connect-email-page__glow connect-email-page__glow--secondary" />

      <div className="connect-email-page__container">
        <div className="connect-email-page__intro">
          <Link to="/" className="connect-email-page__backlink">
            <House className="h-4 w-4" />
            Back to home
          </Link>

          <div className="connect-email-page__header">
            <div className="connect-email-page__eyebrow">Connect email</div>
            <h1 className="connect-email-page__title">Bring your Gmail into MailMind</h1>
            <p className="connect-email-page__description">Connect Gmail so MailMind can sync your emails.</p>
            <p className="connect-email-page__helper-note">Google may ask you to choose an account here.</p>
          </div>
        </div>

        <section className="connect-email-page__shell">
          <aside className="connect-email-page__aside">
            <div className="connect-email-page__brand">
              <BrandLogo size="md" className="justify-start" />
            </div>

            <div className="connect-email-page__aside-copy">
              <h3>What happens next</h3>
              <p>Connect Gmail, sync your inbox, and start working.</p>
            </div>

            <ul className="connect-email-page__benefits">
              {benefitItems.map((item) => {
                const Icon = item.icon;

                return (
                  <li key={item.title} className="connect-email-page__benefit">
                    <div className="connect-email-page__benefit-icon">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="connect-email-page__benefit-copy">
                      <h4>{item.title}</h4>
                      <p>{item.description}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </aside>

          <div className="connect-email-page__panel">
            <div className="connect-email-page__steps">
              {steps.map((item, index) => (
                <div key={item.number} className="connect-email-page__step">
                  <div
                    className={`connect-email-page__step-badge ${item.active ? "connect-email-page__step-badge--active" : ""}`}
                  >
                    {item.number}
                  </div>
                  <div className="connect-email-page__step-label">{item.label}</div>
                  {index < steps.length - 1 ? <div className="connect-email-page__step-line" /> : null}
                </div>
              ))}
            </div>

            <div className="connect-email-page__state-card">{renderActionPanel()}</div>

            {status ? (
              <div className={`connect-email-page__status connect-email-page__status--${statusVariant}`}>
                <div className="connect-email-page__status-label">Status</div>
                <div className="connect-email-page__status-text">{status}</div>
              </div>
            ) : null}

            <div className="connect-email-page__footer-link">
              <button type="button" onClick={() => navigate("/app/dashboard")}>
                Continue to dashboard
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
