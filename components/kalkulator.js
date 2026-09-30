"use client";
// Kalkulator zarade i Cjenovnik (Prodaja)
import { useState, useMemo, useEffect, useRef } from "react";
import {
  Calculator, Tags, Plus, Search, Trash2, Copy, Save, FileText, Link2, CornerDownRight, Check, AlertTriangle,
  Lock, Building2, Pencil, Upload, List, X, ExternalLink,
} from "lucide-react";
import { inputCls, btnPrimary, btnSecondary, btnGhostIcon, fmtDate, companyKey } from "../lib/crm";
import { Modal, Field, EmptyState, SearchBox, ConfirmDelete, ImportModal } from "./ui";
import { Avatar, StatusPill, FilterPill, PanelLabel, headerBtnSec, fmtN } from "./crmBits";

/* ---------------------------------------------------------------------- */
/*  Postavke                                                               */
/* ---------------------------------------------------------------------- */

// Ko smije mijenjati cjenovnik (dodaj ime ako treba još neko)
export const CJENOVNIK_ADMINI = ["Belmin Hinović"];
export const MIN_ZARADA_PCT = 10; // upozorenje ako stavka padne ispod ovog % zarade
const OZNAKE = [
  { k: "PLC", opis: "trajna licenca" },
  { k: "ALC", opis: "godišnje održavanje trajne licence" },
  { k: "YLC", opis: "godišnja pretplata" },
  { k: "QLC", opis: "tromjesečna pretplata" },
];
const OZNAKA_CLS = {
  PLC: "bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200",
  ALC: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200",
  YLC: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
  QLC: "bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-200",
};

/* ---------------------------------------------------------------------- */
/*  Pomoćne funkcije                                                       */
/* ---------------------------------------------------------------------- */

