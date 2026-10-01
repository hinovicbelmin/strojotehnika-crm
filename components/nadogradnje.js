"use client";
// Nadogradnje (SOLIDWORKS) — evidencija verzija po licenci i kontaktiranja firmi s aktivnim održavanjem
import { useState, useMemo, useEffect } from "react";
import {
  ArrowUpCircle, ArrowUp, ArrowRight, Check, Download, Upload, ChevronDown, ChevronRight, X, Building2,
  ExternalLink, Ban, History, RefreshCw, Lock, Wrench, AlertTriangle,
} from "lucide-react";
import {
  inputCls, btnPrimary, btnSecondary, btnGhostIcon, fmtDate, todayStr, daysDiff, companyKey, downloadCSV, TECH_NAMES,
} from "../lib/crm";
import { Modal, Field, EmptyState, SearchBox, ImportModal } from "./ui";
import { Avatar, FilterPill, PanelLabel, PageNav, headerBtnSec, fmtN } from "./crmBits";

/* ---------------------------------------------------------------------- */
/*  Postavke                                                               */
/* ---------------------------------------------------------------------- */

// Proizvodi (kolona "Naziv proizvoda 2" u Kupcima) koji ulaze u nadogradnje
export const NADOGRADNJE_PROIZVODI = [
  "SOLIDWORKS Design Premium",
  "SOLIDWORKS Design Premium Network Technical Product",
  "SOLIDWORKS Design Premium with Simulation Professional Network Technical Product",
  "SOLIDWORKS Design Premium Technical Product",
  "SOLIDWORKS Design Professional",
  "SOLIDWORKS Design Professional Network Technical Product",
  "SOLIDWORKS Design Professional Technical Product",
  "SOLIDWORKS Design Standard",
  "SOLIDWORKS Design Standard Network Technical Product",
  "SOLIDWORKS Design Standard Technical Product",
  "SOLIDWORKS Premium Network Technical Product",
  "SOLIDWORKS Premium Technical Product",
  "SOLIDWORKS Professional Network Technical Product",
  "SOLIDWORKS Professional Technical Product",
  "SOLIDWORKS Standard Network Technical Product",
  "SOLIDWORKS Standard Technical Product",
];
const PROIZVODI_SET = new Set(NADOGRADNJE_PROIZVODI.map((p) => p.toLowerCase()));

// Osim tehničke podrške, nadogradnje smiju uređivati i ovi korisnici (ostali iz prodaje samo gledaju)
export const NADOGRADNJE_UREDNICI_EXTRA = ["Belmin Hinović"];

// Zadani tehničar po državi (za Hrvatsku se bira po firmi)
export const TEHNICAR_PO_DRZAVI = { BA: "Ahmed Mujkanović", AL: "Ahmed Mujkanović" };

const DRZAVE = [
  { k: "BA", label: "Bosna i Hercegovina" },
  { k: "HR", label: "Hrvatska" },
  { k: "AL", label: "Albanija" },
  { k: "OST", label: "Ostalo" },
];
export function drzavaGrupa(d) {
  const s = (d || "").toLowerCase();
  if (/bosn|bih|herceg|^ba$/.test(s)) return "BA";
  if (/croat|hrvat|^hr$/.test(s)) return "HR";
  if (/alban|shqip|^al$/.test(s)) return "AL";
  return "OST";
}

export const N_STATUSI = ["Nije kontaktirana", "Kontaktirana", "Dogovorena nadogradnja", "Nadograđeno", "Odbila", "Ne kontaktirati", "Namjerno starija verzija"];
const KORACI = ["Nije kontaktirana", "Kontaktirana", "Dogovorena nadogradnja", "Nadograđeno"];
const AUTO_AKTUELNA = "Na aktuelnoj verziji";
const PRENOSIVI = ["Ne kontaktirati", "Namjerno starija verzija"]; // ostaju i u novoj kampanji
const STATUS_CLS = {
  "Nije kontaktirana": ["bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300", "bg-slate-400"],
  Kontaktirana: ["bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", "bg-blue-500"],
  "Dogovorena nadogradnja": ["bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300", "bg-violet-500"],
  Nadograđeno: ["bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300", "bg-green-500"],
  Odbila: ["bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", "bg-red-500"],
  "Ne kontaktirati": ["bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", "bg-red-500"],
  "Namjerno starija verzija": ["bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300", "bg-stone-500"],
  [AUTO_AKTUELNA]: ["bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300", "bg-green-300"],
};

