import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, HelpCircle, LogOut, Trash2 } from "lucide-react";
import { Button } from "./button";
import { cn } from "../../lib/utils";

const ICONS = {
  danger: Trash2,
  warning: AlertTriangle,
  logout: LogOut,
  default: HelpCircle,
};

export default function ConfirmDialog({
  title = "Are you sure?",
  description = "",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",   // "danger" | "warning" | "logout" | "default"
  onConfirm,
  onCancel,
}) {
  const Icon = ICONS[variant] || ICONS.default;

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  return createPortal(
    <div
      className="confirm-dialog__backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-desc"
    >
      <div className="confirm-dialog__panel">

        {/* Icon circle */}
        <div className={cn("confirm-dialog__icon-wrap", `confirm-dialog__icon-wrap--${variant}`)}>
          <Icon className="h-6 w-6" />
        </div>

        {/* Text */}
        <div className="confirm-dialog__body">
          <h2 id="confirm-title" className="confirm-dialog__title">{title}</h2>
          {description ? (
            <p id="confirm-desc" className="confirm-dialog__description">{description}</p>
          ) : null}
        </div>

        {/* Actions */}
        <div className="confirm-dialog__actions">
          <Button
            variant="outline"
            className="confirm-dialog__btn-cancel"
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "danger" ? "destructive" : "default"}
            className={cn(
              "confirm-dialog__btn-confirm",
              variant === "logout" && "confirm-dialog__btn-confirm--logout",
              variant === "warning" && "confirm-dialog__btn-confirm--warning"
            )}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