const EUR = new Intl.NumberFormat("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const eur = (v) => `${EUR.format(Number(v) || 0)} €`;
const pct = (v) => `${(Math.round((Number(v) || 0) * 10) / 10).toLocaleString("hr-HR")}%`;
const broj = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
function danasIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// "4.920,00" / "4920" / "4920.5" / "4 920 €" -> broj
export function parseBroj(s) {
  if (s == null) return null;
  if (typeof s === "number") return s;
  let t = String(s).replace(/[€\s]/g, "").replace(/eur/i, "");
  if (!t) return null;
  if (t.includes(",") && t.includes(".")) t = t.lastIndexOf(",") > t.lastIndexOf(".") ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  else if (t.includes(",")) t = t.replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
const osnovaNabave = (p) => (p.cijena_osnova != null && p.cijena_osnova !== "" ? broj(p.cijena_osnova) : broj(p.cijena_kupac));
const novaKljuc = () => Math.random().toString(36).slice(2, 10);

// Izračun jedne stavke: nabava = osnova − margin, pa − dodatni popust (jedan na drugi); prodaja = cijena za kupca − popust kupcu
export function izracunStavke(s) {
  const kom = Math.max(0, broj(s.kom));
  const nabKom = broj(s.cijena_osnova) * (1 - broj(s.margin) / 100) * (1 - broj(s.dod_popust) / 100);
  const prodKom = broj(s.cijena_kupac) * (1 - broj(s.popust_kupac) / 100);
  const zarKom = prodKom - nabKom;
  const maxPopust = broj(s.cijena_kupac) > 0 ? Math.max(0, (1 - nabKom / ((1 - MIN_ZARADA_PCT / 100) * broj(s.cijena_kupac))) * 100) : 0;
  return {
    kom, nabKom, prodKom, zarKom, maxPopust: Math.floor(maxPopust * 10) / 10,
    katalog: broj(s.cijena_kupac) * kom, nabava: nabKom * kom, prodaja: prodKom * kom, zarada: zarKom * kom,
    zaradaPct: prodKom > 0 ? (zarKom / prodKom) * 100 : 0,
  };
}
export function izracunUkupno(stavke) {
  const t = { katalog: 0, nabava: 0, prodaja: 0, zarada: 0, kom: 0 };
  for (const s of stavke) {
    const r = izracunStavke(s);
    t.katalog += r.katalog; t.nabava += r.nabava; t.prodaja += r.prodaja; t.zarada += r.zarada; t.kom += r.kom;
  }
  t.popust = t.katalog - t.prodaja;
  t.zaradaPct = t.prodaja > 0 ? (t.zarada / t.prodaja) * 100 : 0;
  return t;
}
function stavkaIzProizvoda(p, parentKey = null, kom = 1) {
  return {
    key: novaKljuc(), proizvod_id: p.id, naziv: p.naziv, oznaka: p.oznaka || "", opis: p.opis || "", grupa: p.grupa || "",
    kom, cijena_kupac: broj(p.cijena_kupac), cijena_osnova: osnovaNabave(p), margin: p.margin ?? 35,
    dod_popust: 0, popust_kupac: 0, parentKey,
  };
}

function OznakaChip({ oznaka }) {
  if (!oznaka) return null;
  return <span className={"text-[11px] font-bold tracking-wide px-1.5 py-px rounded-md " + (OZNAKA_CLS[oznaka] || "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300")}>{oznaka}</span>;
}

// Unos procenta / količine (lokalni tekst, da se može kucati "12,5")
function BrojInput({ value, onChange, unit, min = 0, max, step = "any", className = "", ariaLabel, tone }) {
  const prikaz = (v) => String(v ?? "").replace(".", ",");
  const [txt, setTxt] = useState(prikaz(value));
  useEffect(() => { if (parseBroj(txt) !== Number(value)) setTxt(prikaz(value)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [value]);
  const ring = tone === "teal" ? "border-teal-300 dark:border-teal-700" : tone === "blue" ? "border-blue-300 dark:border-blue-700" : tone === "warn" ? "border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20" : "border-slate-300 dark:border-slate-600";
  return (
    <span className={"inline-flex items-center h-8 rounded-lg border bg-white dark:bg-slate-900 px-2 focus-within:ring-2 focus-within:ring-teal-500 " + ring + " " + className}>
      <input inputMode="decimal" aria-label={ariaLabel} value={txt}
        onChange={(e) => {
          setTxt(e.target.value);
          const n = parseBroj(e.target.value);
          if (n != null) onChange(Math.max(min, max != null ? Math.min(max, n) : n));
          else if (e.target.value.trim() === "") onChange(0);
        }}
        onBlur={() => setTxt(prikaz(value))}
        className="w-full min-w-0 bg-transparent text-right text-[13.5px] font-semibold text-slate-900 dark:text-slate-100 focus:outline-none tabular-nums" />
      {unit && <span className="text-xs text-slate-400 ml-0.5">{unit}</span>}
    </span>
  );
}

/* ---------------------------------------------------------------------- */
/*  PDF za kupca (bez naše nabavne cijene i zarade)                       */
/* ---------------------------------------------------------------------- */

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function otvoriPdfZaKupca(k) {
  const t = izracunUkupno(k.stavke);
  const redovi = k.stavke.map((s) => {
    const r = izracunStavke(s);
    return `<tr>
      <td><b>${esc(s.naziv)}</b> <span class="oz">${esc(s.oznaka)}</span>${s.opis ? `<div class="op">${esc(s.opis)}</div>` : ""}</td>
      <td class="c">${r.kom}</td><td class="r">${eur(s.cijena_kupac)}</td>
      <td class="c">${broj(s.popust_kupac) ? pct(s.popust_kupac) : "—"}</td>
      <td class="r">${eur(r.prodKom)}</td><td class="r"><b>${eur(r.prodaja)}</b></td></tr>`;
  }).join("");
  const html = `<!doctype html><html lang="bs"><head><meta charset="utf-8"><title>${esc(k.naziv || "Ponuda")}</title>
<style>
  body{font-family:-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#0f172a;margin:40px;font-size:13px}
  h1{font-size:22px;margin:0 0 4px} .muted{color:#64748b} .top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px}
  .firma{font-size:15px;font-weight:700} table{width:100%;border-collapse:collapse;margin-top:8px}
  th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;text-align:left;border-bottom:2px solid #e2e8f0;padding:8px 6px}
  td{border-bottom:1px solid #f1f5f9;padding:9px 6px;vertical-align:top} .r{text-align:right;white-space:nowrap} .c{text-align:center}
  .oz{font-size:10px;font-weight:700;background:#f1f5f9;border-radius:4px;padding:1px 5px;margin-left:4px} .op{font-size:11.5px;color:#64748b;margin-top:2px}
  .tot{margin-left:auto;margin-top:18px;width:330px} .tot div{display:flex;justify-content:space-between;padding:5px 0}
  .tot .big{font-size:16px;font-weight:700;border-top:2px solid #0f172a;margin-top:4px;padding-top:9px}
  .note{margin-top:34px;font-size:11.5px;color:#64748b} @media print{body{margin:18mm}}
</style></head><body>
<div class="top"><div><div class="muted">Strojotehnika d.o.o.</div><h1>${esc(k.naziv || "Ponuda")}</h1><div class="muted">Datum: ${esc(fmtDate(k.datum))}${k.prodavac ? ` · ${esc(k.prodavac)}` : ""}</div></div>
<div style="text-align:right"><div class="muted">Kupac</div><div class="firma">${esc(k.firma || "—")}</div></div></div>
<table><thead><tr><th>Proizvod</th><th class="c">Kom.</th><th class="r">Kataloška cijena</th><th class="c">Popust</th><th class="r">Cijena / kom.</th><th class="r">Ukupno</th></tr></thead><tbody>${redovi}</tbody></table>
<div class="tot"><div><span class="muted">Kataloška vrijednost</span><span>${eur(t.katalog)}</span></div>
<div><span class="muted">Popust</span><span>− ${eur(t.popust)}</span></div>
<div class="big"><span>Ukupno za platiti</span><span>${eur(t.prodaja)}</span></div></div>
<div class="note">Cijene su izražene u EUR, bez PDV-a.${k.napomena ? `<br>${esc(k.napomena)}` : ""}</div>
<script>window.onload=function(){setTimeout(function(){window.print()},250)}</script></body></html>`;
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}

/* ---------------------------------------------------------------------- */
/*  KALKULATOR ZARADE                                                     */
/* ---------------------------------------------------------------------- */

export function praznaKalkulacija(currentUser) {
  return { id: null, naziv: "", firma: "", potencijal_id: null, prodavac: currentUser || "", datum: danasIso(), stavke: [], napomena: "", _izmjena: false };
}

function DodajProizvod({ cjenovnik, onPick }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [aktivni, setAktivni] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const pogodci = useMemo(() => {
    const aktivniP = cjenovnik.filter((p) => p.aktivan !== false);
    const t = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const lista = t.length ? aktivniP.filter((p) => t.every((w) => `${p.naziv} ${p.oznaka} ${p.grupa} ${p.opis}`.toLowerCase().includes(w))) : aktivniP;
    return lista.slice(0, 10);
  }, [q, cjenovnik]);
  useEffect(() => { setAktivni(0); }, [q]);
  const imaAlc = (p) => p.oznaka === "PLC" && cjenovnik.some((x) => x.aktivan !== false && x.oznaka === "ALC" && x.naziv === p.naziv);
  const izaberi = (p) => { onPick(p); setQ(""); setOpen(false); };
  return (
    <div className="relative w-full sm:w-[460px]" ref={ref}>
      <div className="flex items-center gap-2 h-10 rounded-lg border-2 border-dashed border-teal-300 dark:border-teal-700 bg-white dark:bg-slate-900 px-3 focus-within:border-solid focus-within:border-teal-500">
        <Search size={15} className="text-teal-700 dark:text-teal-400 shrink-0" />
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setAktivni((a) => Math.min(a + 1, pogodci.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setAktivni((a) => Math.max(a - 1, 0)); }
            else if (e.key === "Enter" && pogodci[aktivni]) { e.preventDefault(); izaberi(pogodci[aktivni]); }
            else if (e.key === "Escape") setOpen(false);
          }}
          aria-label="Dodaj proizvod iz cjenovnika" placeholder="Dodaj proizvod iz cjenovnika… (npr. „standard ylc“)"
          className="flex-1 min-w-0 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none" />
      </div>
      {open && (
        <div className="absolute left-0 right-0 mt-1.5 z-30 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-1.5 max-h-80 overflow-y-auto">
          {pogodci.length === 0 && <p className="text-sm text-slate-400 px-3 py-2">{cjenovnik.length === 0 ? "Cjenovnik je prazan — dodaj proizvode u tabu Cjenovnik." : "Nema proizvoda s tim nazivom."}</p>}
          {pogodci.map((p, i) => (
            <button key={p.id} type="button" onMouseEnter={() => setAktivni(i)} onClick={() => izaberi(p)}
              className={"w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg " + (i === aktivni ? "bg-teal-50 dark:bg-teal-900/30" : "hover:bg-slate-50 dark:hover:bg-slate-800")}>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5"><span className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate">{p.naziv}</span><OznakaChip oznaka={p.oznaka} /></span>
                {p.opis && <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{p.opis}</span>}
              </span>
              <span className="text-[12.5px] text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">{eur(p.cijena_kupac)}</span>
              {imaAlc(p) && <span className="text-[11px] font-semibold text-sky-800 bg-sky-100 dark:bg-sky-900/50 dark:text-sky-200 px-1.5 rounded-full whitespace-nowrap">+ ALC</span>}
            </button>
          ))}
          {pogodci.some(imaAlc) && <p className="text-[11.5px] text-slate-500 dark:text-slate-400 px-3 pt-2 pb-1 mt-1 border-t border-slate-100 dark:border-slate-800">Uz PLC se automatski doda ALC (održavanje) — može se ukloniti.</p>}
        </div>
      )}
    </div>
  );
}

const GRID = "md:grid md:grid-cols-[minmax(0,1fr)_62px_104px_70px_70px_112px_92px_116px_116px_30px] md:gap-2.5 md:items-center";

function StavkaRed({ s, onChange, onRemove }) {
  const r = izracunStavke(s);
  const razlicitaOsnova = broj(s.cijena_osnova) !== broj(s.cijena_kupac);
  const ispodMin = r.prodaja > 0 && r.zaradaPct < MIN_ZARADA_PCT;
  const gubitak = r.zarKom < 0;
  const zCls = gubitak ? "text-red-700 dark:text-red-400" : ispodMin ? "text-amber-700 dark:text-amber-400" : "text-green-700 dark:text-green-400";
  const lbl = "md:hidden text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";
  return (
    <div className={"px-4 py-3 border-b border-slate-100 dark:border-slate-800 " + GRID + (s.parentKey ? " bg-slate-50/60 dark:bg-slate-800/20" : "")}>
      <div className={"min-w-0 " + (s.parentKey ? "md:pl-6" : "")}>
        <div className="flex items-center gap-1.5 min-w-0">
          {s.parentKey && <CornerDownRight size={14} className="text-slate-400 shrink-0" />}
          <span className="text-[13.5px] font-semibold text-slate-900 dark:text-slate-100 truncate">{s.naziv}</span>
          <OznakaChip oznaka={s.oznaka} />
          <button type="button" onClick={onRemove} className={btnGhostIcon + " md:hidden ml-auto"} aria-label="Ukloni stavku"><Trash2 size={14} /></button>
        </div>
        {s.parentKey
          ? <div className="text-[11px] text-sky-700 dark:text-sky-400 mt-0.5 inline-flex items-center gap-1"><Link2 size={11} /> ide uz PLC — dodano automatski</div>
          : s.opis ? <div className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">{s.opis}</div> : null}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 mt-2.5 md:contents">
        <div className="flex flex-col md:items-center gap-1"><span className={lbl}>Kom.</span>
          <BrojInput value={s.kom} min={1} step="1" onChange={(v) => onChange({ kom: Math.max(1, Math.round(v)) })} ariaLabel="Količina" className="w-full md:w-[54px]" /></div>
        <div className="flex flex-col md:items-end gap-0.5"><span className={lbl}>Kataloška</span>
          <span className="text-[13.5px] font-medium text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">{eur(s.cijena_kupac)}</span>
          <span className="text-[11px] text-slate-400 whitespace-nowrap">{razlicitaOsnova ? `nabava po ${eur(s.cijena_osnova)}` : "po kom."}</span></div>
        <div className="flex flex-col md:items-center gap-1"><span className={lbl}>Naš margin</span>
          <BrojInput value={s.margin} max={100} unit="%" onChange={(v) => onChange({ margin: v })} ariaLabel="Naš margin" className="w-full md:w-[64px]" /></div>
        <div className="flex flex-col md:items-center gap-1"><span className={lbl}>Dod. popust</span>
          <BrojInput value={s.dod_popust} max={100} unit="%" onChange={(v) => onChange({ dod_popust: v })} ariaLabel="Dodatni popust proizvođača" tone={broj(s.dod_popust) ? "blue" : undefined} className="w-full md:w-[64px]" /></div>
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 px-2 py-1.5 text-right"><span className={lbl + " block text-left"}>Mi plaćamo</span>
          <div className="text-[13.5px] font-semibold text-slate-700 dark:text-slate-200 tabular-nums whitespace-nowrap">{eur(r.nabava)}</div>
          <div className="text-[11px] text-slate-400 tabular-nums whitespace-nowrap">{eur(r.nabKom)} / kom.</div></div>
        <div className="flex flex-col md:items-center gap-1"><span className={lbl}>Popust kupcu</span>
          <BrojInput value={s.popust_kupac} max={100} unit="%" onChange={(v) => onChange({ popust_kupac: v })} ariaLabel="Popust kupcu"
            tone={broj(s.popust_kupac) > r.maxPopust ? "warn" : broj(s.popust_kupac) ? "teal" : undefined} className="w-full md:w-[66px]" />
          <span className={"text-[10.5px] whitespace-nowrap " + (broj(s.popust_kupac) > r.maxPopust ? "text-amber-700 dark:text-amber-400 font-semibold" : "text-slate-400")}>maks. {pct(r.maxPopust)}</span></div>
        <div className="rounded-lg bg-teal-50 dark:bg-teal-900/20 px-2 py-1.5 text-right"><span className={lbl + " block text-left"}>Kupac plaća</span>
          <div className="text-[13.5px] font-bold text-teal-800 dark:text-teal-300 tabular-nums whitespace-nowrap">{eur(r.prodaja)}</div>
          <div className="text-[11px] text-slate-400 tabular-nums whitespace-nowrap">{eur(r.prodKom)} / kom.</div></div>
        <div className={"rounded-lg px-2 py-1.5 text-right " + (gubitak ? "bg-red-50 dark:bg-red-900/20" : ispodMin ? "bg-amber-50 dark:bg-amber-900/20" : "bg-green-50 dark:bg-green-900/20")}><span className={lbl + " block text-left"}>Zarada</span>
          <div className={"text-[13.5px] font-bold tabular-nums whitespace-nowrap " + zCls}>{eur(r.zarada)}</div>
          <div className={"text-[11px] tabular-nums whitespace-nowrap " + zCls}>{pct(r.zaradaPct)} od prodaje</div></div>
        <div className="hidden md:flex justify-end"><button type="button" onClick={onRemove} className={btnGhostIcon} aria-label="Ukloni stavku" title="Ukloni stavku"><Trash2 size={14} /></button></div>
      </div>
    </div>
  );
}

export function KalkulatorTab({ cjenovnik = [], kalkulacije = [], potencijali = [], currentUser, nacrt, setNacrt, onSave, onDelete, onViewCompany }) {
  const [pogled, setPogled] = useState("kalkulacija");
  const [q, setQ] = useState("");
  const [fProdavac, setFProdavac] = useState("Svi");
  const [busy, setBusy] = useState(false);
  const [poruka, setPoruka] = useState("");
  const k = nacrt || praznaKalkulacija(currentUser);
  const set = (patch) => setNacrt({ ...k, ...patch, _izmjena: true });

  useEffect(() => { if (!nacrt) setNacrt(praznaKalkulacija(currentUser)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { if (nacrt && !nacrt.prodavac && currentUser) setNacrt({ ...nacrt, prodavac: currentUser }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [currentUser]);
  useEffect(() => { if (!poruka) return; const t = setTimeout(() => setPoruka(""), 4000); return () => clearTimeout(t); }, [poruka]);

  const firmeLista = useMemo(() => [...new Set(potencijali.map((p) => p.naziv_firme).filter(Boolean))].sort((a, b) => a.localeCompare(b, "hr")), [potencijali]);
  const potencijal = useMemo(() => {
    const key = companyKey(k.firma);
    return key ? potencijali.find((p) => companyKey(p.naziv_firme) === key) : null;
  }, [k.firma, potencijali]);

  const t = izracunUkupno(k.stavke);
  const upozorenja = k.stavke.map(izracunStavke);
  const nGubitak = upozorenja.filter((r) => r.zarKom < 0).length;
  const nIspod = upozorenja.filter((r) => r.zarKom >= 0 && r.prodaja > 0 && r.zaradaPct < MIN_ZARADA_PCT).length;

  // ---------- stavke ----------
  const dodaj = (p) => {
    const kom = 1;
    const nova = stavkaIzProizvoda(p, null, kom);
    const dodatne = [nova];
    if (p.oznaka === "PLC") {
      const alc = cjenovnik.find((x) => x.aktivan !== false && x.oznaka === "ALC" && x.naziv === p.naziv);
      if (alc) dodatne.push(stavkaIzProizvoda(alc, nova.key, kom));
    }
    set({ stavke: [...k.stavke, ...dodatne] });
  };
  const izmijeni = (key, patch) => {
    set({
      stavke: k.stavke.map((s) => {
        if (s.key === key) return { ...s, ...patch };
        if ("kom" in patch && s.parentKey === key) return { ...s, kom: patch.kom }; // ALC prati broj PLC licenci
        return s;
      }),
    });
  };
  const ukloni = (key) => set({ stavke: k.stavke.filter((s) => s.key !== key && s.parentKey !== key) });

  // ---------- spremanje / učitavanje ----------
  const imaIzmjena = k._izmjena && k.stavke.length > 0;
  const potvrdiNapustanje = () => !imaIzmjena || window.confirm("Trenutna kalkulacija ima nespremljene izmjene. Nastaviti bez spremanja?");
  const nova = () => { if (potvrdiNapustanje()) { setNacrt(praznaKalkulacija(currentUser)); setPogled("kalkulacija"); } };
  const otvori = (rec) => {
    if (!potvrdiNapustanje()) return;
    setNacrt({ ...rec, stavke: (rec.stavke || []).map((s) => ({ ...s, key: s.key || novaKljuc() })), _izmjena: false });
    setPogled("kalkulacija");
  };
  const dupliciraj = (rec = k) => {
    if (rec !== k && !potvrdiNapustanje()) return;
    const mapa = new Map();
    const stavke = (rec.stavke || []).map((s) => { const nk = novaKljuc(); mapa.set(s.key, nk); return { ...s, key: nk }; })
      .map((s) => ({ ...s, parentKey: s.parentKey ? mapa.get(s.parentKey) || null : null }));
    setNacrt({ ...rec, id: null, naziv: rec.naziv ? `${rec.naziv} (kopija)` : "", datum: danasIso(), prodavac: currentUser || rec.prodavac, stavke, _izmjena: true });
    setPogled("kalkulacija");
  };
  const spremi = async () => {
    if (!currentUser || k.stavke.length === 0 || !k.firma.trim()) return;
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const payload = {
        naziv: k.naziv.trim() || `Kalkulacija — ${k.firma.trim()}`,
        firma: k.firma.trim(), potencijal_id: potencijal ? String(potencijal.id) : null,
        prodavac: k.prodavac || currentUser, datum: k.datum || danasIso(),
        stavke: k.stavke.map(({ key, parentKey, proizvod_id, naziv, oznaka, opis, grupa, kom, cijena_kupac, cijena_osnova, margin, dod_popust, popust_kupac }) =>
          ({ key, parentKey, proizvod_id, naziv, oznaka, opis, grupa, kom, cijena_kupac, cijena_osnova, margin, dod_popust, popust_kupac })),
        ukupno_katalog: Math.round(t.katalog * 100) / 100, ukupno_kupac: Math.round(t.prodaja * 100) / 100,
        ukupno_nabava: Math.round(t.nabava * 100) / 100, zarada: Math.round(t.zarada * 100) / 100,
        napomena: k.napomena || "", updated_by: currentUser, updated_at: now,
      };
      if (!k.id) { payload.created_by = currentUser; payload.created_at = now; }
      const rec = await onSave(k.id, payload);
      if (rec) setNacrt({ ...k, ...rec, stavke: k.stavke, _izmjena: false });
    } finally {
      setBusy(false);
    }
  };
  const pdf = () => {
    const ok = otvoriPdfZaKupca({ ...k, naziv: k.naziv.trim() || `Ponuda — ${k.firma || ""}`.trim() });
    if (!ok) setPoruka("Browser je blokirao novi prozor — dozvoli pop-up prozore za CRM pa pokušaj ponovo.");
  };

  const ranije = useMemo(() => {
    const key = companyKey(k.firma);
    if (!key) return [];
    return kalkulacije.filter((x) => companyKey(x.firma) === key && x.id !== k.id).sort((a, b) => String(b.datum || "").localeCompare(String(a.datum || "")));
  }, [kalkulacije, k.firma, k.id]);

  // ---------- spremljene ----------
  const qq = q.trim().toLowerCase();
  const spremljene = useMemo(() => kalkulacije
    .filter((x) => (fProdavac === "Svi" || x.prodavac === fProdavac) && (!qq || [x.naziv, x.firma, x.prodavac].join(" ").toLowerCase().includes(qq)))
    .sort((a, b) => String(b.datum || "").localeCompare(String(a.datum || "")) || String(b.created_at || "").localeCompare(String(a.created_at || ""))),
  [kalkulacije, fProdavac, qq]);
  const prodavaci = useMemo(() => [...new Set(kalkulacije.map((x) => x.prodavac).filter(Boolean))].sort((a, b) => a.localeCompare(b, "hr")), [kalkulacije]);

  const tabBtn = (id, Icon, label, count) => (
    <button type="button" onClick={() => setPogled(id)}
      className={"h-11 inline-flex items-center gap-1.5 border-b-2 text-[13.5px] whitespace-nowrap transition-colors " +
        (pogled === id ? "border-teal-600 text-teal-700 dark:text-teal-400 font-semibold" : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200")}>
      <Icon size={15} /> {label}
      {count != null && <span className={"text-[11px] px-1.5 rounded-full " + (pogled === id ? "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400")}>{count}</span>}
    </button>
  );
  const lbl = "block text-[11.5px] font-semibold text-slate-500 dark:text-slate-400 mb-1";
  const wBuy = t.katalog > 0 ? (t.nabava / t.katalog) * 100 : 0;
  const wZ = t.katalog > 0 ? (Math.max(0, t.zarada) / t.katalog) * 100 : 0;
  const wPop = t.katalog > 0 ? (t.popust / t.katalog) * 100 : 0;

  return (
    <div>
      {/* ---------- zaglavlje ---------- */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Kalkulator zarade</h2>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">Cijena za kupca, naša nabavna cijena i zarada — po stavci i ukupno</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={headerBtnSec} onClick={() => dupliciraj()} disabled={k.stavke.length === 0}><Copy size={15} /> Dupliciraj</button>
          <button type="button" className={btnPrimary + " h-9"} onClick={nova}><Plus size={15} /> Nova kalkulacija</button>
        </div>
      </div>
      <div className="flex items-center gap-5 border-b border-slate-200 dark:border-slate-700 mb-4 overflow-x-auto">
        {tabBtn("kalkulacija", Calculator, k.id ? "Kalkulacija" : "Nova kalkulacija")}
        {tabBtn("spremljene", List, "Spremljene kalkulacije", kalkulacije.length)}
        <span className="flex-1" />
        <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap"><Lock size={13} /> Vidljivo samo prodaji</span>
      </div>

      {pogled === "spremljene" ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <div className="w-full sm:w-72 sm:flex-none"><SearchBox value={q} onChange={setQ} placeholder="Firma, naziv kalkulacije..." /></div>
            <FilterPill label="Prodavač" value={fProdavac} defaultValue="Svi" onChange={setFProdavac} options={["Svi", ...prodavaci]} />
            <span className="ml-auto text-[13px] text-slate-500 dark:text-slate-400"><b className="text-slate-900 dark:text-slate-100">{spremljene.length}</b> kalkulacija</span>
          </div>
          {spremljene.length === 0 ? (
            <div className="p-4"><EmptyState icon={Calculator} title={kalkulacije.length ? "Nema kalkulacija za odabrane filtere" : "Još nema spremljenih kalkulacija"}
              subtitle={kalkulacije.length ? "Promijeni pretragu ili filter." : "Napravi kalkulaciju i klikni „Spremi kalkulaciju“."} /></div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {spremljene.map((x) => {
                const zp = broj(x.ukupno_kupac) > 0 ? (broj(x.zarada) / broj(x.ukupno_kupac)) * 100 : 0;
                return (
                  <div key={x.id} className="group grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[92px_minmax(0,1.3fr)_minmax(0,1fr)_32px_130px_150px_auto] gap-x-4 gap-y-1 items-center px-4 py-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <span className="hidden md:block text-[13px] text-slate-500 dark:text-slate-400 tabular-nums">{fmtDate(x.datum)}</span>
                    <button type="button" onClick={() => otvori(x)} className="text-left min-w-0">
                      <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100 truncate hover:text-teal-700 dark:hover:text-teal-400">{x.naziv || "Kalkulacija"}</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400 truncate md:hidden">{x.firma} · {fmtDate(x.datum)}</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">{(x.stavke || []).length} {(x.stavke || []).length === 1 ? "stavka" : (x.stavke || []).length < 5 ? "stavke" : "stavki"}</span>
                    </button>
                    <span className="hidden md:block text-[13px] text-slate-700 dark:text-slate-300 truncate">{x.firma}</span>
                    <span className="hidden md:block"><Avatar name={x.prodavac} size="sm" /></span>
                    <span className="hidden md:block text-right text-[13px] font-semibold text-teal-800 dark:text-teal-300 tabular-nums">{eur(x.ukupno_kupac)}</span>
                    <span className="text-right">
                      <span className="block text-[13px] font-bold text-green-700 dark:text-green-400 tabular-nums">{eur(x.zarada)}</span>
                      <span className="block text-[11px] text-slate-400">{pct(zp)} zarade</span>
                    </span>
                    <span className="col-span-2 md:col-span-1 flex items-center justify-end gap-1">
                      <button type="button" className={btnGhostIcon} onClick={() => otvori(x)} title="Otvori" aria-label="Otvori kalkulaciju"><Pencil size={14} /></button>
                      <button type="button" className={btnGhostIcon} onClick={() => dupliciraj(x)} title="Dupliciraj" aria-label="Dupliciraj kalkulaciju"><Copy size={14} /></button>
                      <ConfirmDelete label={x.naziv || "kalkulacija"} onConfirm={() => onDelete(x.id)} />
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* ---------- podaci o kalkulaciji ---------- */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.1fr)_160px_200px] gap-3">
            <div>
              <span className={lbl}>Kupac (iz Baze potencijala) <span className="text-red-500">*</span></span>
              <div className="relative">
                <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input list="kalk-firme" className={inputCls + " pl-8"} value={k.firma} onChange={(e) => set({ firma: e.target.value })} placeholder="Odaberi ili upiši firmu" aria-label="Kupac" />
                <datalist id="kalk-firme">{firmeLista.map((n) => <option key={n} value={n} />)}</datalist>
              </div>
              {potencijal && (
                <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <StatusPill status={potencijal.status} />
                  {onViewCompany && <button type="button" className="inline-flex items-center gap-1 text-teal-700 dark:text-teal-400 hover:underline" onClick={() => onViewCompany(potencijal.naziv_firme)}><ExternalLink size={12} /> 360°</button>}
                </div>
              )}
            </div>
            <div>
              <span className={lbl}>Naziv kalkulacije</span>
              <input className={inputCls} value={k.naziv} onChange={(e) => set({ naziv: e.target.value })} placeholder="npr. Ponuda — 2× SW Standard" aria-label="Naziv kalkulacije" />
            </div>
            <div>
              <span className={lbl}>Datum</span>
              <input type="date" className={inputCls} value={k.datum || ""} onChange={(e) => set({ datum: e.target.value })} aria-label="Datum" />
            </div>
            <div>
              <span className={lbl}>Prodavač</span>
              <div className="flex items-center gap-2 h-[38px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 text-sm text-slate-800 dark:text-slate-200">
                {k.prodavac ? <><Avatar name={k.prodavac} size="sm" /> <span className="truncate">{k.prodavac}</span></> : <span className="text-slate-400">odaberi svoje ime u meniju</span>}
              </div>
            </div>
          </div>

          <div className="xl:flex xl:items-start xl:gap-4">
            {/* ---------- stavke ---------- */}
            <div className="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl mb-4 xl:mb-0">
              <div className={"hidden md:grid px-4 pt-3 text-[10.5px] font-bold uppercase tracking-wider " + GRID}>
                <span /><span /><span />
                <span className="col-span-3 text-center text-slate-500 dark:text-slate-400 border-b-2 border-slate-300 dark:border-slate-600 pb-1.5">Nabava — šta mi plaćamo</span>
                <span className="col-span-2 text-center text-teal-700 dark:text-teal-400 border-b-2 border-teal-300 dark:border-teal-700 pb-1.5">Prodaja — šta plaća kupac</span>
                <span className="text-center text-green-700 dark:text-green-400 border-b-2 border-green-300 dark:border-green-700 pb-1.5">Zarada</span>
                <span />
              </div>
              <div className={"hidden md:grid px-4 py-2 border-b border-slate-200 dark:border-slate-700 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 " + GRID}>
                <span>Proizvod</span><span className="text-center">Kom.</span><span className="text-right">Kataloška</span>
                <span className="text-center">Margin</span><span className="text-center">Dod. pop.</span><span className="text-right">Mi plaćamo</span>
                <span className="text-center">Pop. kupcu</span><span className="text-right">Kupac plaća</span><span className="text-right">Zarada</span><span />
              </div>
              {k.stavke.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  Dodaj prvi proizvod iz cjenovnika — cijene i margin se popune same.
                </div>
              )}
              {k.stavke.map((s) => <StavkaRed key={s.key} s={s} onChange={(p) => izmijeni(s.key, p)} onRemove={() => ukloni(s.key)} />)}
              {k.stavke.length > 0 && (
                <div className={"px-4 py-3 border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 flex flex-wrap gap-x-6 gap-y-1 md:gap-2.5 " + GRID}>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Ukupno · {k.stavke.length} {k.stavke.length === 1 ? "stavka" : k.stavke.length < 5 ? "stavke" : "stavki"} · {t.kom} kom.</span>
                  <span className="hidden md:block" />
                  <span className="text-right text-[13.5px] font-semibold text-slate-700 dark:text-slate-300 tabular-nums">{eur(t.katalog)}</span>
                  <span className="hidden md:block" /><span className="hidden md:block" />
                  <span className="text-right text-[13.5px] font-bold text-slate-700 dark:text-slate-200 tabular-nums">{eur(t.nabava)}</span>
                  <span className="hidden md:block" />
                  <span className="text-right text-[13.5px] font-bold text-teal-800 dark:text-teal-300 tabular-nums">{eur(t.prodaja)}</span>
                  <span className={"text-right text-[13.5px] font-bold tabular-nums " + (t.zarada < 0 ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400")}>{eur(t.zarada)}</span>
                  <span className="hidden md:block" />
                </div>
              )}
              <div className="px-4 py-3.5">
                <DodajProizvod cjenovnik={cjenovnik} onPick={dodaj} />
              </div>
              <div className="px-4 pb-4">
                <span className={lbl}>Napomena (ide i na PDF za kupca)</span>
                <textarea className={inputCls} rows={2} value={k.napomena || ""} onChange={(e) => set({ napomena: e.target.value })} placeholder="npr. Ponuda vrijedi 30 dana." aria-label="Napomena" />
              </div>
            </div>

            {/* ---------- sažetak ---------- */}
            <div className="flex flex-col gap-4 xl:w-[350px] xl:shrink-0">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 flex flex-col gap-3">
                <PanelLabel>Zarada na kalkulaciji</PanelLabel>
                <div className={"text-4xl font-extrabold tracking-tight tabular-nums -mt-1 " + (t.zarada < 0 ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400")}>{eur(t.zarada)}</div>
                <div><span className="text-[12.5px] font-semibold text-green-800 bg-green-100 dark:bg-green-900/40 dark:text-green-300 px-2.5 py-0.5 rounded-full">{pct(t.zaradaPct)} od prodajne cijene</span></div>
                {t.katalog > 0 && (
                  <div>
                    <div className="flex h-3.5 rounded overflow-hidden gap-0.5 mt-1" role="img" aria-label="Podjela kataloške vrijednosti: mi plaćamo, zarada, popust kupcu">
                      <div className="bg-slate-400" style={{ width: `${wBuy}%` }} title={`Mi plaćamo: ${eur(t.nabava)}`} />
                      <div className="bg-green-500" style={{ width: `${wZ}%` }} title={`Zarada: ${eur(t.zarada)}`} />
                      <div className="bg-amber-400" style={{ width: `${wPop}%` }} title={`Popust kupcu: ${eur(t.popust)}`} />
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11.5px] text-slate-600 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-400" />Mi plaćamo {pct(wBuy)}</span>
                      <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-green-500" />Zarada {pct(wZ)}</span>
                      <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />Popust kupcu {pct(wPop)}</span>
                    </div>
                  </div>
                )}
                <div className="text-[13px]">
                  {[
                    ["Kataloška vrijednost", eur(t.katalog), "text-slate-700 dark:text-slate-300", ""],
                    ["Popust kupcu", `− ${eur(t.popust)}`, "text-amber-700 dark:text-amber-400", t.katalog > 0 ? pct((t.popust / t.katalog) * 100) : ""],
                    ["Kupac plaća", eur(t.prodaja), "text-teal-800 dark:text-teal-300 font-bold", "bez PDV-a"],
                    ["Mi plaćamo", eur(t.nabava), "text-slate-700 dark:text-slate-300", ""],
                    ["Zarada", eur(t.zarada), (t.zarada < 0 ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400") + " font-bold", ""],
                  ].map(([a, b, c, d]) => (
                    <div key={a} className="flex justify-between items-baseline py-1.5 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-slate-600 dark:text-slate-400">{a}{d && <span className="text-[11px] text-slate-400 ml-1.5">{d}</span>}</span>
                      <span className={"tabular-nums font-semibold " + c}>{b}</span>
                    </div>
                  ))}
                </div>
                {k.stavke.length > 0 && (nGubitak > 0 ? (
                  <div className="flex items-start gap-2 text-[12.5px] text-red-800 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2"><AlertTriangle size={15} className="shrink-0 mt-0.5" /> {nGubitak} {nGubitak === 1 ? "stavka je" : "stavke su"} u gubitku — smanji popust kupcu.</div>
                ) : nIspod > 0 ? (
                  <div className="flex items-start gap-2 text-[12.5px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2"><AlertTriangle size={15} className="shrink-0 mt-0.5" /> {nIspod} {nIspod === 1 ? "stavka je" : "stavke su"} ispod {MIN_ZARADA_PCT}% zarade.</div>
                ) : (
                  <div className="flex items-start gap-2 text-[12.5px] text-green-800 dark:text-green-300 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2"><Check size={15} className="shrink-0 mt-0.5" /> Sve stavke su iznad minimalne zarade od {MIN_ZARADA_PCT}%.</div>
                ))}
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-col gap-2">
                <button type="button" className={btnPrimary + " justify-center h-10"} onClick={spremi} disabled={busy || !currentUser || k.stavke.length === 0 || !k.firma.trim()}>
                  <Save size={15} /> {busy ? "Spremam..." : k.id ? (k._izmjena ? "Spremi izmjene" : "Spremljeno") : "Spremi kalkulaciju"}
                </button>
                {(!k.firma.trim() && k.stavke.length > 0) && <p className="text-xs text-amber-700 dark:text-amber-400 text-center">Upiši kupca da bi se kalkulacija mogla spremiti.</p>}
                <button type="button" className={headerBtnSec + " justify-center h-10"} onClick={pdf} disabled={k.stavke.length === 0}>
                  <FileText size={15} /> PDF za kupca — bez naše zarade
                </button>
                {poruka && <p className="text-xs text-red-600 dark:text-red-400 text-center">{poruka}</p>}
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
                <PanelLabel>Ranije kalkulacije za ovu firmu</PanelLabel>
                {!k.firma.trim() ? <p className="text-xs text-slate-400">Odaberi kupca da vidiš ranije kalkulacije.</p>
                  : ranije.length === 0 ? <p className="text-xs text-slate-400">Nema ranijih kalkulacija za ovu firmu.</p>
                  : ranije.slice(0, 6).map((x) => {
                    const zp = broj(x.ukupno_kupac) > 0 ? (broj(x.zarada) / broj(x.ukupno_kupac)) * 100 : 0;
                    return (
                      <button key={x.id} type="button" onClick={() => otvori(x)}
                        className="w-full text-left flex items-center gap-2.5 py-2 border-t border-slate-100 dark:border-slate-800 first:border-t-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg -mx-1.5 px-1.5">
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate">{x.naziv || "Kalkulacija"}</span>
                          <span className="block text-[11.5px] text-slate-500 dark:text-slate-400">{fmtDate(x.datum)} · {x.prodavac || "—"}</span>
                        </span>
                        <span className="text-right shrink-0">
                          <span className="block text-[12.5px] font-semibold text-teal-800 dark:text-teal-300 tabular-nums">{eur(x.ukupno_kupac)}</span>
                          <span className="block text-[11px] text-green-700 dark:text-green-400">{pct(zp)} zarade</span>
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  CJENOVNIK                                                              */
/* ---------------------------------------------------------------------- */

const PROIZVOD_PRAZNO = { grupa: "", naziv: "", oznaka: "PLC", opis: "", cijena_kupac: "", cijena_osnova: "", margin: 35, aktivan: true, napomena: "" };

function ProizvodForm({ initial, grupe, currentUser, onSave, onClose }) {
  const [f, setF] = useState(() => (initial
    ? { ...PROIZVOD_PRAZNO, ...initial, cijena_kupac: initial.cijena_kupac ?? "", cijena_osnova: initial.cijena_osnova ?? "", margin: initial.margin ?? 35 }
    : PROIZVOD_PRAZNO));
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const kupac = parseBroj(f.cijena_kupac);
  const osnova = f.cijena_osnova === "" || f.cijena_osnova == null ? kupac : parseBroj(f.cijena_osnova);
  const margin = parseBroj(f.margin) ?? 35;
  const ok = f.naziv.trim() && kupac != null && kupac >= 0 && currentUser;
  const submit = async () => {
    if (!ok) return;
    setBusy(true);
    try {
      const osn = f.cijena_osnova === "" || f.cijena_osnova == null ? null : parseBroj(f.cijena_osnova);
      const payload = {
        grupa: f.grupa.trim(), naziv: f.naziv.trim(), oznaka: (f.oznaka || "").trim().toUpperCase(), opis: (f.opis || "").trim(),
        cijena_kupac: kupac, cijena_osnova: osn != null && osn !== kupac ? osn : null, margin,
        aktivan: !!f.aktivan, napomena: f.napomena || "", updated_by: currentUser, updated_at: new Date().toISOString(),
      };
      if (!initial) { payload.created_by = currentUser; payload.created_at = new Date().toISOString(); }
      await onSave(payload);
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={initial ? "Uredi proizvod" : "Novi proizvod"} onClose={onClose} wide>
      <datalist id="cjen-grupe">{grupe.map((g) => <option key={g} value={g} />)}</datalist>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label="Naziv proizvoda" required hint="npr. SOLIDWORKS Standard"><input className={inputCls} value={f.naziv} onChange={set("naziv")} /></Field>
        <Field label="Oznaka licence" hint="PLC, ALC, YLC, QLC…">
          <input className={inputCls} list="cjen-oznake" value={f.oznaka} onChange={set("oznaka")} />
          <datalist id="cjen-oznake">{OZNAKE.map((o) => <option key={o.k} value={o.k}>{o.opis}</option>)}</datalist>
        </Field>
        <Field label="Grupa" hint="npr. SOLIDWORKS, SolidCAM, DraftSight"><input className={inputCls} list="cjen-grupe" value={f.grupa} onChange={set("grupa")} /></Field>
        <Field label="Opis" hint="npr. trajna licenca"><input className={inputCls} value={f.opis} onChange={set("opis")} /></Field>
        <Field label="Kataloška cijena za kupca (EUR)" required><input className={inputCls} inputMode="decimal" value={f.cijena_kupac} onChange={set("cijena_kupac")} placeholder="npr. 4920" /></Field>
        <Field label="Kataloška cijena proizvođača (EUR)" hint="Samo ako je drugačija — po njoj se računa naša nabava"><input className={inputCls} inputMode="decimal" value={f.cijena_osnova ?? ""} onChange={set("cijena_osnova")} placeholder="ista kao za kupca" /></Field>
        <Field label="Naš margin (%)"><input className={inputCls} inputMode="decimal" value={f.margin} onChange={set("margin")} /></Field>
        <Field label="Status">
          <label className="flex items-center gap-2 h-[38px] text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={!!f.aktivan} onChange={set("aktivan")} className="w-4 h-4 accent-teal-600" /> Aktivan (nudi se u kalkulatoru)
          </label>
        </Field>
      </div>
      <Field label="Napomena"><textarea className={inputCls} rows={2} value={f.napomena || ""} onChange={set("napomena")} /></Field>
      {kupac != null && (
        <div className="text-[12.5px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 mb-2">
          Naša nabavna cijena (bez dodatnog popusta): <b className="tabular-nums">{eur((osnova ?? 0) * (1 - margin / 100))}</b>
          {osnova !== kupac && osnova != null && <span className="text-slate-500"> · računa se od {eur(osnova)}, kupcu se nudi od {eur(kupac)}</span>}
        </div>
      )}
      <div className="flex justify-end gap-2 mt-2">
        <button className={btnSecondary} onClick={onClose}>Otkaži</button>
        <button className={btnPrimary} onClick={submit} disabled={!ok || busy}>{busy ? "Čuvam..." : "Sačuvaj"}</button>
      </div>
    </Modal>
  );
}

export function CjenovnikTab({ data = [], currentUser, onAdd, onUpdate, onDelete, onBulkImport }) {
  const [fGrupa, setFGrupa] = useState("Svi proizvodi");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const admin = CJENOVNIK_ADMINI.includes(currentUser);

  const grupe = useMemo(() => [...new Set(data.map((p) => p.grupa).filter(Boolean))].sort((a, b) => a.localeCompare(b, "hr")), [data]);
  // proizvodi istog naziva idu zajedno, poredani po cijeni (Standard, Professional, Premium…)
  const nivo = useMemo(() => {
    const m = new Map();
    for (const p of data) { const c = broj(p.cijena_kupac); if (!m.has(p.naziv) || c < m.get(p.naziv) || p.oznaka === "PLC") m.set(p.naziv, p.oznaka === "PLC" ? c : Math.min(c, m.get(p.naziv) ?? c)); }
    return m;
  }, [data]);
  const redOznake = (o) => { const i = ["PLC", "ALC", "YLC", "QLC"].indexOf(o); return i < 0 ? 9 : i; };
  const lista = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return data
      .filter((p) => (fGrupa === "Svi proizvodi" || p.grupa === fGrupa) && (!qq || `${p.naziv} ${p.oznaka} ${p.grupa} ${p.opis}`.toLowerCase().includes(qq)))
      .sort((a, b) => (a.grupa || "").localeCompare(b.grupa || "", "hr") || (nivo.get(a.naziv) ?? 0) - (nivo.get(b.naziv) ?? 0) ||
        (a.naziv || "").localeCompare(b.naziv || "", "hr") || redOznake(a.oznaka) - redOznake(b.oznaka));
  }, [data, fGrupa, q, nivo]);
  const imaAlc = (p) => p.oznaka === "PLC" && data.some((x) => x.oznaka === "ALC" && x.naziv === p.naziv);
  const zadnja = useMemo(() => [...data].sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")))[0], [data]);

  const handleSave = async (payload) => {
    if (editing) await onUpdate(editing.id, payload);
    else await onAdd(payload);
  };
  const chip = (g) => {
    const on = fGrupa === g;
    const n = g === "Svi proizvodi" ? data.length : data.filter((p) => p.grupa === g).length;
    return (
      <button key={g} type="button" onClick={() => setFGrupa(g)}
        className={"inline-flex items-center gap-2 h-8 px-3.5 rounded-full border text-[13px] whitespace-nowrap transition-colors " +
          (on ? "bg-teal-600 border-teal-600 text-white font-semibold" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-teal-400")}>
        {g}<span className={"text-[11px] px-1.5 rounded-full " + (on ? "bg-white/25" : "bg-slate-100 dark:bg-slate-800 text-slate-500")}>{n}</span>
      </button>
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Cjenovnik</h2>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">
            {fmtN(data.length)} {data.length === 1 ? "proizvod" : "proizvoda"} · kataloške cijene i standardni margin
            {zadnja && <> · zadnja izmjena {fmtDate(String(zadnja.updated_at || zadnja.created_at || "").slice(0, 10))}{zadnja.updated_by ? `, ${zadnja.updated_by}` : ""}</>}
          </p>
        </div>
        {admin && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={headerBtnSec} onClick={() => setShowImport(true)}><Upload size={15} /> Uvezi iz Excela</button>
            <button type="button" className={btnPrimary + " h-9"} onClick={() => setShowNew(true)}><Plus size={15} /> Novi proizvod</button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {["Svi proizvodi", ...grupe].map(chip)}
      </div>

      <div className="xl:flex xl:items-start xl:gap-4">
        <div className="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden mb-4 xl:mb-0">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800"><div className="w-full sm:w-72"><SearchBox value={q} onChange={setQ} placeholder="Traži proizvod..." /></div></div>
          {lista.length === 0 ? (
            <div className="p-4"><EmptyState icon={Tags} title={data.length ? "Nema proizvoda za odabrani filter" : "Cjenovnik je prazan"}
              subtitle={data.length ? "Promijeni pretragu ili grupu." : admin ? "Dodaj proizvode ručno ili ih uvezi iz Excela." : "Administrator još nije unio proizvode."}
              action={!data.length && admin ? <button className={btnPrimary} onClick={() => setShowNew(true)}><Plus size={15} /> Dodaj prvi proizvod</button> : null} /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-2.5">Grupa</th><th className="px-4 py-2.5">Proizvod</th>
                    <th className="px-4 py-2.5 text-right whitespace-nowrap">Cijena za kupca</th>
                    <th className="px-4 py-2.5 text-right whitespace-nowrap">Osnova za nabavu</th>
                    <th className="px-4 py-2.5 text-center">Margin</th>
                    <th className="px-4 py-2.5 text-right whitespace-nowrap">Naša nabavna</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {lista.map((p) => {
                    const osn = osnovaNabave(p);
                    const razl = osn !== broj(p.cijena_kupac);
                    return (
                      <tr key={p.id} className={"hover:bg-slate-50/70 dark:hover:bg-slate-800/40 " + (p.aktivan === false ? "opacity-50" : "")}>
                        <td className="px-4 py-2.5">{p.grupa ? <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-px rounded-md whitespace-nowrap">{p.grupa}</span> : <span className="text-slate-300">—</span>}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5 flex-wrap"><span className="font-semibold text-slate-900 dark:text-slate-100">{p.naziv}</span><OznakaChip oznaka={p.oznaka} />
                            {imaAlc(p) && <span className="inline-flex items-center gap-1 text-[11px] text-sky-800 dark:text-sky-300"><Link2 size={11} /> + ALC</span>}
                            {p.aktivan === false && <span className="text-[11px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 rounded">neaktivan</span>}</div>
                          {p.opis && <div className="text-xs text-slate-500 dark:text-slate-400">{p.opis}</div>}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap">{eur(p.cijena_kupac)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">{razl ? <span className="font-semibold text-blue-700 dark:text-blue-400" title="Nabava se računa od kataloške cijene proizvođača">{eur(osn)}</span> : <span className="text-slate-400 text-xs">ista</span>}</td>
                        <td className="px-4 py-2.5 text-center text-slate-700 dark:text-slate-300">{pct(p.margin ?? 35)}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-400 tabular-nums whitespace-nowrap">{eur(osn * (1 - broj(p.margin ?? 35) / 100))}</td>
                        <td className="px-4 py-2.5">
                          {admin && (
                            <div className="flex items-center justify-end gap-1">
                              <button className={btnGhostIcon} onClick={() => setEditing(p)} title="Uredi" aria-label="Uredi proizvod"><Pencil size={14} /></button>
                              <ConfirmDelete label={`${p.naziv} ${p.oznaka || ""}`} onConfirm={() => onDelete(p.id)} />
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 xl:w-[340px] xl:shrink-0">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
            <PanelLabel>Oznake licenci</PanelLabel>
            <div className="flex flex-col gap-2 mt-1">
              {OZNAKE.map((o) => <div key={o.k} className="flex items-center gap-2.5 text-[13px] text-slate-700 dark:text-slate-300"><OznakaChip oznaka={o.k} /> {o.opis}</div>)}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-[13px] text-slate-700 dark:text-slate-300">
            <PanelLabel>Pravila kalkulatora</PanelLabel>
            {[
              ["Valuta", "EUR"],
              ["Minimalna zarada po stavci", `${MIN_ZARADA_PCT}%`],
              ["Naša cijena", "osnova − margin, pa − dod. popust"],
              ["Cijena kupcu", "cijena za kupca − popust kupcu"],
              ["Uz PLC automatski dodaj ALC", "Da"],
            ].map(([a, b]) => (
              <div key={a} className="flex justify-between gap-3 py-1.5 border-t border-slate-100 dark:border-slate-800 first:border-t-0"><span className="text-slate-600 dark:text-slate-400">{a}</span><b className="text-right font-semibold">{b}</b></div>
            ))}
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug border-t border-slate-100 dark:border-slate-800 pt-2 mt-1">
              „Osnova za nabavu“ se upisuje samo kad je kataloška cijena proizvođača drugačija od cijene koju nudimo kupcu. Cijene u već spremljenim kalkulacijama se ne mijenjaju kad se promijeni cjenovnik.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[12.5px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5">
            <Lock size={15} className="shrink-0" /> Cjenovnik mijenja samo administrator ({CJENOVNIK_ADMINI.join(", ")}).
          </div>
        </div>
      </div>

      {(showNew || editing) && (
        <ProizvodForm initial={editing} grupe={grupe} currentUser={currentUser} onSave={handleSave} onClose={() => { setShowNew(false); setEditing(null); }} />
      )}
      {showImport && (
        <ImportModal
          title="Uvezi cjenovnik iz Excela"
          columns={["Grupa", "Naziv proizvoda", "Oznaka (PLC/ALC/YLC…)", "Opis (nije obavezno)", "Kataloška cijena za kupca (EUR)", "Kataloška cijena proizvođača — ako je drugačija", "Margin % (prazno = 35)"]}
          existingNames={[]}
          nameColumnIndex={1}
          onClose={() => setShowImport(false)}
          onImport={async (rows) => {
            const now = new Date().toISOString();
            const novi = rows.filter((r) => (r[1] || "").toString().trim()).map((r) => {
              const kupac = parseBroj(r[4]) ?? 0;
              const osn = parseBroj(r[5]);
              return {
                grupa: (r[0] || "").toString().trim(), naziv: (r[1] || "").toString().trim(), oznaka: (r[2] || "").toString().trim().toUpperCase(),
                opis: (r[3] || "").toString().trim(), cijena_kupac: kupac, cijena_osnova: osn != null && osn !== kupac ? osn : null,
                margin: parseBroj(r[6]) ?? 35, aktivan: true, napomena: "",
                created_by: currentUser || "Uvoz", created_at: now, updated_by: currentUser || "Uvoz", updated_at: now,
              };
            });
            await onBulkImport(novi);
          }}
        />
      )}
    </div>
  );
}
