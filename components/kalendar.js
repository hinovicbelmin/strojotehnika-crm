"use client";
// Kalendar — zajednički plan tima: teren, obuke, službeni put, sastanci, događaji, odsustva
import { useState, useMemo, useEffect } from "react";
import {
  Car, GraduationCap, Plane, Users, Video, Sun, Repeat, CalendarDays, MapPin, ChevronLeft, ChevronRight,
  Plus, Pencil, Trash2, History, Building2, Home, Check,
} from "lucide-react";
import { COLLEAGUES, inputCls, btnPrimary, btnSecondary, companyKey } from "../lib/crm";
import { Modal } from "./ui";
import { Avatar, initials } from "./crmBits";

/* ---------------------------------------------------------------------- */
/*  Postavke                                                               */
/* ---------------------------------------------------------------------- */

export const K_VRSTE = ["Teren", "Obuka", "Službeni put", "Sastanak", "Događaj", "Odsutan"];
const K_STIL = {
  Teren: { icon: Car, chip: "bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-800", dot: "bg-blue-500" },
  Obuka: { icon: GraduationCap, chip: "bg-violet-50 text-violet-800 border-violet-300 dark:bg-violet-900/40 dark:text-violet-200 dark:border-violet-800", dot: "bg-violet-500" },
  "Službeni put": { icon: Plane, chip: "bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800", dot: "bg-amber-500" },
  Sastanak: { icon: Users, chip: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600", dot: "bg-slate-400" },
  Događaj: { icon: Video, chip: "bg-teal-50 text-teal-800 border-teal-300 dark:bg-teal-900/40 dark:text-teal-200 dark:border-teal-800", dot: "bg-teal-500" },
  Odsutan: { icon: Sun, chip: "bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-800", dot: "bg-rose-500" },
};
const stil = (v) => K_STIL[v] || K_STIL.Sastanak;
const VAN_UREDA = ["Teren", "Službeni put", "Obuka", "Odsutan"];
const PONAVLJANJA = ["Ne ponavlja se", "Svake sedmice", "Svaki mjesec"];
const ODJELI = ["Prodaja", "Tehnička podrška", "Marketing"];
const URED = { "Belmin Hinović": "Zenica", "Ahmed Mujkanović": "Zenica" };
const DANI_KR = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];
const DANI_PUNI = ["ponedjeljak", "utorak", "srijeda", "četvrtak", "petak", "subota", "nedjelja"];
const MJESECI = ["januar", "februar", "mart", "april", "maj", "juni", "juli", "august", "septembar", "oktobar", "novembar", "decembar"];

/* ---------------------------------------------------------------------- */
/*  Datumi (YYYY-MM-DD, lokalno vrijeme, bez pomjeranja zbog vremenske zone) */
/* ---------------------------------------------------------------------- */

const p2 = (n) => String(n).padStart(2, "0");
export function danasIso() {
  const d = new Date();
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}
const toUtc = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number); return Date.UTC(y, m - 1, d); };
const fromUtc = (t) => { const d = new Date(t); return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`; };
export const addDays = (iso, n) => fromUtc(toUtc(iso) + n * 86400000);
export const diffDays = (a, b) => Math.round((toUtc(b) - toUtc(a)) / 86400000); // b - a
const dow = (iso) => (new Date(toUtc(iso)).getUTCDay() + 6) % 7; // 0 = ponedjeljak
export const pocetakSedmice = (iso) => addDays(iso, -dow(iso));
const dmy = (iso) => { const [, m, d] = iso.split("-").map(Number); return `${d}.${m}.`; };
const dmyg = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${d}.${m}.${y}.`; };
const validIso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").slice(0, 10));

function addMonthsIso(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const mm = m - 1 + n;
  const yy = y + Math.floor(mm / 12);
  const mo = ((mm % 12) + 12) % 12;
  const last = new Date(Date.UTC(yy, mo + 1, 0)).getUTCDate();
  return `${yy}-${p2(mo + 1)}-${p2(Math.min(d, last))}`;
}

// Sva pojavljivanja unosa u periodu [od, do] (uključivo) — za ponavljajuće unose više njih
export function pojavljivanja(u, od, doo) {
  if (!u || !validIso(u.datum_od)) return [];
  const s0 = String(u.datum_od).slice(0, 10);
  const e0 = validIso(u.datum_do) && String(u.datum_do).slice(0, 10) >= s0 ? String(u.datum_do).slice(0, 10) : s0;
  const len = diffDays(s0, e0);
  const until = validIso(u.ponavljanje_do) ? String(u.ponavljanje_do).slice(0, 10) : null;
  const out = [];
  const push = (s) => { const e = addDays(s, len); if (e >= od && s <= doo) out.push({ u, start: s, end: e }); };
  if (u.ponavljanje === "Svake sedmice") {
    let k = Math.max(0, Math.floor((diffDays(s0, od) - len) / 7));
    for (let i = 0; i < 400; i++, k++) {
      const s = addDays(s0, k * 7);
      if (s > doo || (until && s > until)) break;
      push(s);
    }
  } else if (u.ponavljanje === "Svaki mjesec") {
    const [y0, m0] = s0.split("-").map(Number);
    const [y1, m1] = od.split("-").map(Number);
    let k = Math.max(0, (y1 - y0) * 12 + (m1 - m0) - 2);
    for (let i = 0; i < 120; i++, k++) {
      const s = addMonthsIso(s0, k);
      if (s > doo || (until && s > until)) break;
      push(s);
    }
  } else {
    push(s0);
  }
  return out;
}

export function pojavljivanjaSvih(unosi, od, doo) {
  const out = [];
  for (const u of unosi || []) out.push(...pojavljivanja(u, od, doo));
  return out.sort((a, b) => a.start.localeCompare(b.start) || String(a.u.vrijeme_od || "").localeCompare(String(b.u.vrijeme_od || "")));
}

