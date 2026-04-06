import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MailPlus,
  Paperclip,
  Reply,
  ReplyAll,
  Send,
  X,
  Forward,
  Save,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import api from "../api/client";
import { useConfirm } from "../context/ConfirmContext";
import "./ComposeMailDrawer.css";

const modeMeta = {
  new: { icon: MailPlus, label: "Compose" },
  reply: { icon: Reply, label: "Reply" },
  replyAll: { icon: ReplyAll, label: "Reply all" },
  forward: { icon: Forward, label: "Forward" },
};

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(", ");
  }
  return String(value || "");
}

function defaultForm(initialData = {}) {
  return {
    mode: initialData.mode || "new",
    to: normalizeList(initialData.to),
    cc: normalizeList(initialData.cc),
    bcc: normalizeList(initialData.bcc),
    subject: initialData.subject || "",
    body: initialData.body || "",
    threadId: initialData.threadId || "",
    replyToGmailId: initialData.replyToGmailId || "",
  };
}

function formatComposeError(error) {
  if (typeof error?.response?.data === "string") {
    return error.response.data;
  }
  if (error?.response?.data?.error) {
    return error.response.data.error;
  }
  return "MailMind could not complete this email action right now.";
}

export default function ComposeMailDrawer({ open, onClose, initialData }) {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [form, setForm] = useState(defaultForm(initialData));
  const [attachments, setAttachments] = useState([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }
    const nextForm = defaultForm(initialData);
    setForm(nextForm);
    setAttachments([]);
    setShowCc(Boolean(nextForm.cc));
    setShowBcc(Boolean(nextForm.bcc));
    setSavingDraft(false);
    setSending(false);
    setError("");
    setSuccess("");
  }, [initialData, open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose, open]);

  const mode = form.mode || "new";
  const modeInfo = modeMeta[mode] || modeMeta.new;
  const ModeIcon = modeInfo.icon;

  const isDirty = useMemo(() => {
    return Boolean(
      form.to.trim() ||
        form.cc.trim() ||
        form.bcc.trim() ||
        form.subject.trim() ||
        form.body.trim() ||
        attachments.length
    );
  }, [attachments.length, form.bcc, form.body, form.cc, form.subject, form.to]);

  const closeDrawer = async () => {
    if (sending || savingDraft) {
      const ok = await confirm({
        title: "Still sending…",
        description: "MailMind is still working on this email. Are you sure you want to close?",
        confirmLabel: "Close anyway",
        cancelLabel: "Wait",
        variant: "warning",
      });
      if (!ok) return;
    } else if (isDirty && !success) {
      const ok = await confirm({
        title: "Discard draft?",
        description: "Your unsaved changes will be lost. This cannot be undone.",
        confirmLabel: "Discard",
        cancelLabel: "Keep editing",
        variant: "danger",
      });
      if (!ok) return;
    }
    onClose();
  };

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const attachFiles = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      return;
    }
    setAttachments((current) => {
      const existing = new Set(current.map((file) => `${file.name}-${file.size}`));
      const next = [...current];
      files.forEach((file) => {
        const key = `${file.name}-${file.size}`;
        if (!existing.has(key)) {
          next.push(file);
        }
      });
      return next;
    });
    event.target.value = "";
  };

  const removeAttachment = (index) => {
    setAttachments((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const submitCompose = async (kind) => {
    try {
      setError("");
      setSuccess("");
      if (kind === "send") {
        setSending(true);
      } else {
        setSavingDraft(true);
      }

      const formData = new FormData();
      formData.append("to", form.to);
      formData.append("cc", form.cc);
      formData.append("bcc", form.bcc);
      formData.append("subject", form.subject);
      formData.append("body", form.body);
      if (form.threadId) {
        formData.append("thread_id", form.threadId);
      }
      if (form.replyToGmailId) {
        formData.append("reply_to_gmail_id", form.replyToGmailId);
      }
      attachments.forEach((file) => {
        formData.append("attachments", file);
      });

      const endpoint = kind === "send" ? "/api/gmail/send/" : "/api/gmail/drafts/save/";
      const response = await api.post(endpoint, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const mailbox = response.data.mailbox || (kind === "send" ? "sent" : "drafts");
      const message = response.data.message || (kind === "send" ? "Email sent successfully." : "Draft saved successfully.");
      setSuccess(message);

      window.dispatchEvent(
        new CustomEvent("mailmind:outgoing-updated", {
          detail: {
            mailbox,
            gmailId: response.data.gmail_id,
            message,
          },
        })
      );

      window.setTimeout(() => {
        onClose();
        navigate(`/app/inbox?mailbox=${encodeURIComponent(mailbox)}`);
      }, 700);
    } catch (requestError) {
      const message = formatComposeError(requestError);
      setError(message);
      if (requestError.response?.data?.requires_reconnect) {
        window.setTimeout(() => {
          onClose();
          navigate(`/connect-email?gmail=error&message=${encodeURIComponent(message)}`);
        }, 200);
      }
    } finally {
      setSending(false);
      setSavingDraft(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="compose-drawer" role="presentation">
      <button type="button" className="compose-drawer__backdrop" aria-label="Close compose" onClick={closeDrawer} />

      <aside className="compose-drawer__panel" aria-modal="true" role="dialog" aria-label="Compose email">
        <div className="compose-drawer__header">
          <div>
            <div className="compose-drawer__eyebrow">
              <ModeIcon className="h-4 w-4" />
              {modeInfo.label}
            </div>
            <h2 className="compose-drawer__title">
              {mode === "new" ? "New message" : mode === "reply" ? "Reply to email" : mode === "replyAll" ? "Reply to everyone" : "Forward email"}
            </h2>
            <p className="compose-drawer__copy">
              Send from the connected Gmail account so Sent mail, drafts, and replies stay in the same inbox flow.
            </p>
          </div>

          <button type="button" className="compose-drawer__close" onClick={closeDrawer} aria-label="Close compose">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="compose-drawer__body">
          {error ? <div className="compose-drawer__error">{error}</div> : null}
          {success ? <div className="compose-drawer__success">{success}</div> : null}

          <div className="compose-drawer__field">
            <label className="compose-drawer__label" htmlFor="compose-to">
              To
            </label>
            <Input
              id="compose-to"
              value={form.to}
              onChange={(event) => updateField("to", event.target.value)}
              placeholder="name@example.com, second@example.com"
            />
          </div>

          <div className="compose-drawer__recipient-toggles">
            {!showCc ? (
              <button type="button" className="compose-drawer__toggle-link" onClick={() => setShowCc(true)}>
                Add Cc
              </button>
            ) : null}
            {!showBcc ? (
              <button type="button" className="compose-drawer__toggle-link" onClick={() => setShowBcc(true)}>
                Add Bcc
              </button>
            ) : null}
          </div>

          {showCc ? (
            <div className="compose-drawer__field">
              <label className="compose-drawer__label" htmlFor="compose-cc">
                Cc
              </label>
              <Input
                id="compose-cc"
                value={form.cc}
                onChange={(event) => updateField("cc", event.target.value)}
                placeholder="team@example.com"
              />
            </div>
          ) : null}

          {showBcc ? (
            <div className="compose-drawer__field">
              <label className="compose-drawer__label" htmlFor="compose-bcc">
                Bcc
              </label>
              <Input
                id="compose-bcc"
                value={form.bcc}
                onChange={(event) => updateField("bcc", event.target.value)}
                placeholder="private@example.com"
              />
            </div>
          ) : null}

          <div className="compose-drawer__field">
            <label className="compose-drawer__label" htmlFor="compose-subject">
              Subject
            </label>
            <Input
              id="compose-subject"
              value={form.subject}
              onChange={(event) => updateField("subject", event.target.value)}
              placeholder="Write a clear subject"
            />
          </div>

          <div className="compose-drawer__field">
            <label className="compose-drawer__label" htmlFor="compose-body">
              Message
            </label>
            <textarea
              id="compose-body"
              className="compose-drawer__textarea"
              value={form.body}
              onChange={(event) => updateField("body", event.target.value)}
              placeholder="Write your email here..."
            />
          </div>

          <div className="compose-drawer__attachments">
            <div className="compose-drawer__attachments-head">
              <div>
                <div className="compose-drawer__label">Attachments</div>
                <div className="compose-drawer__attachments-copy">Add PDFs, docs, images, or any file you want to send.</div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Paperclip className="mr-1.5 h-4 w-4" />
                Add files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={attachFiles}
              />
            </div>

            {attachments.length ? (
              <div className="compose-drawer__attachment-list">
                {attachments.map((file, index) => (
                  <div key={`${file.name}-${file.size}-${index}`} className="compose-drawer__attachment-item">
                    <div>
                      <div className="compose-drawer__attachment-name">{file.name}</div>
                      <div className="compose-drawer__attachment-size">{Math.max(1, Math.round(file.size / 1024))} KB</div>
                    </div>
                    <button
                      type="button"
                      className="compose-drawer__attachment-remove"
                      onClick={() => removeAttachment(index)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="compose-drawer__attachment-empty">No files attached yet.</div>
            )}
          </div>
        </div>

        <div className="compose-drawer__footer">
          <Button type="button" variant="outline" onClick={() => submitCompose("draft")} disabled={sending || savingDraft}>
            <Save className="mr-1.5 h-4 w-4" />
            {savingDraft ? "Saving..." : "Save draft"}
          </Button>
          <Button type="button" variant="hero" onClick={() => submitCompose("send")} disabled={sending || savingDraft}>
            <Send className="mr-1.5 h-4 w-4" />
            {sending ? "Sending..." : "Send email"}
          </Button>
        </div>
      </aside>
    </div>
  );
}
