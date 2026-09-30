"use client";
// Zajednički mali UI elementi za Bazu potencijala i Lidove (novi izgled)
import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsUpDown, X } from "lucide-react";

const DAY_MS = 24 * 60 * 60 * 1000;

export const fmtN = (n) => Number(n || 0).toLocaleString("hr-HR");

/* ---------- Inicijali i avatar kolege ---------- */
export function initials(name) {
  const parts = String(name || "").replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_BOJE = {
  "Belmin Hinović": "bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200",
  "Marijan Marković": "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200",
  "Vedran Kovačić": "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
  "Nikola Grden": "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200",
  "Marija Puškarić": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
};
const AVATAR_OSTALE = [
  "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-200",
  "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200",
  "bg-lime-100 text-lime-800 dark:bg-lime-900/50 dark:text-lime-200",
  "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/50 dark:text-fuchsia-200",
];
function avatarCls(name) {
  if (AVATAR_BOJE[name]) return AVATAR_BOJE[name];
  if (!name || /\(ex\)|_ex/i.test(name)) return "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_OSTALE[h % AVATAR_OSTALE.length];
}

export function Avatar({ name, size = "md", ring = false }) {
  const sz = size === "sm" ? "w-6 h-6 text-[10px]" : size === "lg" ? "w-8 h-8 text-xs" : "w-7 h-7 text-[11px]";
  return (
    <span title={name}
      className={"inline-flex items-center justify-center rounded-full font-bold shrink-0 " + sz + " " + avatarCls(name) +
        (ring ? " ring-2 ring-white dark:ring-slate-900" : "")}>
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ names, max = 3 }) {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <span className="inline-flex items-center" title={names.join(", ")}>
      {shown.map((n, i) => (
        <span key={n} className={i ? "-ml-1.5" : ""}><Avatar name={n} ring /></span>
      ))}
      {rest > 0 && <span className="-ml-1.5 inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 ring-2 ring-white dark:ring-slate-900">+{rest}</span>}
    </span>
  );
}

/* ---------- Status s tačkom ---------- */
const STATUS_PILL = {
  "Novi kontakt": ["bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-200", "bg-slate-400"],
  "U pregovorima": ["bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", "bg-blue-500"],
  "Ponuda poslana": ["bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300", "bg-violet-500"],
  "Na čekanju": ["bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300", "bg-amber-500"],
  Dobijen: ["bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-300", "bg-green-500"],
  Izgubljen: ["bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300", "bg-red-500"],
  Novi: ["bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-200", "bg-slate-400"],
  Kontaktiran: ["bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", "bg-blue-500"],
  Kvalifikovan: ["bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300", "bg-violet-500"],
  Konvertovan: ["bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-300", "bg-green-500"],
  Odbačen: ["bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300", "bg-red-500"],
};
export function StatusDot({ status }) {
  const dot = (STATUS_PILL[status] || STATUS_PILL["Novi kontakt"])[1];
  return <span className={"inline-block w-2 h-2 rounded-full shrink-0 " + dot} />;
}
export function StatusPill({ status }) {
  const [cls] = STATUS_PILL[status] || STATUS_PILL["Novi kontakt"];
  return (
    <span className={"inline-flex items-center gap-1.5 text-xs font-semibold pl-2 pr-2.5 py-0.5 rounded-full whitespace-nowrap " + cls}>
      <StatusDot status={status} /> {status || "—"}
    </span>
  );
}