const osobeOf = (u) => (Array.isArray(u.osobe) ? u.osobe : []).filter(Boolean);
const firmeOf = (u) => (Array.isArray(u.firme) ? u.firme : []).filter(Boolean);
const naslovOf = (u) => (u.naslov || "").trim() || u.vrsta || "Unos";
function vrijemeTekst(u) {
  if (u.cijeli_dan !== false) return "";
  const a = (u.vrijeme_od || "").slice(0, 5), b = (u.vrijeme_do || "").slice(0, 5);
  return a && b ? `${a}–${b}` : a || "";
}
function periodTekst(o) {
  const vr = vrijemeTekst(o.u);
  if (o.start === o.end) return `${DANI_PUNI[dow(o.start)]} ${dmyg(o.start)}${vr ? " · " + vr : ""}`;
  return `${dmy(o.start)} – ${dmyg(o.end)}${vr ? " · " + vr : ""}`;
}
function podnaslov(u) {
  return [vrijemeTekst(u), u.vrsta === "Obuka" && u.uloga ? u.uloga.toLowerCase() : "", u.lokacija].filter(Boolean).join(" · ");
}
const ime1 = (n) => String(n || "").split(" ")[0];

/* ---------------------------------------------------------------------- */
/*  Mali dijelovi                                                          */
/* ---------------------------------------------------------------------- */

export function VrstaChip({ vrsta, active = true, onClick, count, filter = false }) {
  const s = stil(vrsta);
  const Icon = s.icon;
  const cls = "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-xs font-semibold whitespace-nowrap transition-colors " +
    (active ? s.chip : "bg-white text-slate-400 border-slate-200 dark:bg-slate-900 dark:text-slate-500 dark:border-slate-700" + (filter ? " line-through decoration-slate-300" : " hover:border-slate-300 hover:text-slate-600"));
  const inner = <><Icon size={12} />{vrsta}{count != null && <span className="opacity-75">{count}</span>}</>;
  return onClick ? <button type="button" onClick={onClick} className={cls} aria-pressed={active}>{inner}</button> : <span className={cls}>{inner}</span>;
}

function UnosKartica({ o, onClick, compact }) {
  const s = stil(o.u.vrsta);
  const Icon = s.icon;
  const sub = podnaslov(o.u);
  const vise = osobeOf(o.u).length > 1;
  return (
    <button type="button" onClick={onClick} title={`${naslovOf(o.u)} — ${periodTekst(o)}${osobeOf(o.u).length ? " · " + osobeOf(o.u).join(", ") : ""}`}
      className={"w-full h-full text-left rounded-lg border px-2 py-1 min-w-0 hover:shadow-md hover:brightness-[0.98] transition " + s.chip}>
      <span className="flex items-center gap-1 text-xs font-bold min-w-0">
        <Icon size={12} className="shrink-0" />
        <span className="truncate">{naslovOf(o.u)}</span>
        {vise && <Users size={11} className="shrink-0 opacity-70" />}
        {o.u.ponavljanje && o.u.ponavljanje !== "Ne ponavlja se" && <Repeat size={11} className="shrink-0 opacity-70" />}
      </span>
      {!compact && sub && <span className="block text-[11px] font-medium opacity-80 truncate">{sub}</span>}
    </button>
  );
}

/* ---------------------------------------------------------------------- */
/*  Prikaz: tim po sedmici                                                 */
/* ---------------------------------------------------------------------- */

const COLS_TIM = "minmax(170px, 210px) repeat(5, minmax(110px, 1fr)) minmax(64px, 0.45fr) minmax(64px, 0.45fr)";

