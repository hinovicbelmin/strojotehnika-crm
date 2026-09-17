"use client";
import { CheckCircle2, XCircle, Undo2 } from "lucide-react";

export function ToastStack({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={
            "toast-in pointer-events-auto flex items-center gap-2.5 rounded-lg shadow-lg px-4 py-3 text-sm font-medium min-w-[240px] max-w-sm " +
            (t.type === "error" ? "bg-red-600 text-white" : "bg-slate-900 dark:bg-slate-800 text-white border border-slate-700/50")
          }
        >
          {t.type === "error" ? (
            <XCircle size={16} className="shrink-0" />
          ) : t.actionLabel ? (
            <Undo2 size={16} className="shrink-0 text-amber-400" />
          ) : (
            <CheckCircle2 size={16} className="shrink-0 text-teal-400" />
          )}
          <span className="flex-1">{t.message}</span>
          {t.actionLabel && (
            <button
              onClick={() => {
                t.onAction && t.onAction();
                onDismiss(t.id);
              }}
              className="text-teal-300 hover:text-teal-200 font-semibold underline underline-offset-2 shrink-0"
            >
              {t.actionLabel}
            </button>
          )}
          <button onClick={() => onDismiss(t.id)} className="text-white/50 hover:text-white shrink-0 text-xs">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
