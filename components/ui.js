"use client";
import { useEffect, useMemo, useState } from "react";
import { X, Search, Upload, Trash2 } from "lucide-react";
import { btnGhostIcon, btnPrimary, btnSecondary, inputCls, fmtDate } from "../lib/crm";

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-900/50 p-3 sm:p-6 overflow-y-auto" onClick={onClose}>
      <div
        className={(wide ? "max-w-2xl" : "max-w-lg") + " w-full bg-white rounded-2xl shadow-2xl my-6"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className={btnGhostIcon}>
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, required, hint }) {
  return (
    <label className="block mb-4">
      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-slate-400 mt-1">{hint}</span>}
    </label>
  );
}

export function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 border border-dashed border-slate-300 rounded-xl bg-slate-50/50">
      <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center mb-3">
        <Icon size={20} className="text-slate-400" />
      </div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {subtitle && <p className="text-sm text-slate-400 mt-1 max-w-sm">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Toolbar({ children }) {
  return <div className="flex flex-wrap items-center gap-2 mb-4">{children}</div>;
}

export function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="relative flex-1 min-w-[180px]">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Pretraga..."}
        className={inputCls + " pl-8"}
      />
    </div>
  );
}

export function MetaLine({ record }) {
  return (
    <div className="text-xs text-slate-400 mt-2 flex flex-wrap gap-x-3 gap-y-0.5">
      <span>
        Kreirao: <span className="text-slate-500 font-medium">{record.created_by || "—"}</span>
        {record.created_at ? ` (${fmtDate(record.created_at.slice ? record.created_at.slice(0, 10) : record.created_at)})` : ""}
      </span>
      {(record.updated_by || record.updated_at) && (
        <span>
          Zadnja izmjena: <span className="text-slate-500 font-medium">{record.updated_by || "—"}</span>
          {record.updated_at ? ` (${fmtDate(record.updated_at.slice ? record.updated_at.slice(0, 10) : record.updated_at)})` : ""}
        </span>
      )}
    </div>
  );
}

export function ImportModal({ title, columns, onClose, onImport }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const rows = useMemo(() => {
    return text
      .split("\n")
      .map((r) => r.replace(/\r$/, ""))
      .filter((r) => r.trim().length > 0)
      .map((r) => (r.includes("\t") ? r.split("\t") : r.split(",")).map((c) => c.trim()));
  }, [text]);
  return (
    <Modal title={title} onClose={onClose} wide>
      <p className="text-sm text-slate-500 mb-3">
        Zalijepi redove iz Excela (kolone razdvojene TAB-om ili zarezom), tim redoslijedom:
      </p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {columns.map((c, i) => (
          <span key={i} className="text-xs bg-slate-100 text-slate-600 rounded px-2 py-0.5">
            {i + 1}. {c}
          </span>
        ))}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        placeholder="Zalijepi podatke ovdje..."
        className={inputCls + " font-mono text-xs"}
      />
      <p className="text-xs text-slate-400 mt-2">Prepoznato redova: {rows.length}</p>
      <div className="flex justify-end gap-2 mt-5">
        <button className={btnSecondary} onClick={onClose}>
          Otkaži
        </button>
        <button
          className={btnPrimary}
          disabled={rows.length === 0 || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onImport(rows);
              onClose();
            } finally {
              setBusy(false);
            }
          }}
        >
          <Upload size={15} /> {busy ? "Uvozim..." : `Uvezi${rows.length > 0 ? ` (${rows.length})` : ""}`}
        </button>
      </div>
    </Modal>
  );
}

export function ConfirmDelete({ label, onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!confirming) {
    return (
      <button className={btnGhostIcon} title="Obriši" onClick={() => setConfirming(true)}>
        <Trash2 size={15} />
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <button
        className="text-xs text-red-600 font-semibold hover:underline disabled:opacity-50"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await onConfirm();
          setBusy(false);
          setConfirming(false);
        }}
      >
        Obriši {label}?
      </button>
      <button className="text-xs text-slate-400 hover:underline" onClick={() => setConfirming(false)}>
        ne
      </button>
    </span>
  );
}