// Kategorije verzija — boje iste kao u Excelu
const KAT = {
  g: { label: "Aktuelna verzija", cls: "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800", hex: "#22c55e" },
  y: { label: "Starija verzija", cls: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-800", hex: "#eab308" },
  na: { label: "Nije aktivirana", cls: "bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600", hex: "#94a3b8" },
  red: { label: "Ne kontaktirati", cls: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800", hex: "#ef4444" },
  nep: { label: "Nije provjereno", cls: "bg-white text-slate-500 border-slate-300 border-dashed dark:bg-slate-900 dark:text-slate-400 dark:border-slate-600", hex: "#e2e8f0" },
};

/* ---------------------------------------------------------------------- */
/*  Pomoćne funkcije                                                       */
/* ---------------------------------------------------------------------- */

const licKljuc = (sn, proizvod) => `${(sn || "").trim().toUpperCase()}|${(proizvod || "").trim().toLowerCase()}`;
const nowIso = () => new Date().toISOString();

// "2025" -> 2025, "2020/2024" -> 2020 (najstarija), "SW2024 SP3" -> 2024, "NA"/"not activated" -> "NA", prazno -> null
export function normVerzija(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (/^na$|not\s*activ|nije\s*aktiv/i.test(s)) return "NA";
  const god = (s.match(/(19|20)\d{2}/g) || []).map(Number);
  if (god.length) return String(Math.min(...god));
  return s;
}
const godinaVerzije = (v) => { const n = Number(normVerzija(v)); return Number.isFinite(n) && n > 1990 ? n : null; };
const kratkiNaziv = (p) => (p || "").replace(/^SOLIDWORKS\s+/i, "").replace(/\s+Technical Product$/i, "") || p;

function aktivnoOdrzavanje(k) {
  if (k.end_date) return daysDiff(k.end_date) >= 0;
  const st = (k.izvorni_status || "").toLowerCase();
  return st.includes("w/support") && !st.includes("wo/");
}
function ukljucenProizvod(k) {
  const p2 = (k.naziv_proizvoda_2 || "").trim().toLowerCase();
  if (p2 && PROIZVODI_SET.has(p2)) return true;
  return PROIZVODI_SET.has((k.naziv_proizvoda || "").trim().toLowerCase());
}
const proizvodLicence = (k) => {
  const p2 = (k.naziv_proizvoda_2 || "").trim();
  return p2 && PROIZVODI_SET.has(p2.toLowerCase()) ? p2 : (k.naziv_proizvoda || "").trim();
};

export function aktuelnaKampanja(kampanje) {
  const v = (kampanje || []).map((k) => Number(k.verzija)).filter((n) => Number.isFinite(n));
  return v.length ? Math.max(...v) : 2026;
}

function kategorija(ver, red, akt) {
  if (red) return "red";
  if (ver == null || ver === "") return "nep";
  if (ver === "NA") return "na";
  const g = godinaVerzije(ver);
  if (g == null) return "nep";
  return g >= akt ? "g" : "y";
}

/*
 * Model: licence s aktivnim održavanjem iz Kupaca + stanje iz baze (tekuća kampanja,
 * a ako licenca u njoj još nema zapis — zadnje poznato stanje iz ranije kampanje).
 */
export function izgradiNadogradnje({ kupci, licRows, firmRows, akt }) {
  // zapisi licenci po ključu i kampanji
  const tekuci = new Map();
  const raniji = new Map(); // ključ -> najnoviji zapis iz ranije kampanje
  const historija = new Map(); // ključ -> svi zapisi ranijih kampanja
  for (const r of licRows || []) {
    const k = licKljuc(r.serijski_broj, r.proizvod);
    const kamp = Number(r.kampanja);
    if (kamp === akt) tekuci.set(k, r);
    else if (kamp < akt) {
      const b = raniji.get(k);
      if (!b || Number(b.kampanja) < kamp) raniji.set(k, r);
      if (!historija.has(k)) historija.set(k, []);
      historija.get(k).push(r);
    }
  }
  const firmeTek = new Map();
  const firmeRanije = new Map();
  for (const f of firmRows || []) {
    const kamp = Number(f.kampanja);
    if (kamp === akt) firmeTek.set(f.firma_key, f);
    else if (kamp < akt) {
      const b = firmeRanije.get(f.firma_key);
      if (!b || Number(b.kampanja) < kamp) firmeRanije.set(f.firma_key, f);
    }
  }

  // licence iz Kupaca (bez duplikata po serijskom + proizvodu)
  const licMap = new Map();
  for (const k of kupci || []) {
    if (!k.serijski_broj || !ukljucenProizvod(k) || !aktivnoOdrzavanje(k)) continue;
    const proizvod = proizvodLicence(k);
    const key = licKljuc(k.serijski_broj, proizvod);
    const b = licMap.get(key);
    if (b) {
      if ((k.end_date || "") > (b.end_date || "")) b.end_date = k.end_date;
      continue;
    }
    licMap.set(key, {
      key, sn: k.serijski_broj.trim(), proizvod, firma: (k.naziv_firme || "").trim(), drzava: k.drzava || "",
      grupa: drzavaGrupa(k.drzava), tip: k.revenue_type || "", end_date: k.end_date || null, kom: Number(k.broj_licenci) || 1,
    });
  }

  const licence = [];
  for (const l of licMap.values()) {
    const rec = tekuci.get(l.key) || null;
    const prev = raniji.get(l.key) || null;
    const zatecena = rec ? normVerzija(rec.zatecena_verzija) : prev ? normVerzija(prev.verzija_nakon || prev.zatecena_verzija) : null;
    const nakon = rec ? normVerzija(rec.verzija_nakon) : null;
    const red = rec ? !!rec.ne_kontaktirati : prev ? !!prev.ne_kontaktirati : false;
    const efektivna = nakon || zatecena;
    licence.push({
      ...l, rec, prev, zatecena, nakon, red, efektivna,
      kat: kategorija(efektivna, red, akt),
      prenijeto: !rec && !!prev,
      provjereno_at: rec ? rec.provjereno_at : null, provjerio: rec ? rec.provjerio : null,
      nadogradjeno_at: rec ? rec.nadogradjeno_at : null, nadogradio: rec ? rec.nadogradio : null,
      historija: (historija.get(l.key) || []).sort((a, b) => Number(b.kampanja) - Number(a.kampanja)),
    });
  }

  // grupisanje po firmi
  const fm = new Map();
  for (const l of licence) {
    const fk = companyKey(l.firma) || l.firma.toLowerCase();
    if (!fm.has(fk)) fm.set(fk, { key: fk, naziv: l.firma, drzava: l.drzava, grupa: l.grupa, licence: [] });
    fm.get(fk).licence.push(l);
  }
  const firme = [];
  for (const f of fm.values()) {
    f.licence.sort((a, b) => (a.end_date || "").localeCompare(b.end_date || "") || a.sn.localeCompare(b.sn));
    f.najraniji = f.licence.map((l) => l.end_date).filter(Boolean).sort()[0] || null;
    f.najkasniji = f.licence.map((l) => l.end_date).filter(Boolean).sort().slice(-1)[0] || null;
    f.rec = firmeTek.get(f.key) || null;
    f.prev = firmeRanije.get(f.key) || null;
    const kats = f.licence.map((l) => l.kat);
    f.nKat = { g: 0, y: 0, na: 0, red: 0, nep: 0 };
    kats.forEach((k) => { f.nKat[k] += 1; });
    let status = f.rec && f.rec.status ? f.rec.status : null;
    if (!status && f.prev && PRENOSIVI.includes(f.prev.status)) status = f.prev.status;
    if (!status) {
      if (kats.every((k) => k === "g")) status = AUTO_AKTUELNA;
      else if (kats.filter((k) => k !== "g").every((k) => k === "red")) status = "Ne kontaktirati";
      else status = "Nije kontaktirana";
    }
    f.status = status;
    f.auto = !(f.rec && f.rec.status);
    f.tehnicar = (f.rec && f.rec.tehnicar) || TEHNICAR_PO_DRZAVI[f.grupa] || "";
    f.trebaKontakt = f.status === "Nije kontaktirana" && f.nKat.y > 0;
    f.najstarija = f.licence.map((l) => godinaVerzije(l.efektivna)).filter(Boolean).sort((a, b) => a - b)[0] || null;
    f.nadogradjeno = f.licence.filter((l) => l.nakon && l.nadogradjeno_at).length;
    firme.push(f);
  }
  firme.sort((a, b) => (a.najraniji || "9").localeCompare(b.najraniji || "9") || a.naziv.localeCompare(b.naziv));
  return { licence, firme };
}

// Za meni: firme za kontakt kojima održavanje ističe u narednih 30 dana
export function nadogradnjeBadge(model) {
  return model.firme.filter((f) => f.trebaKontakt && f.najraniji && daysDiff(f.najraniji) <= 30).length;
}

// Za Kupce i 360° profil: kratko stanje po firmi
export function nadogradnjeSazetak(model, akt) {
  const m = new Map();
  for (const f of model.firme) {
    const nad = f.licence.filter((l) => l.nakon && l.nadogradjeno_at).map((l) => ({
      od: l.zatecena, na: l.nakon, datum: l.nadogradjeno_at, ko: l.nadogradio, sn: l.sn, proizvod: l.proizvod, kampanja: akt,
    }));
    for (const l of f.licence) for (const h of l.historija) {
      if (h.verzija_nakon && h.nadogradjeno_at) nad.push({ od: normVerzija(h.zatecena_verzija), na: normVerzija(h.verzija_nakon), datum: h.nadogradjeno_at, ko: h.nadogradio, sn: l.sn, proizvod: l.proizvod, kampanja: Number(h.kampanja) });
    }
    nad.sort((a, b) => (b.datum || "").localeCompare(a.datum || ""));
    m.set(f.key, { status: f.status, najstarija: f.najstarija, akt, nLic: f.licence.length, nadogradnje: nad, tehnicar: f.tehnicar, nKat: f.nKat });
  }
  return m;
}

// Mala oznaka za red firme u Kupcima
export function NadogradnjaBadge({ info }) {
  if (!info) return null;
  const { status, najstarija, akt } = info;
  let txt; let cls;
  if (status === AUTO_AKTUELNA || (najstarija && najstarija >= akt && status !== "Ne kontaktirati")) {
    txt = `SW ${najstarija || akt} · aktuelno`; cls = "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300";
  } else if (status === "Nije kontaktirana") {
    txt = najstarija ? `SW ${najstarija} · za nadogradnju` : "SW · nije provjereno";
    cls = najstarija ? "bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400";
  } else {
    txt = `${najstarija ? `SW ${najstarija} · ` : ""}${status.toLowerCase()}`;
    cls = "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300";
  }
  return (
    <span className={"inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-px rounded-full whitespace-nowrap " + cls} title="Stanje nadogradnje (tab Nadogradnje)">
      <ArrowUpCircle size={11} /> {txt}
    </span>
  );
}

function VerzijaPill({ ver, kat, n }) {
  const k = KAT[kat] || KAT.nep;
  const t = ver == null || ver === "" ? (n ? "?" : "nije provjereno") : ver === "NA" ? "nije aktivirana" : ver;
  return (
    <span className={"inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md border whitespace-nowrap tabular-nums " + k.cls}>
      {n ? `${n}× ` : ""}{t}
    </span>
  );
}
function StatusChip({ status, sm }) {
  const [cls, dot] = STATUS_CLS[status] || STATUS_CLS["Nije kontaktirana"];
  return (
    <span className={"inline-flex items-center gap-1.5 font-semibold rounded-full whitespace-nowrap " + (sm ? "text-[11px] px-2 py-px " : "text-xs pl-2 pr-2.5 py-0.5 ") + cls}>
      <span className={"w-1.5 h-1.5 rounded-full " + dot} /> {status}
    </span>
  );
}
function IsticeCell({ d }) {
  if (!d) return <span className="text-xs text-slate-400">—</span>;
  const n = daysDiff(d);
  const cls = n <= 31 ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300"
    : n <= 92 ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
  return (
    <div className="whitespace-nowrap">
      <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 tabular-nums">{fmtDate(d)}</div>
      <span className={"text-[11px] font-semibold px-1.5 rounded-full " + cls}>za {n} {n === 1 ? "dan" : "dana"}</span>
    </div>
  );
}
function verzijeChips(f) {
  const m = new Map();
  for (const l of f.licence) {
    const k = `${l.kat}|${l.efektivna ?? ""}`;
    if (!m.has(k)) m.set(k, { kat: l.kat, ver: l.efektivna, n: 0 });
    m.get(k).n += 1;
  }
  const red = { y: 0, red: 1, nep: 2, na: 3, g: 4 };
  return [...m.values()].sort((a, b) => red[a.kat] - red[b.kat] || (godinaVerzije(a.ver) || 0) - (godinaVerzije(b.ver) || 0));
}

function opcijeVerzija(akt) {
  const o = [];
  for (let y = akt; y >= akt - 12; y--) o.push(String(y));
  return o;
}
function VerzijaSelect({ value, onChange, akt, disabled, placeholder = "nije provjereno", kat }) {
  const k = KAT[kat || (value ? kategorija(value, false, akt) : "nep")];
  return (
    <span className={"relative inline-flex items-center gap-1 h-7 pl-2 pr-1.5 rounded-md border text-xs font-semibold whitespace-nowrap " + (value ? k.cls : "bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-700")}>
      {value ? (value === "NA" ? "nije aktivirana" : value) : placeholder}
      {!disabled && <ChevronDown size={12} />}
      {!disabled && (
        <select aria-label="Verzija" value={value || ""} onChange={(e) => onChange(e.target.value || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
          <option value="">— {placeholder} —</option>
          {opcijeVerzija(akt).map((v) => <option key={v} value={v}>{v}{Number(v) === akt ? " (aktuelna)" : ""}</option>)}
          <option value="NA">nije aktivirana</option>
        </select>
      )}
    </span>
  );
}

/* ---------------------------------------------------------------------- */
/*  Tab                                                                    */
/* ---------------------------------------------------------------------- */

export function NadogradnjeTab({
  kupci, kampanje, licRows, firmRows, potencijali = [], podrska = [], currentUser,
  onSaveLicence, onSaveFirma, onNovaKampanja, onAddPodrska, onViewCompany, showToast,
}) {
  const akt = aktuelnaKampanja(kampanje);
  const canEdit = TECH_NAMES.includes(currentUser) || NADOGRADNJE_UREDNICI_EXTRA.includes(currentUser);
  const model = useMemo(() => izgradiNadogradnje({ kupci, licRows, firmRows, akt }), [kupci, licRows, firmRows, akt]);

  const mojaDrzava = Object.entries(TEHNICAR_PO_DRZAVI).find(([, t]) => t === currentUser);
  const [fDrzava, setFDrzava] = useState(mojaDrzava ? mojaDrzava[0] : "Sve");
  const [fKat, setFKat] = useState(null);
  const [fStatus, setFStatus] = useState("Svi");
  const [fIstice, setFIstice] = useState("Sve");
  const [fTehnicar, setFTehnicar] = useState("Svi");
  const [q, setQ] = useState("");
  const [otvorene, setOtvorene] = useState(new Set());
  const [panelKey, setPanelKey] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showImport, setShowImport] = useState(false);
  const [showKampanja, setShowKampanja] = useState(false);
  const [podrskaPrompt, setPodrskaPrompt] = useState(null);
  useEffect(() => { setPage(1); }, [fDrzava, fKat, fStatus, fIstice, fTehnicar, q]);

  const uDrzavi = useMemo(() => model.firme.filter((f) => fDrzava === "Sve" || f.grupa === fDrzava), [model, fDrzava]);
  const licUDrzavi = useMemo(() => uDrzavi.flatMap((f) => f.licence), [uDrzavi]);
  const nDrzava = useMemo(() => {
    const m = { Sve: model.firme.length };
    model.firme.forEach((f) => { m[f.grupa] = (m[f.grupa] || 0) + 1; });
    return m;
  }, [model]);
  const licPoKat = useMemo(() => {
    const m = { g: 0, y: 0, na: 0, red: 0, nep: 0 };
    licUDrzavi.forEach((l) => { m[l.kat] += 1; });
    return m;
  }, [licUDrzavi]);
  const firmPoKat = useMemo(() => {
    const m = { g: 0, y: 0, na: 0, red: 0, nep: 0 };
    uDrzavi.forEach((f) => Object.keys(m).forEach((k) => { if (f.nKat[k] > 0) m[k] += 1; }));
    return m;
  }, [uDrzavi]);

  const prolazi = (f, skip = {}) => {
    if (!skip.kat && fKat && !(f.nKat[fKat] > 0)) return false;
    if (!skip.status && fStatus !== "Svi" && f.status !== fStatus) return false;
    if (fTehnicar !== "Svi") {
      if (fTehnicar === "(nedodijeljen)" ? f.tehnicar : f.tehnicar !== fTehnicar) return false;
    }
    if (fIstice !== "Sve") {
      const dana = { "30 dana": 31, "3 mjeseca": 92, "6 mjeseci": 183 }[fIstice];
      if (!f.najraniji || daysDiff(f.najraniji) > dana) return false;
    }
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      if (!f.naziv.toLowerCase().includes(s) && !f.licence.some((l) => l.sn.toLowerCase().includes(s))) return false;
    }
    return true;
  };
  const filtrirane = useMemo(() => uDrzavi.filter((f) => prolazi(f)), // eslint-disable-next-line react-hooks/exhaustive-deps
    [uDrzavi, fKat, fStatus, fIstice, fTehnicar, q]);
  const nStatus = useMemo(() => {
    const m = { Svi: 0 };
    uDrzavi.filter((f) => prolazi(f, { status: true })).forEach((f) => { m.Svi += 1; m[f.status] = (m[f.status] || 0) + 1; });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uDrzavi, fKat, fIstice, fTehnicar, q]);
  const stranica = filtrirane.slice((page - 1) * pageSize, page * pageSize);

  const provjereno = licUDrzavi.filter((l) => l.kat !== "nep").length;
  const tehnicari = useMemo(() => [...new Set(model.firme.map((f) => f.tehnicar).filter(Boolean))].sort(), [model]);
  const panelFirma = panelKey ? model.firme.find((f) => f.key === panelKey) : null;

  /* ---------- spremanje ---------- */
  const licPayload = (l, patch) => ({
    kampanja: akt, serijski_broj: l.sn, proizvod: l.proizvod, firma: l.firma, drzava: l.drzava,
    zatecena_verzija: l.zatecena, verzija_nakon: l.nakon, ne_kontaktirati: l.red,
    provjereno_at: l.provjereno_at, provjerio: l.provjerio, nadogradjeno_at: l.nadogradjeno_at, nadogradio: l.nadogradio,
    ...patch, updated_by: currentUser || "—", updated_at: nowIso(),
    ...(l.rec ? {} : { created_by: currentUser || "—", created_at: nowIso() }),
  });
  const sacuvajLicence = async (stavke) => {
    // stavke: [{ l, patch }]
    if (!canEdit || !stavke.length) return false;
    try {
      await onSaveLicence(stavke.map(({ l, patch }) => ({ id: l.rec ? l.rec.id : null, data: licPayload(l, patch) })));
      return true;
    } catch (e) {
      return false;
    }
  };
  const firmaPayload = (f, patch) => ({
    kampanja: akt, firma_key: f.key, firma: f.naziv,
    status: f.rec ? f.rec.status : null, tehnicar: f.rec ? f.rec.tehnicar : (TEHNICAR_PO_DRZAVI[f.grupa] || null),
    kontakt: f.rec ? f.rec.kontakt : null, mail: f.rec ? f.rec.mail : null,
    datum_kontakta: f.rec ? f.rec.datum_kontakta : null, termin: f.rec ? f.rec.termin : null, komentar: f.rec ? f.rec.komentar : null,
    ...patch, updated_by: currentUser || "—", updated_at: nowIso(),
    ...(f.rec ? {} : { created_by: currentUser || "—", created_at: nowIso() }),
  });
  const sacuvajFirmu = async (f, patch) => {
    if (!canEdit) return false;
    try {
      await onSaveFirma(f.rec ? f.rec.id : null, firmaPayload(f, patch));
      return true;
    } catch (e) {
      return false;
    }
  };

  const postaviZatecenu = (l, v) => sacuvajLicence([{ l, patch: { zatecena_verzija: v, provjereno_at: todayStr(), provjerio: currentUser || null } }]);
  const postaviNakon = async (f, lics, v) => {
    const stavke = lics.map((l) => ({
      l, patch: v ? { verzija_nakon: v, nadogradjeno_at: todayStr(), nadogradio: currentUser || null } : { verzija_nakon: null, nadogradjeno_at: null, nadogradio: null },
    }));
    const ok = await sacuvajLicence(stavke);
    if (!ok || !v) return;
    // ako su sad sve licence na aktuelnoj verziji -> firma "Nadograđeno"
    const ostale = f.licence.filter((x) => !lics.includes(x));
    const sveAktuelne = ostale.every((x) => x.kat === "g" || x.kat === "red" || x.kat === "na") && godinaVerzije(v) >= akt;
    if (sveAktuelne && !["Odbila", "Ne kontaktirati"].includes(f.status)) await sacuvajFirmu(f, { status: "Nadograđeno" });
    const od = [...new Set(lics.map((l) => l.zatecena).filter(Boolean))].sort().join("/") || "?";
    setPodrskaPrompt({ f, lics, od, na: v });
  };
  const provjerenoDanas = (lics) => sacuvajLicence(lics.filter((l) => l.zatecena).map((l) => ({ l, patch: { provjereno_at: todayStr(), provjerio: currentUser || null } })));

  const upisiPodrsku = async ({ f, lics, od, na }) => {
    const teh = TECH_NAMES.includes(currentUser) ? currentUser : f.tehnicar || currentUser;
    try {
      await onAddPodrska({
        datum: todayStr(), firma: f.naziv, tehnicar: teh, vrsta: "Instalacija", proizvod: "SOLIDWORKS",
        opis: `Nadogradnja SOLIDWORKS ${od} → ${na} (${lics.length} ${lics.length === 1 ? "licenca" : lics.length < 5 ? "licence" : "licenci"})`,
        napomena: lics.map((l) => `${l.sn} — ${kratkiNaziv(l.proizvod)}`).join("\n"),
        created_by: currentUser || teh, created_at: nowIso(), updated_by: currentUser || teh, updated_at: nowIso(),
      });
    } catch (e) { /* toast u page.js */ }
    setPodrskaPrompt(null);
  };

  // uvoz verzija iz Excela: serijski broj, proizvod (opc.), verzija, ne kontaktirati (opc.)
  const uvezi = async (rows) => {
    const poSn = new Map();
    model.licence.forEach((l) => {
      const k = l.sn.toUpperCase();
      if (!poSn.has(k)) poSn.set(k, []);
      poSn.get(k).push(l);
    });
    const stavke = new Map();
    let nepoznati = 0;
    for (const r of rows) {
      const sn = String(r[0] || "").trim().toUpperCase();
      const pr = String(r[1] || "").trim().toLowerCase();
      const ver = normVerzija(r[2]);
      const nk = /^(da|yes|x|1|true|crveno)$/i.test(String(r[3] || "").trim());
      const kandidati = (poSn.get(sn) || []).filter((l) => !pr || l.proizvod.toLowerCase() === pr);
      if (!kandidati.length) { nepoznati += 1; continue; }
      kandidati.forEach((l) => {
        const patch = {};
        if (ver) { patch.zatecena_verzija = ver; patch.provjereno_at = todayStr(); patch.provjerio = currentUser || null; }
        if (r[3] != null && String(r[3]).trim() !== "") patch.ne_kontaktirati = nk;
        if (Object.keys(patch).length) stavke.set(l.key, { l, patch });
      });
    }
    const ok = await sacuvajLicence([...stavke.values()]);
    if (ok && showToast) showToast(`Upisano ${stavke.size} licenci${nepoznati ? ` · ${nepoznati} redova nije prepoznato (serijski broj nema aktivno održavanje ili nije u Kupcima)` : ""}`);
  };

  const exportCSV = () => {
    const headers = ["Firma", "Država", "Serijski broj", "Proizvod", "Tip", "Održavanje do", "Zatečena verzija", "Verzija nakon", "Ne kontaktirati", "Provjereno", "Provjerio", "Status firme", "Tehničar", "Kontakt", "Mail", "Datum kontakta", "Termin", "Komentar"];
    const rows = filtrirane.flatMap((f) => f.licence.map((l) => [
      f.naziv, l.drzava, l.sn, l.proizvod, l.tip, l.end_date, l.zatecena === "NA" ? "nije aktivirana" : l.zatecena || "", l.nakon || "", l.red ? "DA" : "",
      l.provjereno_at || "", l.provjerio || "", f.status, f.tehnicar, f.rec?.kontakt || "", f.rec?.mail || "", f.rec?.datum_kontakta || "", f.rec?.termin || "", f.rec?.komentar || "",
    ]));
    downloadCSV(`nadogradnje_SW${akt}_${todayStr()}.csv`, headers, rows);
  };

  const toggle = (k) => setOtvorene((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  /* ---------- KPI ---------- */
  const kpi = [
    { k: null, label: "Aktivno održavanje", val: licUDrzavi.length, sub: `licenci · ${fmtN(uDrzavi.length)} ${uDrzavi.length === 1 ? "firma" : "firmi"}`, dot: "bg-teal-500" },
    { k: "y", label: "Treba kontaktirati", val: licPoKat.y, sub: `na starijoj verziji · ${fmtN(firmPoKat.y)} firmi`, dot: "bg-yellow-500" },
    { k: "g", label: `Na verziji ${akt}`, val: licPoKat.g, sub: licUDrzavi.length ? `${Math.round((licPoKat.g / licUDrzavi.length) * 100)}% · ne treba kontakt` : "ne treba kontakt", dot: "bg-green-500" },
    { k: "nep", label: "Nije provjereno", val: licPoKat.nep, sub: `${fmtN(firmPoKat.nep)} firmi`, dot: "bg-slate-300" },
    { k: "na", label: "Nije aktivirana", val: licPoKat.na, sub: `${fmtN(firmPoKat.na)} firmi`, dot: "bg-slate-400" },
    { k: "red", label: "Ne kontaktirati", val: licPoKat.red, sub: `${fmtN(firmPoKat.red)} firmi`, dot: "bg-red-500" },
  ];

  /* ---------- desna kolona ---------- */
  const raspodjela = useMemo(() => {
    const m = new Map();
    licUDrzavi.forEach((l) => {
      let k;
      if (l.kat === "nep") k = "Nije provjereno";
      else if (l.efektivna === "NA") k = "Nije aktivirana";
      else {
        const g = godinaVerzije(l.efektivna);
        k = g == null ? "Nije provjereno" : g >= akt ? String(akt) : g >= akt - 2 ? String(g) : `${akt - 3} i starije`;
      }
      m.set(k, (m.get(k) || 0) + 1);
    });
    const order = [String(akt), String(akt - 1), String(akt - 2), `${akt - 3} i starije`, "Nije aktivirana", "Nije provjereno"];
    const hex = ["#22c55e", "#facc15", "#eab308", "#ca8a04", "#94a3b8", "#e2e8f0"];
    return order.map((k, i) => ({ k, n: m.get(k) || 0, hex: hex[i] })).filter((x) => x.n > 0);
  }, [licUDrzavi, akt]);
  const poMjesecima = useMemo(() => {
    const out = [];
    const d0 = new Date(); d0.setDate(1);
    for (let i = 0; i < 6; i++) {
      const d = new Date(d0.getFullYear(), d0.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const fs = uDrzavi.filter((f) => (f.najraniji || "").startsWith(key));
      out.push({ key, label: d.toLocaleDateString("bs-BA", { month: "long" }) + (d.getFullYear() !== d0.getFullYear() ? ` ${d.getFullYear()}.` : ""), n: fs.length, y: fs.filter((f) => f.nKat.y > 0 && !["Odbila", "Ne kontaktirati", "Namjerno starija verzija", "Nadograđeno"].includes(f.status)).length });
    }
    return out;
  }, [uDrzavi]);
  const maxMj = Math.max(1, ...poMjesecima.map((m) => m.n));
  const zaduzenja = useMemo(() => {
    const m = new Map();
    model.firme.forEach((f) => {
      const t = f.tehnicar || "(nedodijeljen)";
      if (!m.has(t)) m.set(t, { t, firme: 0, zaKontakt: 0, drz: new Set() });
      const z = m.get(t);
      z.firme += 1; z.drz.add(f.grupa);
      if (f.trebaKontakt) z.zaKontakt += 1;
    });
    return [...m.values()].sort((a, b) => (a.t === "(nedodijeljen)") - (b.t === "(nedodijeljen)") || b.firme - a.firme);
  }, [model]);

  const chipCls = (on) => "h-8 px-3 rounded-full border text-[13px] whitespace-nowrap inline-flex items-center gap-1.5 transition-colors " +
    (on ? "bg-violet-600 border-violet-600 text-white font-semibold" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300");

  return (
    <div className="space-y-4">
      {/* zaglavlje */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">SOLIDWORKS licence s aktivnim održavanjem — lista se sama puni iz Kupaca i licenci</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={headerBtnSec} onClick={exportCSV}><Download size={15} /> Izvoz u Excel</button>
          {canEdit && <button type="button" className={headerBtnSec} onClick={() => setShowImport(true)}><Upload size={15} /> Uvezi verzije iz Excela</button>}
        </div>
      </div>

      {/* kampanja */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-violet-200 dark:border-violet-900/60 bg-gradient-to-r from-violet-50 to-white dark:from-violet-950/40 dark:to-slate-900 px-4 py-3">
        <span className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/50 inline-flex items-center justify-center text-violet-700 dark:text-violet-300 shrink-0"><ArrowUpCircle size={20} /></span>
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">Aktivna kampanja</div>
          <div className="text-base font-bold text-slate-900 dark:text-slate-100">SOLIDWORKS {akt} <span className="text-sm font-normal text-slate-500 dark:text-slate-400">· sve ispod verzije {akt} se nudi za nadogradnju</span></div>
        </div>
        <div className="flex-1" />
        <div className="w-full sm:w-72">
          <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
            <span><b>{fmtN(provjereno)}</b> od {fmtN(licUDrzavi.length)} licenci provjereno</span>
            <b>{licUDrzavi.length ? Math.round((provjereno / licUDrzavi.length) * 100) : 0}%</b>
          </div>
          <div className="h-2 rounded-full bg-violet-100 dark:bg-violet-900/40 overflow-hidden">
            <div className="h-full bg-violet-500" style={{ width: `${licUDrzavi.length ? (provjereno / licUDrzavi.length) * 100 : 0}%` }} />
          </div>
        </div>
        {canEdit && <button type="button" className={headerBtnSec} onClick={() => setShowKampanja(true)}><RefreshCw size={15} /> Nova kampanja</button>}
      </div>

      {!canEdit && (
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
          <Lock size={13} /> Samo pregled — nadogradnje uređuje tehnička podrška.
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpi.map((t) => {
          const on = fKat === t.k && t.k !== null;
          return (
            <button key={t.label} type="button" onClick={() => setFKat(t.k === null || fKat === t.k ? null : t.k)}
              className={"text-left rounded-2xl border bg-white dark:bg-slate-900 px-4 py-3 transition-all hover:shadow-sm " +
                (on ? "border-violet-500 ring-2 ring-violet-500/30" : "border-slate-200 dark:border-slate-800")}>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400"><span className={"w-2 h-2 rounded-sm " + t.dot} />{t.label}</span>
              <span className="block text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">{fmtN(t.val)}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{t.sub}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col xl:flex-row gap-4 items-start">
        <div className="flex-1 min-w-0 w-full space-y-3">
          {/* država */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-1">Država</span>
            <button type="button" className={chipCls(fDrzava === "Sve")} onClick={() => setFDrzava("Sve")}>Sve <span className="opacity-70 text-[11px]">{nDrzava.Sve || 0}</span></button>
            {DRZAVE.filter((d) => nDrzava[d.k]).map((d) => (
              <button key={d.k} type="button" className={chipCls(fDrzava === d.k)} onClick={() => setFDrzava(d.k)}>
                {TEHNICAR_PO_DRZAVI[d.k] && <Avatar name={TEHNICAR_PO_DRZAVI[d.k]} size="sm" />}
                {d.label}
                <span className="opacity-70 text-[11px]">{TEHNICAR_PO_DRZAVI[d.k] ? `${TEHNICAR_PO_DRZAVI[d.k].split(" ")[0]} · ` : ""}{nDrzava[d.k]}</span>
              </button>
            ))}
          </div>
          {/* status + filteri */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-1">Status</span>
            {["Svi", ...N_STATUSI, AUTO_AKTUELNA].filter((s) => s === "Svi" || nStatus[s]).map((s) => (
              <button key={s} type="button" className={chipCls(fStatus === s)} onClick={() => setFStatus(s)}>{s} <span className="opacity-70 text-[11px]">{nStatus[s] || 0}</span></button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SearchBox value={q} onChange={setQ} placeholder="Firma ili serijski broj…" />
            <FilterPill label="Ističe" value={fIstice} defaultValue="Sve" options={["Sve", "30 dana", "3 mjeseca", "6 mjeseci"]} onChange={setFIstice} />
            <FilterPill label="Tehničar" value={fTehnicar} defaultValue="Svi" options={["Svi", ...tehnicari, "(nedodijeljen)"]} onChange={setFTehnicar} />
          </div>

          {/* tabela */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            {filtrirane.length === 0 ? (
              <div className="p-6">
                <EmptyState icon={ArrowUpCircle} title={model.firme.length ? "Nema firmi za ove filtere" : "Nema licenci s aktivnim održavanjem"}
                  subtitle={model.firme.length ? "Promijeni filtere iznad." : "Lista se puni iz taba Kupci i licence (SOLIDWORKS proizvodi kojima održavanje još traje)."} />
              </div>
            ) : (
              <>
                <div className="hidden md:grid grid-cols-[18px_minmax(0,1fr)_170px_104px_190px_160px_28px] gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <span /><span>Firma</span><span>Verzije po licencama</span><span>Ističe ↑</span><span>Status kontakta</span><span>Kontakt</span><span />
                </div>
                {stranica.map((f) => {
                  const open = otvorene.has(f.key);
                  const muted = f.status === AUTO_AKTUELNA;
                  return (
                    <div key={f.key} className="border-t border-slate-100 dark:border-slate-800 first:border-t-0">
                      <div onClick={() => toggle(f.key)}
                        className={"grid grid-cols-[18px_minmax(0,1fr)_auto] md:grid-cols-[18px_minmax(0,1fr)_170px_104px_190px_160px_28px] gap-3 items-center px-4 py-2.5 cursor-pointer transition-colors " +
                          (open ? "bg-violet-50/60 dark:bg-violet-950/30" : "hover:bg-slate-50 dark:hover:bg-slate-800/40") + (muted && !open ? " opacity-75" : "")}>
                        <span className="text-slate-400">{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{f.naziv}</span>
                            <span className="text-[11px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 rounded-full whitespace-nowrap">{f.licence.length} lic.</span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {[...new Set(f.licence.map((l) => kratkiNaziv(l.proizvod)))].join(", ")}
                            {f.najkasniji && f.najkasniji !== f.najraniji && <span className="text-amber-700 dark:text-amber-400"> · ističu {fmtDate(f.najraniji)} – {fmtDate(f.najkasniji)}</span>}
                          </div>
                          <div className="md:hidden flex flex-wrap gap-1 mt-1">{verzijeChips(f).map((c, i) => <VerzijaPill key={i} ver={c.ver} kat={c.kat} n={c.n} />)}</div>
                        </div>
                        <div className="md:hidden"><StatusChip status={f.status} sm /></div>
                        <div className="hidden md:flex flex-wrap gap-1">{verzijeChips(f).map((c, i) => <VerzijaPill key={i} ver={c.ver} kat={c.kat} n={c.n} />)}</div>
                        <div className="hidden md:block"><IsticeCell d={f.najraniji} /></div>
                        <div className="hidden md:block">
                          <StatusChip status={f.status} />
                          {f.nadogradjeno > 0 && f.status !== "Nadograđeno" && <div className="text-[11px] text-violet-700 dark:text-violet-300 mt-1">{f.nadogradjeno} od {f.licence.length} nadograđeno</div>}
                          {f.rec?.komentar && ["Odbila", "Ne kontaktirati", "Namjerno starija verzija"].includes(f.status) && <div className="text-[11px] text-slate-500 truncate mt-1" title={f.rec.komentar}>{f.rec.komentar}</div>}
                        </div>
                        <div className="hidden md:block min-w-0">
                          {f.rec?.kontakt || f.rec?.datum_kontakta ? (
                            <>
                              <div className="text-[12.5px] text-slate-700 dark:text-slate-300 truncate">{f.rec.kontakt || "—"}</div>
                              {f.rec.datum_kontakta && <div className="text-[11.5px] text-slate-500">kontaktirano {fmtDate(f.rec.datum_kontakta)}</div>}
                            </>
                          ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                          {f.tehnicar && <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5 truncate"><Wrench size={10} /> {f.tehnicar}</div>}
                        </div>
                        <div className="hidden md:block" onClick={(e) => e.stopPropagation()}>
                          <button type="button" className={btnGhostIcon} title="Otvori firmu" aria-label="Otvori firmu" onClick={() => setPanelKey(f.key)}><ArrowRight size={15} /></button>
                        </div>
                      </div>
                      {open && (
                        <div className="bg-violet-50/60 dark:bg-violet-950/30 px-4 pb-3 md:pl-11">
                          <div className="hidden md:grid grid-cols-[210px_minmax(0,1fr)_96px_124px_150px_130px] gap-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                            <span>Serijski broj</span><span>Proizvod</span><span>Održavanje do</span><span>Zatečena verzija</span><span>Verzija nakon</span><span>Provjereno</span>
                          </div>
                          {f.licence.map((l) => (
                            <div key={l.key} className="grid grid-cols-1 md:grid-cols-[210px_minmax(0,1fr)_96px_124px_150px_130px] gap-x-3 gap-y-1 items-center py-2 border-t border-dashed border-violet-100 dark:border-violet-900/50">
                              <span className="font-mono text-xs text-slate-700 dark:text-slate-300 break-all">{l.sn}</span>
                              <span className="text-[12.5px] text-slate-800 dark:text-slate-200 flex items-center gap-1.5 min-w-0">
                                <span className="truncate" title={l.proizvod}>{l.proizvod.replace(/ Technical Product$/i, "")}</span>
                                {l.tip && <span className="text-[10px] font-bold text-sky-800 bg-sky-100 dark:bg-sky-900/40 dark:text-sky-200 px-1.5 rounded">{l.tip}</span>}
                              </span>
                              <span className="text-[12.5px] text-slate-600 dark:text-slate-400 tabular-nums">{fmtDate(l.end_date)}</span>
                              <span onClick={(e) => e.stopPropagation()}>
                                <VerzijaSelect value={l.zatecena} akt={akt} disabled={!canEdit} kat={l.red ? "red" : undefined} onChange={(v) => postaviZatecenu(l, v)} />
                              </span>
                              <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                {l.nakon && <ArrowUp size={13} className="text-green-600" />}
                                {canEdit || l.nakon ? (
                                  <VerzijaSelect value={l.nakon} akt={akt} disabled={!canEdit} placeholder="odaberi" onChange={(v) => postaviNakon(f, [l], v)} />
                                ) : <span className="text-xs text-slate-400">—</span>}
                              </span>
                              <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                {l.provjerio && <Avatar name={l.provjerio} size="sm" />}
                                {l.nadogradjeno_at ? <span className="text-green-700 dark:text-green-400">nadograđeno {fmtDate(l.nadogradjeno_at)}</span>
                                  : l.provjereno_at ? fmtDate(l.provjereno_at) : l.prenijeto ? <span title="Zadnje poznato iz ranije kampanje">iz kampanje {l.prev.kampanja}</span> : "—"}
                              </span>
                            </div>
                          ))}
                          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-dashed border-violet-100 dark:border-violet-900/50">
                            {canEdit && (
                              <>
                                <button type="button" className={btnSecondary + " !py-1.5 text-[13px]"} onClick={() => provjerenoDanas(f.licence)}><Check size={14} /> Provjereno danas — sve {f.licence.length}</button>
                                <button type="button" className={btnSecondary + " !py-1.5 text-[13px]"} onClick={() => postaviNakon(f, f.licence.filter((l) => l.kat === "y"), String(akt))} disabled={!f.licence.some((l) => l.kat === "y")}>
                                  <ArrowUp size={14} /> Sve nadograđene na {akt}
                                </button>
                              </>
                            )}
                            <span className="flex-1" />
                            {onViewCompany && <button type="button" className={btnSecondary + " !py-1.5 text-[13px]"} onClick={() => onViewCompany(f.naziv)}><ExternalLink size={14} /> 360°</button>}
                            <button type="button" className={btnPrimary + " !py-1.5 text-[13px] !bg-violet-600 hover:!bg-violet-700"} onClick={() => setPanelKey(f.key)}>Otvori firmu <ArrowRight size={14} /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                <PageNav page={page} setPage={setPage} pageSize={pageSize} setPageSize={setPageSize} total={filtrirane.length} />
              </>
            )}
          </div>
        </div>

        {/* desna kolona */}
        <div className="w-full xl:w-[320px] shrink-0 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <PanelLabel>Stanje verzija{fDrzava !== "Sve" ? ` · ${fDrzava}` : ""}</PanelLabel>
            <div className="flex h-3.5 rounded overflow-hidden gap-0.5 mb-2">
              {raspodjela.map((r) => <div key={r.k} title={`${r.k}: ${r.n}`} style={{ width: `${(r.n / Math.max(1, licUDrzavi.length)) * 100}%`, background: r.hex }} />)}
            </div>
            {raspodjela.map((r) => (
              <div key={r.k} className="flex items-center gap-2 py-1 border-t border-slate-100 dark:border-slate-800 text-[13px] text-slate-700 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: r.hex }} />
                <span className="flex-1">{r.k}</span>
                <b className="tabular-nums">{fmtN(r.n)}</b>
                <span className="w-9 text-right text-xs text-slate-400">{Math.round((r.n / Math.max(1, licUDrzavi.length)) * 100)}%</span>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <PanelLabel>Održavanje ističe — kontaktiraj prije ponude za obnovu</PanelLabel>
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mb-2"><b className="text-yellow-700 dark:text-yellow-400">žuto</b> = firme na starijoj verziji (još otvorene) / ukupno firmi</p>
            {poMjesecima.map((m) => (
              <div key={m.key} className="grid grid-cols-[96px_1fr_48px] items-center gap-2 py-1">
                <span className="text-[13px] text-slate-700 dark:text-slate-300 capitalize">{m.label}</span>
                <div className="h-2.5 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                  <div className="bg-yellow-500" style={{ width: `${(m.y / maxMj) * 100}%` }} />
                  <div className="bg-slate-200 dark:bg-slate-700" style={{ width: `${((m.n - m.y) / maxMj) * 100}%` }} />
                </div>
                <span className="text-xs text-right text-slate-600 dark:text-slate-400 tabular-nums"><b>{m.y}</b> / {m.n}</span>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <PanelLabel>Zaduženja</PanelLabel>
            {zaduzenja.map((z) => (
              <button key={z.t} type="button" onClick={() => setFTehnicar(fTehnicar === z.t ? "Svi" : z.t)}
                className={"w-full flex items-center gap-2.5 py-1.5 border-t border-slate-100 dark:border-slate-800 first:border-t-0 text-left rounded " + (fTehnicar === z.t ? "bg-violet-50 dark:bg-violet-950/40" : "")}>
                {z.t === "(nedodijeljen)" ? <span className="w-7 h-7 rounded-full border border-dashed border-slate-300 dark:border-slate-600 shrink-0" /> : <Avatar name={z.t} />}
                <span className="flex-1 min-w-0">
                  <span className={"block text-[13px] font-semibold truncate " + (z.t === "(nedodijeljen)" ? "text-slate-400 italic" : "text-slate-800 dark:text-slate-200")}>{z.t === "(nedodijeljen)" ? "Nije dodijeljeno" : z.t}</span>
                  <span className="block text-[11.5px] text-slate-500">{[...z.drz].map((d) => (DRZAVE.find((x) => x.k === d) || {}).label).join(", ")}</span>
                </span>
                <span className="text-xs text-slate-600 dark:text-slate-400 text-right whitespace-nowrap">{z.zaKontakt} za kontakt<br /><span className="text-slate-400">{z.firme} firmi</span></span>
              </button>
            ))}
            <p className="text-[11.5px] text-slate-400 mt-2">BiH i Albanija → Ahmed Mujkanović. Za Hrvatsku se tehničar bira u panelu firme.</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1.5">
            <PanelLabel>Boje — iste kao u Excelu</PanelLabel>
            {[[String(akt), "g", "najnovija verzija — ne treba kontakt"], [String(akt - 1), "y", "starija verzija — kontaktirati"], ["NA", "na", "licenca nije aktivirana"], [String(akt - 1), "red", "ne kontaktirati"], [null, "nep", "još nije provjereno"]].map(([v, k, t]) => (
              <div key={k} className="flex items-center gap-2 text-[12.5px] text-slate-700 dark:text-slate-300"><VerzijaPill ver={v} kat={k} /> {t}</div>
            ))}
          </div>
        </div>
      </div>

      {panelFirma && (
        <FirmaPanel f={panelFirma} akt={akt} canEdit={canEdit} potencijali={potencijali} podrska={podrska}
          onClose={() => setPanelKey(null)} onSaveFirma={(patch) => sacuvajFirmu(panelFirma, patch)}
          onZatecena={postaviZatecenu} onNakon={(lics, v) => postaviNakon(panelFirma, lics, v)} onProvjereno={provjerenoDanas}
          onRedFlag={(l, v) => sacuvajLicence([{ l, patch: { ne_kontaktirati: v } }])}
          onViewCompany={onViewCompany} />
      )}

      {podrskaPrompt && (
        <div className="fixed left-4 right-4 sm:right-auto bottom-4 z-[60] sm:w-[520px] bg-white dark:bg-slate-900 border border-violet-300 dark:border-violet-800 rounded-2xl shadow-2xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/40 text-green-700 inline-flex items-center justify-center shrink-0"><Check size={16} /></span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{podrskaPrompt.lics.length === 1 ? "Licenca nadograđena" : `${podrskaPrompt.lics.length} licence nadograđene`}: {podrskaPrompt.od} → {podrskaPrompt.na}</div>
              <div className="text-xs text-slate-500 truncate">{podrskaPrompt.f.naziv}</div>
            </div>
            <button type="button" className={btnGhostIcon} onClick={() => setPodrskaPrompt(null)} aria-label="Zatvori"><X size={16} /></button>
          </div>
          <div className="text-[12.5px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
            Upisati i u <b>Tehničku podršku</b>? Vrsta: Instalacija · SOLIDWORKS · „Nadogradnja SOLIDWORKS {podrskaPrompt.od} → {podrskaPrompt.na}“
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setPodrskaPrompt(null)}>Samo nadogradnja</button>
            <button type="button" className={btnPrimary + " !bg-violet-600 hover:!bg-violet-700"} onClick={() => upisiPodrsku(podrskaPrompt)}><Wrench size={14} /> Upiši i u podršku</button>
          </div>
        </div>
      )}

      {showImport && (
        <ImportModal
          title="Uvezi verzije iz Excela"
          columns={["Serijski broj", "Naziv proizvoda 2 (može prazno)", "Verzija (npr. 2025 ili not activated)", "Ne kontaktirati (DA / prazno)"]}
          existingNames={[]}
          onClose={() => setShowImport(false)}
          onImport={async (rows) => { await uvezi(rows); setShowImport(false); }}
        />
      )}

      {showKampanja && (
        <NovaKampanjaModal akt={akt} onClose={() => setShowKampanja(false)}
          onSave={async (v) => { await onNovaKampanja(v); setShowKampanja(false); }} />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Panel firme                                                            */
/* ---------------------------------------------------------------------- */

function FirmaPanel({ f, akt, canEdit, potencijali, podrska, onClose, onSaveFirma, onZatecena, onNakon, onProvjereno, onRedFlag, onViewCompany }) {
  const init = () => ({
    status: f.auto ? (f.status === AUTO_AKTUELNA ? "" : f.status) : f.status,
    tehnicar: f.tehnicar || "", kontakt: f.rec?.kontakt || "", mail: f.rec?.mail || "",
    datum_kontakta: f.rec?.datum_kontakta || "", termin: f.rec?.termin || "", komentar: f.rec?.komentar || "",
  });
  const [v, setV] = useState(init);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setV(init()); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.key]);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // prijedlozi kontakata koje CRM već ima za ovu firmu
  const prijedlozi = useMemo(() => {
    const imena = new Map();
    potencijali.filter((p) => companyKey(p.naziv_firme) === f.key).forEach((p) => {
      if (p.kontakt_osoba) imena.set(p.kontakt_osoba, p.email || "");
      (p.dodatni_kontakti || []).forEach((k) => { if (k.ime) imena.set(k.ime, k.email || ""); });
    });
    return [...imena.entries()].map(([ime, mail]) => ({ ime, mail }));
  }, [potencijali, f.key]);
  const prodavac = useMemo(() => {
    const p = potencijali.find((x) => companyKey(x.naziv_firme) === f.key);
    return p ? [p.kolega, ...(p.prodavaci || [])].filter((x) => x && x !== "Nedodijeljeno")[0] : null;
  }, [potencijali, f.key]);

  const set = (k) => (e) => {
    const val = e.target.value;
    setV((s) => {
      const n = { ...s, [k]: val };
      if (k === "kontakt") { const m = prijedlozi.find((p) => p.ime === val); if (m && m.mail && !s.mail) n.mail = m.mail; }
      return n;
    });
  };
  const setStatus = (s) => setV((x) => ({ ...x, status: s, datum_kontakta: s === "Kontaktirana" && !x.datum_kontakta ? todayStr() : x.datum_kontakta }));
  const save = async () => {
    setBusy(true);
    const ok = await onSaveFirma({
      status: v.status || null, tehnicar: v.tehnicar || null, kontakt: v.kontakt.trim() || null, mail: v.mail.trim() || null,
      datum_kontakta: v.datum_kontakta || null, termin: v.termin || null, komentar: v.komentar.trim() || null,
    });
    setBusy(false);
    if (ok) onClose();
  };
  const korak = KORACI.indexOf(v.status || "Nije kontaktirana");
  const ranije = f.licence.flatMap((l) => l.historija.map((h) => ({ ...h, sn: l.sn }))).sort((a, b) => Number(b.kampanja) - Number(a.kampanja));
  const podrskaFirme = podrska.filter((s) => companyKey(s.firma) === f.key && /nadogradnj/i.test(s.opis || "")).slice(0, 3);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 dark:bg-black/60" onClick={onClose}>
      <div className="w-full max-w-[640px] h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 inline-flex items-center justify-center text-slate-500 shrink-0"><Building2 size={20} /></span>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">{f.naziv}</h3>
              <p className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                {f.licence.length} {f.licence.length === 1 ? "licenca" : "licence"} · održavanje do {fmtDate(f.najraniji)}
                {f.najraniji && <b className="text-orange-700 dark:text-orange-400"> (za {daysDiff(f.najraniji)} dana)</b>}
                {f.najkasniji && f.najkasniji !== f.najraniji && <> – {fmtDate(f.najkasniji)}</>}
              </p>
            </div>
            {onViewCompany && <button type="button" className={btnSecondary + " !py-1.5 text-[13px] whitespace-nowrap"} onClick={() => onViewCompany(f.naziv)}><ExternalLink size={14} /> 360°</button>}
            <button type="button" className={btnGhostIcon} onClick={onClose} aria-label="Zatvori"><X size={18} /></button>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[12.5px] text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1.5">Kampanja SOLIDWORKS {akt}</span>
            <span className="flex items-center gap-1.5">Prodavač: <b className="font-medium text-slate-700 dark:text-slate-300">{prodavac || "—"}</b></span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
          {/* tehničar */}
          <label className="block">
            <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Tehničar koji je preuzeo nadogradnju</span>
            <select className={inputCls} value={v.tehnicar} onChange={set("tehnicar")} disabled={!canEdit}>
              <option value="">— nije dodijeljeno —</option>
              {TECH_NAMES.map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>

          {/* status */}
          <div>
            <PanelLabel>Status kontakta</PanelLabel>
            <div className="flex items-start">
              {KORACI.map((s, i) => {
                const done = korak > i; const cur = korak === i;
                return [
                  <button key={s} type="button" disabled={!canEdit} onClick={() => setStatus(s)} className="flex flex-col items-center gap-1.5 w-[25%] sm:w-28 text-center disabled:cursor-default">
                    <span className={"w-6 h-6 rounded-full inline-flex items-center justify-center " +
                      (done ? "bg-violet-600 text-white" : cur ? "border-2 border-violet-600 bg-violet-100 dark:bg-violet-900/40" : "border-2 border-slate-300 dark:border-slate-600")}>
                      {done ? <Check size={13} /> : cur ? <span className="w-2 h-2 rounded-full bg-violet-600" /> : null}
                    </span>
                    <span className={"text-[11.5px] leading-tight " + (cur ? "font-bold text-violet-800 dark:text-violet-300" : done ? "text-slate-700 dark:text-slate-300" : "text-slate-400")}>{s}</span>
                  </button>,
                  i < KORACI.length - 1 && <span key={s + "l"} className={"flex-1 h-0.5 mt-3 " + (korak > i ? "bg-violet-500" : "bg-slate-200 dark:bg-slate-700")} />,
                ];
              })}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {[["Odbila", X], ["Ne kontaktirati", Ban], ["Namjerno starija verzija", History]].map(([s, Ic]) => (
                <button key={s} type="button" disabled={!canEdit} onClick={() => setStatus(v.status === s ? "" : s)}
                  className={"inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[12.5px] font-medium disabled:opacity-60 " +
                    (v.status === s ? "bg-red-50 border-red-300 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300" : "bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300")}>
                  <Ic size={13} /> {s}
                </button>
              ))}
            </div>
            {f.auto && <p className="text-[11.5px] text-slate-400 mt-2">Trenutno: <b>{f.status}</b> (automatski, prema verzijama licenci).</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
            <Field label="Kontakt osoba">
              <input className={inputCls} list={`kont-${f.key}`} value={v.kontakt} onChange={set("kontakt")} disabled={!canEdit} placeholder="ime i prezime" />
              <datalist id={`kont-${f.key}`}>{prijedlozi.map((p) => <option key={p.ime} value={p.ime} />)}</datalist>
            </Field>
            <Field label="Mail na koji je poslano">
              <input className={inputCls} type="email" value={v.mail} onChange={set("mail")} disabled={!canEdit} placeholder="mail@firma.ba" />
            </Field>
            <Field label="Datum kontakta"><input type="date" className={inputCls} value={v.datum_kontakta} onChange={set("datum_kontakta")} disabled={!canEdit} /></Field>
            <Field label="Termin nadogradnje"><input type="date" className={inputCls} value={v.termin} onChange={set("termin")} disabled={!canEdit} /></Field>
          </div>
          {prijedlozi.length > 0 && <p className="text-[11.5px] text-slate-400 -mt-3">Kontakt osoba nudi kontakte iz Baze potencijala za ovu firmu.</p>}
          <Field label="Komentar">
            <textarea className={inputCls} rows={3} value={v.komentar} onChange={set("komentar")} disabled={!canEdit} placeholder="npr. dogovoreno da se nadogradi kad završe projekat" />
          </Field>

          {/* licence */}
          <div>
            <PanelLabel right={canEdit && (
              <span className="flex gap-1.5">
                <button type="button" className={btnSecondary + " !py-1 !px-2.5 text-[12px]"} onClick={() => onProvjereno(f.licence)}><Check size={13} /> Provjereno danas</button>
                <button type="button" className={btnSecondary + " !py-1 !px-2.5 text-[12px]"} disabled={!f.licence.some((l) => l.kat === "y")} onClick={() => onNakon(f.licence.filter((l) => l.kat === "y"), String(akt))}><ArrowUp size={13} /> Sve na {akt}</button>
              </span>
            )}>Licence</PanelLabel>
            {f.licence.map((l) => (
              <div key={l.key} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_118px_16px_128px] gap-x-2 gap-y-1.5 items-center py-2.5 border-t border-slate-100 dark:border-slate-800">
                <div className="min-w-0 col-span-2 sm:col-span-1">
                  <div className="font-mono text-xs text-slate-700 dark:text-slate-300 break-all">{l.sn}</div>
                  <div className="text-[11.5px] text-slate-500 truncate">{kratkiNaziv(l.proizvod)}{l.tip ? ` · ${l.tip}` : ""} · do {fmtDate(l.end_date)}</div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                    {l.nadogradjeno_at ? <span className="text-green-700 dark:text-green-400">nadograđeno {fmtDate(l.nadogradjeno_at)}{l.nadogradio ? ` · ${l.nadogradio}` : ""}</span>
                      : l.provjereno_at ? <span>provjereno {fmtDate(l.provjereno_at)}{l.provjerio ? ` · ${l.provjerio}` : ""}</span> : null}
                    {canEdit ? (
                      <label className="inline-flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={l.red} onChange={(e) => onRedFlag(l, e.target.checked)} className="accent-red-600" /> ne kontaktirati
                      </label>
                    ) : l.red ? <span className="text-red-600">ne kontaktirati</span> : null}
                  </div>
                </div>
                <VerzijaSelect value={l.zatecena} akt={akt} disabled={!canEdit} kat={l.red ? "red" : undefined} onChange={(val) => onZatecena(l, val)} />
                <ArrowRight size={14} className="text-slate-300 hidden sm:block" />
                <VerzijaSelect value={l.nakon} akt={akt} disabled={!canEdit} placeholder="verzija nakon" onChange={(val) => onNakon([l], val)} />
              </div>
            ))}
          </div>

          {/* ranije */}
          <div>
            <PanelLabel>Ranije kampanje</PanelLabel>
            {ranije.length === 0 ? (
              <p className="text-[12.5px] text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2">Prva kampanja u CRM-u. Od iduće ovdje se vidi: zatečena verzija → verzija nakon, ko je radio i kada.</p>
            ) : ranije.map((h) => (
              <div key={h.id} className="text-[12.5px] text-slate-600 dark:text-slate-300 py-1 border-t border-slate-100 dark:border-slate-800">
                <b>SW {h.kampanja}</b> · <span className="font-mono text-[11px]">{h.sn}</span> · {normVerzija(h.zatecena_verzija) || "?"}{h.verzija_nakon ? ` → ${normVerzija(h.verzija_nakon)}` : ""}{h.nadogradio ? ` · ${h.nadogradio}` : ""}{h.nadogradjeno_at ? ` · ${fmtDate(h.nadogradjeno_at)}` : ""}
              </div>
            ))}
            {podrskaFirme.length > 0 && (
              <div className="mt-2 space-y-1">
                {podrskaFirme.map((s) => <div key={s.id} className="text-[12px] text-slate-500 flex items-center gap-1.5"><Wrench size={11} /> {fmtDate(s.datum)} · {s.tehnicar} · {s.opis}</div>)}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex justify-end gap-2">
          <button type="button" className={btnSecondary} onClick={onClose}>Zatvori</button>
          {canEdit && <button type="button" className={btnPrimary + " !bg-violet-600 hover:!bg-violet-700"} onClick={save} disabled={busy}><Check size={15} /> {busy ? "Čuvam..." : "Sačuvaj"}</button>}
        </div>
      </div>
    </div>
  );
}

function NovaKampanjaModal({ akt, onClose, onSave }) {
  const [v, setV] = useState(String(akt + 1));
  const [busy, setBusy] = useState(false);
  const n = Number(v);
  const ok = Number.isInteger(n) && n > akt && n < akt + 5;
  return (
    <Modal title="Nova kampanja" onClose={onClose}>
      <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">Kad izađe nova verzija SOLIDWORKS-a, otvori novu kampanju. Trenutna je <b>SOLIDWORKS {akt}</b>.</p>
      <Field label="Nova aktuelna verzija" required>
        <input type="number" className={inputCls} value={v} onChange={(e) => setV(e.target.value)} />
      </Field>
      <ul className="text-[13px] text-slate-600 dark:text-slate-300 space-y-1.5 mb-5">
        {[
          "Zatečena verzija = zadnja poznata (verzija nakon iz prošle kampanje)",
          "Statusi kontakta kreću ispočetka („Nije kontaktirana“)",
          "„Ne kontaktirati“ i „Namjerno starija verzija“ ostaju",
          `Kampanja ${akt} ostaje u historiji svake licence`,
        ].map((t) => <li key={t} className="flex gap-2"><Check size={15} className="text-green-600 shrink-0 mt-0.5" /> {t}</li>)}
      </ul>
      <div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-lg px-3 py-2 mb-4">
        <AlertTriangle size={14} className="shrink-0 mt-0.5" /> Ovo se radi jednom godišnje. Vratiti se na staru kampanju može samo administrator u bazi.
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className={btnSecondary} onClick={onClose}>Otkaži</button>
        <button type="button" className={btnPrimary + " !bg-violet-600 hover:!bg-violet-700"} disabled={!ok || busy}
          onClick={async () => { setBusy(true); try { await onSave(n); } finally { setBusy(false); } }}>
          Otvori kampanju {ok ? n : ""}
        </button>
      </div>
    </Modal>
  );
}
