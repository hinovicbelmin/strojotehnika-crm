"use client";
import { useState, useRef, useEffect } from "react";
import { Lock, LogOut, Sun, Moon, ChevronsLeft, ChevronsRight, Check } from "lucide-react";
import { COLLEAGUES } from "../lib/crm";

// Raspored tabova u grupe (redoslijed = redoslijed u meniju)
const GROUPS = [
  { label: null, items: ["pregled"] },
  { label: "Prodaja", items: ["forecast", "potencijali", "lidovi", "akcije", "kalkulator", "cjenovnik"] },
  { label: "Kupci i podrška", items: ["kupci", "podrska", "nadogradnje", "kontakti"] },
  { label: "Moj dan", items: ["podsjetnici"] },
];

const DEPTS = ["Prodaja", "Tehnička podrška", "Marketing"];

function initialsOf(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

// Boje brojača: "alert" (crveno), "warn" (žuto), "muted" (sivo)
const BADGE_CLS = {
  alert: "bg-red-500 text-white",
  warn: "bg-amber-500/20 text-amber-300",
  muted: "bg-slate-800 text-slate-300",
};
const DOT_CLS = { alert: "bg-red-500", warn: "bg-amber-500", muted: "bg-slate-500" };

function Tooltip({ children }) {
  return (
    <span className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-100 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
      {children}
    </span>
  );
}

// Prikaz prijavljenog korisnika — ime je vezano za nalog (email), ne za računar
function UserInfo({ currentUser, accountEmail, onClose, collapsed }) {
  const ref = useRef(null);
  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [onClose]);
  return (
    <div ref={ref}
      className={"absolute z-50 w-64 rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/40 p-3 text-[12.5px] text-slate-300 " +
        (collapsed ? "left-full ml-3 bottom-0" : "left-0 right-0 bottom-full mb-2 w-auto")}>
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5"><Lock size={11} /> Prijavljen nalog</div>
      <div className="font-semibold text-slate-100">{currentUser || "—"}</div>
      {accountEmail && <div className="text-slate-400 truncate">{accountEmail}</div>}
      <p className="text-[11.5px] text-slate-500 mt-2 leading-snug">Ime je vezano za ovaj nalog i sve izmjene se bilježe pod njim. Za drugog kolegu — odjavi se i prijavi s njegovim podacima. Pogrešno ime? Javi administratoru CRM-a.</p>
    </div>
  );
}

// Jednokratni izbor imena za nalog koji još nije povezan s kolegom
function normAscii(s) {
  return (s || "").toLowerCase()
    .replace(/đ/g, "dj").replace(/[čć]/g, "c").replace(/š/g, "s").replace(/ž/g, "z")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
}
// Pogodi kolegu po emailu (npr. ahmed.mujkanovic@..., hinovicbelmin@...) — samo ako je jednoznačno
export function pogodiImePoEmailu(email) {
  const local = normAscii((email || "").split("@")[0]);
  if (!local) return "";
  const pogodci = COLLEAGUES.filter((c) => {
    const dijelovi = c.name.split(/\s+/).map((d) => normAscii(d)).filter(Boolean);
    const prezime = dijelovi[dijelovi.length - 1];
    const ime = dijelovi[0];
    return prezime && local.includes(prezime) && (local.includes(ime) || local.startsWith(ime[0]) || local.endsWith(ime[0]));
  });
  return pogodci.length === 1 ? pogodci[0].name : "";
}