function TimSedmica({ sedmica, ljudi, occ, danas, onNovi, onOtvori }) {
  const dani = Array.from({ length: 7 }, (_, i) => addDays(sedmica, i));
  // po osobi: [{o, c0, c1}] i trake (da se unosi ne preklapaju)
  const poOsobi = useMemo(() => {
    const m = new Map();
    for (const o of occ) {
      const c0 = Math.max(0, diffDays(sedmica, o.start));
      const c1 = Math.min(6, diffDays(sedmica, o.end));
      if (c1 < 0 || c0 > 6) continue;
      for (const n of osobeOf(o.u)) {
        if (!m.has(n)) m.set(n, []);
        m.get(n).push({ o, c0, c1 });
      }
    }
    for (const [n, arr] of m) {
      arr.sort((a, b) => a.c0 - b.c0 || (b.c1 - b.c0) - (a.c1 - a.c0));
      const trake = [];
      for (const x of arr) {
        let t = trake.findIndex((last) => x.c0 > last);
        if (t < 0) { trake.push(x.c1); t = trake.length - 1; } else trake[t] = x.c1;
        x.traka = t;
      }
      m.set(n, { items: arr, n: Math.max(1, trake.length) });
    }
    return m;
  }, [occ, sedmica]);

  const pozadina = (d, i) => (d === danas ? "bg-teal-50/70 dark:bg-teal-900/20" : i >= 5 ? "bg-slate-50 dark:bg-slate-800/40" : "");

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto">
      <div className="min-w-[980px]">
        <div className="grid sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800" style={{ gridTemplateColumns: COLS_TIM }}>
          <div className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 self-end">Osoba</div>
          {dani.map((d, i) => (
            <div key={d} className={"px-2.5 py-2 border-l border-slate-100 dark:border-slate-800 " + pozadina(d, i)}>
              <div className={"text-[11px] font-bold uppercase tracking-wide " + (d === danas ? "text-teal-700 dark:text-teal-400" : "text-slate-500 dark:text-slate-400")}>{DANI_KR[i]}</div>
              <div className={"text-[17px] font-extrabold flex items-center gap-1.5 " + (d === danas ? "text-teal-700 dark:text-teal-400" : "text-slate-900 dark:text-slate-100")}>
                {Number(d.slice(8))}.
                {d === danas && <span className="text-[10px] font-bold text-white bg-teal-600 rounded-full px-1.5 py-px">danas</span>}
              </div>
            </div>
          ))}
        </div>
        {ODJELI.map((odj) => {
          const grupa = ljudi.filter((c) => c.dept === odj);
          if (!grupa.length) return null;
          return (
            <div key={odj}>
              <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                {odj} <span className="font-semibold text-slate-400">{grupa.length}</span>
              </div>
              {grupa.map((c) => {
                const r = poOsobi.get(c.name) || { items: [], n: 1 };
                return (
                  <div key={c.name} className="grid border-b border-slate-100 dark:border-slate-800 last:border-b-0" style={{ gridTemplateColumns: COLS_TIM, gridTemplateRows: `repeat(${r.n}, minmax(46px, auto))` }}>
                    <div className="flex items-center gap-2.5 px-4 py-1.5 min-w-0" style={{ gridColumn: 1, gridRow: `1 / span ${r.n}` }}>
                      <Avatar name={c.name} />
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate">{c.name}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1"><MapPin size={10} />{URED[c.name] || "Zagreb"}</div>
                      </div>
                    </div>
                    {dani.map((d, i) => (
                      <button key={d} type="button" aria-label={`Novi unos: ${c.name}, ${dmyg(d)}`} onClick={() => onNovi({ osoba: c.name, datum: d })}
                        className={"border-l border-slate-100 dark:border-slate-800 hover:bg-teal-50 dark:hover:bg-teal-900/20 group relative " + pozadina(d, i)}
                        style={{ gridColumn: i + 2, gridRow: `1 / span ${r.n}` }}>
                        <Plus size={14} className="absolute right-1.5 top-1.5 text-teal-600 opacity-0 group-hover:opacity-100" />
                      </button>
                    ))}
                    {r.items.map((x, j) => (
                      <div key={x.o.u.id + "-" + x.o.start + "-" + j} className="relative z-[1] p-[3px] min-w-0" style={{ gridColumn: `${x.c0 + 2} / ${x.c1 + 3}`, gridRow: x.traka + 1 }}>
                        <UnosKartica o={x.o} onClick={() => onOtvori(x.o)} compact={x.c0 >= 5 && x.c1 === x.c0} />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Prikaz: mjesec                                                         */
/* ---------------------------------------------------------------------- */

function MjesecPrikaz({ mjesec, occ, danas, onDan, onOtvori, onNovi }) {
  const prvi = mjesec + "-01";
  const start = pocetakSedmice(prvi);
  const dani = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const mj = prvi.slice(0, 7);
  const poDanu = useMemo(() => {
    const m = new Map();
    for (const o of occ) {
      for (let d = o.start; d <= o.end; d = addDays(d, 1)) {
        if (!m.has(d)) m.set(d, []);
        m.get(d).push(o);
      }
    }
    return m;
  }, [occ]);
  const sedmica = dani[35].slice(0, 7) !== mj ? 5 : 6;
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800">
          {DANI_KR.map((d, i) => <div key={d} className={"px-2.5 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 " + (i >= 5 ? "bg-slate-50 dark:bg-slate-800/40" : "")}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {dani.slice(0, sedmica * 7).map((d, i) => {
            const u = d.slice(0, 7) === mj;
            const lista = poDanu.get(d) || [];
            return (
              <div key={d} className={"min-h-[104px] p-1.5 flex flex-col gap-1 border-slate-100 dark:border-slate-800 min-w-0 " + (i % 7 ? "border-l " : "") + (i >= 7 ? "border-t " : "") + (i % 7 >= 5 ? "bg-slate-50 dark:bg-slate-800/40" : "")}>
                <div className="flex items-center justify-between">
                  <button type="button" onClick={() => onDan(d)} title="Otvori sedmicu"
                    className={"min-w-[24px] h-6 px-1 rounded-full text-xs font-bold " + (d === danas ? "bg-teal-600 text-white" : u ? "text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800" : "text-slate-300 dark:text-slate-600")}>
                    {Number(d.slice(8))}
                  </button>
                  <button type="button" aria-label={`Novi unos ${dmyg(d)}`} onClick={() => onNovi({ datum: d })} className="w-6 h-6 rounded-md text-slate-300 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 inline-flex items-center justify-center"><Plus size={13} /></button>
                </div>
                {lista.slice(0, 3).map((o, j) => {
                  const s = stil(o.u.vrsta);
                  const os = osobeOf(o.u);
                  return (
                    <button key={o.u.id + "-" + j} type="button" onClick={() => onOtvori(o)} title={`${naslovOf(o.u)} — ${os.join(", ")}`}
                      className={"text-left text-[11px] font-semibold rounded-md border px-1.5 py-0.5 truncate " + s.chip}>
                      {os.length && os.length <= 3 ? os.map(initials).join(", ") + " · " : os.length > 3 ? `${os.length} osobe · ` : ""}{naslovOf(o.u)}
                    </button>
                  );
                })}
                {lista.length > 3 && (
                  <button type="button" onClick={() => onDan(d)} className="text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-teal-700 px-1">+{lista.length - 3} još</button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Prikaz: lista                                                          */
/* ---------------------------------------------------------------------- */

function ListaPrikaz({ occ, danas, onOtvori }) {
  const grupe = useMemo(() => {
    const m = new Map();
    for (const o of occ) {
      const k = o.start < danas ? danas : o.start;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(o);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [occ, danas]);
  if (!grupe.length) {
    return <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-10 text-center text-sm text-slate-500">Nema unosa u sljedećih 60 dana.</div>;
  }
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800">
      {grupe.map(([d, lista]) => (
        <div key={d} className="flex flex-col sm:flex-row gap-2 sm:gap-4 px-4 py-3">
          <div className="sm:w-36 shrink-0">
            <div className={"text-sm font-bold " + (d === danas ? "text-teal-700 dark:text-teal-400" : "text-slate-900 dark:text-slate-100")}>{d === danas ? "Danas" : d === addDays(danas, 1) ? "Sutra" : DANI_PUNI[dow(d)]}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{dmyg(d)}</div>
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            {lista.map((o, j) => {
              const s = stil(o.u.vrsta);
              const Icon = s.icon;
              return (
                <button key={o.u.id + "-" + j} type="button" onClick={() => onOtvori(o)} className="w-full flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-left">
                  <span className={"w-8 h-8 rounded-lg border inline-flex items-center justify-center shrink-0 " + s.chip}><Icon size={15} /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13.5px] font-semibold text-slate-900 dark:text-slate-100 truncate">{naslovOf(o.u)}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{[o.u.vrsta, o.start !== o.end ? `${dmy(o.start)}–${dmy(o.end)}` : "", podnaslov(o.u), firmeOf(o.u).join(", ")].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="flex -space-x-1.5 shrink-0">{osobeOf(o.u).slice(0, 4).map((n) => <Avatar key={n} name={n} size="sm" ring />)}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Detalj unosa                                                           */
/* ---------------------------------------------------------------------- */

function DetaljModal({ o, onClose, onEdit, onDelete, onUpisi, onViewCompany }) {
  const u = o.u;
  const s = stil(u.vrsta);
  const Icon = s.icon;
  const firme = firmeOf(u);
  const upisano = (Array.isArray(u.historija_upisana) ? u.historija_upisana : []).includes(o.start);
  const [busy, setBusy] = useState(false);
  const [potvrdaBrisanja, setPotvrdaBrisanja] = useState(false);
  const ponavlja = u.ponavljanje && u.ponavljanje !== "Ne ponavlja se";
  return (
    <Modal title={naslovOf(u)} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className={"w-10 h-10 rounded-xl border inline-flex items-center justify-center shrink-0 " + s.chip}><Icon size={19} /></span>
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{u.vrsta}{u.vrsta === "Obuka" && u.uloga ? ` · ${u.uloga.toLowerCase()}` : ""}</div>
            <div className="text-[13px] text-slate-600 dark:text-slate-300">{periodTekst(o)}</div>
          </div>
        </div>
        <div className="space-y-2 text-[13px] text-slate-700 dark:text-slate-300">
          <div className="flex items-start gap-2"><Users size={14} className="text-slate-400 mt-0.5 shrink-0" />
            <span className="flex flex-wrap gap-1.5">{osobeOf(u).map((n) => <span key={n} className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-full pl-0.5 pr-2 py-0.5"><Avatar name={n} size="sm" />{n}</span>)}</span>
          </div>
          {u.lokacija && <div className="flex items-center gap-2"><MapPin size={14} className="text-slate-400 shrink-0" />{u.lokacija}</div>}
          {firme.length > 0 && (
            <div className="flex items-start gap-2"><Building2 size={14} className="text-slate-400 mt-0.5 shrink-0" />
              <span className="flex flex-wrap gap-x-2 gap-y-1">{firme.map((f) => (
                <button key={f} type="button" onClick={() => onViewCompany && onViewCompany(f)} className="font-semibold text-teal-700 dark:text-teal-400 hover:underline text-left">{f}</button>
              ))}</span>
            </div>
          )}
          {ponavlja && <div className="flex items-center gap-2"><Repeat size={14} className="text-slate-400 shrink-0" />{u.ponavljanje}{validIso(u.ponavljanje_do) ? ` do ${dmyg(String(u.ponavljanje_do).slice(0, 10))}` : ""}</div>}
          {u.napomena && <div className="whitespace-pre-line bg-slate-50 dark:bg-slate-800/60 rounded-lg px-3 py-2">{u.napomena}</div>}
        </div>
        <div className="text-[11.5px] text-slate-500 dark:text-slate-400">Unio {u.created_by || "—"}{u.created_at ? ` · ${dmyg(String(u.created_at).slice(0, 10))}` : ""}{u.updated_by && u.updated_by !== u.created_by ? ` · zadnja izmjena ${u.updated_by}` : ""}</div>
        {firme.length > 0 && (
          upisano
            ? <div className="flex items-center gap-2 text-[13px] text-green-700 dark:text-green-400"><Check size={15} /> Upisano u historiju firmi za {dmyg(o.start)}</div>
            : <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await onUpisi(u, o.start); } finally { setBusy(false); } }} className={btnSecondary + " w-full justify-center"}>
                <History size={15} /> {busy ? "Upisujem…" : `Upiši u historiju ${firme.length === 1 ? "firme" : "firmi"} (Baza potencijala)`}
              </button>
        )}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          {potvrdaBrisanja ? (
            <span className="flex items-center gap-2 text-[13px] text-slate-700 dark:text-slate-300">
              {ponavlja ? "Obrisati sva ponavljanja?" : "Obrisati unos?"}
              <button type="button" onClick={() => { onDelete(u); onClose(); }} className="rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-2.5 py-1.5">Obriši</button>
              <button type="button" onClick={() => setPotvrdaBrisanja(false)} className="text-xs text-slate-500 hover:underline">Ne</button>
            </span>
          ) : (
            <button type="button" onClick={() => setPotvrdaBrisanja(true)} className="inline-flex items-center gap-1.5 text-[13px] text-red-600 dark:text-red-400 hover:underline"><Trash2 size={14} /> Obriši</button>
          )}
          <button type="button" onClick={() => onEdit(u)} className={btnPrimary}><Pencil size={14} /> Uredi</button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/*  Novi unos / izmjena                                                    */
/* ---------------------------------------------------------------------- */

const normTxt = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");

function FirmePolje({ value, onChange, sveFirme }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const pogodci = useMemo(() => {
    const t = normTxt(q.trim());
    if (t.length < 2) return [];
    const izabrane = new Set(value.map(companyKey));
    const out = [];
    for (const f of sveFirme) {
      if (izabrane.has(companyKey(f))) continue;
      const n = normTxt(f);
      if (n.includes(t)) out.push([n.startsWith(t) ? 0 : 1, f]);
      if (out.length > 60) break;
    }
    return out.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1])).slice(0, 8).map((x) => x[1]);
  }, [q, sveFirme, value]);
  const dodaj = (f) => { const v = f.trim(); if (v && !value.some((x) => companyKey(x) === companyKey(v))) onChange([...value, v]); setQ(""); };
  return (
    <div className="relative">
      <div className={inputCls + " flex flex-wrap items-center gap-1.5 min-h-[38px] py-1.5"}>
        {value.map((f) => (
          <span key={f} className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/40 border border-teal-200 dark:border-teal-800 rounded-md pl-1.5 pr-1 py-0.5">
            <Building2 size={11} />{f}
            <button type="button" aria-label={`Ukloni ${f}`} onClick={() => onChange(value.filter((x) => x !== f))} className="ml-0.5 text-teal-600 hover:text-red-600">×</button>
          </span>
        ))}
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (pogodci[0]) dodaj(pogodci[0]); else if (q.trim()) dodaj(q); } }}
          placeholder={value.length ? "dodaj još…" : "traži firmu…"} className="flex-1 min-w-[120px] bg-transparent outline-none text-sm" />
      </div>
      {open && (pogodci.length > 0 || q.trim().length >= 2) && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {pogodci.map((f) => (
            <button key={f} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => dodaj(f)} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"><Building2 size={13} className="text-slate-400" />{f}</button>
          ))}
          {!pogodci.some((f) => normTxt(f) === normTxt(q.trim())) && q.trim().length >= 2 && (
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => dodaj(q)} className="w-full text-left px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700">Dodaj „{q.trim()}“ (nije u bazi)</button>
          )}
        </div>
      )}
    </div>
  );
}

const Lbl = ({ children }) => <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">{children}</span>;

function UnosModal({ initial, preset, currentUser, sveFirme, onClose, onSave }) {
  const [f, setF] = useState(() => {
    if (initial) {
      return {
        vrsta: initial.vrsta || "Teren", naslov: initial.naslov || "", osobe: osobeOf(initial),
        datum_od: String(initial.datum_od || "").slice(0, 10), datum_do: String(initial.datum_do || initial.datum_od || "").slice(0, 10),
        cijeli_dan: initial.cijeli_dan !== false, vrijeme_od: (initial.vrijeme_od || "09:00").slice(0, 5), vrijeme_do: (initial.vrijeme_do || "").slice(0, 5),
        lokacija: initial.lokacija || "", uloga: initial.uloga || "Drži", ponavljanje: initial.ponavljanje || "Ne ponavlja se",
        ponavljanje_do: initial.ponavljanje_do ? String(initial.ponavljanje_do).slice(0, 10) : "", firme: firmeOf(initial),
        napomena: initial.napomena || "", podsjetnik: !!initial.podsjetnik,
      };
    }
    const d = (preset && preset.datum) || danasIso();
    const os = preset && preset.osoba ? [preset.osoba] : currentUser ? [currentUser] : [];
    return {
      vrsta: "Teren", naslov: "", osobe: os, datum_od: d, datum_do: d, cijeli_dan: true, vrijeme_od: "09:00", vrijeme_do: "",
      lokacija: "", uloga: "Drži", ponavljanje: "Ne ponavlja se", ponavljanje_do: "", firme: [], napomena: "", podsjetnik: false,
    };
  });
  const [greska, setGreska] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const toggleOsoba = (n) => set("osobe", f.osobe.includes(n) ? f.osobe.filter((x) => x !== n) : [...f.osobe, n]);

  const spremi = async () => {
    if (!f.osobe.length) return setGreska("Odaberi barem jednu osobu.");
    if (!validIso(f.datum_od)) return setGreska("Unesi datum početka.");
    const doo = validIso(f.datum_do) ? f.datum_do : f.datum_od;
    if (doo < f.datum_od) return setGreska("Datum završetka je prije početka.");
    if (!f.cijeli_dan && f.vrijeme_do && f.datum_od === doo && f.vrijeme_do < f.vrijeme_od) return setGreska("Vrijeme završetka je prije početka.");
    setGreska("");
    const payload = {
      vrsta: f.vrsta, naslov: f.naslov.trim(), osobe: f.osobe, datum_od: f.datum_od, datum_do: doo,
      cijeli_dan: f.cijeli_dan, vrijeme_od: f.cijeli_dan ? null : f.vrijeme_od || null, vrijeme_do: f.cijeli_dan ? null : f.vrijeme_do || null,
      lokacija: f.lokacija.trim(), uloga: f.vrsta === "Obuka" ? f.uloga : null, ponavljanje: f.ponavljanje,
      ponavljanje_do: f.ponavljanje !== "Ne ponavlja se" && validIso(f.ponavljanje_do) ? f.ponavljanje_do : null,
      firme: f.firme, napomena: f.napomena.trim(), podsjetnik: f.podsjetnik,
    };
    setBusy(true);
    try {
      const ok = await onSave(initial ? initial.id : null, payload);
      if (ok) onClose();
    } finally { setBusy(false); }
  };

  return (
    <Modal title={initial ? "Uredi unos" : "Novi unos u kalendar"} onClose={onClose} wide>
      <div className="space-y-4">
        <div>
          <Lbl>Vrsta</Lbl>
          <div className="flex flex-wrap gap-1.5">{K_VRSTE.map((v) => <VrstaChip key={v} vrsta={v} active={f.vrsta === v} onClick={() => set("vrsta", v)} />)}</div>
        </div>
        <label className="block">
          <Lbl>Naslov</Lbl>
          <input className={inputCls} value={f.naslov} onChange={(e) => set("naslov", e.target.value)}
            placeholder={{ Teren: "npr. Travnik — posjeta kupcima", Obuka: "npr. SOLIDWORKS Essentials", "Službeni put": "npr. Split — posjete kupcima", Sastanak: "npr. Prodajni sastanak", Događaj: "npr. Webinar: SOLIDWORKS novosti", Odsutan: "npr. Godišnji odmor" }[f.vrsta]} />
        </label>
        {f.vrsta === "Obuka" && (
          <div>
            <Lbl>Uloga</Lbl>
            <div className="inline-flex border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden">
              {["Drži", "Pohađa"].map((x, i) => (
                <button key={x} type="button" onClick={() => set("uloga", x)} aria-pressed={f.uloga === x}
                  className={"px-3.5 h-9 text-sm " + (i ? "border-l border-slate-300 dark:border-slate-600 " : "") + (f.uloga === x ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300")}>
                  {x === "Drži" ? "Drži obuku" : "Pohađa obuku"}
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <Lbl>Ko</Lbl>
          <div className="space-y-2">
            {ODJELI.map((odj) => (
              <div key={odj} className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-400 w-28 shrink-0">{odj}</span>
                {COLLEAGUES.filter((c) => c.dept === odj).map((c) => {
                  const on = f.osobe.includes(c.name);
                  return (
                    <button key={c.name} type="button" onClick={() => toggleOsoba(c.name)} aria-pressed={on}
                      className={"inline-flex items-center gap-1.5 h-8 pl-0.5 pr-2.5 rounded-full border text-[12.5px] transition-colors " + (on ? "bg-teal-50 border-teal-400 text-teal-900 dark:bg-teal-900/40 dark:border-teal-600 dark:text-teal-100 font-semibold" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300")}>
                      <Avatar name={c.name} size="sm" />{ime1(c.name)}{on && <Check size={12} />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block"><Lbl>Od</Lbl>
            <input type="date" className={inputCls} value={f.datum_od} onChange={(e) => { const v = e.target.value; setF((p) => ({ ...p, datum_od: v, datum_do: !p.datum_do || p.datum_do < v ? v : p.datum_do })); }} />
          </label>
          <label className="block"><Lbl>Do</Lbl>
            <input type="date" className={inputCls} value={f.datum_do} min={f.datum_od} onChange={(e) => set("datum_do", e.target.value)} />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={f.cijeli_dan} onChange={(e) => set("cijeli_dan", e.target.checked)} className="w-4 h-4 accent-teal-600" />
          Cijeli dan <span className="text-xs text-slate-400">(godišnji, obuka ili put preko više dana)</span>
        </label>
        {!f.cijeli_dan && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><Lbl>Vrijeme od</Lbl><input type="time" className={inputCls} value={f.vrijeme_od} onChange={(e) => set("vrijeme_od", e.target.value)} /></label>
            <label className="block"><Lbl>Vrijeme do</Lbl><input type="time" className={inputCls} value={f.vrijeme_do} onChange={(e) => set("vrijeme_do", e.target.value)} /></label>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block"><Lbl>Lokacija</Lbl><input className={inputCls} value={f.lokacija} onChange={(e) => set("lokacija", e.target.value)} placeholder="grad, kupac, online…" /></label>
          <label className="block"><Lbl>Ponavljanje</Lbl>
            <select className={inputCls} value={f.ponavljanje} onChange={(e) => set("ponavljanje", e.target.value)}>
              {PONAVLJANJA.map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
        </div>
        {f.ponavljanje !== "Ne ponavlja se" && (
          <label className="block"><Lbl>Ponavlja se do (prazno = bez kraja)</Lbl>
            <input type="date" className={inputCls + " sm:w-1/2"} value={f.ponavljanje_do} min={f.datum_od} onChange={(e) => set("ponavljanje_do", e.target.value)} />
          </label>
        )}
        <div><Lbl>Firme (nije obavezno) — iz Baze potencijala i Kupaca</Lbl><FirmePolje value={f.firme} onChange={(v) => set("firme", v)} sveFirme={sveFirme} /></div>
        <label className="block"><Lbl>Napomena</Lbl><textarea rows={2} className={inputCls} value={f.napomena} onChange={(e) => set("napomena", e.target.value)} /></label>
        <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={f.podsjetnik} onChange={(e) => set("podsjetnik", e.target.checked)} className="w-4 h-4 mt-0.5 accent-teal-600" />
          <span>Podsjeti me dan ranije<span className="block text-xs text-slate-400">pojavi se u Podsjetnicima svakoj osobi iz unosa</span></span>
        </label>
        {greska && <div className="text-sm text-red-600 dark:text-red-400">{greska}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnSecondary}>Otkaži</button>
          <button type="button" onClick={spremi} disabled={busy || !currentUser} className={btnPrimary}><Check size={15} /> {busy ? "Čuvam…" : "Sačuvaj"}</button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/*  Danas: ko je van ureda                                                  */
/* ---------------------------------------------------------------------- */

export function vanUredaDanas(unosi, dan = danasIso()) {
  const occ = pojavljivanjaSvih(unosi, dan, dan);
  const m = new Map(); // ime -> occ (prvi van ureda)
  for (const o of occ) {
    if (!VAN_UREDA.includes(o.u.vrsta)) continue;
    for (const n of osobeOf(o.u)) if (!m.has(n)) m.set(n, o);
  }
  return m;
}

function DanasTraka({ unosi, danas, ljudiSvi }) {
  const occ = pojavljivanjaSvih(unosi, danas, danas);
  const grupa = (vrste) => {
    const s = new Set();
    for (const o of occ) if (vrste.includes(o.u.vrsta)) osobeOf(o.u).forEach((n) => s.add(n));
    return [...s];
  };
  const teren = grupa(["Teren", "Službeni put"]);
  const obuka = grupa(["Obuka"]).filter((n) => !teren.includes(n));
  const odsutni = grupa(["Odsutan"]).filter((n) => !teren.includes(n) && !obuka.includes(n));
  const van = new Set([...teren, ...obuka, ...odsutni]);
  const uUredu = ljudiSvi.filter((c) => !van.has(c.name)).length;
  const blok = (Icon, cls, label, imena) => (
    <span className="inline-flex items-center gap-2 text-[13px] text-slate-700 dark:text-slate-300">
      <Icon size={15} className={cls} /> {label} <b>{imena.length}</b>
      {imena.length > 0 && <span className="flex -space-x-1">{imena.slice(0, 6).map((n) => <Avatar key={n} name={n} size="sm" ring />)}</span>}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3">
      <b className="text-[13px] text-slate-900 dark:text-slate-100">Danas, {DANI_PUNI[dow(danas)]} {dmy(danas)}:</b>
      {blok(Car, "text-blue-600", "Na terenu ili putu", teren)}
      <span className="w-px h-5 bg-slate-200 dark:bg-slate-700 hidden sm:block" />
      {blok(GraduationCap, "text-violet-600", "Na obuci", obuka)}
      <span className="w-px h-5 bg-slate-200 dark:bg-slate-700 hidden sm:block" />
      {blok(Sun, "text-rose-600", "Odsutni", odsutni)}
      <span className="w-px h-5 bg-slate-200 dark:bg-slate-700 hidden sm:block" />
      <span className="inline-flex items-center gap-2 text-[13px] text-slate-700 dark:text-slate-300"><Home size={15} className="text-slate-500" /> U uredu <b>{uUredu}</b></span>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Glavni tab                                                             */
/* ---------------------------------------------------------------------- */

export function KalendarTab({ unosi = [], potencijali = [], kupci = [], currentUser, onSave, onDelete, onUpisiHistoriju, onViewCompany }) {
  const [danas, setDanas] = useState(danasIso);
  useEffect(() => { const t = setInterval(() => setDanas(danasIso()), 60000); return () => clearInterval(t); }, []);
  const [prikaz, setPrikaz] = useState("tim");
  const [sedmica, setSedmica] = useState(() => pocetakSedmice(danasIso()));
  const [mjesec, setMjesec] = useState(() => danasIso().slice(0, 7));
  const [odjel, setOdjel] = useState("Svi");
  const [skrivene, setSkrivene] = useState([]);
  const [modal, setModal] = useState(null); // { initial } | { preset }
  const [detalj, setDetalj] = useState(null); // occ

  const sveFirme = useMemo(() => {
    const m = new Map();
    for (const x of potencijali) if (x.naziv_firme) { const k = companyKey(x.naziv_firme); if (k && !m.has(k)) m.set(k, x.naziv_firme.trim()); }
    for (const x of kupci) if (x.naziv_firme) { const k = companyKey(x.naziv_firme); if (k && !m.has(k)) m.set(k, x.naziv_firme.trim()); }
    return [...m.values()].sort((a, b) => a.localeCompare(b));
  }, [potencijali, kupci]);

  const ljudi = useMemo(() => {
    if (odjel === "Samo ja") return COLLEAGUES.filter((c) => c.name === currentUser);
    if (odjel === "Svi") return COLLEAGUES;
    return COLLEAGUES.filter((c) => c.dept === odjel);
  }, [odjel, currentUser]);
  const imenaLjudi = useMemo(() => new Set(ljudi.map((c) => c.name)), [ljudi]);
  const vidljivi = useMemo(() => unosi.filter((u) => !skrivene.includes(u.vrsta) && osobeOf(u).some((n) => imenaLjudi.has(n) || (odjel === "Svi" && !COLLEAGUES.some((c) => c.name === n)))), [unosi, skrivene, imenaLjudi, odjel]);

  const raspon = prikaz === "tim" ? [sedmica, addDays(sedmica, 6)]
    : prikaz === "mjesec" ? [pocetakSedmice(mjesec + "-01"), addDays(pocetakSedmice(mjesec + "-01"), 41)]
    : [danas, addDays(danas, 60)];
  const occ = useMemo(() => pojavljivanjaSvih(vidljivi, raspon[0], raspon[1]), [vidljivi, raspon[0], raspon[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  const brojPoVrsti = useMemo(() => {
    const m = {};
    for (const o of pojavljivanjaSvih(unosi.filter((u) => osobeOf(u).some((n) => imenaLjudi.has(n))), raspon[0], raspon[1])) m[o.u.vrsta] = (m[o.u.vrsta] || 0) + 1;
    return m;
  }, [unosi, imenaLjudi, raspon[0], raspon[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  // ako je detalj otvoren, a unos izmijenjen/obrisan — osvježi ili zatvori
  useEffect(() => {
    if (!detalj) return;
    const u = unosi.find((x) => x.id === detalj.u.id);
    if (!u) setDetalj(null);
    else if (u !== detalj.u) setDetalj({ ...detalj, u });
  }, [unosi]); // eslint-disable-line react-hooks/exhaustive-deps

  const naprijed = (n) => {
    if (prikaz === "tim") setSedmica((s) => addDays(s, 7 * n));
    else if (prikaz === "mjesec") setMjesec((m) => addMonthsIso(m + "-01", n).slice(0, 7));
  };
  const naDanas = () => { setSedmica(pocetakSedmice(danasIso())); setMjesec(danasIso().slice(0, 7)); };
  const naslovPerioda = prikaz === "tim"
    ? (() => { const k = addDays(sedmica, 6); return sedmica.slice(5, 7) === k.slice(5, 7) ? `${Number(sedmica.slice(8))}.–${Number(k.slice(8))}. ${MJESECI[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}.` : `${dmy(sedmica)} – ${dmyg(k)}`; })()
    : prikaz === "mjesec" ? `${MJESECI[Number(mjesec.slice(5, 7)) - 1][0].toUpperCase()}${MJESECI[Number(mjesec.slice(5, 7)) - 1].slice(1)} ${mjesec.slice(0, 4)}.`
    : "Od danas, sljedećih 60 dana";

  const segBtn = (id, label) => (
    <button key={id} type="button" onClick={() => setPrikaz(id)} aria-pressed={prikaz === id}
      className={"h-9 px-3.5 text-sm " + (id !== "tim" ? "border-l border-slate-300 dark:border-slate-600 " : "") + (prikaz === id ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700")}>
      {label}
    </button>
  );
  const chipF = (x) => (
    <button key={x} type="button" onClick={() => setOdjel(x)} aria-pressed={odjel === x}
      className={"h-8 px-3 rounded-full border text-[12.5px] whitespace-nowrap transition-colors " + (odjel === x ? "bg-teal-600 border-teal-600 text-white font-semibold" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300")}>
      {x}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Kalendar</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Ko je na terenu, na obuci, na putu ili odsutan — cijeli tim na jednom mjestu. Svako unosi svoje planove.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden">
            {segBtn("tim", "Tim · sedmica")}{segBtn("mjesec", "Mjesec")}{segBtn("lista", "Lista")}
          </div>
          <button type="button" className={btnPrimary} onClick={() => setModal({ preset: null })} disabled={!currentUser}><Plus size={16} /> Novi unos</button>
        </div>
      </div>

      <DanasTraka unosi={unosi} danas={danas} ljudiSvi={COLLEAGUES} />

      <div className="flex flex-wrap items-center gap-2">
        {prikaz !== "lista" && (
          <>
            <button type="button" aria-label="Prethodno" onClick={() => naprijed(-1)} className={btnSecondary + " !px-2 h-9"}><ChevronLeft size={16} /></button>
            <button type="button" onClick={naDanas} className={btnSecondary + " h-9"}>Danas</button>
            <button type="button" aria-label="Sljedeće" onClick={() => naprijed(1)} className={btnSecondary + " !px-2 h-9"}><ChevronRight size={16} /></button>
          </>
        )}
        <b className="text-base text-slate-900 dark:text-slate-100 mx-1.5 whitespace-nowrap">{naslovPerioda}</b>
        <div className="flex flex-wrap gap-1.5">{["Svi", ...ODJELI, ...(currentUser ? ["Samo ja"] : [])].map(chipF)}</div>
        <span className="flex-1" />
        <div className="flex flex-wrap gap-1.5">
          {K_VRSTE.map((v) => (
            <VrstaChip key={v} vrsta={v} filter active={!skrivene.includes(v)} count={brojPoVrsti[v] || null}
              onClick={() => setSkrivene((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]))} />
          ))}
        </div>
      </div>

      {prikaz === "tim" && <TimSedmica sedmica={sedmica} ljudi={ljudi} occ={occ} danas={danas} onNovi={(p) => setModal({ preset: p })} onOtvori={setDetalj} />}
      {prikaz === "mjesec" && <MjesecPrikaz mjesec={mjesec} occ={occ} danas={danas} onOtvori={setDetalj} onNovi={(p) => setModal({ preset: p })}
        onDan={(d) => { setSedmica(pocetakSedmice(d)); setPrikaz("tim"); }} />}
      {prikaz === "lista" && <ListaPrikaz occ={occ} danas={danas} onOtvori={setDetalj} />}

      {prikaz === "tim" && (
        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <CalendarDays size={13} /> Klik na prazno polje dodaje unos za tu osobu i dan. Prazno polje = u uredu.
          <Users size={12} className="ml-1" /> zajednički unos · <Repeat size={12} /> ponavlja se
        </p>
      )}

      {modal && (
        <UnosModal initial={modal.initial || null} preset={modal.preset || null} currentUser={currentUser} sveFirme={sveFirme}
          onClose={() => setModal(null)} onSave={onSave} />
      )}
      {detalj && !modal && (
        <DetaljModal o={detalj} onClose={() => setDetalj(null)} onEdit={(u) => { setDetalj(null); setModal({ initial: u }); }}
          onDelete={onDelete} onUpisi={onUpisiHistoriju} onViewCompany={(f) => { setDetalj(null); onViewCompany && onViewCompany(f); }} />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Za druge tabove                                                         */
/* ---------------------------------------------------------------------- */

// Podsjetnici: moji unosi danas + sutrašnji s "Podsjeti me dan ranije"
export function KalendarDanasBlok({ unosi = [], currentUser, onOpen }) {
  const danas = danasIso();
  const sutra = addDays(danas, 1);
  if (!currentUser) return null;
  const moji = unosi.filter((u) => osobeOf(u).includes(currentUser));
  const dn = pojavljivanjaSvih(moji, danas, danas).map((o) => ({ o, kada: o.start === o.end ? (vrijemeTekst(o.u) || "cijeli dan") : `do ${dmy(o.end)}` }));
  const st = pojavljivanjaSvih(moji.filter((u) => u.podsjetnik), sutra, sutra).filter((o) => o.start === sutra).map((o) => ({ o, sutra: true, kada: vrijemeTekst(o.u) || "sutra" }));
  const sve = [...dn, ...st];
  if (!sve.length) return null;
  return (
    <div className="mb-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 inline-flex items-center gap-1.5"><CalendarDays size={13} /> Danas u kalendaru</span>
        {onOpen && <button type="button" onClick={onOpen} className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline">Otvori kalendar</button>}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {sve.map(({ o, sutra: s, kada }, i) => {
          const sv = stil(o.u.vrsta);
          const Icon = sv.icon;
          return (
            <button key={o.u.id + "-" + i} type="button" onClick={onOpen} className={"flex items-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-semibold text-left " + sv.chip}>
              <Icon size={14} className="shrink-0" />
              <span className="flex-1 min-w-0 truncate">{s ? "Sutra: " : ""}{naslovOf(o.u)}{o.u.lokacija ? ` — ${o.u.lokacija}` : ""}</span>
              <span className="font-medium opacity-80 whitespace-nowrap">{kada}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Pregled: traka "Ko je danas van ureda"
export function VanUredaTraka({ unosi = [], onOpen }) {
  const m = vanUredaDanas(unosi);
  if (!m.size) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3">
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-1 inline-flex items-center gap-1.5"><CalendarDays size={13} /> Danas van ureda</span>
      {[...m.entries()].map(([n, o]) => {
        const s = stil(o.u.vrsta);
        return (
          <button key={n} type="button" onClick={onOpen} title={`${n}: ${naslovOf(o.u)}`} className={"inline-flex items-center gap-1.5 h-8 pl-0.5 pr-2.5 rounded-full border text-xs font-semibold " + s.chip}>
            <Avatar name={n} size="sm" />{ime1(n)} · {o.u.vrsta === "Odsutan" ? "odsutan" : o.u.lokacija || naslovOf(o.u)}
          </button>
        );
      })}
    </div>
  );
}

// Profil firme 360°: posjete i obuke (zadnjih 180 i sljedećih 120 dana)
export function kalendarZaFirmu(unosi = [], naziv) {
  const k = companyKey(naziv);
  if (!k) return [];
  const sa = unosi.filter((u) => firmeOf(u).some((f) => companyKey(f) === k));
  const d = danasIso();
  return pojavljivanjaSvih(sa, addDays(d, -180), addDays(d, 120)).reverse();
}
export function KalendarFirmeSekcija({ unosi = [], naziv }) {
  const lista = kalendarZaFirmu(unosi, naziv);
  if (!lista.length) return null;
  const d = danasIso();
  return (
    <div className="mb-6">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
        <CalendarDays size={13} /> Kalendar — posjete i obuke ({lista.length})
      </h4>
      <div className="space-y-1.5">
        {lista.slice(0, 8).map((o, i) => {
          const s = stil(o.u.vrsta);
          const Icon = s.icon;
          return (
            <div key={o.u.id + "-" + i} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg px-3 py-2 text-sm">
              <span className={"w-7 h-7 rounded-lg border inline-flex items-center justify-center shrink-0 " + s.chip}><Icon size={13} /></span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">{dmyg(o.start)}{o.end !== o.start ? `–${dmyg(o.end)}` : ""} · {o.u.vrsta} · {naslovOf(o.u)}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{osobeOf(o.u).join(", ")}</div>
              </div>
              {o.start > d && <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/40 rounded-full px-2 py-0.5">planirano</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Opis za historiju firme (Baza potencijala)
export function opisZaHistoriju(u) {
  const dio = [`${u.vrsta}${u.vrsta === "Obuka" && u.uloga ? ` (${u.uloga.toLowerCase()})` : ""}: ${naslovOf(u)}`];
  if (u.napomena) dio.push(u.napomena);
  const os = osobeOf(u);
  if (os.length) dio.push(`(${os.join(", ")})`);
  return dio.join(" — ").replace(" — (", " (");
}
