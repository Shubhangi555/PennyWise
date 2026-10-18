import { useEffect } from 'react';

export interface ToastState {
  id: number; // changes on every new toast so the timer restarts
  message: string;
  action?: { label: string; onClick: () => void };
}

const DURATION_MS = 6000;

// Bottom-centre notification with an optional action (e.g. Undo). Announced to screen readers.
export default function Toast({ toast, onDismiss }: { toast: ToastState | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <div aria-live="polite" role="status">
      {toast && (
        <div className="toast" key={toast.id}>
          <span>{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action!.onClick();
                onDismiss();
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
