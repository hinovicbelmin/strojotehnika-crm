"use client";
import { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  Target, Plus, Pencil, Upload, Download, ExternalLink, Square, CheckSquare, AlertTriangle, X,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown, History, Users, FileSpreadsheet, CheckCircle2, Trash2,
} from "lucide-react";
import {
  COLLEAGUES, COLLEAGUE_NAMES, POTENCIJAL_STATUSI, STATUS_BOJE, EU_COUNTRIES,
  inputCls, btnPrimary, btnSecondary, btnGhostIcon, todayStr, fmtDate, downloadCSV,
  buildCompanyNameIndex, findCompanyMatch, companyKey,
} from "../lib/crm";
import { Modal, Field, EmptyState, Toolbar, SearchBox, ImportModal, ConfirmDelete, BulkActionBar } from "./ui";

export const NEDODIJELJENO = "Nedodijeljeno";
const NEPOZNATA = "Nepoznata";
const PRODAVACI = COLLEAGUES.filter((c) => c.dept === "Prodaja").map((c) => c.name);
const DRZAVE_FILTER = [NEPOZNATA, ...EU_COUNTRIES];

// Svi prodavači firme (glavni + dodatni), bez "Nedodijeljeno"
export function prodavaciOf(p) {
  const all = [p.kolega, ...(p.prodavaci || [])].filter((x) => x && x !== NEDODIJELJENO);
  return [...new Set(all)];
}

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function maxDatum(historija) {
  let m = null;
  for (const h of historija || []) if (h.datum && (!m || h.datum > m)) m = h.datum;
  return m;
}

/* ---------------------------------------------------------------------- */
/*  Forma                                                                  */
/* ---------------------------------------------------------------------- */

function CountrySelect({ value, onChange }) {
  const options = value && !DRZAVE_FILTER.includes(value) ? [value, ...DRZAVE_FILTER] : DRZAVE_FILTER;
  return (
    <select className={inputCls} value={value || ""} onChange={onChange}>
      <option value="">— odaberi državu —</option>
      {options.map((c) => <option key={c}>{c}</option>)}
    </select>
  );
}

function SectionTitle({ icon: Icon, children, right }) {
  return (
    <div className="flex items-center justify-between mb-2 mt-1">
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {Icon && <Icon size={13} />} {children}
      </span>
      {right}
    </div>
  );
}

