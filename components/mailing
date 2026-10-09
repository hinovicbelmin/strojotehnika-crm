"use client";
// Izvoz kontakata za mailing (Outlook spajanje pošte) — filteri, izostavljanje, odjave, evidencija
import { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import { Mail, X, Lock, Save, Download, Search, Filter, Ban, History, RotateCcw } from "lucide-react";
import {
  btnPrimary, btnSecondary, btnGhostIcon, fmtDate, companyKey, POTENCIJAL_STATUSI, PRODAJA_MARKETING_NAMES,
  currentMonthStr, isForecastWon, isForecastLost,
} from "../lib/crm";
import { fmtN, Avatar } from "./crmBits";
import { drzavaGrupa } from "./nadogradnje";
import {
  DRZAVE, ODRZAVANJE, TIPOVI, ZADNJI, PORODICE_LIC, licenceInfo, odrzavanjeOk, zadnjiOk, kupciPoFirmi, akcijaAktivna,
} from "./akcije";

/* ---------------------------------------------------------------------- */
/*  Postavke i pomoćne funkcije                                            */
/* ---------------------------------------------------------------------- */

export const ODJAVA_RAZLOZI = ["Odjavio se", "Tražio telefonom / mailom", "Pogrešan mail", "Drugo"];
const IZVORI = ["Baza potencijala", "Kupci", "Oboje"];
const NEDODIJELJENO = "Nedodijeljeno";
const DRZAVA_KRATKO = { BA: "BiH", HR: "Hrvatska", AL: "Albanija" };
export const POCETNI_FILTER = {
  izvor: "Oboje", drzava: "Sve", prodavac: "Svi", porodica: "Svi", tip: "Sve", odrzavanje: "Sve", status: "Svi", zadnji: "Bilo kada", akcija: "",
  kupiliDana: 30, xKupili: true, xForecast: true, xAkcija: false, xNezainteresovana: true, xIzgubljen: true, osobe: "svi",
};
const RAZLOZI = [
  ["xKupili", "kupili"], ["xForecast", "forecast"], ["xAkcija", "akcija"], ["xNezainteresovana", "nezainteresovana"], ["xIzgubljen", "izgubljen"],
];
const MAIL_RE = /[A-Z0-9._%+'-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
export const normMail = (s) => String(s || "").trim().toLowerCase();
function prviMail(s) {
  const m = String(s || "").match(MAIL_RE);
  return m ? m[0].toLowerCase() : "";
}
function prodavaciOf(p) {
  const all = [p.kolega, ...(p.prodavaci || [])].filter((x) => x && x !== NEDODIJELJENO);
  return [...new Set(all)];
}
function isoPrije(dana) {
  const d = new Date();
  d.setDate(d.getDate() - dana);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function danasIso() { return isoPrije(0); }
function podijeliIme(ime) {
  const p = String(ime || "").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return ["", ""];
  return [p[0], p.slice(1).join(" ")];
}

export function opisFiltera(f, akcije = []) {
  const d = [];
  if (f.akcija) { const a = akcije.find((x) => x.id === f.akcija); d.push(`Akcija: ${a ? a.naziv : "?"}`); }
  if (f.izvor !== "Oboje") d.push(f.izvor);
  if (f.drzava !== "Sve") d.push((DRZAVE.find((x) => x[0] === f.drzava) || [0, f.drzava])[1]);
  if (f.prodavac !== "Svi") d.push(f.prodavac);
  if (f.porodica !== "Svi") d.push(f.porodica);
  if (f.tip !== "Sve") d.push((TIPOVI.find((x) => x[0] === f.tip) || [0, f.tip])[1]);
  if (f.odrzavanje !== "Sve") d.push(`održavanje: ${f.odrzavanje.toLowerCase()}`);
  if (f.status !== "Svi") d.push(f.status);
  if (f.zadnji !== "Bilo kada") d.push(`zadnji kontakt: ${f.zadnji.toLowerCase()}`);
  if (f.xKupili) d.push(`bez kupaca ${f.kupiliDana} dana`);
  if (f.osobe === "glavni") d.push("samo glavni kontakt");
  return d.join(" · ") || "Svi kontakti";
}

/*
 * Model izvoza: firme koje prolaze filtere, razlozi izostavljanja i osobe s mailom.
 */
export function izgradiMailing({ kupci, potencijali, forecast, akcije, akcijeFirme, odjave, f }) {
  const kupciMap = kupciPoFirmi(kupci);
  const potMap = new Map();
  for (const p of potencijali || []) {
    const k = companyKey(p.naziv_firme);
    if (!k) continue;
    if (!potMap.has(k)) potMap.set(k, []);
    potMap.get(k).push(p);
  }
  let keys;
  if (f.izvor === "Baza potencijala") keys = [...potMap.keys()];
  else if (f.izvor === "Kupci") keys = [...kupciMap.keys()];
  else keys = [...new Set([...potMap.keys(), ...kupciMap.keys()])];
  if (f.akcija) {
    const uAkciji = new Set((akcijeFirme || []).filter((r) => r.akcija_id === f.akcija).map((r) => r.firma_key));
    keys = keys.filter((k) => uAkciji.has(k));
  }

  // razlozi izostavljanja (skupovi ključeva firmi)
  const od = isoPrije(Number(f.kupiliDana) || 0);
  const danas = danasIso();
  const odMj = od.slice(0, 7);
  const tekuciMj = currentMonthStr();
  const kupili = new Set();
  for (const r of forecast || []) if (isForecastWon(r.status) && r.mjesec && r.mjesec >= odMj && r.mjesec <= tekuciMj) kupili.add(companyKey(r.kupac));
  for (const k of kupci || []) {
    const s = k.start_date ? String(k.start_date).slice(0, 10) : "";
    if (s && s >= od && s <= danas) kupili.add(companyKey(k.naziv_firme));
  }
  for (const p of potencijali || []) {
    const s = p.datum_dobijanja ? String(p.datum_dobijanja).slice(0, 10) : "";
    if (s && s >= od && s <= danas) kupili.add(companyKey(p.naziv_firme));
  }
  const uForecastu = new Set((forecast || []).filter((r) => !isForecastWon(r.status) && !isForecastLost(r.status) && (!r.mjesec || r.mjesec >= tekuciMj)).map((r) => companyKey(r.kupac)));
  const aktivneAkcije = new Set((akcije || []).filter((a) => akcijaAktivna(a) && a.id !== f.akcija).map((a) => a.id));
  const uAktivnojAkciji = new Set((akcijeFirme || []).filter((r) => aktivneAkcije.has(r.akcija_id)).map((r) => r.firma_key));
  const nezainteresovana = new Set((akcijeFirme || []).filter((r) => r.status === "Nije zainteresovana").map((r) => r.firma_key));
  const odjavljeni = new Map((odjave || []).map((o) => [normMail(o.email), o]));

  const licFilter = f.porodica !== "Svi" || f.tip !== "Sve" || f.odrzavanje !== "Sve";
  const poRazlogu = { kupili: 0, forecast: 0, akcija: 0, nezainteresovana: 0, izgubljen: 0, odjava: 0 };
  const osobe = [];
  let firmiOsnova = 0;
  let firmiBezMaila = 0;
  const vidjeni = new Set();

  for (const key of keys) {
    const pots = potMap.get(key) || [];
    const kRows = kupciMap.get(key) || [];
    const pot = pots.find((p) => prodavaciOf(p).length) || pots[0] || null;
    const naziv = String((pot && pot.naziv_firme) || (kRows[0] && kRows[0].naziv_firme) || "").trim();
    const drzava = (pot && pot.drzava) || (kRows[0] && kRows[0].drzava) || "";
    const grupa = drzavaGrupa(drzava);
    if (f.drzava !== "Sve" && grupa !== f.drzava) continue;
    const prodavaci = [...new Set(pots.flatMap(prodavaciOf))];
    if (f.prodavac !== "Svi" && !(f.prodavac === "(nedodijeljeno)" ? prodavaci.length === 0 : prodavaci.includes(f.prodavac))) continue;
    if (f.status !== "Svi" && !pots.some((p) => p.status === f.status)) continue;
    const zk = pots.map((p) => p.zadnji_kontakt).filter(Boolean).sort().slice(-1)[0] || null;
    if (!zadnjiOk({ zadnji_kontakt: zk }, f.zadnji)) continue;
    const li = licenceInfo(kRows, f.porodica === "Svi" ? "Sve" : f.porodica, f.tip);
    if (licFilter && (!li.ima || !odrzavanjeOk(li, f.odrzavanje))) continue;
    firmiOsnova += 1;

    const r = {
      kupili: kupili.has(key), forecast: uForecastu.has(key), akcija: uAktivnojAkciji.has(key),
      nezainteresovana: nezainteresovana.has(key), izgubljen: !!(pot && pot.status === "Izgubljen"),
    };
    let razlog = null;
    for (const [fk, rk] of RAZLOZI) {
      if (!r[rk]) continue;
      if (f[fk]) { poRazlogu[rk] += 1; if (!razlog) razlog = rk; }
    }

    // osobe s mailom
    const kontakti = [];
    for (const p of pots) {
      if (p.kontakt_osoba || p.email) kontakti.push({ ime: p.kontakt_osoba || "", funkcija: p.kontakt_funkcija || "", email: p.email || "", glavni: p === pot });
      for (const k of p.dodatni_kontakti || []) kontakti.push({ ime: k.ime || "", funkcija: k.funkcija || "", email: k.email || "", glavni: false });
    }
    let izbor = kontakti.filter((k) => prviMail(k.email));
    if (f.osobe === "glavni") {
      const g = izbor.find((k) => k.glavni) || izbor[0];
      izbor = g ? [g] : [];
    }
    if (!izbor.length) { if (!razlog) firmiBezMaila += 1; continue; }
    const liSve = licFilter ? li : licenceInfo(kRows);
    for (const k of izbor) {
      const email = prviMail(k.email);
      if (vidjeni.has(email)) continue;
      vidjeni.add(email);
      const [ime, prezime] = podijeliIme(k.ime);
      const o = {
        email, ime, prezime, imeCijelo: k.ime, funkcija: k.funkcija, firma: naziv, firmaKey: key,
        drzava: DRZAVA_KRATKO[grupa] || drzava, prodavac: prodavaci[0] || NEDODIJELJENO,
        licence: liSve.tekst || "", odrzavanje_do: liSve.maxEnd || "", razlog,
      };
      if (!razlog && odjavljeni.has(email)) { o.razlog = "odjava"; o.odjava = odjavljeni.get(email); poRazlogu.odjava += 1; }
      osobe.push(o);
    }
  }
  osobe.sort((a, b) => a.firma.localeCompare(b.firma, "hr") || a.email.localeCompare(b.email));
  return { osobe, poRazlogu, firmiOsnova, firmiBezMaila };
}

const RAZLOG_TEKST = {
  kupili: "kupili nedavno", forecast: "otvorena stavka u Forecastu", akcija: "već u aktivnoj akciji",
  nezainteresovana: "„Nije zainteresovana“ u akciji", izgubljen: "status „Izgubljen“", odjava: "ne šalji mailove", rucno: "isključeno ručno",
};

function izveziExcel(lista, f, akcije, currentUser) {
  const wb = XLSX.utils.book_new();
  const glava = ["Email", "Ime", "Prezime", "Funkcija", "Firma", "Država", "Prodavač", "Licence", "Održavanje do"];
  const rows = lista.map((o) => [o.email, o.ime, o.prezime, o.funkcija || "", o.firma, o.drzava || "", o.prodavac === NEDODIJELJENO ? "" : o.prodavac, o.licence || "", o.odrzavanje_do ? fmtDate(o.odrzavanje_do) : ""]);
  const ws = XLSX.utils.aoa_to_sheet([glava, ...rows]);
  ws["!cols"] = [{ wch: 32 }, { wch: 14 }, { wch: 18 }, { wch: 22 }, { wch: 36 }, { wch: 10 }, { wch: 18 }, { wch: 28 }, { wch: 13 }];
  XLSX.utils.book_append_sheet(wb, ws, "Kontakti");
  const fs = XLSX.utils.aoa_to_sheet([
    ["Izvoz kontakata za mailing — Strojotehnika CRM"], [],
    ["Filter", opisFiltera(f, akcije)], ["Izvezao", currentUser || ""], ["Datum", fmtDate(danasIso())], ["Broj mailova", lista.length], [],
    ["Outlook / Word: Mailings → Start Mail Merge → E-mail Messages → Select Recipients → Use an Existing List → ovaj fajl, list „Kontakti“."],
  ]);
  fs["!cols"] = [{ wch: 16 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(wb, fs, "Filter");
  const ime = opisFiltera(f, akcije).replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 50) || "kontakti";
  XLSX.writeFile(wb, `Mailing_${ime}_${danasIso()}.xlsx`);
}

/* ---------------------------------------------------------------------- */
/*  Mali UI elementi                                                       */
/* ---------------------------------------------------------------------- */

function Sel({ label, value, onChange, options, def }) {
  const active = value !== def;
  return (
    <label className="block">
      <span className="block text-[11.5px] font-semibold text-slate-500 dark:text-slate-400 mb-1">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className={"w-full h-[34px] rounded-lg border px-2 text-[13px] " + (active
          ? "border-teal-300 bg-teal-50 text-teal-900 font-semibold dark:border-teal-700 dark:bg-teal-950/40 dark:text-teal-200"
          : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100")}>
        {options.map((o) => (typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o[0]} value={o[0]}>{o[1]}</option>))}
      </select>
    </label>
  );
}
function Cb({ on, onChange, lock, children, sub, n }) {
  return (
    <label className={"flex gap-2.5 items-start py-1.5 " + (lock ? "cursor-default" : "cursor-pointer")}>
      {lock ? (
        <span className="w-4 h-4 rounded bg-slate-400 inline-flex items-center justify-center shrink-0 mt-0.5"><Lock size={10} className="text-white" /></span>
      ) : (
        <input type="checkbox" className="w-4 h-4 mt-0.5 accent-teal-600 shrink-0" checked={on} onChange={(e) => onChange(e.target.checked)} />
      )}
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5 text-[13px] text-slate-800 dark:text-slate-100">
          <span className="flex-1">{children}</span>
          {n > 0 && on && <span className="text-[11px] font-bold text-red-700 bg-red-50 dark:bg-red-950/40 dark:text-red-300 px-1.5 rounded-full whitespace-nowrap">−{fmtN(n)}</span>}
        </span>
        {sub && <span className="block text-[11.5px] text-slate-500 dark:text-slate-400">{sub}</span>}
      </span>
    </label>
  );
}
function Seg({ value, onChange, options }) {
  return (
    <div className="inline-flex flex-wrap rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      {options.map(([k, l], i) => (
        <button key={k} type="button" onClick={() => onChange(k)}
          className={"h-[30px] px-3 text-[12.5px] " + (i ? "border-l border-slate-200 dark:border-slate-700 " : "") +
            (value === k ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800")}>
          {l}
        </button>
      ))}
    </div>
  );
}
const CAP = "text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400";

/* ---------------------------------------------------------------------- */
/*  Prozor za izvoz                                                        */
/* ---------------------------------------------------------------------- */

export function MailingIzvozModal({
  kupci = [], potencijali = [], forecast = [], akcije = [], akcijeFirme = [], odjave = [], filteri = [], izvozi = [],
  presetAkcija = null, currentUser, onClose, onSaveFilter, onDeleteFilter, onLogExport, showToast,
}) {
  const [f, setF] = useState(() => (presetAkcija ? { ...POCETNI_FILTER, akcija: presetAkcija.id } : { ...POCETNI_FILTER }));
  const [aktivniFilter, setAktivniFilter] = useState(null);
  const [rucno, setRucno] = useState(() => new Set());
  const [q, setQ] = useState("");
  const [sveIzost, setSveIzost] = useState(false);
  const [page, setPage] = useState(1);
  const [naziv, setNaziv] = useState("");
  const [busy, setBusy] = useState(false);
  const [pokaziRanije, setPokaziRanije] = useState(false);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => { setPage(1); }, [f, q, sveIzost]);

  const set = (k) => (v) => { setF((x) => ({ ...x, [k]: v })); setAktivniFilter(null); };
  const model = useMemo(() => izgradiMailing({ kupci, potencijali, forecast, akcije, akcijeFirme, odjave, f }),
    [kupci, potencijali, forecast, akcije, akcijeFirme, odjave, f]);
  const ukljuceni = useMemo(() => model.osobe.filter((o) => !o.razlog && !rucno.has(o.email)), [model, rucno]);
  const nFirmi = useMemo(() => new Set(ukljuceni.map((o) => o.firmaKey)).size, [ukljuceni]);
  const izostFirmi = useMemo(() => new Set(model.osobe.filter((o) => o.razlog && o.razlog !== "odjava").map((o) => o.firmaKey)).size, [model]);
  const nIzost = izostFirmi + model.poRazlogu.odjava + rucno.size;
  const qq = q.trim().toLowerCase();
  const prikaz = useMemo(() => model.osobe
    .filter((o) => sveIzost || (!o.razlog && !rucno.has(o.email)) || rucno.has(o.email))
    .filter((o) => !qq || [o.email, o.imeCijelo, o.firma, o.funkcija].join(" ").toLowerCase().includes(qq)), [model, sveIzost, rucno, qq]);
  const PS = 50;
  const stranica = prikaz.slice((page - 1) * PS, page * PS);
  const strana = Math.max(1, Math.ceil(prikaz.length / PS));
  const akcijeZaIzbor = useMemo(() => [...akcije].sort((a, b) => String(b.pocetak || "").localeCompare(String(a.pocetak || ""))), [akcije]);
  const ranije = useMemo(() => [...izvozi].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))).slice(0, 8), [izvozi]);

  const primijeni = (flt, id = null) => { setF({ ...POCETNI_FILTER, ...flt }); setAktivniFilter(id); setRucno(new Set()); };
  const toggleOsoba = (o) => setRucno((s) => { const n = new Set(s); if (n.has(o.email)) n.delete(o.email); else n.add(o.email); return n; });
  const izvezi = async () => {
    if (!ukljuceni.length || busy) return;
    setBusy(true);
    try {
      izveziExcel(ukljuceni, f, akcije, currentUser);
      try {
        await onLogExport({
          opis: opisFiltera(f, akcije), filter: f, broj_mailova: ukljuceni.length, broj_firmi: nFirmi,
          firme: [...new Set(ukljuceni.map((o) => o.firmaKey))], akcija_id: f.akcija || null,
        });
      } catch (e) { /* izvoz je preuzet; greška evidencije je već prikazana */ }
      onClose();
    } catch (e) {
      console.error(e);
      if (showToast) showToast("Greška pri izradi Excel fajla", "error");
    } finally {
      setBusy(false);
    }
  };
  const spremi = async () => {
    if (!naziv.trim()) return;
    try { const rec = await onSaveFilter(naziv.trim(), f); setNaziv(""); if (rec) setAktivniFilter(rec.id); } catch (e) { /* toast */ }
  };
  const tile = (l, v, s, cls = "") => (
    <div className={"flex-1 min-w-[130px] rounded-xl border px-3.5 py-2.5 " + (cls || "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800")}>
      <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">{l}</div>
      <div className="text-2xl font-extrabold tabular-nums text-slate-900 dark:text-slate-100">{fmtN(v)}</div>
      <div className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate">{s}</div>
    </div>
  );
  const pr = model.poRazlogu;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 p-2 sm:p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className="w-full max-w-[1320px] h-[94vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col border border-transparent dark:border-slate-700 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* zaglavlje */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 inline-flex items-center justify-center shrink-0"><Mail size={18} /></span>
            <div className="min-w-0">
              <div className="text-base font-bold text-slate-900 dark:text-slate-100">Izvoz kontakata za mailing{presetAkcija ? ` — ${presetAkcija.naziv}` : ""}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Excel za Outlook spajanje pošte (Mail Merge) — svaki primalac dobije svoj mail</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className={btnGhostIcon} aria-label="Zatvori"><X size={18} /></button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          {/* filteri */}
          <div className="lg:w-[400px] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900 overflow-y-auto px-5 py-4 space-y-4 max-h-[40vh] lg:max-h-none">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className={CAP}>Spremljeni filteri</span>
                {ranije.length > 0 && (
                  <button type="button" onClick={() => setPokaziRanije(!pokaziRanije)} className="text-[11.5px] font-medium text-teal-700 dark:text-teal-400 hover:underline inline-flex items-center gap-1">
                    <History size={12} /> {pokaziRanije ? "Sakrij ranije izvoze" : "Ranije izvezeno"}
                  </button>
                )}
              </div>
              {filteri.length === 0 ? <p className="text-[12px] text-slate-400">Još nema spremljenih filtera — spremi ga dolje.</p> : (
                <div className="flex flex-wrap gap-1.5">
                  {filteri.map((fl) => (
                    <span key={fl.id} className={"inline-flex items-center h-7 rounded-full text-[12px] border " + (aktivniFilter === fl.id ? "bg-teal-600 border-teal-600 text-white font-semibold" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200")}>
                      <button type="button" className="pl-2.5 pr-1.5 h-full" title={`${opisFiltera({ ...POCETNI_FILTER, ...fl.filter }, akcije)} · ${fl.created_by || ""}`} onClick={() => primijeni(fl.filter, fl.id)}>{fl.naziv}</button>
                      {fl.created_by === currentUser && onDeleteFilter && (
                        <button type="button" className="pr-2 h-full opacity-60 hover:opacity-100" aria-label={`Obriši filter ${fl.naziv}`} onClick={() => onDeleteFilter(fl)}><X size={11} /></button>
                      )}
                    </span>
                  ))}
                </div>
              )}
              {pokaziRanije && (
                <div className="mt-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                  {ranije.map((l) => (
                    <div key={l.id} className="flex items-center gap-2 px-2.5 py-1.5 text-[12px]">
                      <Avatar name={l.created_by || "?"} size="sm" />
                      <span className="text-slate-500 whitespace-nowrap">{l.created_at ? fmtDate(String(l.created_at).slice(0, 10)) : ""}</span>
                      <span className="flex-1 min-w-0 truncate text-slate-700 dark:text-slate-300" title={l.opis}>{l.opis}</span>
                      <b className="tabular-nums">{fmtN(l.broj_mailova)}</b>
                      {l.filter && <button type="button" className="text-teal-700 dark:text-teal-400 hover:underline inline-flex items-center gap-0.5" onClick={() => primijeni(l.filter)}><RotateCcw size={11} /> Ponovi</button>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className={CAP + " mb-2"}>1 · Koje firme</div>
              <div className="mb-2.5"><Seg value={f.izvor} onChange={set("izvor")} options={IZVORI.map((x) => [x, x])} /></div>
              <div className="grid grid-cols-2 gap-2">
                <Sel label="Država" value={f.drzava} onChange={set("drzava")} options={DRZAVE} def="Sve" />
                <Sel label="Prodavač" value={f.prodavac} onChange={set("prodavac")} options={["Svi", ...PRODAJA_MARKETING_NAMES, "(nedodijeljeno)"]} def="Svi" />
                <Sel label="Proizvod" value={f.porodica} onChange={set("porodica")} options={["Svi", ...PORODICE_LIC]} def="Svi" />
                <Sel label="Tip licence" value={f.tip} onChange={set("tip")} options={TIPOVI} def="Sve" />
                <Sel label="Održavanje" value={f.odrzavanje} onChange={set("odrzavanje")} options={["Sve", ...ODRZAVANJE.filter((x) => x !== "Sve")]} def="Sve" />
                <Sel label="Status potencijala" value={f.status} onChange={set("status")} options={["Svi", ...POTENCIJAL_STATUSI]} def="Svi" />
                <Sel label="Zadnji kontakt" value={f.zadnji} onChange={set("zadnji")} options={ZADNJI} def="Bilo kada" />
                <Sel label="Akcija" value={f.akcija} onChange={set("akcija")} options={[["", "—"], ...akcijeZaIzbor.map((a) => [a.id, a.naziv])]} def="" />
              </div>
              {(f.porodica !== "Svi" || f.tip !== "Sve" || f.odrzavanje !== "Sve") && (
                <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-1.5">Filter po licencama uzima samo firme koje su u Kupcima i licencama.</p>
              )}
            </div>

            <div>
              <div className={CAP + " mb-1"}>2 · Izostavi</div>
              <Cb on={f.xKupili} onChange={set("xKupili")} n={pr.kupili}
                sub="Dobijeno u Forecastu, nova licenca u Kupcima ili „Dobijen“ u Bazi potencijala">
                <span className="inline-flex items-center gap-1.5">Kupili u zadnjih
                  <input type="number" min="1" max="730" value={f.kupiliDana} aria-label="Broj dana"
                    onChange={(e) => set("kupiliDana")(Math.max(1, Number(e.target.value) || 30))}
                    className="w-14 h-6 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-1 text-[12.5px] font-bold" /> dana</span>
              </Cb>
              <Cb on={f.xForecast} onChange={set("xForecast")} n={pr.forecast} sub="već se pregovara (ovaj ili sljedeći mjeseci)">Otvorena stavka u Forecastu</Cb>
              <Cb on={f.xAkcija} onChange={set("xAkcija")} n={pr.akcija} sub={f.akcija ? "osim odabrane akcije" : ""}>Već u aktivnoj akciji</Cb>
              <Cb on={f.xNezainteresovana} onChange={set("xNezainteresovana")} n={pr.nezainteresovana}>„Nije zainteresovana“ u nekoj akciji</Cb>
              <Cb on={f.xIzgubljen} onChange={set("xIzgubljen")} n={pr.izgubljen}>Status „Izgubljen“</Cb>
              <Cb on lock n={pr.odjava} sub="uvijek — ne može se isključiti">Označeni „Ne šalji mailove“</Cb>
            </div>

            <div>
              <div className={CAP + " mb-2"}>3 · Koje osobe</div>
              <div className="mb-1.5"><Seg value={f.osobe} onChange={set("osobe")} options={[["svi", "Svi kontakti firme"], ["glavni", "Samo glavni kontakt"]]} /></div>
              <Cb on lock>Samo osobe koje imaju mail</Cb>
              <Cb on lock sub="npr. info@ upisan kod dvije osobe">Isti mail samo jednom</Cb>
            </div>
          </div>

          {/* pregled */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col px-4 sm:px-5 py-4 gap-3">
            <div className="flex flex-wrap gap-2.5">
              {tile("Firmi u izvozu", nFirmi, `od ${fmtN(model.firmiOsnova)} koje prolaze filtere`)}
              {tile("Mailova za izvoz", ukljuceni.length, "bez duplikata", "bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-900")}
              {tile("Firmi bez maila", model.firmiBezMaila, "nemaju nijedan mail u Bazi potencijala")}
              {tile("Izostavljeno", nIzost, "firmi/osoba — razlozi lijevo", nIzost ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900" : "")}
            </div>
            <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                <span className={CAP}>Pregled prije izvoza</span>
                <span className="text-xs text-slate-500 hidden sm:inline">skini kvačicu da izostaviš osobu</span>
                <span className="flex-1" />
                <span className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Traži…" aria-label="Traži u pregledu"
                    className="h-8 w-48 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-7 pr-2 text-[12.5px]" />
                </span>
                <label className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input type="checkbox" className="accent-teal-600" checked={sveIzost} onChange={(e) => setSveIzost(e.target.checked)} />
                  <Filter size={12} className="text-slate-400" /> prikaži i izostavljene
                </label>
              </div>
              <div className="hidden md:grid grid-cols-[22px_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)] gap-2.5 px-3.5 py-2 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <span /><span>Osoba</span><span>Mail</span><span>Firma · licence</span><span>Zašto izostavljeno</span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                {stranica.length === 0 ? (
                  <p className="p-6 text-sm text-slate-500 text-center">{model.osobe.length ? "Nema osoba za prikaz." : "Nema kontakata s mailom za ove filtere."}</p>
                ) : stranica.map((o) => {
                  const off = !!o.razlog || rucno.has(o.email);
                  const raz = o.razlog || (rucno.has(o.email) ? "rucno" : null);
                  return (
                    <div key={o.email} className={"grid grid-cols-[22px_minmax(0,1fr)] md:grid-cols-[22px_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)] gap-x-2.5 gap-y-0.5 items-center px-3.5 py-2 border-b border-slate-100 dark:border-slate-800 " + (off ? "opacity-55" : "")}>
                      <input type="checkbox" className="w-4 h-4 accent-teal-600" aria-label={`Uključi ${o.email}`} checked={!off}
                        disabled={!!o.razlog} onChange={() => toggleOsoba(o)} />
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate">{o.imeCijelo || <span className="italic text-slate-400">bez imena</span>}</div>
                        {o.funkcija && <div className="text-[11.5px] text-slate-500 truncate">{o.funkcija}</div>}
                        <div className="md:hidden text-[12px] text-teal-700 dark:text-teal-400 truncate">{o.email} · {o.firma}</div>
                      </div>
                      <div className="hidden md:block text-[12.5px] text-teal-700 dark:text-teal-400 truncate">{o.email}</div>
                      <div className="hidden md:block min-w-0">
                        <div className="text-[12.5px] font-semibold text-slate-700 dark:text-slate-200 truncate">{o.firma}</div>
                        <div className="text-[11px] text-slate-500 truncate">{[o.licence, o.odrzavanje_do ? `do ${fmtDate(o.odrzavanje_do)}` : ""].filter(Boolean).join(" · ") || o.drzava}</div>
                      </div>
                      <div className="hidden md:block">
                        {raz && <span className={"text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap " + (raz === "rucno" ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300")}
                          title={raz === "odjava" && o.odjava ? `${o.odjava.razlog || ""} · ${o.odjava.created_by || ""}` : undefined}>{RAZLOG_TEKST[raz]}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between px-3.5 py-2 border-t border-slate-200 dark:border-slate-800 text-[12.5px] text-slate-500">
                <span>{prikaz.length ? `${fmtN((page - 1) * PS + 1)}–${fmtN(Math.min(page * PS, prikaz.length))} od ${fmtN(prikaz.length)}` : "0"}</span>
                {strana > 1 && (
                  <span className="flex items-center gap-1">
                    <button type="button" className="px-2 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button>
                    <span>{page} / {strana}</span>
                    <button type="button" className="px-2 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30" disabled={page >= strana} onClick={() => setPage(page + 1)}>›</button>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* dno */}
        <div className="flex flex-wrap items-center gap-2.5 px-5 py-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <span className="inline-flex items-center gap-2 text-[13px] text-slate-700 dark:text-slate-300">
            <Save size={14} className="text-slate-400" /> Spremi filter kao:
            <input value={naziv} onChange={(e) => setNaziv(e.target.value)} placeholder="npr. BiH · bez održavanja" aria-label="Naziv filtera"
              onKeyDown={(e) => { if (e.key === "Enter") spremi(); }}
              className="h-8 w-52 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-[13px]" />
            <button type="button" className={btnSecondary + " !py-1 !px-2.5 text-[12.5px]"} disabled={!naziv.trim()} onClick={spremi}>Spremi</button>
          </span>
          <span className="flex-1" />
          <span className="text-[12.5px] text-slate-500 hidden md:inline">{fmtN(ukljuceni.length)} mailova · izvoz se bilježi (ko, kad, filter)</span>
          <button type="button" className={btnSecondary} onClick={onClose}>Otkaži</button>
          <button type="button" className={btnPrimary} disabled={!ukljuceni.length || busy} onClick={izvezi}><Download size={15} /> Izvezi Excel za Outlook</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Oznaka „Ne šalji mailove“ (Baza potencijala, Kontakti)                 */
/* ---------------------------------------------------------------------- */

export function OdjavaOznaka({ email, odjava, firma, ime, onOdjava, onUkloniOdjavu, disabled }) {
  const [mod, setMod] = useState(null); // "dodaj" | "ukloni"
  const [razlog, setRazlog] = useState(ODJAVA_RAZLOZI[0]);
  const [busy, setBusy] = useState(false);
  const mail = prviMail(email);
  if (!mail) return null;
  const run = async (fn) => { setBusy(true); try { await fn(); setMod(null); } catch (e) { /* toast */ } finally { setBusy(false); } };
  if (mod === "dodaj") {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5 text-[11.5px]">
        <select value={razlog} onChange={(e) => setRazlog(e.target.value)} aria-label="Razlog"
          className="h-6 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-1 text-[11.5px]">
          {ODJAVA_RAZLOZI.map((r) => <option key={r}>{r}</option>)}
        </select>
        <button type="button" disabled={busy} className="h-6 px-2 rounded bg-red-600 text-white font-semibold" onClick={() => run(() => onOdjava({ email: mail, razlog, firma, ime }))}>Ne šalji</button>
        <button type="button" className="h-6 px-1.5 text-slate-500" onClick={() => setMod(null)}>Otkaži</button>
      </span>
    );
  }
  if (mod === "ukloni") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11.5px] text-slate-600 dark:text-slate-300">
        Ponovo slati mailove?
        <button type="button" disabled={busy} className="h-6 px-2 rounded bg-teal-600 text-white font-semibold" onClick={() => run(() => onUkloniOdjavu(odjava))}>Da</button>
        <button type="button" className="h-6 px-1.5 text-slate-500" onClick={() => setMod(null)}>Ne</button>
      </span>
    );
  }
  if (odjava) {
    return (
      <button type="button" disabled={disabled} onClick={() => setMod("ukloni")}
        title={`${odjava.razlog || "Ne šalji mailove"}${odjava.created_by ? ` · ${odjava.created_by}` : ""}`}
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-1.5 py-px">
        <Ban size={11} /> Ne šalji mailove{odjava.created_at ? ` · ${fmtDate(String(odjava.created_at).slice(0, 10))}` : ""}
      </button>
    );
  }
  return (
    <button type="button" disabled={disabled} onClick={() => setMod("dodaj")}
      className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 hover:text-red-600 border border-slate-200 dark:border-slate-700 rounded-md px-1.5 py-px">
      <Mail size={11} /> prima mailove
    </button>
  );
}
export { prviMail };
