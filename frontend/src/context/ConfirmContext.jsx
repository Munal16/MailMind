import { createContext, useCallback, useContext, useState } from "react";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import "../components/ui/ConfirmDialog.css";

const ConfirmContext = createContext(null);

/**
 * Wrap your app with this provider to enable useConfirm() everywhere.
 */
export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setDialog({ ...options, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    dialog?.resolve(true);
    setDialog(null);
  }, [dialog]);

  const handleCancel = useCallback(() => {
    dialog?.resolve(false);
    setDialog(null);
  }, [dialog]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog ? (
        <ConfirmDialog
          title={dialog.title}
          description={dialog.description}
          confirmLabel={dialog.confirmLabel}
          cancelLabel={dialog.cancelLabel}
          variant={dialog.variant}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      ) : null}
    </ConfirmContext.Provider>
  );
}

/**
 * Returns an async confirm(options) function.
 *
 * Usage:
 *   const confirm = useConfirm();
 *   const ok = await confirm({ title: "Delete?", variant: "danger" });
 *   if (ok) { ... }
 *
 * Options:
 *   title        – heading text
 *   description  – body text (optional)
 *   confirmLabel – confirm button label (default "Confirm")
 *   cancelLabel  – cancel button label  (default "Cancel")
 *   variant      – "danger" | "warning" | "logout" | "default"
 */
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}
