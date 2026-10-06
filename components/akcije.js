"use client";
// Akcije — interne prodajne akcije: lista firmi, ko je kontaktiran, šta je dogovoreno, forecast i rezultat
import { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  Megaphone, Plus, Download, ArrowLeft, CalendarDays, Check, X, Bell, Calculator, TrendingUp, ExternalLink, History,
  Info, Building2, FileText, FileSpreadsheet, Pencil, Trash2, Upload, Archive, RotateCcw, ChevronDown, Users,
} from "lucide-react";
import {
  inputCls, btnPrimary, btnSecondary, btnGhostIcon, fmtDate, daysDiff, companyKey, PRODAJA_MARKETING_NAMES,
  POTENCIJAL_STATUSI, currentMonthStr, isForecastWon, isForecastLost, FORECAST_SOFTVERI, FORECAST_TIPOVI_LICENCE,
  FORECAST_STATUSI, FORECAST_PRODAVACI, buildCompanyNameIndex, findCompanyMatch,
} from "../lib/crm";
import { EmptyState, SearchBox } from "./ui";
import { Avatar, FilterPill, PanelLabel, PageNav, headerBtnSec, fmtN, daysAgo, MenuButton } from "./crmBits";
import { drzavaGrupa } from "./nadogradnje";
import { izracunUkupno } from "./kalkulator";
import { prodavaciOf } from "./potencijali";

/* ---------------------------------------------------------------------- */
/*  Postavke                                                               */
/* ---------------------------------------------------------------------- */

export const A_STATUSI = ["Nije kontaktirana", "Kontaktirana", "Zainteresovana", "Ponuda poslana", "Dobijeno", "Nije zainteresovana"];
const KORACI = A_STATUSI.slice(0, 5);
const STATUS_STIL = {
  "Nije kontaktirana": ["bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300", "bg-slate-400", "#94a3b8"],
  Kontaktirana: ["bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", "bg-blue-500", "#3b82f6"],
  Zainteresovana: ["bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300", "bg-amber-500", "#f59e0b"],
  "Ponuda poslana": ["bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300", "bg-violet-500", "#8b5cf6"],
  Dobijeno: ["bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300", "bg-green-500", "#22c55e"],
  "Nije zainteresovana": ["bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", "bg-red-500", "#ef4444"],
};
// Akciju (naziv, period, brisanje) osim autora smije mijenjati i
export const AKCIJE_ADMINI = ["Belmin Hinović"];

const DRZAVE = [["Sve", "Sve države"], ["BA", "BiH"], ["HR", "Hrvatska"], ["AL", "Albanija"], ["OST", "Ostalo"]];
const ODRZAVANJE = ["Isteklo", "Isteklo prije 1+ god.", "Isteklo prije 3+ god.", "Ističe u 90 dana", "Aktivno", "Sve"];
const TIPOVI = [["Sve", "Svi tipovi"], ["ALC", "Trajna (ALC)"], ["YLC", "Zakup (YLC/QLC)"], ["YSC", "Pretplata (YSC)"]];
const TIP_GRUPA = { ALC: ["ALC", "ELC", "ULC"], YLC: ["YLC", "QLC"], YSC: ["YSC", "ASC", "QSC"] };
const ZADNJI = ["Bilo kada", "Zadnjih 90 dana", "Prije više od 6 mj.", "Prije više od 12 mj.", "Nikad kontaktirano"];

// porodice proizvoda — isto kao u Kupcima i licencama
const PORODICE_LIC = ["SOLIDWORKS", "3DEXPERIENCE", "DraftSight", "SolidCAM", "SWOOD", "DriveWorks", "SolidSteel", "Ostalo"];
const ULOGE_3DX = /(Swymer|Collaborative|Collaborator|Business Analyst|Project Planner|Works Learner|Shop Floor|3D Creator|3D Sculptor|Manufacturing Definition|Industrial Designer|Release Engineer|Engineer$|Structural Designer|Product Architect|Innovator)/i;
function porodicaLicence(k) {
  const p = (k.naziv_proizvoda || "").trim();
  if (!p) return "Ostalo";
  if (/^NOT FOR SALE/i.test(p) || /3DEXPERIENCE|^Platform\b/i.test(p) || ULOGE_3DX.test(p)) return "3DEXPERIENCE";
  for (const f of ["SolidCAM", "SWOOD", "DriveWorks", "SolidSteel", "DraftSight"]) if (p.toLowerCase().includes(f.toLowerCase())) return f;
  if (/SOLIDWORKS|^PhotoWorks/i.test(p)) return "SOLIDWORKS";
  return "Ostalo";
}
const licKom = (k) => { const n = Number(k.broj_licenci); return n > 0 ? n : 1; };
// dodatak uz paket ("with SOLIDWORKS CAM ...") nije zasebna licenca — ne broji se, ali se gleda njegov datum održavanja
const jeKomponenta = (k) => /^with\b/i.test((k.naziv_proizvoda_2 || "").trim());

/* ---------------------------------------------------------------------- */
/*  Pomoćne funkcije                                                       */
/* ---------------------------------------------------------------------- */

function danasIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function plusDana(n, od = null) {
  const d = od ? new Date(od + "T00:00:00") : new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export const fmtEur = (v) => `${Math.round(Number(v) || 0).toLocaleString("hr-HR")} €`;
const num = (v) => { const n = Number(String(v ?? "").replace(/\s|€/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const nizProdavaca = (a) => (Array.isArray(a.prodavaci) ? a.prodavaci : []);

export function akcijaAktivna(a) {
  return !a.zavrsena && (!a.kraj || daysDiff(String(a.kraj).slice(0, 10)) >= 0);
}
function periodTekst(a) {
  if (!a.pocetak && !a.kraj) return "bez perioda";
  return `${a.pocetak ? fmtDate(a.pocetak) : "…"} – ${a.kraj ? fmtDate(a.kraj) : "…"}`;
}
// status firme; stavka u forecastu označena kao "Dobijeno" računa se kao dobijena
function efStatus(r, fcById) {
  const fc = r.forecast_id ? fcById.get(String(r.forecast_id)) : null;
  if (fc && isForecastWon(fc.status)) return "Dobijeno";
  return A_STATUSI.includes(r.status) ? r.status : "Nije kontaktirana";
}
function forecastOf(r, fcById) {
  return r.forecast_id ? fcById.get(String(r.forecast_id)) || null : null;
}
const zadnjiZapis = (r) => (r.historija || []).find((h) => h.opis) || null;

export function statistikaAkcije(rows, fcById) {
  const s = { ukupno: rows.length, po: {}, kontaktirano: 0, zainteresovano: 0, ponuda: 0, dobijeno: 0, fcIznos: 0, dobIznos: 0, uForecastu: 0, razlozi: new Map() };
  A_STATUSI.forEach((x) => { s.po[x] = 0; });
  for (const r of rows) {
    const st = efStatus(r, fcById);
    s.po[st] += 1;
    if (st !== "Nije kontaktirana") s.kontaktirano += 1;
    if (st === "Zainteresovana" || st === "Ponuda poslana" || st === "Dobijeno") s.zainteresovano += 1;
    if (st === "Ponuda poslana" || st === "Dobijeno") s.ponuda += 1;
    if (st === "Dobijeno") { s.dobijeno += 1; s.dobIznos += Number(r.vrijednost) || 0; }
    else if (st !== "Nije zainteresovana") {
      const fc = forecastOf(r, fcById);
      if (fc && !isForecastLost(fc.status)) { s.uForecastu += 1; s.fcIznos += Number(r.vrijednost) || 0; }
    }
    if (st === "Nije zainteresovana") {
      const k = (r.razlog || "").trim() || "bez navedenog razloga";
      s.razlozi.set(k, (s.razlozi.get(k) || 0) + 1);
    }
  }
  return s;
}
const pctOf = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// Kupci po firmi (ključ = companyKey)
function kupciPoFirmi(kupci) {
  const m = new Map();
  for (const k of kupci || []) {
    const key = companyKey(k.naziv_firme);
    if (!key) continue;
    if (!m.has(key)) m.set(key, []);
    m.get(key).push(k);
  }
  return m;
}
function licenceInfo(rows, porodica = "Sve", tip = "Sve") {
  let rel = rows || [];
  if (tip !== "Sve") rel = rel.filter((k) => (TIP_GRUPA[tip] || []).includes(String(k.revenue_type || "").toUpperCase()));
  if (porodica !== "Sve") rel = rel.filter((k) => porodicaLicence(k) === porodica);
  const m = new Map();
  let n = 0;
  let maxEnd = null;
  let aktivno = false;
  for (const k of rel) {
    const f = porodicaLicence(k);
    const kom = jeKomponenta(k) ? 0 : licKom(k);
    m.set(f, (m.get(f) || 0) + kom);
    n += kom;
    const e = k.end_date ? String(k.end_date).slice(0, 10) : null;
    if (e && (!maxEnd || e > maxEnd)) maxEnd = e;
    if (e ? daysDiff(e) >= 0 : /w\/support/i.test(k.izvorni_status || "") && !/wo\/support/i.test(k.izvorni_status || "")) aktivno = true;
  }
  const tekst = PORODICE_LIC.filter((f) => m.get(f) > 0).map((f) => `${f} ${m.get(f)}`).join(" · ");
  return { tekst, n, maxEnd, aktivno, ima: rel.length > 0 };
}
function odrzavanjeOk(li, opcija) {
  if (opcija === "Sve") return true;
  if (opcija === "Aktivno") return li.aktivno;
  if (opcija === "Isteklo") return !li.aktivno;
  const d = li.maxEnd ? daysDiff(li.maxEnd) : null;
  if (d == null) return false;
  if (opcija === "Isteklo prije 1+ god.") return !li.aktivno && d < -365;
  if (opcija === "Isteklo prije 3+ god.") return !li.aktivno && d < -1095;
  if (opcija === "Ističe u 90 dana") return li.aktivno && d >= 0 && d <= 90;
  return true;
}
function zadnjiOk(p, opcija) {
  if (opcija === "Bilo kada") return true;
  const n = daysAgo(p.zadnji_kontakt);
  if (opcija === "Nikad kontaktirano") return n == null;
  if (n == null) return opcija !== "Zadnjih 90 dana";
  if (opcija === "Zadnjih 90 dana") return n <= 90;
  if (opcija === "Prije više od 6 mj.") return n > 182;
  if (opcija === "Prije više od 12 mj.") return n > 365;
  return true;
}
// prvi potencijal po firmi (prednost ima zapis s prodavačem)
function potencijaliPoFirmi(potencijali) {
  const m = new Map();
  for (const p of potencijali || []) {
    const key = companyKey(p.naziv_firme);
    if (!key) continue;
    const b = m.get(key);
    if (!b || (!prodavaciOf(b).length && prodavaciOf(p).length)) m.set(key, p);
  }
  return m;
}
function prodavacIzBaze(p) {
  return p ? prodavaciOf(p)[0] || "" : "";
}

/* ---------------------------------------------------------------------- */
/*  Mali UI elementi                                                       */
/* ---------------------------------------------------------------------- */

function StatusPill({ status, chev = false }) {
  const [cls, dot] = STATUS_STIL[status] || STATUS_STIL["Nije kontaktirana"];
  return (
    <span className={"inline-flex items-center gap-1.5 text-xs font-semibold pl-2 pr-2.5 py-0.5 rounded-full whitespace-nowrap " + cls}>
      <span className={"w-1.5 h-1.5 rounded-full " + dot} />{status}{chev && <ChevronDown size={12} className="opacity-60 -mr-1" />}
    </span>
  );
}
function StatusSelect({ value, onChange, disabled }) {
  return (
    <span className="relative inline-flex" onClick={(e) => e.stopPropagation()}>
      <StatusPill status={value} chev={!disabled} />
      {!disabled && (
        <select aria-label="Status u akciji" value={value} onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
          {A_STATUSI.map((s) => <option key={s}>{s}</option>)}
        </select>
      )}
    </span>
  );
}
function LicenceChip({ r }) {
  if (!r.licence) return <span className="text-slate-300 dark:text-slate-600">—</span>;
  const istekla = r.odrzavanje_do && daysDiff(String(r.odrzavanje_do).slice(0, 10)) < 0;
  return (
    <span title={`${r.licence} — broj osnovnih licenci (bez dodataka uz paket)${r.odrzavanje_do ? ` · održavanje do ${fmtDate(r.odrzavanje_do)}` : ""}`}
      className={"inline-flex items-center gap-1.5 h-6 px-2 rounded-md border text-xs font-semibold whitespace-nowrap max-w-full " +
        (istekla ? "bg-white text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700"
          : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900")}>
      <span className={"w-1.5 h-1.5 rounded-sm shrink-0 " + (istekla ? "bg-slate-300 dark:bg-slate-600" : "bg-red-600")} />
      <span className="truncate">{r.licence}</span>
    </span>
  );
}
function Lijevak({ s, compact = false }) {
  const redovi = [["Kontaktirano", s.kontaktirano, "#3b82f6"], ["Zainteresovano", s.zainteresovano, "#f59e0b"], ["Ponuda", s.ponuda, "#8b5cf6"], ["Dobijeno", s.dobijeno, "#22c55e"]];
  if (!compact) redovi.unshift(["Firmi u akciji", s.ukupno, "#94a3b8"]);
  return (
    <div className="space-y-1.5">
      {redovi.map(([l, v, c], i) => (
        <div key={l} className={"grid items-center gap-2.5 " + (compact ? "grid-cols-[104px_1fr_64px]" : "grid-cols-[120px_1fr_84px]")}>
          <span className="text-[12.5px] text-slate-600 dark:text-slate-400">{l}</span>
          <div className={(compact ? "h-2 " : "h-4 ") + "rounded bg-slate-100 dark:bg-slate-800 overflow-hidden"}>
            <div className="h-full rounded" style={{ width: `${pctOf(v, s.ukupno)}%`, background: c }} />
          </div>
          <span className="text-[12.5px] font-bold text-slate-900 dark:text-slate-100 text-right tabular-nums">
            {fmtN(v)} <span className="font-medium text-slate-400">{compact ? `/ ${fmtN(s.ukupno)}` : !compact && (i > 0) ? `${pctOf(v, s.ukupno)}%` : ""}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
function BigModal({ title, onClose, children, footer, maxW = "max-w-4xl" }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 p-3 sm:p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className={maxW + " w-full bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-h-[92vh] flex flex-col border border-transparent dark:border-slate-700"} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          <button type="button" onClick={onClose} className={btnGhostIcon} aria-label="Zatvori"><X size={18} /></button>
        </div>
        <div className="p-5 sm:p-6 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-5 sm:px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 shrink-0 flex flex-wrap justify-end items-center gap-2">{footer}</div>}
      </div>
    </div>
  );
}
const Lbl = ({ children }) => <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">{children}</span>;
const Napomena = ({ children }) => (
  <div className="flex items-start gap-2 text-[12.5px] text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2">
    <Info size={14} className="mt-0.5 shrink-0 text-slate-400" /><span>{children}</span>
  </div>
);

/* ---------------------------------------------------------------------- */
/*  Izbor firmi (Kupci / Baza potencijala / Excel / ručno)                 */
/* ---------------------------------------------------------------------- */

const IZVORI = [["kupci", "Iz Kupaca i licenci"], ["potencijali", "Iz Baze potencijala"], ["excel", "Iz Excela"], ["rucno", "Ručno"]];
const IZVOR_NAZIV = Object.fromEntries(IZVORI);

function FirmePicker({ kupci, potencijali, postojeci, onChange }) {
  const [izvor, setIzvor] = useState("kupci");
  const [fDrz, setFDrz] = useState("BA");
  const [fPor, setFPor] = useState("SOLIDWORKS");
  const [fOdr, setFOdr] = useState("Isteklo");
  const [fTip, setFTip] = useState("ALC");
  const [pProd, setPProd] = useState("Svi");
  const [pStatus, setPStatus] = useState("Svi");
  const [pZadnji, setPZadnji] = useState("Bilo kada");
  const [excel, setExcel] = useState([]);
  const [excelInfo, setExcelInfo] = useState("");
  const [rucno, setRucno] = useState([]);
  const [rucnoQ, setRucnoQ] = useState("");
  const [iskljucene, setIskljucene] = useState(() => new Set());
  const [dodjela, setDodjela] = useState({});
  const [q, setQ] = useState("");

  const kupciMap = useMemo(() => kupciPoFirmi(kupci), [kupci]);
  const potMap = useMemo(() => potencijaliPoFirmi(potencijali), [potencijali]);
  const sviNazivi = useMemo(() => {
    const s = new Map();
    for (const p of potencijali || []) { const k = companyKey(p.naziv_firme); if (k && !s.has(k)) s.set(k, p.naziv_firme.trim()); }
    for (const [k, rows] of kupciMap) if (!s.has(k)) s.set(k, String(rows[0].naziv_firme || "").trim());
    return s;
  }, [potencijali, kupciMap]);
  const indeks = useMemo(() => buildCompanyNameIndex([...sviNazivi.values()]), [sviNazivi]);

  const kandidat = (key, naziv, drzava, extra = {}) => {
    const li = extra.li || licenceInfo(kupciMap.get(key) || []);
    const p = potMap.get(key);
    return {
      key, firma: naziv, drzava: drzava || (p && p.drzava) || ((kupciMap.get(key) || [])[0] || {}).drzava || "",
      licence: li.tekst || "", broj_licenci: li.n || null, odrzavanje_do: li.maxEnd || null,
      prodavac: extra.prodavac || prodavacIzBaze(p), uBazi: !!p,
    };
  };

  const kandidati = useMemo(() => {
    let out = [];
    if (izvor === "kupci") {
      for (const [key, rows] of kupciMap) {
        if (fDrz !== "Sve" && drzavaGrupa(rows[0].drzava) !== fDrz) continue;
        const li = licenceInfo(rows, fPor, fTip);
        if (!li.ima || !odrzavanjeOk(li, fOdr)) continue;
        out.push(kandidat(key, String(rows[0].naziv_firme || "").trim(), rows[0].drzava, { li }));
      }
      out.sort((a, b) => (b.odrzavanje_do || "").localeCompare(a.odrzavanje_do || "") || a.firma.localeCompare(b.firma, "hr"));
    } else if (izvor === "potencijali") {
      for (const [key, p] of potMap) {
        if (fDrz !== "Sve" && drzavaGrupa(p.drzava) !== fDrz) continue;
        if (pProd !== "Svi" && !(pProd === "(nedodijeljeno)" ? prodavaciOf(p).length === 0 : prodavaciOf(p).includes(pProd))) continue;
        if (pStatus !== "Svi" && p.status !== pStatus) continue;
        if (!zadnjiOk(p, pZadnji)) continue;
        out.push(kandidat(key, p.naziv_firme.trim(), p.drzava));
      }
      out.sort((a, b) => a.firma.localeCompare(b.firma, "hr"));
    } else if (izvor === "excel") {
      out = excel.map((e) => kandidat(e.key, e.firma, "", { prodavac: e.prodavac }));
    } else {
      out = rucno.map((e) => kandidat(e.key, e.firma, ""));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [izvor, kupciMap, potMap, fDrz, fPor, fOdr, fTip, pProd, pStatus, pZadnji, excel, rucno]);

  const vecUAkciji = kandidati.filter((k) => postojeci.has(k.key)).length;
  const nove = useMemo(() => kandidati.filter((k) => !postojeci.has(k.key)), [kandidati, postojeci]);
  const odabrane = useMemo(() => nove.filter((k) => !iskljucene.has(k.key)).map((k) => ({ ...k, prodavac: dodjela[k.key] !== undefined ? dodjela[k.key] : k.prodavac })),
    [nove, iskljucene, dodjela]);
  const opisFiltera = useMemo(() => {
    if (izvor === "kupci") return { izvor, drzava: fDrz, porodica: fPor, odrzavanje: fOdr, tip: fTip };
    if (izvor === "potencijali") return { izvor, drzava: fDrz, prodavac: pProd, status: pStatus, zadnji_kontakt: pZadnji };
    return { izvor };
  }, [izvor, fDrz, fPor, fOdr, fTip, pProd, pStatus, pZadnji]);
  useEffect(() => { onChange(odabrane, opisFiltera); }, [odabrane, opisFiltera, onChange]);

  const qq = q.trim().toLowerCase();
  const prikaz = nove.filter((k) => !qq || k.firma.toLowerCase().includes(qq));
  const nedodijeljenih = odabrane.filter((k) => !k.prodavac).length;

  const ucitajExcel = async (file) => {
    setExcelInfo("");
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: "" });
      const prodavaci = PRODAJA_MARKETING_NAMES;
      const out = new Map();
      let prepoznato = 0;
      aoa.forEach((r, i) => {
        const raw = String(r[0] || "").trim();
        if (!raw) return;
        if (i === 0 && /firma|naziv|kupac|company/i.test(raw)) return; // zaglavlje
        const match = findCompanyMatch(raw, indeks);
        if (match) prepoznato += 1;
        const naziv = match || raw;
        const key = companyKey(naziv);
        if (!key || out.has(key)) return;
        const pr = String(r[1] || "").trim().toLowerCase();
        const prodavac = pr ? prodavaci.find((n) => n.toLowerCase() === pr || n.toLowerCase().startsWith(pr + " ") || n.split(" ")[0].toLowerCase() === pr) || "" : "";
        out.set(key, { key, firma: naziv, prodavac });
      });
      setExcel([...out.values()]);
      setExcelInfo(`${out.size} firmi iz fajla, ${prepoznato} prepoznato u CRM-u.`);
    } catch (e) {
      console.error(e);
      setExcelInfo("Fajl nije moguće pročitati — koristi .xlsx, .xls ili .csv.");
      setExcel([]);
    }
  };
  const dodajRucno = () => {
    const raw = rucnoQ.trim();
    if (!raw) return;
    const naziv = findCompanyMatch(raw, indeks) || raw;
    const key = companyKey(naziv);
    if (key && !rucno.some((r) => r.key === key)) setRucno([...rucno, { key, firma: naziv }]);
    setRucnoQ("");
  };
  const toggle = (key) => setIskljucene((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const sel = "h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-[13px] text-slate-800 dark:text-slate-100 w-full";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Firme u akciji</span>
        <div className="inline-flex flex-wrap rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          {IZVORI.map(([k, l], i) => (
            <button key={k} type="button" onClick={() => setIzvor(k)}
              className={"h-8 px-3 text-[12.5px] " + (i ? "border-l border-slate-200 dark:border-slate-700 " : "") +
                (izvor === k ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800")}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {(izvor === "kupci" || izvor === "potencijali") && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <label><Lbl>Država</Lbl>
            <select className={sel} value={fDrz} onChange={(e) => setFDrz(e.target.value)}>{DRZAVE.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </label>
          {izvor === "kupci" ? (
            <>
              <label><Lbl>Proizvod</Lbl>
                <select className={sel} value={fPor} onChange={(e) => setFPor(e.target.value)}>{["Sve", ...PORODICE_LIC].map((p) => <option key={p} value={p}>{p === "Sve" ? "Svi proizvodi" : p}</option>)}</select>
              </label>
              <label><Lbl>Tip licence</Lbl>
                <select className={sel} value={fTip} onChange={(e) => setFTip(e.target.value)}>{TIPOVI.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              </label>
              <label><Lbl>Održavanje</Lbl>
                <select className={sel} value={fOdr} onChange={(e) => setFOdr(e.target.value)}>{ODRZAVANJE.map((o) => <option key={o}>{o}</option>)}</select>
              </label>
            </>
          ) : (
            <>
              <label><Lbl>Prodavač</Lbl>
                <select className={sel} value={pProd} onChange={(e) => setPProd(e.target.value)}>{["Svi", ...PRODAJA_MARKETING_NAMES, "(nedodijeljeno)"].map((p) => <option key={p}>{p}</option>)}</select>
              </label>
              <label><Lbl>Status potencijala</Lbl>
                <select className={sel} value={pStatus} onChange={(e) => setPStatus(e.target.value)}>{["Svi", ...POTENCIJAL_STATUSI].map((p) => <option key={p}>{p}</option>)}</select>
              </label>
              <label><Lbl>Zadnji kontakt</Lbl>
                <select className={sel} value={pZadnji} onChange={(e) => setPZadnji(e.target.value)}>{ZADNJI.map((o) => <option key={o}>{o}</option>)}</select>
              </label>
            </>
          )}
        </div>
      )}
      {izvor === "kupci" && (
        <p className="text-[11.5px] text-slate-500 dark:text-slate-400 -mt-1">
          Održavanje se gleda po firmi: „Isteklo“ = nijedna licenca odabranog proizvoda i tipa nema aktivno održavanje. Za neaktivne korisnike: Svi proizvodi + Isteklo prije 3+ god.
        </p>
      )}
      {izvor === "excel" && (
        <div className="space-y-1.5">
          <label className={btnSecondary + " cursor-pointer !inline-flex"}>
            <Upload size={15} /> Odaberi Excel fajl
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files[0] && ucitajExcel(e.target.files[0])} />
          </label>
          <p className="text-[11.5px] text-slate-500 dark:text-slate-400">Prva kolona = naziv firme, druga (nije obavezna) = prodavač. Nazivi se povezuju s firmama koje CRM već ima.</p>
          {excelInfo && <p className="text-[12.5px] text-teal-700 dark:text-teal-400">{excelInfo}</p>}
        </div>
      )}
      {izvor === "rucno" && (
        <div className="flex gap-2">
          <datalist id="akcije-firme-list">{[...sviNazivi.values()].slice(0, 3000).map((n) => <option key={n} value={n} />)}</datalist>
          <input list="akcije-firme-list" className={inputCls} value={rucnoQ} onChange={(e) => setRucnoQ(e.target.value)} placeholder="Naziv firme"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); dodajRucno(); } }} />
          <button type="button" className={btnSecondary} onClick={dodajRucno} disabled={!rucnoQ.trim()}><Plus size={15} /> Dodaj</button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900 rounded-xl px-3.5 py-2.5">
        <Building2 size={18} className="text-teal-700 dark:text-teal-400 shrink-0" />
        <div className="flex-1 min-w-[200px]">
          <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Odabrano <span className="text-teal-700 dark:text-teal-400">{fmtN(odabrane.length)}</span> od {fmtN(nove.length)} firmi
            {vecUAkciji > 0 && <span className="font-medium text-slate-500"> · {vecUAkciji} već u akciji</span>}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400">Prodavač se preuzima iz Baze potencijala; firme bez prodavača idu na „Nedodijeljeno“. Firmu možeš isključiti prije spremanja.</div>
        </div>
        {nedodijeljenih > 0 && (
          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
            {nedodijeljenih} nedodijeljenih →
            <select className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs" value=""
              onChange={(e) => { const v = e.target.value; if (!v) return; setDodjela((d) => { const n = { ...d }; odabrane.filter((k) => !k.prodavac).forEach((k) => { n[k.key] = v; }); return n; }); }}>
              <option value="">dodijeli…</option>
              {PRODAJA_MARKETING_NAMES.map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
        )}
      </div>

      {nove.length > 0 && (
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
            <input type="checkbox" aria-label="Odaberi sve" checked={iskljucene.size === 0 || nove.every((k) => !iskljucene.has(k.key))}
              onChange={(e) => setIskljucene(e.target.checked ? new Set() : new Set(nove.map((k) => k.key)))} />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex-1">Firma · licence · održavanje do</span>
            <input className="h-7 w-44 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs" placeholder="Traži u listi…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {prikaz.slice(0, 400).map((k) => {
              const off = iskljucene.has(k.key);
              const pr = dodjela[k.key] !== undefined ? dodjela[k.key] : k.prodavac;
              return (
                <div key={k.key} className={"grid grid-cols-[20px_minmax(0,1fr)_160px] items-center gap-2 px-3 py-1.5 " + (off ? "opacity-45" : "")}>
                  <input type="checkbox" aria-label={`Uključi ${k.firma}`} checked={!off} onChange={() => toggle(k.key)} />
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 truncate">{k.firma}
                      {!k.uBazi && <span className="ml-1.5 text-[10.5px] font-medium text-slate-400" title="Firma nije u Bazi potencijala">· nije u bazi</span>}
                    </div>
                    <div className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate">{k.licence || "nema licenci u Kupcima"}{k.odrzavanje_do ? ` · do ${fmtDate(k.odrzavanje_do)}` : ""}</div>
                  </div>
                  <select aria-label="Prodavač" disabled={off} value={pr || ""} onChange={(e) => setDodjela((d) => ({ ...d, [k.key]: e.target.value }))}
                    className={"h-8 rounded-lg border bg-white dark:bg-slate-900 px-2 text-xs " + (pr ? "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200" : "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300")}>
                    <option value="">Nedodijeljeno</option>
                    {PRODAJA_MARKETING_NAMES.map((n) => <option key={n}>{n}</option>)}
                  </select>
                </div>
              );
            })}
            {prikaz.length > 400 && <div className="px-3 py-2 text-xs text-slate-500">… i još {prikaz.length - 400} (sve su uključene; suzi filter ili koristi pretragu)</div>}
          </div>
        </div>
      )}
      {nove.length === 0 && (
        <p className="text-[13px] text-slate-500 dark:text-slate-400 py-2">{izvor === "excel" ? "Učitaj fajl s listom firmi." : izvor === "rucno" ? "Dodaj firme jednu po jednu." : "Nema firmi za ove filtere."}</p>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Nova / uredi akciju                                                    */
/* ---------------------------------------------------------------------- */

function AkcijaModal({ initial, kupci, potencijali, currentUser, onClose, onSave }) {
  const [f, setF] = useState(() => ({
    naziv: initial?.naziv || "", ponuda: initial?.ponuda || "",
    pocetak: initial?.pocetak ? String(initial.pocetak).slice(0, 10) : danasIso(),
    kraj: initial?.kraj ? String(initial.kraj).slice(0, 10) : plusDana(55),
    prodavaci: initial ? nizProdavaca(initial) : currentUser ? [currentUser] : [],
  }));
  const [firme, setFirme] = useState([]);
  const [filter, setFilter] = useState(null);
  const [busy, setBusy] = useState(false);
  const prazno = useMemo(() => new Set(), []);
  const onPick = useMemo(() => (rows, flt) => { setFirme(rows); setFilter(flt); }, []);
  const toggleP = (n) => setF((x) => ({ ...x, prodavaci: x.prodavaci.includes(n) ? x.prodavaci.filter((y) => y !== n) : [...x.prodavaci, n] }));
  const ok = f.naziv.trim() && currentUser && (!f.kraj || !f.pocetak || f.kraj >= f.pocetak);
  const submit = async () => {
    if (!ok || busy) return;
    setBusy(true);
    try {
      const done = await onSave({
        naziv: f.naziv.trim(), ponuda: f.ponuda.trim() || null, pocetak: f.pocetak || null, kraj: f.kraj || null,
        prodavaci: f.prodavaci, ...(initial ? {} : { izvor: filter ? IZVOR_NAZIV[filter.izvor] : null, filter }),
      }, initial ? null : firme);
      if (done !== false) onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <BigModal title={initial ? "Uredi akciju" : "Nova akcija"} onClose={onClose} maxW={initial ? "max-w-xl" : "max-w-4xl"}
      footer={<>
        {!initial && <span className="text-[12.5px] text-slate-500 mr-auto">{fmtN(firme.length)} firmi ide u akciju</span>}
        <button type="button" className={btnSecondary} onClick={onClose}>Otkaži</button>
        <button type="button" className={btnPrimary} onClick={submit} disabled={!ok || busy}>{busy ? "Čuvam…" : initial ? "Sačuvaj" : "Napravi akciju"}</button>
      </>}>
      <div className={initial ? "space-y-4" : "grid grid-cols-1 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-6"}>
        <div className="space-y-4">
          <label className="block"><Lbl>Naziv akcije *</Lbl>
            <input className={inputCls} value={f.naziv} onChange={(e) => setF({ ...f, naziv: e.target.value })} placeholder="npr. Zakup 2+1 — korisnici bez održavanja" autoFocus />
          </label>
          <label className="block"><Lbl>Ponuda (kratko, vidi se u listi i izvještaju)</Lbl>
            <textarea className={inputCls} rows={3} value={f.ponuda} onChange={(e) => setF({ ...f, ponuda: e.target.value })} placeholder="npr. Trajne licence s isteklim održavanjem: plati 2 godine zakupa, dobij 3" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><Lbl>Početak</Lbl><input type="date" className={inputCls} value={f.pocetak} onChange={(e) => setF({ ...f, pocetak: e.target.value })} /></label>
            <label className="block"><Lbl>Kraj</Lbl><input type="date" className={inputCls} value={f.kraj} min={f.pocetak || undefined} onChange={(e) => setF({ ...f, kraj: e.target.value })} /></label>
          </div>
          <div><Lbl>Prodavači u akciji</Lbl>
            <div className="flex flex-wrap gap-1.5">
              {PRODAJA_MARKETING_NAMES.map((n) => {
                const on = f.prodavaci.includes(n);
                return (
                  <button key={n} type="button" onClick={() => toggleP(n)}
                    className={"h-7 px-2.5 rounded-full text-[12.5px] border transition-colors " + (on ? "bg-teal-600 border-teal-600 text-white" : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-teal-400")}>
                    {on && <Check size={12} className="inline -mt-0.5 mr-1" />}{n}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {!initial && <FirmePicker kupci={kupci} potencijali={potencijali} postojeci={prazno} onChange={onPick} />}
      </div>
    </BigModal>
  );
}

function DodajFirmeModal({ akcija, kupci, potencijali, postojeci, onClose, onAdd }) {
  const [firme, setFirme] = useState([]);
  const [busy, setBusy] = useState(false);
  const onPick = useMemo(() => (rows) => setFirme(rows), []);
  return (
    <BigModal title={`Dodaj firme — ${akcija.naziv}`} onClose={onClose}
      footer={<>
        <span className="text-[12.5px] text-slate-500 mr-auto">{fmtN(firme.length)} novih firmi</span>
        <button type="button" className={btnSecondary} onClick={onClose}>Otkaži</button>
        <button type="button" className={btnPrimary} disabled={!firme.length || busy}
          onClick={async () => { setBusy(true); try { await onAdd(firme); onClose(); } catch (e) { /* toast je već prikazan */ } finally { setBusy(false); } }}>
          {busy ? "Dodajem…" : `Dodaj ${fmtN(firme.length)} firmi`}
        </button>
      </>}>
      <FirmePicker kupci={kupci} potencijali={potencijali} postojeci={postojeci} onChange={onPick} />
    </BigModal>
  );
}

/* ---------------------------------------------------------------------- */
/*  Prebaci u forecast                                                     */
/* ---------------------------------------------------------------------- */

function ForecastModal({ r, akcija, potencijal, onClose, onSave }) {
  const zakup = /zakup|ylc|najam/i.test(`${akcija.naziv} ${akcija.ponuda || ""}`);
  const porodica = (r.licence || "").split(" ")[0];
  const [f, setF] = useState({
    mjesec: currentMonthStr(),
    softver: FORECAST_SOFTVERI.includes(porodica) ? porodica : "SOLIDWORKS",
    tip_licence: zakup ? "YLC" : "PLC",
    broj_licenci: r.broj_licenci != null ? String(r.broj_licenci) : "",
    status: "U pregovorima",
    vrijednost: r.vrijednost != null ? String(r.vrijednost) : "",
    napomena: `Akcija: ${akcija.naziv}`,
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const sel = inputCls;
  const submit = async () => {
    setBusy(true);
    try {
      const v = num(f.vrijednost);
      await onSave({
        mjesec: f.mjesec, prodavac: FORECAST_PRODAVACI.includes(r.prodavac) ? r.prodavac : "",
        kupac: potencijal ? potencijal.naziv_firme : r.firma, softver: f.softver, tip_licence: f.tip_licence,
        broj_licenci: f.broj_licenci === "" ? null : Number(f.broj_licenci), status: f.status,
        napomena: [f.napomena.trim(), v ? `Vrijednost ponude: ${fmtEur(v)}` : ""].filter(Boolean).join(" · "),
        potencijal_id: potencijal ? potencijal.id : null,
      }, v);
      onClose();
    } catch (e) {
      /* toast je već prikazan */
    } finally {
      setBusy(false);
    }
  };
  return (
    <BigModal title={`Prebaci u forecast — ${r.firma}`} onClose={onClose} maxW="max-w-lg"
      footer={<>
        <button type="button" className={btnSecondary} onClick={onClose}>Otkaži</button>
        <button type="button" className={btnPrimary} onClick={submit} disabled={busy || !f.mjesec}><TrendingUp size={15} /> {busy ? "Čuvam…" : "Prebaci u forecast"}</button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><Lbl>Mjesec</Lbl><input type="month" className={sel} value={f.mjesec} onChange={set("mjesec")} /></label>
        <label className="block"><Lbl>Status</Lbl><select className={sel} value={f.status} onChange={set("status")}>{FORECAST_STATUSI.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label className="block"><Lbl>Softver</Lbl><select className={sel} value={f.softver} onChange={set("softver")}>{FORECAST_SOFTVERI.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label className="block"><Lbl>Tip licence</Lbl><select className={sel} value={f.tip_licence} onChange={set("tip_licence")}>{FORECAST_TIPOVI_LICENCE.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label className="block"><Lbl>Broj licenci</Lbl><input type="number" min="0" className={sel} value={f.broj_licenci} onChange={set("broj_licenci")} /></label>
        <label className="block"><Lbl>Vrijednost ponude (€)</Lbl><input inputMode="decimal" className={sel} value={f.vrijednost} onChange={set("vrijednost")} placeholder="npr. 5800" /></label>
      </div>
      <label className="block mt-3"><Lbl>Napomena</Lbl><input className={sel} value={f.napomena} onChange={set("napomena")} /></label>
      <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-3">
        Stavka se pravi u Forecastu{FORECAST_PRODAVACI.includes(r.prodavac) ? ` (prodavač: ${r.prodavac})` : ""}. Kad je tamo označiš kao „Dobijeno“, i u akciji se računa kao dobijena.
      </p>
    </BigModal>
  );
}

/* ---------------------------------------------------------------------- */
/*  Panel firme u akciji                                                   */
/* ---------------------------------------------------------------------- */

function FirmaPanel({ r, akcija, fcById, potencijal, kalkulacije, currentUser, onClose, onUpdate, onZapis, onForecast, onKalkulator, onRemove, onViewCompany }) {
  const [novi, setNovi] = useState("");
  const [datum, setDatum] = useState(danasIso());
  const [busy, setBusy] = useState(false);
  const [razlog, setRazlog] = useState(r.razlog || "");
  const [vrij, setVrij] = useState(r.vrijednost != null ? String(r.vrijednost) : "");
  const [pDatum, setPDatum] = useState(r.podsjetnik_datum ? String(r.podsjetnik_datum).slice(0, 10) : "");
  const [pOpis, setPOpis] = useState(r.podsjetnik_opis || "");
  const [sveH, setSveH] = useState(false);
  useEffect(() => {
    setRazlog(r.razlog || ""); setVrij(r.vrijednost != null ? String(r.vrijednost) : "");
    setPDatum(r.podsjetnik_datum ? String(r.podsjetnik_datum).slice(0, 10) : ""); setPOpis(r.podsjetnik_opis || "");
  }, [r.id, r.razlog, r.vrijednost, r.podsjetnik_datum, r.podsjetnik_opis]);
  useEffect(() => { setNovi(""); setDatum(danasIso()); setSveH(false); }, [r.id]);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const st = efStatus(r, fcById);
  const fc = forecastOf(r, fcById);
  const korak = KORACI.indexOf(st);
  const historija = r.historija || [];
  const shownH = sveH ? historija : historija.slice(0, 4);
  const kalk = useMemo(() => kalkulacije.filter((k) => companyKey(k.firma) === r.firma_key)
    .sort((a, b) => String(b.datum || "").localeCompare(String(a.datum || ""))).slice(0, 3), [kalkulacije, r.firma_key]);

  const run = async (fn) => { setBusy(true); try { await fn(); } catch (e) { /* toast je već prikazan */ } finally { setBusy(false); } };
  const setStatus = (s) => { if (s !== r.status) run(() => onUpdate(r, { status: s })); };
  const dodaj = () => {
    if (!novi.trim() || !currentUser) return;
    run(async () => { await onZapis(r, { datum: datum || danasIso(), kolega: currentUser, opis: novi.trim() }); setNovi(""); setDatum(danasIso()); });
  };
  const sacuvajVrijednost = () => {
    const v = vrij.trim() === "" ? null : num(vrij);
    if (v === (r.vrijednost == null ? null : Number(r.vrijednost))) return;
    run(() => onUpdate(r, { vrijednost: v }, "Vrijednost ponude sačuvana"));
  };
  const btnSm = btnSecondary + " !py-1.5 text-[13px] justify-center";

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/40 dark:bg-black/60 xl:static xl:z-auto xl:bg-transparent xl:dark:bg-transparent" onClick={onClose}>
      <div className="absolute right-0 top-0 h-full w-full max-w-[460px] xl:static xl:h-auto xl:max-h-[calc(100vh-7rem)] xl:w-[420px] xl:max-w-none xl:sticky xl:top-2 bg-white dark:bg-slate-900 xl:border border-slate-200 dark:border-slate-800 xl:rounded-2xl shadow-2xl xl:shadow-lg xl:shadow-slate-900/5 flex flex-col overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-3.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-[17px] font-bold text-slate-900 dark:text-slate-100 leading-snug break-words">{r.firma}</h3>
              <p className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                {r.licence || "bez licenci u Kupcima"}{r.odrzavanje_do ? ` · održavanje do ${fmtDate(r.odrzavanje_do)}` : ""}
              </p>
            </div>
            {onViewCompany && <button type="button" className={btnSecondary + " !py-1 !px-2 text-[12.5px] whitespace-nowrap"} onClick={() => onViewCompany(r.firma)}><ExternalLink size={13} /> 360°</button>}
            <button type="button" className={btnGhostIcon} onClick={onClose} aria-label="Zatvori"><X size={18} /></button>
          </div>
          <label className="mt-2.5 flex items-center gap-2 text-[12.5px] text-slate-600 dark:text-slate-400">
            <Users size={13} className="text-slate-400" /> Prodavač:
            <select aria-label="Prodavač firme" className="h-7 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 text-[12.5px] text-slate-800 dark:text-slate-100"
              value={r.prodavac || ""} disabled={busy} onChange={(e) => run(() => onUpdate(r, { prodavac: e.target.value || null }, "Prodavač promijenjen"))}>
              <option value="">Nedodijeljeno</option>
              {[...new Set([...PRODAJA_MARKETING_NAMES, ...(r.prodavac ? [r.prodavac] : [])])].map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* status */}
          <div>
            <PanelLabel>Status u akciji</PanelLabel>
            <div className="flex items-start">
              {KORACI.map((s, i) => {
                const done = korak > i; const cur = korak === i;
                return [
                  <button key={s} type="button" disabled={busy} onClick={() => setStatus(s)} className="flex flex-col items-center gap-1.5 w-[62px] shrink-0 text-center">
                    <span className={"w-6 h-6 rounded-full inline-flex items-center justify-center transition-colors " +
                      (done ? "bg-teal-600 text-white" : cur ? "border-2 border-teal-600 bg-teal-50 dark:bg-teal-900/40" : "border-2 border-slate-300 dark:border-slate-600 hover:border-teal-400")}>
                      {done ? <Check size={13} /> : cur ? <span className="w-2 h-2 rounded-full bg-teal-600" /> : null}
                    </span>
                    <span className={"text-[11px] leading-tight " + (cur ? "font-bold text-teal-800 dark:text-teal-300" : done ? "text-slate-700 dark:text-slate-300" : "text-slate-400")}>{s}</span>
                  </button>,
                  i < KORACI.length - 1 ? <span key={s + "l"} className={"flex-1 h-0.5 mt-3 " + (korak > i ? "bg-teal-500" : "bg-slate-200 dark:bg-slate-700")} /> : null,
                ];
              })}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" disabled={busy} onClick={() => setStatus(st === "Nije zainteresovana" ? "Kontaktirana" : "Nije zainteresovana")}
                className={"inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-xs " + (st === "Nije zainteresovana"
                  ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300 font-semibold"
                  : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-red-300")}>
                <X size={12} /> Nije zainteresovana
              </button>
              {fc && isForecastWon(fc.status) && r.status !== "Dobijeno" && <span className="text-[11.5px] text-green-700 dark:text-green-400">dobijeno u Forecastu</span>}
            </div>
            {st === "Nije zainteresovana" && (
              <input className={inputCls + " !py-1.5 mt-2 text-[13px]"} placeholder="Razlog (npr. prešli na drugi softver) — Enter"
                value={razlog} onChange={(e) => setRazlog(e.target.value)}
                onBlur={() => razlog.trim() !== (r.razlog || "") && run(() => onUpdate(r, { razlog: razlog.trim() || null }, "Razlog sačuvan"))}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
            )}
          </div>

          {/* šta je dogovoreno */}
          <div>
            <PanelLabel>Šta je dogovoreno</PanelLabel>
            <div className="flex gap-2">
              <input aria-label="Šta je dogovoreno" className={inputCls + " !py-1.5"} value={novi} disabled={busy || !currentUser}
                placeholder={currentUser ? "Šta je dogovoreno? (Enter)" : "Prijavi se s imenom"} onChange={(e) => setNovi(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); dodaj(); } }} />
              <input type="date" aria-label="Datum zapisa" className={inputCls + " !py-1.5 !w-[136px] shrink-0"} value={datum} onChange={(e) => setDatum(e.target.value)} />
            </div>
            <p className="text-[11.5px] mt-1.5 flex items-start gap-1.5 text-teal-700 dark:text-teal-400">
              <History size={12} className="mt-0.5 shrink-0" />
              {potencijal ? "Upisuje se i u historiju kontaktiranja u Bazi potencijala, s oznakom akcije." : <span className="text-slate-500 dark:text-slate-400">Firma nije u Bazi potencijala — zapis ostaje samo u akciji.</span>}
            </p>
            {historija.length > 0 && (
              <ol className="mt-3 space-y-0">
                {shownH.map((h, i) => (
                  <li key={i} className="flex gap-2.5 py-2 border-t border-slate-100 dark:border-slate-800">
                    <Avatar name={h.kolega || "?"} size="sm" />
                    <div className="min-w-0">
                      <div className="text-[11.5px] text-slate-500 dark:text-slate-400"><b className="text-slate-800 dark:text-slate-200 font-semibold">{h.kolega || "—"}</b> · {h.datum ? fmtDate(h.datum) : "—"}</div>
                      {h.opis ? <div className="text-[13px] text-slate-700 dark:text-slate-300 break-words whitespace-pre-line">{h.opis}</div>
                        : h.status ? <div className="text-[12.5px] text-slate-500 dark:text-slate-400">status → <b className="font-semibold">{h.status}</b></div> : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {historija.length > 4 && (
              <button type="button" onClick={() => setSveH(!sveH)} className="mt-1 text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline">
                {sveH ? "Prikaži manje" : `Prikaži sve (${historija.length})`}
              </button>
            )}
          </div>

          {/* podsjetnik */}
          <div>
            <PanelLabel right={r.podsjetnik_datum ? (
              <button type="button" disabled={busy} className="text-xs font-medium text-green-700 dark:text-green-400 hover:underline inline-flex items-center gap-1"
                onClick={() => run(() => onUpdate(r, { podsjetnik_datum: null, podsjetnik_opis: null }, "Podsjetnik obavljen"))}><Check size={12} /> Obavljeno</button>
            ) : null}>Podsjetnik</PanelLabel>
            <div className="flex gap-2">
              <input type="date" aria-label="Datum podsjetnika" className={inputCls + " !py-1.5 !w-[140px] shrink-0"} value={pDatum} onChange={(e) => setPDatum(e.target.value)} />
              <input aria-label="Opis podsjetnika" className={inputCls + " !py-1.5"} value={pOpis} onChange={(e) => setPOpis(e.target.value)} placeholder="npr. nazvati direktora" />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {[["Sutra", 1], ["Za 3 dana", 3], ["Za 1 sedmicu", 7], ["Za 2 sedmice", 14]].map(([l, n]) => (
                <button key={l} type="button" className="h-7 px-2.5 rounded-full border border-slate-200 dark:border-slate-700 text-[12px] text-slate-600 dark:text-slate-300 hover:border-teal-400" onClick={() => setPDatum(plusDana(n))}>{l}</button>
              ))}
              <span className="flex-1" />
              <button type="button" className={btnSecondary + " !py-1 !px-2.5 text-[12.5px]"} disabled={busy || !pDatum || (pDatum === String(r.podsjetnik_datum || "").slice(0, 10) && pOpis === (r.podsjetnik_opis || ""))}
                onClick={() => run(() => onUpdate(r, { podsjetnik_datum: pDatum, podsjetnik_opis: pOpis.trim() || null }, `Podsjetnik za ${fmtDate(pDatum)} sačuvan`))}>
                <Bell size={13} /> Sačuvaj podsjetnik
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Vidi se i u tabu Podsjetnici.</p>
          </div>

          {/* vrijednost + kalkulacije */}
          <div>
            <PanelLabel>Vrijednost ponude</PanelLabel>
            <div className="flex gap-2 items-center">
              <input aria-label="Vrijednost ponude u EUR" inputMode="decimal" className={inputCls + " !py-1.5"} value={vrij} onChange={(e) => setVrij(e.target.value)}
                onBlur={sacuvajVrijednost} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} placeholder="iznos u € (za izvještaj)" />
              <span className="text-sm text-slate-500">€</span>
            </div>
            {kalk.length > 0 && (
              <div className="mt-2 space-y-1">
                {kalk.map((k) => {
                  const t = izracunUkupno(k.stavke || []);
                  return (
                    <div key={k.id} className="flex items-center gap-2 text-[12.5px] text-slate-600 dark:text-slate-400">
                      <Calculator size={13} className="text-slate-400 shrink-0" />
                      <span className="truncate flex-1" title={k.naziv}>{k.naziv || "Kalkulacija"} · {fmtDate(k.datum)}</span>
                      <b className="text-slate-800 dark:text-slate-200 tabular-nums">{fmtEur(t.prodaja)}</b>
                      <button type="button" className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline"
                        onClick={() => { setVrij(String(Math.round(t.prodaja * 100) / 100)); run(() => onUpdate(r, { vrijednost: Math.round(t.prodaja * 100) / 100 }, "Iznos preuzet iz kalkulacije")); }}>preuzmi</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* forecast */}
          {fc ? (
            <div className="flex items-center gap-2 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900 rounded-xl px-3 py-2 text-[13px] text-teal-900 dark:text-teal-200">
              <TrendingUp size={15} className="shrink-0" />
              <span className="flex-1">U forecastu · {fc.mjesec} · <b>{fc.status}</b>{fc.broj_licenci ? ` · ${fc.broj_licenci} lic.` : ""}</span>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={btnSm} onClick={() => onKalkulator(r)}><Calculator size={14} /> Kalkulator</button>
            <button type="button" className={btnSm} disabled={!!fc} onClick={() => onForecast(r)} title={fc ? "Već je u forecastu" : undefined}>
              <TrendingUp size={14} /> {fc ? "U forecastu" : "Prebaci u forecast"}
            </button>
          </div>
          <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[11.5px] text-slate-400">
            <span>Dodano {r.created_at ? fmtDate(String(r.created_at).slice(0, 10)) : "—"}{r.created_by ? ` · ${r.created_by}` : ""}</span>
            <button type="button" className="inline-flex items-center gap-1 hover:text-red-600" onClick={() => onRemove(r)}><Trash2 size={12} /> Ukloni iz akcije</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Izvještaj (PDF / Excel)                                                */
/* ---------------------------------------------------------------------- */

function poProdavacu(rows, fcById) {
  const m = new Map();
  for (const r of rows) {
    const k = r.prodavac || "Nedodijeljeno";
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return [...m.entries()].map(([prodavac, rs]) => ({ prodavac, s: statistikaAkcije(rs, fcById) }))
    .sort((a, b) => (a.prodavac === "Nedodijeljeno") - (b.prodavac === "Nedodijeljeno") || b.s.ukupno - a.s.ukupno);
}

function izvjestajHtml(lista, fcById) {
  const blok = ({ a, rows }) => {
    const s = statistikaAkcije(rows, fcById);
    const pp = poProdavacu(rows, fcById);
    const bar = (l, v, c) => `<tr><td class="l">${l}</td><td><div class="bar"><div style="width:${pctOf(v, s.ukupno)}%;background:${c}"></div></div></td><td class="r"><b>${v}</b> <span class="m">${pctOf(v, s.ukupno)}%</span></td></tr>`;
    const razlozi = [...s.razlozi.entries()].sort((x, y) => y[1] - x[1]).map(([k, v]) => `${esc(k)} (${v})`).join(" · ") || "—";
    return `<section>
<div class="k">Izvještaj akcije</div><h1>${esc(a.naziv)}</h1>
<div class="m">${esc(periodTekst(a))}${a.ponuda ? ` · ${esc(a.ponuda)}` : ""}</div>
<div class="m">Stanje na ${esc(fmtDate(danasIso()))}${nizProdavaca(a).length ? ` · prodavači: ${esc(nizProdavaca(a).join(", "))}` : ""}</div>
<div class="kpi"><div><span>Firmi</span><b>${s.ukupno}</b></div><div><span>Kontaktirano</span><b>${pctOf(s.kontaktirano, s.ukupno)}%</b></div><div><span>Zainteresovano</span><b>${s.zainteresovano}</b></div><div><span>U forecastu</span><b>${esc(fmtEur(s.fcIznos))}</b></div><div class="g"><span>Dobijeno</span><b>${esc(fmtEur(s.dobIznos))}</b></div></div>
<h2>Lijevak</h2><table class="f">${bar("Firmi u akciji", s.ukupno, "#94a3b8")}${bar("Kontaktirano", s.kontaktirano, "#3b82f6")}${bar("Zainteresovano", s.zainteresovano, "#f59e0b")}${bar("Ponuda poslana", s.ponuda, "#8b5cf6")}${bar("Dobijeno", s.dobijeno, "#22c55e")}</table>
<h2>Po prodavaču</h2><table class="t"><thead><tr><th>Prodavač</th><th class="r">Firmi</th><th class="r">Kontakt.</th><th class="r">Zaint.</th><th class="r">Ponuda</th><th class="r">Dobij.</th><th class="r">Forecast</th><th class="r">Dobijeno</th></tr></thead><tbody>
${pp.map(({ prodavac, s: x }) => `<tr><td>${esc(prodavac)}</td><td class="r">${x.ukupno}</td><td class="r">${x.kontaktirano}</td><td class="r">${x.zainteresovano}</td><td class="r">${x.ponuda}</td><td class="r">${x.dobijeno}</td><td class="r">${x.fcIznos ? esc(fmtEur(x.fcIznos)) : "—"}</td><td class="r">${x.dobIznos ? esc(fmtEur(x.dobIznos)) : "—"}</td></tr>`).join("")}
</tbody></table>
<h2>Razlozi „Nije zainteresovana“</h2><p>${razlozi}</p>
<h2>Firme — zainteresovane, ponuda, dobijeno</h2><table class="t"><thead><tr><th>Firma</th><th>Prodavač</th><th>Status</th><th>Zadnji zapis</th><th class="r">Vrijednost</th></tr></thead><tbody>
${rows.filter((r) => ["Zainteresovana", "Ponuda poslana", "Dobijeno"].includes(efStatus(r, fcById))).map((r) => { const z = zadnjiZapis(r); return `<tr><td>${esc(r.firma)}</td><td>${esc(r.prodavac || "—")}</td><td>${esc(efStatus(r, fcById))}</td><td>${z ? `${esc(fmtDate(z.datum))} · ${esc(z.opis)}` : "—"}</td><td class="r">${r.vrijednost ? esc(fmtEur(r.vrijednost)) : "—"}</td></tr>`; }).join("") || `<tr><td colspan="5" class="m">još nema</td></tr>`}
</tbody></table></section>`;
  };
  return `<!doctype html><html lang="bs"><head><meta charset="utf-8"><title>Izvještaj — akcije</title><style>
body{font-family:-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#0f172a;margin:36px;font-size:12.5px}
section{page-break-after:always} section:last-child{page-break-after:auto}
.k{font-size:10.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#64748b} h1{font-size:21px;margin:2px 0 3px} h2{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#475569;margin:22px 0 6px}
.m{color:#64748b} .kpi{display:flex;gap:10px;margin-top:14px} .kpi div{flex:1;background:#f8fafc;border-radius:10px;padding:8px 12px} .kpi span{display:block;font-size:11px;color:#64748b} .kpi b{font-size:18px} .kpi .g{background:#f0fdf4} .kpi .g b{color:#15803d}
table{width:100%;border-collapse:collapse} .f td{padding:3px 6px} .f .l{width:130px} .f td:nth-child(2){width:70%} .bar{height:12px;background:#f1f5f9;border-radius:4px;overflow:hidden} .bar div{height:100%}
.t th{font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;text-align:left;border-bottom:2px solid #e2e8f0;padding:6px} .t td{border-bottom:1px solid #f1f5f9;padding:6px;vertical-align:top}
.r{text-align:right;white-space:nowrap} @media print{body{margin:14mm}}
</style></head><body>${lista.map(blok).join("")}
<script>window.onload=function(){setTimeout(function(){window.print()},250)}</script></body></html>`;
}
function otvoriPdf(lista, fcById) {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(izvjestajHtml(lista, fcById));
  w.document.close();
  return true;
}
function izvozExcel(lista, fcById, fileName) {
  const wb = XLSX.utils.book_new();
  const saz = [["Akcija", "Period", "Ponuda", "Firmi", "Kontaktirano", "Zainteresovano", "Ponuda poslana", "Dobijeno", "Nije zainteresovana", "U forecastu (€)", "Dobijeno (€)"]];
  const pro = [["Akcija", "Prodavač", "Firmi", "Kontaktirano", "Zainteresovano", "Ponuda poslana", "Dobijeno", "U forecastu (€)", "Dobijeno (€)"]];
  const fir = [["Akcija", "Firma", "Država", "Prodavač", "Licence", "Održavanje do", "Status", "Razlog", "Zadnji kontakt", "Zadnji zapis", "Podsjetnik", "Vrijednost (€)", "U forecastu"]];
  for (const { a, rows } of lista) {
    const s = statistikaAkcije(rows, fcById);
    saz.push([a.naziv, periodTekst(a), a.ponuda || "", s.ukupno, s.kontaktirano, s.zainteresovano, s.ponuda, s.dobijeno, s.po["Nije zainteresovana"], Math.round(s.fcIznos), Math.round(s.dobIznos)]);
    poProdavacu(rows, fcById).forEach(({ prodavac, s: x }) => pro.push([a.naziv, prodavac, x.ukupno, x.kontaktirano, x.zainteresovano, x.ponuda, x.dobijeno, Math.round(x.fcIznos), Math.round(x.dobIznos)]));
    rows.forEach((r) => {
      const z = zadnjiZapis(r);
      const fc = forecastOf(r, fcById);
      fir.push([a.naziv, r.firma, r.drzava || "", r.prodavac || "Nedodijeljeno", r.licence || "", r.odrzavanje_do ? fmtDate(r.odrzavanje_do) : "", efStatus(r, fcById), r.razlog || "",
        r.zadnji_kontakt ? fmtDate(r.zadnji_kontakt) : "", z ? z.opis : "", r.podsjetnik_datum ? fmtDate(r.podsjetnik_datum) : "", r.vrijednost != null ? Number(r.vrijednost) : "", fc ? `${fc.mjesec} · ${fc.status}` : ""]);
    });
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(saz), "Sažetak");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pro), "Po prodavaču");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fir), "Firme");
  XLSX.writeFile(wb, fileName);
}

function IzvjestajModal({ a, rows, fcById, onClose, showToast }) {
  const s = statistikaAkcije(rows, fcById);
  const pp = poProdavacu(rows, fcById);
  const razlozi = [...s.razlozi.entries()].sort((x, y) => y[1] - x[1]);
  const pdf = () => { if (!otvoriPdf([{ a, rows }], fcById) && showToast) showToast("Browser je blokirao novi prozor — dozvoli pop-up za CRM", "error"); };
  const xls = () => izvozExcel([{ a, rows }], fcById, `Akcija_${a.naziv.replace(/[^\p{L}\p{N}]+/gu, "_").slice(0, 40)}_${danasIso()}.xlsx`);
  const kpi = [["Kontaktirano", `${pctOf(s.kontaktirano, s.ukupno)}%`, "bg-blue-50 dark:bg-blue-950/30", "text-blue-700 dark:text-blue-300", ""],
    ["Zainteresovano", `${fmtN(s.zainteresovano)} firmi`, "bg-amber-50 dark:bg-amber-950/30", "text-amber-800 dark:text-amber-300", ""],
    ["U forecastu", fmtEur(s.fcIznos), "bg-teal-50 dark:bg-teal-950/30", "text-teal-700 dark:text-teal-300", ""],
    ["Dobijeno", fmtEur(s.dobIznos), "bg-green-50 dark:bg-green-950/30", "text-green-700 dark:text-green-300", "!text-green-700 dark:!text-green-400"]];
  const th = "text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right";
  return (
    <BigModal title="Izvještaj za nadređene" onClose={onClose} maxW="max-w-3xl"
      footer={<>
        <button type="button" className={btnSecondary} onClick={pdf}><FileText size={15} /> PDF</button>
        <button type="button" className={btnSecondary} onClick={xls}><FileSpreadsheet size={15} /> Excel</button>
        <button type="button" className={btnPrimary} onClick={onClose}>Zatvori</button>
      </>}>
      <div className="space-y-5">
        <div>
          <div className="text-[17px] font-bold text-slate-900 dark:text-slate-100">{a.naziv}</div>
          <div className="text-[12.5px] text-slate-500 dark:text-slate-400">stanje na {fmtDate(danasIso())} · period {periodTekst(a)}</div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {kpi.map(([l, v, bg, fg, vc]) => (
            <div key={l} className={"rounded-xl px-3.5 py-2.5 " + bg}><div className={"text-[11.5px] " + fg}>{l}</div><div className={"text-xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums " + vc}>{v}</div></div>
          ))}
        </div>
        <div><PanelLabel>Lijevak</PanelLabel><Lijevak s={s} /></div>
        <div>
          <PanelLabel>Po prodavaču</PanelLabel>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] min-w-[560px]">
              <thead><tr className="border-b border-slate-200 dark:border-slate-700">
                <th className={th + " !text-left py-1.5"}>Prodavač</th><th className={th}>Firmi</th><th className={th}>Kontakt.</th><th className={th}>Zaint.</th><th className={th}>Ponuda</th><th className={th}>Dobij.</th><th className={th}>Forecast</th><th className={th}>Dobijeno</th>
              </tr></thead>
              <tbody>
                {pp.map(({ prodavac, s: x }) => (
                  <tr key={prodavac} className="border-b border-slate-100 dark:border-slate-800 tabular-nums text-slate-700 dark:text-slate-300">
                    <td className="py-1.5"><span className="inline-flex items-center gap-2">{prodavac === "Nedodijeljeno" ? <span className="w-6 h-6 rounded-full border border-dashed border-slate-300" /> : <Avatar name={prodavac} size="sm" />}{prodavac}</span></td>
                    <td className="text-right">{x.ukupno}</td><td className="text-right">{x.kontaktirano}</td><td className="text-right">{x.zainteresovano}</td><td className="text-right">{x.ponuda}</td>
                    <td className="text-right font-bold text-green-700 dark:text-green-400">{x.dobijeno}</td>
                    <td className="text-right">{x.fcIznos ? fmtEur(x.fcIznos) : "—"}</td><td className="text-right font-bold text-green-700 dark:text-green-400">{x.dobIznos ? fmtEur(x.dobIznos) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <PanelLabel>Razlozi „Nije zainteresovana“</PanelLabel>
          <p className="text-[13px] text-slate-700 dark:text-slate-300">{razlozi.length ? razlozi.map(([k, v]) => `${k} (${v})`).join(" · ") : "—"}</p>
        </div>
      </div>
    </BigModal>
  );
}

/* ---------------------------------------------------------------------- */
/*  Detalj akcije                                                          */
/* ---------------------------------------------------------------------- */

function sortKljuc(r, st) {
  const p = r.podsjetnik_datum ? daysDiff(String(r.podsjetnik_datum).slice(0, 10)) : null;
  if (p != null && p <= 0) return 0;
  if (st === "Nije kontaktirana") return 1;
  if (st === "Dobijeno" || st === "Nije zainteresovana") return 3;
  return 2;
}

function AkcijaDetalj({
  a, rows, fcById, potMap, kupci, potencijali, kalkulacije, currentUser, canManage,
  onBack, onEdit, onToggleZavrsena, onDelete, onAddFirme, onUpdate, onZapis, onForecast, onKalkulator, onRemove, onViewCompany, showToast,
}) {
  const imaMoje = rows.some((r) => r.prodavac === currentUser);
  const [fProd, setFProd] = useState(imaMoje ? currentUser : "Svi");
  const [fStatus, setFStatus] = useState("Svi");
  const [q, setQ] = useState("");
  const [panelId, setPanelId] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [showDodaj, setShowDodaj] = useState(false);
  const [showIzv, setShowIzv] = useState(false);
  const [fcRow, setFcRow] = useState(null);
  useEffect(() => { setPage(1); }, [fProd, fStatus, q]);

  const prodavaci = useMemo(() => {
    const s = new Set(rows.map((r) => r.prodavac || "Nedodijeljeno"));
    return [...s].sort((x, y) => (x === "Nedodijeljeno") - (y === "Nedodijeljeno") || x.localeCompare(y, "hr"));
  }, [rows]);
  const uOpsegu = useMemo(() => rows.filter((r) => fProd === "Svi" || (r.prodavac || "Nedodijeljeno") === fProd), [rows, fProd]);
  const s = useMemo(() => statistikaAkcije(uOpsegu, fcById), [uOpsegu, fcById]);
  const qq = q.trim().toLowerCase();
  const lista = useMemo(() => uOpsegu
    .map((r) => ({ r, st: efStatus(r, fcById) }))
    .filter(({ r, st }) => (fStatus === "Svi" || st === fStatus) && (!qq || [r.firma, r.licence, r.razlog, ...(r.historija || []).map((h) => h.opis)].join(" ").toLowerCase().includes(qq)))
    .sort((x, y) => sortKljuc(x.r, x.st) - sortKljuc(y.r, y.st)
      || String(x.r.podsjetnik_datum || "9").localeCompare(String(y.r.podsjetnik_datum || "9"))
      || A_STATUSI.indexOf(x.st) - A_STATUSI.indexOf(y.st)
      || String(y.r.odrzavanje_do || "").localeCompare(String(x.r.odrzavanje_do || ""))
      || x.r.firma.localeCompare(y.r.firma, "hr")), [uOpsegu, fcById, fStatus, qq]);
  const stranica = lista.slice((page - 1) * pageSize, page * pageSize);
  const panelRow = panelId ? rows.find((r) => r.id === panelId) : null;
  const postojeci = useMemo(() => new Set(rows.map((r) => r.firma_key)), [rows]);
  const aktivna = akcijaAktivna(a);
  const G = "md:grid-cols-[26px_minmax(0,1.5fr)_minmax(0,150px)_170px_minmax(0,1fr)_84px_130px]";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400"><ArrowLeft size={14} /> Akcije</button>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight mt-0.5 flex flex-wrap items-center gap-2">
            {a.naziv}
            {aktivna ? <span className="text-[11.5px] font-bold text-green-700 bg-green-100 dark:bg-green-900/40 dark:text-green-300 px-2 py-0.5 rounded-full">Aktivna</span>
              : <span className="text-[11.5px] font-bold text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 rounded-full">Završena</span>}
          </h2>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">{periodTekst(a)}{a.ponuda ? ` · ${a.ponuda}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={headerBtnSec} onClick={() => setShowDodaj(true)}><Plus size={15} /> Dodaj firme</button>
          <button type="button" className={headerBtnSec} onClick={() => setShowIzv(true)}><Download size={15} /> Izvještaj</button>
          {canManage && (
            <MenuButton label="Akcija" icon={Pencil} className={headerBtnSec} items={[
              { label: "Uredi naziv, ponudu i period", icon: Pencil, onClick: onEdit },
              aktivna ? { label: "Završi akciju", hint: "prelazi u završene; podaci ostaju", icon: Archive, onClick: () => onToggleZavrsena(true) }
                : { label: "Vrati u aktivne", hint: "ako je završena ručno", icon: RotateCcw, onClick: () => onToggleZavrsena(false) },
              { label: "Obriši akciju", hint: "briše akciju i listu firmi (može se poništiti 5 s)", icon: Trash2, onClick: onDelete },
            ]} />
          )}
        </div>
      </div>

      {/* pločice po statusu */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
        {A_STATUSI.map((st) => {
          const on = fStatus === st;
          return (
            <button key={st} type="button" onClick={() => setFStatus(on ? "Svi" : st)}
              className={"text-left rounded-xl border bg-white dark:bg-slate-900 px-3.5 py-2.5 transition-all hover:shadow-sm " + (on ? "ring-2" : "border-slate-200 dark:border-slate-800")}
              style={on ? { borderColor: STATUS_STIL[st][2], boxShadow: `0 0 0 2px ${STATUS_STIL[st][2]}40` } : undefined}>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400"><span className={"w-2 h-2 rounded-full " + STATUS_STIL[st][1]} />{st}</span>
              <span className="block text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">{fmtN(s.po[st])}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col xl:flex-row gap-4 items-start">
        <div className="flex-1 min-w-0 w-full space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <SearchBox value={q} onChange={setQ} placeholder="Traži firmu ili zapis…" />
            <FilterPill label="Prodavač" value={fProd} defaultValue="Svi" options={["Svi", ...prodavaci]} onChange={setFProd} />
            <FilterPill label="Status" value={fStatus} defaultValue="Svi" options={["Svi", ...A_STATUSI]} onChange={setFStatus} />
            <span className="flex-1" />
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden lg:inline">Redoslijed: podsjetnici za danas, pa nekontaktirane</span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            {lista.length === 0 ? (
              <div className="p-6">
                <EmptyState icon={Megaphone} title={rows.length ? "Nema firmi za ove filtere" : "Akcija još nema firmi"}
                  subtitle={rows.length ? "Promijeni filtere iznad." : "Dodaj firme iz Kupaca, Baze potencijala ili Excela."}
                  action={!rows.length ? <button type="button" className={btnPrimary} onClick={() => setShowDodaj(true)}><Plus size={15} /> Dodaj firme</button> : null} />
              </div>
            ) : (
              <>
                <div className={"hidden md:grid gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 " + G}>
                  <span /><span>Firma</span><span>Licence</span><span>Status</span><span>Zadnji kontakt</span><span>Podsjetnik</span><span>Forecast</span>
                </div>
                {stranica.map(({ r, st }) => {
                  const z = zadnjiZapis(r);
                  const fc = forecastOf(r, fcById);
                  const pd = r.podsjetnik_datum ? String(r.podsjetnik_datum).slice(0, 10) : null;
                  const pdd = pd ? daysDiff(pd) : null;
                  const sel = panelId === r.id;
                  return (
                    <div key={r.id} onClick={() => setPanelId(sel ? null : r.id)}
                      className={"grid grid-cols-[26px_minmax(0,1fr)_auto] gap-x-3 gap-y-1 items-center px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 first:border-t-0 cursor-pointer transition-colors " + G + " " +
                        (sel ? "bg-teal-50/70 dark:bg-teal-950/30 shadow-[inset_3px_0_0_0_#0d9488]" : "hover:bg-slate-50 dark:hover:bg-slate-800/40")}>
                      {r.prodavac ? <Avatar name={r.prodavac} size="sm" /> : <span title="Nedodijeljeno" className="w-6 h-6 rounded-full border border-dashed border-slate-300 dark:border-slate-600" />}
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{r.firma}</div>
                        <div className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate">
                          {r.odrzavanje_do ? `održavanje ${daysDiff(String(r.odrzavanje_do).slice(0, 10)) < 0 ? "isteklo" : "do"} ${fmtDate(r.odrzavanje_do)}` : r.drzava || "—"}
                          {st === "Nije zainteresovana" && r.razlog ? <span className="text-red-600 dark:text-red-400"> · {r.razlog}</span> : null}
                        </div>
                      </div>
                      <div className="md:hidden"><StatusSelect value={r.status in STATUS_STIL ? r.status : "Nije kontaktirana"} onChange={(v) => onUpdate(r, { status: v })} /></div>
                      <div className="hidden md:block min-w-0"><LicenceChip r={r} /></div>
                      <div className="hidden md:block">
                        {st !== r.status ? <span title="Dobijeno u Forecastu"><StatusPill status={st} /></span>
                          : <StatusSelect value={st} onChange={(v) => onUpdate(r, { status: v })} />}
                      </div>
                      <div className="hidden md:block min-w-0 text-[12.5px] text-slate-700 dark:text-slate-300 truncate" title={z ? z.opis : undefined}>
                        {z ? <><span className="text-slate-500">{fmtDate(z.datum).slice(0, 7)}</span> · {z.opis}</> : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </div>
                      <div className="hidden md:block text-[12.5px]" title={r.podsjetnik_opis || undefined}>
                        {pd ? <span className={"inline-flex items-center gap-1 " + (pdd < 0 ? "text-red-600 dark:text-red-400 font-semibold" : pdd === 0 ? "text-amber-700 dark:text-amber-400 font-semibold" : "text-slate-600 dark:text-slate-400")}>
                          <Bell size={12} /> {pdd === 0 ? "danas" : fmtDate(pd).slice(0, 7)}</span> : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </div>
                      <div className="hidden md:block" onClick={(e) => e.stopPropagation()}>
                        {st === "Dobijeno" ? (
                          <span className="text-xs font-bold text-green-700 bg-green-100 dark:bg-green-900/40 dark:text-green-300 px-2 py-0.5 rounded-full whitespace-nowrap">dobijeno{r.vrijednost ? ` · ${fmtEur(r.vrijednost)}` : ""}</span>
                        ) : fc ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 bg-teal-50 dark:bg-teal-950/40 dark:text-teal-300 px-2 py-0.5 rounded-full whitespace-nowrap" title={`${fc.mjesec} · ${fc.status}`}>
                            <TrendingUp size={11} /> {r.vrijednost ? fmtEur(r.vrijednost) : fc.status}</span>
                        ) : st === "Zainteresovana" || st === "Ponuda poslana" ? (
                          <button type="button" onClick={() => setFcRow(r)} className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-300 border border-dashed border-teal-300 dark:border-teal-700 px-2 py-0.5 rounded-full whitespace-nowrap hover:bg-teal-50 dark:hover:bg-teal-950/40">
                            <Plus size={11} /> u forecast</button>
                        ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </div>
                    </div>
                  );
                })}
                <PageNav page={page} setPage={setPage} pageSize={pageSize} setPageSize={setPageSize} total={lista.length} />
              </>
            )}
          </div>
          {rows.length > 0 && (
            <Napomena>„Šta je dogovoreno“ iz panela firme upisuje se i u historiju firme u Bazi potencijala (s oznakom akcije). Stavka prebačena u Forecast i tamo označena kao „Dobijeno“ računa se kao dobijena i ovdje.</Napomena>
          )}
        </div>

        {panelRow && (
          <FirmaPanel r={panelRow} akcija={a} fcById={fcById} potencijal={potMap.get(panelRow.firma_key) || null} kalkulacije={kalkulacije}
            currentUser={currentUser} onClose={() => setPanelId(null)} onUpdate={onUpdate} onZapis={onZapis}
            onForecast={(r) => setFcRow(r)} onKalkulator={(r) => onKalkulator(r, a)}
            onRemove={(r) => { setPanelId(null); onRemove(r); }} onViewCompany={onViewCompany} />
        )}
      </div>

      {showDodaj && (
        <DodajFirmeModal akcija={a} kupci={kupci} potencijali={potencijali} postojeci={postojeci} onClose={() => setShowDodaj(false)} onAdd={(firme) => onAddFirme(a, firme)} />
      )}
      {showIzv && <IzvjestajModal a={a} rows={rows} fcById={fcById} onClose={() => setShowIzv(false)} showToast={showToast} />}
      {fcRow && (
        <ForecastModal r={fcRow} akcija={a} potencijal={potMap.get(fcRow.firma_key) || null} onClose={() => setFcRow(null)}
          onSave={(payload, vrijednost) => onForecast(fcRow, payload, vrijednost)} />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Tab: pregled akcija                                                    */
/* ---------------------------------------------------------------------- */

function AkcijaKartica({ a, rows, fcById, currentUser, onOpen }) {
  const s = statistikaAkcije(rows, fcById);
  const aktivna = akcijaAktivna(a);
  const dana = a.kraj ? daysDiff(String(a.kraj).slice(0, 10)) : null;
  const moje = rows.filter((r) => r.prodavac === currentUser);
  const mojeZaKontakt = moje.filter((r) => efStatus(r, fcById) === "Nije kontaktirana").length;
  const mojiPodsjetnici = moje.filter((r) => r.podsjetnik_datum && daysDiff(String(r.podsjetnik_datum).slice(0, 10)) <= 0).length;
  const prodavaci = nizProdavaca(a).length ? nizProdavaca(a) : [...new Set(rows.map((r) => r.prodavac).filter(Boolean))];
  return (
    <button type="button" onClick={onOpen}
      className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-3 hover:border-teal-400 dark:hover:border-teal-700 hover:shadow-md transition-all">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 inline-flex items-center justify-center shrink-0"><Megaphone size={19} /></span>
        <div className="flex-1 min-w-0">
          <div className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">{a.naziv}</div>
          {a.ponuda && <div className="text-[13px] text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2">{a.ponuda}</div>}
        </div>
        {aktivna ? <span className="text-[11.5px] font-bold text-green-700 bg-green-100 dark:bg-green-900/40 dark:text-green-300 px-2 py-0.5 rounded-full whitespace-nowrap">Aktivna{dana != null ? ` · još ${dana} ${dana === 1 ? "dan" : "dana"}` : ""}</span>
          : <span className="text-[11.5px] font-bold text-slate-600 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">Završena</span>}
      </div>
      <div className="flex items-center gap-3 text-[12.5px] text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} className="text-slate-400" /> {periodTekst(a)}</span>
        <span className="inline-flex -space-x-1.5">{prodavaci.slice(0, 5).map((p) => <Avatar key={p} name={p} size="sm" ring />)}</span>
        <span className="flex-1" />
        <span><b className="text-slate-900 dark:text-slate-100">{fmtN(s.ukupno)}</b> firmi</span>
      </div>
      <div className="border-t border-slate-100 dark:border-slate-800 pt-3"><Lijevak s={s} compact /></div>
      <div className="flex gap-2.5">
        <div className="flex-1 rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2"><div className="text-[11px] text-slate-500">U forecastu</div><div className="text-base font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">{fmtEur(s.fcIznos)}</div></div>
        <div className="flex-1 rounded-xl bg-green-50 dark:bg-green-950/30 px-3 py-2"><div className="text-[11px] text-green-700 dark:text-green-400">Dobijeno</div><div className="text-base font-extrabold text-green-700 dark:text-green-400 tabular-nums">{fmtEur(s.dobIznos)}</div></div>
      </div>
      {moje.length > 0 && aktivna && (
        <div className="text-[12.5px] text-slate-600 dark:text-slate-400 flex flex-wrap gap-x-3">
          <span>Tvojih firmi: <b className="text-slate-800 dark:text-slate-200">{moje.length}</b></span>
          {mojeZaKontakt > 0 && <span><b className="text-slate-800 dark:text-slate-200">{mojeZaKontakt}</b> čeka kontakt</span>}
          {mojiPodsjetnici > 0 && <span className="text-red-600 dark:text-red-400 font-semibold inline-flex items-center gap-1"><Bell size={12} /> {mojiPodsjetnici} podsjetnik za danas</span>}
        </div>
      )}
    </button>
  );
}

export function AkcijeTab({
  akcije = [], akcijeFirme = [], kupci = [], potencijali = [], forecast = [], kalkulacije = [], currentUser,
  onSaveAkcija, onDeleteAkcija, onAddFirme, onUpdateFirma, onZapis, onForecast, onRemoveFirma, onKalkulator, onViewCompany, showToast,
}) {
  const [otvorenaId, setOtvorenaId] = useState(null);
  const [modal, setModal] = useState(null); // { initial } | null
  const fcById = useMemo(() => new Map((forecast || []).map((f) => [String(f.id), f])), [forecast]);
  const potMap = useMemo(() => potencijaliPoFirmi(potencijali), [potencijali]);
  const poAkciji = useMemo(() => {
    const m = new Map();
    for (const r of akcijeFirme) {
      if (!m.has(r.akcija_id)) m.set(r.akcija_id, []);
      m.get(r.akcija_id).push(r);
    }
    return m;
  }, [akcijeFirme]);
  const sortirane = useMemo(() => [...akcije].sort((x, y) => String(y.pocetak || y.created_at || "").localeCompare(String(x.pocetak || x.created_at || ""))), [akcije]);
  const aktivne = sortirane.filter(akcijaAktivna);
  const zavrsene = sortirane.filter((a) => !akcijaAktivna(a));
  const otvorena = otvorenaId ? akcije.find((a) => a.id === otvorenaId) : null;
  useEffect(() => { if (otvorenaId && !otvorena) setOtvorenaId(null); }, [otvorenaId, otvorena]);
  const canManage = (a) => !!currentUser && (a.created_by === currentUser || AKCIJE_ADMINI.includes(currentUser));

  const izvjestajSve = (tip) => {
    const lista = (aktivne.length ? aktivne : sortirane).map((a) => ({ a, rows: poAkciji.get(a.id) || [] }));
    if (!lista.length) return;
    if (tip === "pdf") { if (!otvoriPdf(lista, fcById) && showToast) showToast("Browser je blokirao novi prozor — dozvoli pop-up za CRM", "error"); }
    else izvozExcel(sortirane.map((a) => ({ a, rows: poAkciji.get(a.id) || [] })), fcById, `Akcije_${danasIso()}.xlsx`);
  };

  const spremi = async (payload, firme) => {
    const id = modal && modal.initial ? modal.initial.id : null;
    const rec = await onSaveAkcija(id, payload, firme);
    if (!rec) return false;
    if (!id) setOtvorenaId(rec.id);
    return true;
  };

  let sadrzaj;
  if (otvorena) {
    sadrzaj = (
      <AkcijaDetalj key={otvorena.id} a={otvorena} rows={poAkciji.get(otvorena.id) || []} fcById={fcById} potMap={potMap} kupci={kupci} potencijali={potencijali}
        kalkulacije={kalkulacije} currentUser={currentUser} canManage={canManage(otvorena)}
        onBack={() => setOtvorenaId(null)} onEdit={() => setModal({ initial: otvorena })}
        onToggleZavrsena={(v) => onSaveAkcija(otvorena.id, { zavrsena: v })}
        onDelete={() => { setOtvorenaId(null); onDeleteAkcija(otvorena.id); }}
        onAddFirme={onAddFirme} onUpdate={onUpdateFirma} onZapis={(r, zapis) => onZapis(r, zapis, otvorena)}
        onForecast={onForecast} onKalkulator={onKalkulator} onRemove={onRemoveFirma} onViewCompany={onViewCompany} showToast={showToast} />
    );
  } else {
    sadrzaj = (
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Akcije</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Interne prodajne akcije: ko je na listi, ko je kontaktiran, šta je dogovoreno i šta je prodano</p>
          </div>
          <div className="flex gap-2">
            {akcije.length > 0 && (
              <MenuButton label="Izvještaj" icon={Download} className={headerBtnSec} items={[
                { label: "PDF — " + (aktivne.length ? "aktivne akcije" : "sve akcije"), hint: "za nadređene, otvara se za štampu / PDF", icon: FileText, onClick: () => izvjestajSve("pdf") },
                { label: "Excel — sve akcije", hint: "sažetak, po prodavaču i sve firme", icon: FileSpreadsheet, onClick: () => izvjestajSve("xlsx") },
              ]} />
            )}
            <button type="button" className={btnPrimary} onClick={() => setModal({ initial: null })} disabled={!currentUser}><Plus size={16} /> Nova akcija</button>
          </div>
        </div>

        {akcije.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8">
            <EmptyState icon={Megaphone} title="Još nema akcija"
              subtitle="Napravi akciju, odaberi firme (npr. iz Kupaca: BiH · SOLIDWORKS · održavanje isteklo) i prati kontaktiranje, ponude i rezultat."
              action={<button type="button" className={btnPrimary} onClick={() => setModal({ initial: null })} disabled={!currentUser}><Plus size={16} /> Nova akcija</button>} />
          </div>
        ) : (
          <>
            {aktivne.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {aktivne.map((a) => <AkcijaKartica key={a.id} a={a} rows={poAkciji.get(a.id) || []} fcById={fcById} currentUser={currentUser} onOpen={() => setOtvorenaId(a.id)} />)}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">Trenutno nema aktivnih akcija.</p>
            )}
            {zavrsene.length > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Završene akcije</div>
                <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_170px_70px_110px_130px] gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-800/60 border-y border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <span>Akcija</span><span>Period</span><span className="text-right">Firmi</span><span className="text-right">Kontaktirano</span><span className="text-right">Rezultat</span>
                </div>
                {zavrsene.map((a) => {
                  const s = statistikaAkcije(poAkciji.get(a.id) || [], fcById);
                  return (
                    <button key={a.id} type="button" onClick={() => setOtvorenaId(a.id)}
                      className="w-full text-left grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_170px_70px_110px_130px] gap-3 items-center px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{a.naziv}</span>
                      <span className="hidden sm:block text-[12.5px] text-slate-500">{periodTekst(a)}</span>
                      <span className="hidden sm:block text-[13px] text-right text-slate-700 dark:text-slate-300">{fmtN(s.ukupno)}</span>
                      <span className="hidden sm:block text-[13px] text-right text-slate-700 dark:text-slate-300">{fmtN(s.kontaktirano)}</span>
                      <span className="text-[13px] text-right font-bold text-green-700 dark:text-green-400 whitespace-nowrap">{s.dobijeno} dobijeno{s.dobIznos ? ` · ${fmtEur(s.dobIznos)}` : ""}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <>
      {sadrzaj}
      {modal && (
        <AkcijaModal initial={modal.initial} kupci={kupci} potencijali={potencijali} currentUser={currentUser}
          onClose={() => setModal(null)} onSave={spremi} />
      )}
    </>
  );
}