export function ImeNalogaModal({ accountEmail, onConfirm, onSignOut }) {
  const [izbor, setIzbor] = useState(() => pogodiImePoEmailu(accountEmail));
  const [busy, setBusy] = useState(false);
  const [greska, setGreska] = useState("");
  const potvrdi = async () => {
    if (!izbor) return;
    setBusy(true); setGreska("");
    try { await onConfirm(izbor); } catch (e) { setGreska("Nije uspjelo spremanje. Pokušaj ponovo."); }
    setBusy(false);
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-transparent dark:border-slate-700 flex flex-col max-h-[90vh]">
        <div className="px-6 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Ko koristi ovaj nalog?</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Nalog <b className="text-slate-700 dark:text-slate-200">{accountEmail || "—"}</b> još nije povezan s imenom.
            Odaberi svoje ime — ovo se radi samo jednom, a nakon toga se sve izmjene s ovog naloga bilježe pod tim imenom, na svakom računaru.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {DEPTS.map((dept) => (
            <div key={dept}>
              <div className="px-3 pt-2.5 pb-1 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">{dept}</div>
              {COLLEAGUES.filter((c) => c.dept === dept).map((c) => {
                const active = c.name === izbor;
                return (
                  <button key={c.name} type="button" onClick={() => setIzbor(c.name)}
                    className={"w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors " +
                      (active ? "bg-teal-50 text-teal-800 dark:bg-teal-900/30 dark:text-teal-200 font-semibold" : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800")}>
                    <span className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-[10.5px] font-bold text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">{initialsOf(c.name)}</span>
                    <span className="flex-1 truncate">{c.name}</span>
                    {active && <Check size={15} />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
          {greska && <p className="text-xs text-red-600">{greska}</p>}
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={onSignOut} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 inline-flex items-center gap-1.5"><LogOut size={14} /> Nisam ja — odjavi</button>
            <button type="button" disabled={!izbor || busy} onClick={potvrdi}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
              <Check size={15} /> {busy ? "Spremam..." : izbor ? `Ja sam ${izbor.split(" ")[0]}` : "Odaberi ime"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({
  tabs, tab, onSelectTab, navOpen, isRestricted, badges,
  currentUser, currentDept, accountEmail, theme, onToggleTheme, onSignOut, collapsed, onToggleCollapsed,
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  // Na mobitelu (otvoren meni preko ekrana) uvijek pun prikaz
  const mini = collapsed && !navOpen;
  const tabById = Object.fromEntries(tabs.map((t) => [t.id, t]));

  return (
    <aside
      className={
        "bg-gradient-to-b from-slate-900 to-[#0b1324] dark:from-slate-950 dark:to-slate-950 text-slate-300 shrink-0 flex-col border-r border-transparent dark:border-slate-800 transition-[width] duration-200 " +
        (mini ? "w-[76px] " : "w-64 ") +
        (navOpen ? "flex fixed inset-y-0 left-0 z-40" : "hidden md:flex sticky top-0 h-screen")
      }
    >
      {/* Logo — u skupljenom meniju samo znak: zauzima lijevih 247 od 865 px širine slike, pa je na visini 30px širok ~51px */}
      <div className={mini ? "flex justify-center pt-5 pb-4" : "px-5 pt-6 pb-5"}>
        {mini ? (
          <div className="overflow-hidden flex items-center" style={{ width: 51, height: 30 }} title="Strojotehnika">
            <img src="/logo.png" alt="Strojotehnika" className="max-w-none" style={{ height: 30, width: "auto" }} />
          </div>
        ) : (
          <img src="/logo.png" alt="Strojotehnika" className="h-9 w-auto" />
        )}
      </div>

      {/* Tabovi */}
      <nav className={"flex-1 " + (mini ? "px-3.5 flex flex-col items-center" : "px-3 overflow-y-auto")}>
        {GROUPS.map((g, gi) => (
          <div key={gi} className={mini ? "w-full flex flex-col items-center gap-1.5" : "space-y-0.5"}>
            {g.label && (mini
              ? <div className="w-7 h-px bg-slate-800 my-2" />
              : <div className="px-3 pt-5 pb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">{g.label}</div>
            )}
            {g.items.map((id) => {
              const t = tabById[id];
              if (!t) return null;
              const Icon = t.icon;
              const active = tab === id;
              const restricted = isRestricted(id);
              const badge = !restricted && badges[id] && badges[id].count > 0 ? badges[id] : null;

              if (mini) {
                return (
                  <button
                    key={id}
                    onClick={() => onSelectTab(id)}
                    aria-label={t.label}
                    className={
                      "group relative w-12 h-11 rounded-xl flex items-center justify-center transition-colors duration-150 " +
                      (restricted
                        ? "text-slate-600 hover:bg-slate-800/40"
                        : active
                        ? "bg-teal-400/15 text-teal-300"
                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-100")
                    }
                  >
                    <Icon size={19} />
                    {restricted && <Lock size={10} className="absolute bottom-1.5 right-2" />}
                    {badge && (badge.tone === "alert"
                      ? <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-slate-900">{badge.count > 99 ? "99+" : badge.count}</span>
                      : <span className={"absolute top-2 right-2.5 w-2 h-2 rounded-full ring-2 ring-slate-900 " + DOT_CLS[badge.tone]} />
                    )}
                    <Tooltip>{t.label}{badge ? ` · ${badge.count}${badge.hint ? " " + badge.hint : ""}` : ""}{restricted ? " · nema pristupa" : ""}</Tooltip>
                  </button>
                );
              }

              return (
                <button
                  key={id}
                  onClick={() => onSelectTab(id)}
                  className={
                    "relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 " +
                    (restricted
                      ? "text-slate-600 font-medium hover:bg-slate-800/40"
                      : active
                      ? "bg-teal-400/[0.12] text-teal-300 font-semibold"
                      : "text-slate-400 font-medium hover:bg-slate-800/70 hover:text-slate-100")
                  }
                  title={badge && badge.hint ? `${badge.count} ${badge.hint}` : undefined}
                >
                  {active && !restricted && <span className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r bg-teal-400" />}
                  <Icon size={17} className="shrink-0" />
                  <span className="truncate">{t.label}</span>
                  {restricted && <Lock size={12} className="ml-auto shrink-0" />}
                  {badge && (
                    <span className={"ml-auto text-[11px] font-bold px-1.5 min-w-[20px] text-center py-px rounded-full " + BADGE_CLS[badge.tone]}>
                      {badge.count > 99 ? "99+" : badge.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Dno: korisnik + tema / skupi / odjava */}
      {mini ? (
        <div className="border-t border-slate-800 py-3.5 flex flex-col items-center gap-2">
          <button onClick={onToggleCollapsed} aria-label="Proširi meni" className="group relative w-10 h-9 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 flex items-center justify-center">
            <ChevronsRight size={17} /><Tooltip>Proširi meni</Tooltip>
          </button>
          <button onClick={onToggleTheme} aria-label="Promijeni temu" className="group relative w-10 h-9 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 flex items-center justify-center">
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}<Tooltip>{theme === "dark" ? "Svijetla tema" : "Tamna tema"}</Tooltip>
          </button>
          <button onClick={onSignOut} aria-label="Odjava" className="group relative w-10 h-9 rounded-lg text-red-300/80 hover:bg-slate-800 hover:text-red-300 flex items-center justify-center">
            <LogOut size={16} /><Tooltip>Odjava</Tooltip>
          </button>
          <div className="relative mt-1">
            <button
              onClick={() => setPickerOpen((o) => !o)}
              aria-label="Prijavljeni korisnik"
              className={"group relative w-10 h-10 rounded-full text-[13px] font-bold flex items-center justify-center " + (currentUser ? "bg-teal-600 text-white" : "bg-amber-500 text-slate-900")}
            >
              {currentUser ? initialsOf(currentUser) : "?"}
              {!pickerOpen && <Tooltip>{currentUser || "Nalog nije povezan s imenom"}</Tooltip>}
            </button>
            {pickerOpen && <UserInfo currentUser={currentUser} accountEmail={accountEmail} onClose={() => setPickerOpen(false)} collapsed />}
          </div>
        </div>
      ) : (
        <div className="border-t border-slate-800 p-3 space-y-2.5">
          <div className="relative">
            <button
              onClick={() => setPickerOpen((o) => !o)}
              className={"w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition-colors " + (currentUser ? "bg-slate-800/80 hover:bg-slate-800" : "bg-amber-500/15 hover:bg-amber-500/25 ring-1 ring-amber-500/40")}
            >
              <span className={"w-9 h-9 rounded-full text-[13px] font-bold flex items-center justify-center shrink-0 " + (currentUser ? "bg-teal-600 text-white" : "bg-amber-500 text-slate-900")}>
                {currentUser ? initialsOf(currentUser) : "?"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-slate-100 truncate">{currentUser || "Nalog nije povezan"}</span>
                <span className="block text-[11px] text-slate-400 truncate">{currentUser ? currentDept || "—" : accountEmail || "—"}</span>
              </span>
              <Lock size={13} className="text-slate-500 shrink-0" />
            </button>
            {pickerOpen && <UserInfo currentUser={currentUser} accountEmail={accountEmail} onClose={() => setPickerOpen(false)} />}
          </div>
          <div className="flex gap-1.5">
            <button onClick={onToggleTheme} className="flex-1 h-9 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-100 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors">
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />} Tema
            </button>
            {!navOpen && (
              <button onClick={onToggleCollapsed} className="flex-1 h-9 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-100 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors">
                <ChevronsLeft size={14} /> Skupi
              </button>
            )}
            <button onClick={onSignOut} className="flex-1 h-9 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-red-300/80 hover:text-red-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors">
              <LogOut size={14} /> Odjava
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