function PotencijalForm({ initial, currentUser, existingList, onSave, onClose }) {
  const [f, setF] = useState(() => {
    const base = {
      naziv_firme: "", grad: "", adresa: "", drzava: "", djelatnost: "", kontakt_osoba: "", kontakt_funkcija: "", telefon: "", email: "",
      kolega: currentUser || "", prodavaci: [], status: "Novi kontakt", napomena: "",
      podsjetnik_datum: "", podsjetnik_opis: "", dodatni_kontakti: [], historija: [],
    };
    return initial ? { ...base, ...initial, prodavaci: initial.prodavaci || [], historija: initial.historija || [], dodatni_kontakti: initial.dodatni_kontakti || [] } : base;
  });
  const [busy, setBusy] = useState(false);
  const [novi, setNovi] = useState({ datum: todayStr(), kontakt: "", opis: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const duplicateMatch = useMemo(() => {
    const target = companyKey(f.naziv_firme);
    if (target.length < 3) return null;
    return (existingList || []).find((p) => (!initial || p.id !== initial.id) && companyKey(p.naziv_firme) === target) || null;
  }, [f.naziv_firme, existingList, initial]);

  const dodatniProdavaci = (f.prodavaci || []).filter((p) => p !== f.kolega);
  const toggleProdavac = (name) => {
    const cur = new Set(dodatniProdavaci);
    if (cur.has(name)) cur.delete(name);
    else cur.add(name);
    setF({ ...f, prodavaci: [...cur] });
  };

  const kontakti = f.dodatni_kontakti || [];
  const addKontakt = () => setF({ ...f, dodatni_kontakti: [...kontakti, { ime: "", funkcija: "", telefon: "", email: "", napomena: "" }] });
  const updateKontakt = (idx, key, val) => setF({ ...f, dodatni_kontakti: kontakti.map((k, i) => (i === idx ? { ...k, [key]: val } : k)) });
  const removeKontakt = (idx) => setF({ ...f, dodatni_kontakti: kontakti.filter((_, i) => i !== idx) });

  const historija = useMemo(() => [...(f.historija || [])].sort((a, b) => (b.datum || "").localeCompare(a.datum || "")), [f.historija]);
  const addHistorija = () => {
    if (!novi.opis.trim()) return;
    setF({ ...f, historija: [{ datum: novi.datum || todayStr(), kolega: currentUser || f.kolega || "", kontakt: novi.kontakt.trim(), opis: novi.opis.trim() }, ...(f.historija || [])] });
    setNovi({ datum: todayStr(), kontakt: "", opis: "" });
  };
  const removeHistorija = (h) => setF({ ...f, historija: (f.historija || []).filter((x) => x !== h) });

  const submit = async () => {
    if (!f.naziv_firme.trim() || !f.kolega || !currentUser) return;
    setBusy(true);
    try {
      let datumDobijanja = (initial && initial.datum_dobijanja) || null;
      if (f.status === "Dobijen" && !datumDobijanja) datumDobijanja = todayStr();
      const glavni = f.kolega === NEDODIJELJENO ? [] : [f.kolega];
      const payload = {
        ...f,
        prodavaci: uniq([...glavni, ...dodatniProdavaci]),
        podsjetnik_datum: f.podsjetnik_datum || null,
        datum_dobijanja: datumDobijanja,
        dodatni_kontakti: kontakti.filter((k) => (k.ime || "").trim() || (k.telefon || "").trim() || (k.email || "").trim()),
        historija: f.historija || [],
        zadnji_kontakt: maxDatum(f.historija) || null,
        updated_by: currentUser, updated_at: new Date().toISOString(),
      };
      delete payload.id;
      if (!initial) {
        payload.created_by = currentUser;
        payload.created_at = new Date().toISOString();
      }
      await onSave(payload);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={initial ? "Uredi potencijala" : "Novi potencijal"} onClose={onClose} wide>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label="Naziv firme" required>
          <input className={inputCls} value={f.naziv_firme} onChange={set("naziv_firme")} />
        </Field>
        <Field label="Glavni prodavač" required>
          <select className={inputCls} value={f.kolega} onChange={set("kolega")}>
            <option value="">— odaberi —</option>
            <option value={NEDODIJELJENO}>{NEDODIJELJENO}</option>
            {COLLEAGUE_NAMES.map((n) => <option key={n}>{n}</option>)}
          </select>
        </Field>
      </div>

      <div className="mb-4">
        <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">Dodatni prodavači</span>
        <div className="flex flex-wrap gap-1.5">
          {PRODAVACI.filter((n) => n !== f.kolega).map((n) => {
            const on = dodatniProdavaci.includes(n);
            return (
              <button key={n} type="button" onClick={() => toggleProdavac(n)}
                className={"text-xs px-2.5 py-1 rounded-full border transition-colors " + (on
                  ? "bg-teal-600 border-teal-600 text-white"
                  : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-teal-500")}>
                {on ? "✓ " : ""}{n}
              </button>
            );
          })}
        </div>
      </div>

      {duplicateMatch && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 flex items-start gap-1.5">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          Moguć duplikat — već postoji <strong className="mx-1">{duplicateMatch.naziv_firme}</strong> (prodavač: {duplicateMatch.kolega || "—"}, status: {duplicateMatch.status}).
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label="Grad"><input className={inputCls} value={f.grad || ""} onChange={set("grad")} /></Field>
        <Field label="Država"><CountrySelect value={f.drzava} onChange={set("drzava")} /></Field>
      </div>
      <Field label="Adresa"><input className={inputCls} value={f.adresa || ""} onChange={set("adresa")} /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label="Djelatnost"><input className={inputCls} value={f.djelatnost || ""} onChange={set("djelatnost")} /></Field>
        <Field label="Status">
          <select className={inputCls} value={f.status} onChange={set("status")}>
            {POTENCIJAL_STATUSI.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
      </div>

      <SectionTitle icon={Users}>Glavni kontakt</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label="Ime i prezime"><input className={inputCls} value={f.kontakt_osoba || ""} onChange={set("kontakt_osoba")} /></Field>
        <Field label="Funkcija"><input className={inputCls} value={f.kontakt_funkcija || ""} onChange={set("kontakt_funkcija")} /></Field>
        <Field label="Telefon"><input className={inputCls} value={f.telefon || ""} onChange={set("telefon")} /></Field>
        <Field label="Email"><input className={inputCls} value={f.email || ""} onChange={set("email")} /></Field>
      </div>

      <div className="mb-5">
        <SectionTitle icon={Users} right={
          <button type="button" onClick={addKontakt} className="text-xs text-teal-600 font-medium hover:underline flex items-center gap-1"><Plus size={13} /> Dodaj kontakt</button>
        }>Ostali kontakti ({kontakti.length})</SectionTitle>
        {kontakti.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500">Nema drugih kontakata.</p>
        ) : (
          <div className="space-y-2">
            {kontakti.map((k, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-start bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-lg p-2.5">
                <input className={inputCls} placeholder="Ime i prezime" value={k.ime || ""} onChange={(e) => updateKontakt(idx, "ime", e.target.value)} />
                <input className={inputCls} placeholder="Funkcija" value={k.funkcija || ""} onChange={(e) => updateKontakt(idx, "funkcija", e.target.value)} />
                <input className={inputCls} placeholder="Telefon" value={k.telefon || ""} onChange={(e) => updateKontakt(idx, "telefon", e.target.value)} />
                <input className={inputCls} placeholder="Email" value={k.email || ""} onChange={(e) => updateKontakt(idx, "email", e.target.value)} />
                <button type="button" onClick={() => removeKontakt(idx)} className={btnGhostIcon} title="Ukloni kontakt"><X size={15} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-5">
        <SectionTitle icon={History}>Historija kontaktiranja ({historija.length})</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2 bg-teal-50/60 dark:bg-teal-900/10 border border-teal-100 dark:border-teal-900/40 rounded-lg p-2.5 mb-2">
          <input type="date" className={inputCls} value={novi.datum} onChange={(e) => setNovi({ ...novi, datum: e.target.value })} />
          <input className={inputCls} placeholder="Kontakt osoba (opcionalno)" value={novi.kontakt} onChange={(e) => setNovi({ ...novi, kontakt: e.target.value })} />
          <textarea className={inputCls + " sm:col-span-2"} rows={2} placeholder="Šta je dogovoreno / rečeno..." value={novi.opis} onChange={(e) => setNovi({ ...novi, opis: e.target.value })} />
          <div className="sm:col-span-2 flex justify-end">
            <button type="button" className={btnSecondary} onClick={addHistorija} disabled={!novi.opis.trim()}><Plus size={14} /> Dodaj zapis</button>
          </div>
        </div>
        {historija.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500">Još nema zapisa o kontaktiranju.</p>
        ) : (
          <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
            {historija.map((h, i) => (
              <div key={i} className="group bg-slate-50 dark:bg-slate-800/60 rounded-lg px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    <strong className="text-slate-700 dark:text-slate-200">{h.datum ? fmtDate(h.datum) : "bez datuma"}</strong>
                    {h.kolega ? ` · ${h.kolega}` : ""}{h.kontakt ? ` · ${h.kontakt}` : ""}
                  </span>
                  <button type="button" onClick={() => removeHistorija(h)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500" title="Obriši zapis"><Trash2 size={13} /></button>
                </div>
                <p className="text-slate-700 dark:text-slate-300 whitespace-pre-line mt-0.5">{h.opis}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <Field label="Napomena">
        <textarea className={inputCls} rows={3} value={f.napomena || ""} onChange={set("napomena")} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label="Podsjetnik — datum" hint="Kad se treba javiti/pozvati">
          <input type="date" className={inputCls} value={f.podsjetnik_datum || ""} onChange={set("podsjetnik_datum")} />
        </Field>
        <Field label="Podsjetnik — opis">
          <input className={inputCls} placeholder="npr. poziv, sastanak..." value={f.podsjetnik_opis || ""} onChange={set("podsjetnik_opis")} />
        </Field>
      </div>
      <Field label="Unio / ažurira">
        <input className={inputCls + " bg-slate-50 dark:bg-slate-800/60"} value={currentUser || "— odaberi svoje ime u meniju —"} disabled />
      </Field>
      {initial && initial.datum_dobijanja && (
        <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2 -mt-2 mb-4">✓ Dobijeno: {fmtDate(initial.datum_dobijanja)}</p>
      )}
      <div className="flex justify-end gap-2 mt-2">
        <button className={btnSecondary} onClick={onClose}>Otkaži</button>
        <button className={btnPrimary} onClick={submit} disabled={!f.naziv_firme.trim() || !f.kolega || !currentUser || busy}>
          {busy ? "Čuvam..." : "Sačuvaj"}
        </button>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/*  Uvoz objedinjene baze (Excel: listovi Firme, Kontakti, Historija)      */
/* ---------------------------------------------------------------------- */

function parseDMY(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}` : null;
  }
  const m = String(v).match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function sheetObjects(wb, name) {
  const ws = wb.Sheets[name];
  if (!ws) return null;
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const [head, ...rest] = rows;
  return rest.filter((r) => r.some((c) => c !== "")).map((r) => Object.fromEntries(head.map((h, i) => [String(h).trim(), r[i]])));
}

const splitList = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);

function ObjedinjeniImport({ existing, kupci, currentUser, onImport, onClose }) {
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState(null);
  const [done, setDone] = useState(null);

  const processFile = async (file) => {
    setError("");
    setParsed(null);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const firme = sheetObjects(wb, "Firme");
      const kontakti = sheetObjects(wb, "Kontakti") || [];
      const historija = sheetObjects(wb, "Historija") || [];
      if (!firme) throw new Error('Fajl nema list "Firme". Koristi fajl Potencijali_objedinjeno.xlsx.');

      const kByFirma = new Map();
      for (const k of kontakti) {
        const id = String(k["ID firme"]);
        if (!kByFirma.has(id)) kByFirma.set(id, []);
        kByFirma.get(id).push(k);
      }
      const hByFirma = new Map();
      for (const h of historija) {
        const id = String(h["ID firme"]);
        if (!hByFirma.has(id)) hByFirma.set(id, []);
        hByFirma.get(id).push({ datum: parseDMY(h["Datum"]), kolega: String(h["Kolega"] || ""), kontakt: String(h["Kontakt osoba"] || ""), opis: String(h["Opis"] || "") });
      }

      const kupciIndex = buildCompanyNameIndex(kupci.map((k) => k.naziv_firme));
      const existingKeys = new Set(existing.map((p) => companyKey(p.naziv_firme)));
      const now = new Date().toISOString();
      const rows = [];
      let skipped = 0, dobijeno = 0;
      for (const fr of firme) {
        const id = String(fr["ID"]);
        let naziv = String(fr["Naziv firme"] || "").trim();
        if (!naziv) continue;
        const varijante = String(fr["Varijante naziva"] || "").split("|").map((s) => s.trim()).filter(Boolean);
        let kupac = findCompanyMatch(naziv, kupciIndex);
        for (const v of varijante) {
          if (kupac) break;
          kupac = findCompanyMatch(v, kupciIndex);
        }
        let napomena = String(fr["Napomena"] || "");
        if (kupac && kupac !== naziv) {
          napomena = `Upisivano i kao: ${naziv}` + (napomena ? "\n" + napomena : "");
          naziv = kupac; // isti naziv kao u Kupcima -> 360° pregled povezuje sve
        }
        if (existingKeys.has(companyKey(naziv))) { skipped++; continue; }
        existingKeys.add(companyKey(naziv));
        if (kupac) dobijeno++;

        const ks = (kByFirma.get(id) || []).map((k) => ({
          ime: String(k["Ime i prezime"] || ""), funkcija: String(k["Funkcija"] || ""),
          telefon: String(k["Telefon"] || ""), email: String(k["Email"] || ""), napomena: "",
        }));
        const [glavni, ...ostali] = ks;
        const hs = (hByFirma.get(id) || []).sort((a, b) => (b.datum || "").localeCompare(a.datum || ""));
        const prvi = parseDMY(fr["Prvi kontakt"]);
        const glavniProdavac = String(fr["Glavni prodavač"] || "").trim() || NEDODIJELJENO;
        rows.push({
          naziv_firme: naziv,
          grad: String(fr["Grad"] || ""), adresa: String(fr["Adresa"] || ""),
          drzava: String(fr["Država"] || "") || NEPOZNATA, djelatnost: String(fr["Djelatnost"] || ""),
          kolega: glavniProdavac, prodavaci: splitList(fr["Svi prodavači"]),
          kontakt_osoba: glavni ? glavni.ime : "", kontakt_funkcija: glavni ? glavni.funkcija : "",
          telefon: glavni ? glavni.telefon : "", email: glavni ? glavni.email : "",
          dodatni_kontakti: ostali, historija: hs,
          zadnji_kontakt: parseDMY(fr["Zadnji kontakt"]) || maxDatum(hs),
          status: kupac ? "Dobijen" : "U pregovorima",
          napomena, izvor: String(fr["Izvor"] || ""),
          podsjetnik_datum: null, podsjetnik_opis: "",
          created_by: currentUser || "Uvoz", created_at: prvi ? `${prvi}T08:00:00Z` : "2020-01-01T08:00:00Z",
          updated_by: currentUser || "Uvoz", updated_at: now,
        });
      }
      setParsed({
        fileName: file.name, rows, skipped, dobijeno,
        kontakti: rows.reduce((s, r) => s + (r.kontakt_osoba || r.telefon || r.email ? 1 : 0) + r.dodatni_kontakti.length, 0),
        historija: rows.reduce((s, r) => s + r.historija.length, 0),
        nedodijeljeno: rows.filter((r) => r.kolega === NEDODIJELJENO).length,
        visePro: rows.filter((r) => r.prodavaci.length > 1).length,
      });
    } catch (e) {
      console.error(e);
      setError(e.message || "Greška pri čitanju fajla.");
    }
  };

  const runImport = async () => {
    setProgress({ done: 0, total: parsed.rows.length });
    try {
      await onImport(parsed.rows, { chunk: 150, onProgress: (d, t) => setProgress({ done: d, total: t }) });
      setDone(parsed.rows.length);
    } catch (e) {
      setError("Uvoz je prekinut: " + (e.message || "greška") + ". Firme uvezene do tog trenutka su sačuvane.");
    } finally {
      setProgress(null);
    }
  };

  const Stat = ({ label, value, accent }) => (
    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
      <div className={"text-lg font-bold " + (accent || "text-slate-800 dark:text-slate-100")}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );

  return (
    <Modal title="Uvoz objedinjene baze potencijala" onClose={progress ? () => {} : onClose} wide>
      {done != null ? (
        <div className="text-center py-8">
          <CheckCircle2 size={40} className="mx-auto text-teal-600 mb-3" />
          <p className="text-base font-semibold text-slate-800 dark:text-slate-100">Uvezeno {done} firmi</p>
          <button className={btnPrimary + " mt-5"} onClick={onClose}>Zatvori</button>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
            Odaberi fajl <strong>Potencijali_objedinjeno.xlsx</strong> (listovi Firme, Kontakti, Historija). Firme koje postoje u
            tabu <em>Kupci i licence</em> dobijaju status <strong>Dobijen</strong> i naziv kao u Kupcima, a ostale <strong>U pregovorima</strong>.
          </p>
          <label
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragEnter={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const file = e.dataTransfer.files && e.dataTransfer.files[0]; if (file) processFile(file); }}
            className={"flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-8 cursor-pointer transition-colors " +
              (drag ? "border-teal-500 bg-teal-50 dark:bg-teal-900/20" : "border-slate-300 dark:border-slate-600 hover:border-teal-400")}
          >
            <FileSpreadsheet size={28} className="text-teal-600" />
            <span className="text-sm text-slate-600 dark:text-slate-300">{parsed ? parsed.fileName : "Prevuci fajl ovdje ili klikni za odabir"}</span>
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files[0] && processFile(e.target.files[0])} />
          </label>

          {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 mt-3">{error}</p>}

          {parsed && (
            <div className="mt-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Stat label="Firmi za uvoz" value={parsed.rows.length} accent="text-teal-700 dark:text-teal-400" />
                <Stat label="Prepoznato kao kupci → Dobijen" value={parsed.dobijeno} accent="text-green-700 dark:text-green-400" />
                <Stat label="Kontakata" value={parsed.kontakti} />
                <Stat label="Zapisa historije" value={parsed.historija} />
                <Stat label="Firmi s više prodavača" value={parsed.visePro} />
                <Stat label="Nedodijeljeno" value={parsed.nedodijeljeno} />
              </div>
              {parsed.skipped > 0 && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
                  {parsed.skipped} firmi već postoji u Bazi potencijala i neće se ponovo uvesti.
                </p>
              )}
              {progress && (
                <div className="mt-4">
                  <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div className="h-full bg-teal-600 transition-all" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">Uvozim... {progress.done} / {progress.total} — ne zatvaraj prozor.</p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-5">
            <button className={btnSecondary} onClick={onClose} disabled={!!progress}>Otkaži</button>
            <button className={btnPrimary} onClick={runImport} disabled={!parsed || parsed.rows.length === 0 || !!progress}>
              <Upload size={15} /> {progress ? "Uvozim..." : `Uvezi ${parsed ? parsed.rows.length : ""} firmi`}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/*  Tab                                                                    */
/* ---------------------------------------------------------------------- */

function Pagination({ page, setPage, pageSize, setPageSize, total }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(page, totalPages);
  const from = total === 0 ? 0 : (p - 1) * pageSize + 1;
  const to = Math.min(p * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <span>Prikaz po strani:</span>
        <select className="text-sm rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
          value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
          {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
        <span>{total === 0 ? "0 rezultata" : `${from}–${to} od ${total}`}</span>
        <div className="flex items-center gap-1">
          <button className={btnGhostIcon} disabled={p <= 1} onClick={() => setPage(p - 1)}><ChevronLeft size={16} /></button>
          <span className="px-2">Strana {p} / {totalPages}</span>
          <button className={btnGhostIcon} disabled={p >= totalPages} onClick={() => setPage(p + 1)}><ChevronRight size={16} /></button>
        </div>
      </div>
    </div>
  );
}

function SortTh({ label, field, sort, setSort }) {
  const active = sort.field === field;
  return (
    <th className="px-4 py-2.5 cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200"
      onClick={() => setSort({ field, dir: active && sort.dir === "asc" ? "desc" : field === "zadnji_kontakt" && !active ? "desc" : "asc" })}>
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (sort.dir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : <ChevronsUpDown size={12} className="text-slate-300 dark:text-slate-600" />}
      </span>
    </th>
  );
}

function ProdavaciCell({ p }) {
  const svi = prodavaciOf(p);
  if (svi.length === 0) return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">{NEDODIJELJENO}</span>;
  const glavni = p.kolega && p.kolega !== NEDODIJELJENO ? p.kolega : svi[0];
  const ostali = svi.filter((x) => x !== glavni);
  return (
    <span className="inline-flex items-center gap-1.5" title={svi.join(", ")}>
      {glavni}
      {ostali.length > 0 && <span className="text-[11px] font-semibold px-1.5 rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">+{ostali.length}</span>}
    </span>
  );
}

export function PotencijaliTab({ data, kupci = [], currentUser, onAdd, onUpdate, onDelete, onBulkImport, onBulkUpdate, onBulkDelete, onViewCompany, presetStatus, onPresetConsumed }) {
  const [q, setQ] = useState("");
  const [fKolega, setFKolega] = useState("Sve kolege");
  const [fStatus, setFStatus] = useState("Svi statusi");
  const [fDrzava, setFDrzava] = useState("Sve države");
  const [sort, setSort] = useState({ field: "naziv_firme", dir: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [editing, setEditing] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showObjedinjeni, setShowObjedinjeni] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [bulkKolega, setBulkKolega] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    if (presetStatus) {
      setFStatus(presetStatus);
      onPresetConsumed && onPresetConsumed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetStatus]);

  useEffect(() => { setPage(1); }, [q, fKolega, fStatus, fDrzava, sort]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const out = data.filter((p) => {
      if (fKolega === NEDODIJELJENO) { if (prodavaciOf(p).length > 0) return false; }
      else if (fKolega !== "Sve kolege" && !prodavaciOf(p).includes(fKolega)) return false;
      if (fStatus !== "Svi statusi" && p.status !== fStatus) return false;
      if (fDrzava !== "Sve države" && (p.drzava || NEPOZNATA) !== fDrzava) return false;
      if (qq) {
        const hay = [p.naziv_firme, p.kontakt_osoba, p.email, p.djelatnost, p.grad, p.adresa,
          ...(p.dodatni_kontakti || []).flatMap((k) => [k.ime, k.email])].join(" ").toLowerCase();
        if (!hay.includes(qq)) return false;
      }
      return true;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    const val = (p) => (sort.field === "kolega" ? (prodavaciOf(p)[0] || "") : p[sort.field] || "");
    out.sort((a, b) => {
      const va = val(a), vb = val(b);
      if (!va && vb) return 1;
      if (va && !vb) return -1;
      return String(va).localeCompare(String(vb), "hr", { sensitivity: "base" }) * dir;
    });
    return out;
  }, [data, q, fKolega, fStatus, fDrzava, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((Math.min(page, totalPages) - 1) * pageSize, Math.min(page, totalPages) * pageSize);

  const toggleSelect = (id) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const toggleSelectAll = () => setSelected(allFilteredSelected ? new Set() : new Set(filtered.map((p) => p.id)));

  const handleSave = async (payload) => {
    if (editing) await onUpdate(editing.id, payload);
    else await onAdd(payload);
  };

  const exportCSV = () => {
    const headers = ["Naziv firme", "Grad", "Adresa", "Država", "Djelatnost", "Glavni prodavač", "Svi prodavači", "Status",
      "Kontakt osoba", "Funkcija", "Telefon", "Email", "Ostali kontakti", "Zadnji kontakt", "Napomena", "Podsjetnik datum", "Podsjetnik opis"];
    const rows = filtered.map((p) => [
      p.naziv_firme, p.grad, p.adresa, p.drzava, p.djelatnost, p.kolega, prodavaciOf(p).join(", "), p.status,
      p.kontakt_osoba, p.kontakt_funkcija, p.telefon, p.email,
      (p.dodatni_kontakti || []).map((k) => [k.ime, k.funkcija, k.telefon, k.email].filter(Boolean).join(" / ")).join("; "),
      p.zadnji_kontakt, p.napomena, p.podsjetnik_datum, p.podsjetnik_opis,
    ]);
    downloadCSV(`potencijali_${todayStr()}.csv`, headers, rows);
  };

  const statusBadge = (s) => (
    <span className={"text-xs px-2 py-0.5 rounded-full whitespace-nowrap " + (STATUS_BOJE[s] || "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400")}>{s}</span>
  );

  return (
    <div>
      <div className="grid items-center gap-2 mb-3"
        style={{ gridTemplateColumns: "minmax(160px,420px) minmax(70px,170px) minmax(70px,150px) minmax(70px,170px) 1fr minmax(70px,150px)" }}>
        <SearchBox value={q} onChange={setQ} placeholder="Pretraži firmu, kontakt, email, grad..." />
        <select className={inputCls} value={fKolega} onChange={(e) => setFKolega(e.target.value)}>
          <option>Sve kolege</option>
          {COLLEAGUE_NAMES.map((n) => <option key={n}>{n}</option>)}
          <option value={NEDODIJELJENO}>{NEDODIJELJENO}</option>
        </select>
        <select className={inputCls} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option>Svi statusi</option>
          {POTENCIJAL_STATUSI.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className={inputCls} value={fDrzava} onChange={(e) => setFDrzava(e.target.value)}>
          <option>Sve države</option>
          {DRZAVE_FILTER.map((c) => <option key={c}>{c}</option>)}
        </select>
        <div />
        <button className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.97] transition-all" onClick={exportCSV}>
          <Download size={15} /> Izvoz CSV
        </button>
      </div>
      <Toolbar>
        <button className={btnSecondary} onClick={() => setShowObjedinjeni(true)}><FileSpreadsheet size={15} /> Uvezi objedinjenu bazu</button>
        <button className={btnSecondary} onClick={() => setShowImport(true)}><Upload size={15} /> Uvezi</button>
        <button className={btnPrimary} onClick={() => setShowNew(true)} disabled={!currentUser}><Plus size={15} /> Dodaj potencijala</button>
      </Toolbar>

      {selected.size > 0 && (
        <BulkActionBar count={selected.size} onClear={() => setSelected(new Set())}>
          <select className="text-sm rounded-lg border border-white/30 bg-white/10 px-2 py-1.5 text-white" value={bulkKolega} onChange={(e) => setBulkKolega(e.target.value)}>
            <option value="" className="text-slate-800">— odaberi prodavača —</option>
            {COLLEAGUE_NAMES.map((n) => <option key={n} className="text-slate-800">{n}</option>)}
            <option value={NEDODIJELJENO} className="text-slate-800">{NEDODIJELJENO}</option>
          </select>
          <button
            className="text-sm bg-white text-teal-700 rounded-lg px-3 py-1.5 font-medium hover:bg-teal-50 active:scale-95 transition-transform disabled:opacity-50"
            disabled={!bulkKolega || bulkBusy}
            onClick={async () => {
              setBulkBusy(true);
              try {
                await onBulkUpdate(Array.from(selected), {
                  kolega: bulkKolega, prodavaci: bulkKolega === NEDODIJELJENO ? [] : [bulkKolega],
                  updated_by: currentUser || "Grupna izmjena", updated_at: new Date().toISOString(),
                });
                setSelected(new Set());
                setBulkKolega("");
              } finally {
                setBulkBusy(false);
              }
            }}
          >
            Dodijeli prodavaču
          </button>
          <button
            className="text-sm bg-red-500 text-white rounded-lg px-3 py-1.5 font-medium hover:bg-red-600 active:scale-95 transition-transform disabled:opacity-50"
            disabled={bulkBusy}
            onClick={async () => {
              if (!window.confirm(`Obrisati ${selected.size} odabranih potencijala?`)) return;
              setBulkBusy(true);
              try {
                await onBulkDelete(Array.from(selected));
                setSelected(new Set());
              } finally {
                setBulkBusy(false);
              }
            }}
          >
            Obriši odabrane
          </button>
        </BulkActionBar>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon={Target} title={data.length === 0 ? "Nema unesenih potencijala" : "Nema rezultata za odabrane filtere"}
          subtitle={data.length === 0 ? "Dodaj ručno ili uvezi objedinjenu bazu potencijala iz Excela." : "Promijeni pretragu ili filtere."}
          action={data.length === 0 ? <button className={btnPrimary} onClick={() => setShowObjedinjeni(true)}><FileSpreadsheet size={15} /> Uvezi objedinjenu bazu</button> : null} />
      ) : (
        <>
          <div className="hidden sm:block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    <th className="px-3 py-2.5 w-8">
                      <button onClick={toggleSelectAll} className={btnGhostIcon} title={`Odaberi svih ${filtered.length}`}>
                        {allFilteredSelected ? <CheckSquare size={15} /> : <Square size={15} />}
                      </button>
                    </th>
                    <SortTh label="Firma" field="naziv_firme" sort={sort} setSort={setSort} />
                    <SortTh label="Grad" field="grad" sort={sort} setSort={setSort} />
                    <SortTh label="Država" field="drzava" sort={sort} setSort={setSort} />
                    <SortTh label="Status" field="status" sort={sort} setSort={setSort} />
                    <SortTh label="Prodavač" field="kolega" sort={sort} setSort={setSort} />
                    <SortTh label="Zadnji kontakt" field="zadnji_kontakt" sort={sort} setSort={setSort} />
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {pageRows.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 cursor-pointer" onClick={() => setEditing(p)}>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => toggleSelect(p.id)} className={btnGhostIcon}>
                          {selected.has(p.id) ? <CheckSquare size={15} className="text-teal-600" /> : <Square size={15} />}
                        </button>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                          {p.naziv_firme}
                          {onViewCompany && (
                            <button onClick={(e) => { e.stopPropagation(); onViewCompany(p.naziv_firme); }} className="text-slate-300 dark:text-slate-600 hover:text-teal-600 dark:hover:text-teal-400" title="360° pregled firme">
                              <ExternalLink size={12} />
                            </button>
                          )}
                        </span>
                        {(p.kontakt_osoba || (p.dodatni_kontakti || []).length > 0) && (
                          <div className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-xs">
                            {p.kontakt_osoba}{(p.dodatni_kontakti || []).length > 0 ? ` · +${p.dodatni_kontakti.length} kontakt.` : ""}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">{p.grad || "—"}</td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">{p.drzava || "—"}</td>
                      <td className="px-4 py-2.5">{statusBadge(p.status)}</td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap"><ProdavaciCell p={p} /></td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">{p.zadnji_kontakt ? fmtDate(p.zadnji_kontakt) : "—"}</td>
                      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end">
                          <button className={btnGhostIcon} onClick={() => setEditing(p)} title="Uredi"><Pencil size={14} /></button>
                          <ConfirmDelete label={p.naziv_firme} onConfirm={() => onDelete(p.id)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} setPage={setPage} pageSize={pageSize} setPageSize={setPageSize} total={filtered.length} />
          </div>

          <div className="sm:hidden space-y-2.5">
            {pageRows.map((p) => (
              <div key={p.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4" onClick={() => setEditing(p)}>
                <div className="flex items-start justify-between gap-2">
                  <button onClick={(e) => { e.stopPropagation(); toggleSelect(p.id); }} className={btnGhostIcon + " -ml-1.5 mt-0.5"}>
                    {selected.has(p.id) ? <CheckSquare size={15} className="text-teal-600" /> : <Square size={15} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="font-semibold text-slate-900 dark:text-slate-100">{p.naziv_firme}</h4>
                      {statusBadge(p.status)}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {[p.grad, p.drzava].filter(Boolean).join(", ")} · {prodavaciOf(p).join(", ") || NEDODIJELJENO}
                      {p.zadnji_kontakt ? ` · ${fmtDate(p.zadnji_kontakt)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button className={btnGhostIcon} onClick={() => setEditing(p)} title="Uredi"><Pencil size={14} /></button>
                    <ConfirmDelete label={p.naziv_firme} onConfirm={() => onDelete(p.id)} />
                  </div>
                </div>
              </div>
            ))}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <Pagination page={page} setPage={setPage} pageSize={pageSize} setPageSize={setPageSize} total={filtered.length} />
            </div>
          </div>
        </>
      )}

      {(showNew || editing) && (
        <PotencijalForm initial={editing} currentUser={currentUser} existingList={data} onSave={handleSave}
          onClose={() => { setShowNew(false); setEditing(null); }} />
      )}

      {showObjedinjeni && (
        <ObjedinjeniImport existing={data} kupci={kupci} currentUser={currentUser} onImport={onBulkImport} onClose={() => setShowObjedinjeni(false)} />
      )}

      {showImport && (
        <ImportModal
          title="Uvezi bazu potencijala"
          columns={["Naziv firme", "Grad", "Država", "Kontakt osoba", "Telefon", "Email", "Kolega", "Status", "Napomena"]}
          existingNames={data.map((p) => p.naziv_firme)}
          onClose={() => setShowImport(false)}
          onImport={async (rows) => {
            const novi = rows.map((r) => {
              const kolega = COLLEAGUE_NAMES.includes(r[6]) ? r[6] : currentUser || "";
              return {
                naziv_firme: r[0] || "", grad: r[1] || "", drzava: r[2] || "", kontakt_osoba: r[3] || "",
                telefon: r[4] || "", email: r[5] || "", kolega, prodavaci: kolega ? [kolega] : [],
                status: POTENCIJAL_STATUSI.includes(r[7]) ? r[7] : "Novi kontakt",
                napomena: r[8] || "", podsjetnik_datum: null, podsjetnik_opis: "",
                created_by: currentUser || "Uvoz", created_at: new Date().toISOString(),
                updated_by: currentUser || "Uvoz", updated_at: new Date().toISOString(),
              };
            });
            await onBulkImport(novi);
          }}
        />
      )}
    </div>
  );
}