/* ---------- Datumi ---------- */
export function daysAgo(dateStr) {
  if (!dateStr) return null;
  const d = new Date(String(dateStr).slice(0, 10) + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((t - d) / DAY_MS);
}
export function relDate(dateStr) {
  const n = daysAgo(dateStr);
  if (n == null) return "";
  if (n < 0) return `za ${-n} d.`;
  if (n === 0) return "danas";
  if (n === 1) return "jučer";
  if (n < 45) return `prije ${n} dana`;
  if (n < 365) return `prije ${Math.round(n / 30)} mj.`;
  const g = Math.floor(n / 365);
  return `prije ${g} ${g === 1 ? "godinu" : g < 5 ? "godine" : "godina"}`;
}
// boja "starosti" zadnjeg kontakta
export function ageCls(dateStr) {
  const n = daysAgo(dateStr);
  if (n == null) return "text-slate-400 dark:text-slate-500";
  if (n <= 30) return "text-green-700 dark:text-green-400";
  if (n <= 180) return "text-slate-700 dark:text-slate-300";
  if (n <= 365) return "text-amber-700 dark:text-amber-400";
  return "text-slate-400 dark:text-slate-500";
}

/* ---------- Filter kao "oznaka" (native select ispod, pa radi i na mobitelu) ---------- */
export function FilterPill({ label, value, defaultValue, options, onChange }) {
  const active = value !== defaultValue;
  return (
    <span className={"relative inline-flex items-center h-9 rounded-lg border text-[13px] whitespace-nowrap transition-colors " +
      (active
        ? "border-teal-300 bg-teal-50 text-teal-800 dark:border-teal-700 dark:bg-teal-900/30 dark:text-teal-200"
        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600")}>
      <span className="relative inline-flex items-center gap-1.5 pl-3 pr-2 h-full">
        <span className={active ? "opacity-75" : "text-slate-500 dark:text-slate-400"}>{label}:</span>
        <span className="font-semibold max-w-[160px] truncate">{value}</span>
        {!active && <ChevronDown size={13} className="text-slate-400" />}
        <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
          {options.map((o) => (typeof o === "string"
            ? <option key={o} value={o}>{o}</option>
            : <option key={o.value} value={o.value}>{o.label}</option>))}
        </select>
      </span>
      {active && (
        <button type="button" aria-label={`Ukloni filter ${label}`} onClick={() => onChange(defaultValue)}
          className="h-full pr-2 pl-0.5 text-teal-700 dark:text-teal-300 hover:text-teal-900 dark:hover:text-white">
          <X size={13} />
        </button>
      )}
    </span>
  );
}

/* ---------- Brzi prikaz (chip s brojem) ---------- */
export function ViewChip({ active, label, count, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={"inline-flex items-center gap-2 h-8 px-3.5 rounded-full border text-[13px] whitespace-nowrap transition-colors " +
        (active
          ? "bg-teal-600 border-teal-600 text-white font-semibold shadow-sm"
          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-teal-400 dark:hover:border-teal-600")}>
      {label}
      {count != null && (
        <span className={"text-[11px] px-1.5 rounded-full " + (active ? "bg-white/25" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400")}>{fmtN(count)}</span>
      )}
    </button>
  );
}

/* ---------- Dugme s padajućim menijem ---------- */
export function MenuButton({ label, icon: Icon, className, items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" className={className} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {Icon && <Icon size={15} />} {label} <ChevronDown size={13} className="opacity-60" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1.5 z-30 w-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-1.5">
          {items.map((it) => (
            <button key={it.label} type="button" onClick={() => { setOpen(false); it.onClick(); }}
              className="w-full text-left flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
              {it.icon && <it.icon size={16} className="mt-0.5 text-teal-600 shrink-0" />}
              <span>
                <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{it.label}</span>
                {it.hint && <span className="block text-xs text-slate-500 dark:text-slate-400">{it.hint}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Naslov kolone sa sortiranjem ---------- */
export function SortHead({ label, field, sort, setSort, descFirst, className = "" }) {
  const active = sort.field === field;
  return (
    <th className={"px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none " +
      (active ? "text-teal-700 dark:text-teal-400 " : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 ") + className}
      onClick={() => setSort({ field, dir: active ? (sort.dir === "asc" ? "desc" : "asc") : descFirst ? "desc" : "asc" })}>
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (sort.dir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : <ChevronsUpDown size={12} className="text-slate-300 dark:text-slate-600" />}
      </span>
    </th>
  );
}

/* ---------- Numerisana paginacija ---------- */
export function PageNav({ page, setPage, pageSize, setPageSize, total }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(page, totalPages);
  const from = total === 0 ? 0 : (p - 1) * pageSize + 1;
  const to = Math.min(p * pageSize, total);
  const nums = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - p) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  const navBtn = "w-8 h-8 inline-flex items-center justify-center rounded-md text-sm disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 text-[13px] text-slate-500 dark:text-slate-400">
      <div className="flex items-center gap-3">
        <span>{total === 0 ? "0 rezultata" : `${fmtN(from)}–${fmtN(to)} od ${fmtN(total)}`}</span>
        <label className="flex items-center gap-1.5">
          <span className="hidden sm:inline">po strani</span>
          <select className="text-[13px] rounded-md border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 bg-white dark:bg-slate-900"
            value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
            {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-0.5">
        <button type="button" aria-label="Prethodna strana" className={navBtn} disabled={p <= 1} onClick={() => setPage(p - 1)}><ChevronLeft size={16} /></button>
        {nums.map((n, i) => n === "…"
          ? <span key={"e" + i} className="w-6 text-center">…</span>
          : <button key={n} type="button" onClick={() => setPage(n)}
              className={"min-w-8 h-8 px-1.5 inline-flex items-center justify-center rounded-md text-sm " +
                (n === p ? "bg-teal-600 text-white font-semibold" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300")}>{n}</button>)}
        <button type="button" aria-label="Sljedeća strana" className={navBtn} disabled={p >= totalPages} onClick={() => setPage(p + 1)}><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

export function PanelLabel({ children, right }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{children}</span>
      {right}
    </div>
  );
}

export const headerBtnSec =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 h-9 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.97] transition-all";
