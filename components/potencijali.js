"use client";
import { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  Target, Plus, Pencil, Upload, Download, ExternalLink, Square, CheckSquare, AlertTriangle, X,
  ChevronRight, History, Users, FileSpreadsheet, CheckCircle2, Trash2, MapPin, Phone, Mail, Bell, User,
} from "lucide-react";
import {
  COLLEAGUES, COLLEAGUE_NAMES, POTENCIJAL_STATUSI, EU_COUNTRIES,
  inputCls, btnPrimary, btnSecondary, btnGhostIcon, todayStr, fmtDate, downloadCSV, reminderUrgency,
  buildCompanyNameIndex, findCompanyMatch, companyKey,
} from "../lib/crm";
import { Modal, Field, EmptyState, SearchBox, ImportModal, ConfirmDelete, BulkActionBar } from "./ui";
import {
  Avatar, AvatarStack, StatusPill, FilterPill, ViewChip, MenuButton, SortHead, PageNav, PanelLabel,
  initials, daysAgo, relDate, ageCls, fmtN, headerBtnSec,
} from "./crmBits";

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

const SVE_KOLEGE = "Sve kolege";
const SVI_STATUSI = "Svi statusi";
const SVE_DRZAVE = "Sve države";
const BILO_KADA = "Bilo kada";
const ZADNJI_OPCIJE = [BILO_KADA, "Zadnjih 30 dana", "Zadnjih 90 dana", "Prije više od 6 mj.", "Prije više od 12 mj.", "Nikad kontaktirano"];

const DRZAVA_KOD = {
  "Bosna i Hercegovina": "BA", Hrvatska: "HR", Albanija: "AL", Srbija: "RS", Slovenija: "SI", "Crna Gora": "ME",
  "Sjeverna Makedonija": "MK", Makedonija: "MK", Kosovo: "XK", Njemačka: "DE", Austrija: "AT", Italija: "IT",
  Mađarska: "HU", Švicarska: "CH", Francuska: "FR", Nizozemska: "NL", Poljska: "PL", Češka: "CZ", Slovačka: "SK",
};
const drzavaKod = (d) => (!d || d === NEPOZNATA ? "?" : DRZAVA_KOD[d] || d.slice(0, 2).toUpperCase());

function zadnjiOk(p, opcija) {
  if (opcija === BILO_KADA) return true;
  const n = daysAgo(p.zadnji_kontakt);
  if (opcija === "Nikad kontaktirano") return n == null;
  if (n == null) return opcija === "Prije više od 6 mj." || opcija === "Prije više od 12 mj.";
  if (opcija === "Zadnjih 30 dana") return n <= 30;
  if (opcija === "Zadnjih 90 dana") return n <= 90;
  if (opcija === "Prije više od 6 mj.") return n > 182;
  if (opcija === "Prije više od 12 mj.") return n > 365;
  return true;
}

function kontaktiOf(p) {
  const out = [];
  if (p.kontakt_osoba || p.telefon || p.email) {
    out.push({ ime: p.kontakt_osoba, funkcija: p.kontakt_funkcija, telefon: p.telefon, email: p.email, glavni: true });
  }
  for (const k of p.dodatni_kontakti || []) out.push({ ...k, glavni: false });
  return out;
}
const firstOf = (s) => String(s || "").split(/[,;\n]/).map((x) => x.trim()).filter(Boolean)[0] || "";

/* ---------- Bočni panel firme ---------- */
function FirmaPanel({ p, currentUser, onClose, onEdit, onUpdate, onDelete, onViewCompany }) {
  const [novi, setNovi] = useState("");
  const [datum, setDatum] = useState(todayStr());
  const [busy, setBusy] = useState(false);
  const [sveH, setSveH] = useState(false);
  const [sviK, setSviK] = useState(false);

  const kontakti = kontaktiOf(p);
  const historija = useMemo(() => [...(p.historija || [])].sort((a, b) => (b.datum || "").localeCompare(a.datum || "")), [p.historija]);
  const prodavaci = prodavaciOf(p);
  const glavni = p.kolega && p.kolega !== NEDODIJELJENO ? p.kolega : prodavaci[0];
  const lokacija = [p.adresa, p.grad].filter(Boolean).join(", ");

  const dodajZapis = async () => {
    if (!novi.trim() || !currentUser) return;
    setBusy(true);
    try {
      const zapis = { datum: datum || todayStr(), kolega: currentUser, kontakt: "", opis: novi.trim() };
      const nova = [zapis, ...(p.historija || [])];
      await onUpdate(p.id, { historija: nova, zadnji_kontakt: maxDatum(nova), updated_by: currentUser, updated_at: new Date().toISOString() });
      setNovi("");
      setDatum(todayStr());
    } finally {
      setBusy(false);
    }
  };

  const promijeniStatus = async (status) => {
    if (!currentUser) return;
    const patch = { status, updated_by: currentUser, updated_at: new Date().toISOString() };
    if (status === "Dobijen" && !p.datum_dobijanja) patch.datum_dobijanja = todayStr();
    await onUpdate(p.id, patch);
  };

  const shownK = sviK ? kontakti : kontakti.slice(0, 4);
  const shownH = sveH ? historija : historija.slice(0, 5);
  const iconLink = "w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-teal-700 hover:border-teal-300 dark:hover:text-teal-300 dark:hover:border-teal-700";

  return (
    <div className="bg-white dark:bg-slate-900 xl:border border-slate-200 dark:border-slate-700 xl:rounded-2xl shadow-xl xl:shadow-lg xl:shadow-slate-900/5 min-h-full xl:min-h-0 flex flex-col">
      {/* zaglavlje */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug break-words">{p.naziv_firme}</h3>
            {(lokacija || p.drzava) && (
              <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-start gap-1">
                <MapPin size={13} className="mt-0.5 shrink-0 text-slate-400" />
                <span>{lokacija}{lokacija && p.drzava ? " · " : ""}{p.drzava}</span>
              </p>
            )}
          </div>
          <button type="button" aria-label="Zatvori panel" onClick={onClose} className={btnGhostIcon}><X size={17} /></button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="relative inline-flex">
            <StatusPill status={p.status} />
            <select aria-label="Promijeni status" value={p.status || ""} disabled={!currentUser}
              onChange={(e) => promijeniStatus(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-default">
              {(POTENCIJAL_STATUSI.includes(p.status) ? POTENCIJAL_STATUSI : [p.status, ...POTENCIJAL_STATUSI]).map((s) => <option key={s}>{s}</option>)}
            </select>
          </span>
          {p.djelatnost && <span className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-2.5 py-0.5 max-w-full truncate">{p.djelatnost}</span>}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-slate-600 dark:text-slate-300">
          {prodavaci.length === 0 ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">{NEDODIJELJENO}</span>
          ) : (
            [glavni, ...prodavaci.filter((x) => x !== glavni)].map((n, i) => (
              <span key={n} className="inline-flex items-center gap-1.5">
                <Avatar name={n} size="sm" />
                <span className={i === 0 ? "font-semibold text-slate-800 dark:text-slate-100" : ""}>{n}</span>
                {i === 0 && prodavaci.length > 1 && <span className="text-[11px] text-slate-400">glavni</span>}
              </span>
            ))
          )}
        </div>

        {p.podsjetnik_datum && (
          <div className={"inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full " + reminderUrgency(p.podsjetnik_datum).cls}>
            <Bell size={12} /> {fmtDate(p.podsjetnik_datum)}{p.podsjetnik_opis ? ` — ${p.podsjetnik_opis}` : ""}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <button type="button" className={btnPrimary + " !py-1.5"} onClick={onEdit}><Pencil size={14} /> Uredi</button>
          {onViewCompany && <button type="button" className={btnSecondary + " !py-1.5"} onClick={() => onViewCompany(p.naziv_firme)}><ExternalLink size={14} /> 360°</button>}
          <div className="flex-1" />
          <ConfirmDelete label={p.naziv_firme} onConfirm={() => onDelete(p.id)} />
        </div>
      </div>

      {/* kontakti */}
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
        <PanelLabel>Kontakti · {kontakti.length}</PanelLabel>
        {kontakti.length === 0 ? (
          <p className="text-[13px] text-slate-400 dark:text-slate-500">Nema unesenih kontakata.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {shownK.map((k, i) => {
              const tel = firstOf(k.telefon);
              const mail = firstOf(k.email);
              return (
                <div key={i} className="flex items-center gap-2.5 py-2.5 first:pt-0.5">
                  <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold inline-flex items-center justify-center shrink-0">
                    {k.ime ? initials(k.ime) : <User size={14} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <span className="truncate">{k.ime || "(bez imena)"}</span>
                      {k.glavni && kontakti.length > 1 && <span className="text-[10px] font-bold text-teal-700 bg-teal-100 dark:bg-teal-900/40 dark:text-teal-300 px-1.5 rounded-full shrink-0">glavni</span>}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate" title={[k.funkcija, k.telefon, k.email].filter(Boolean).join(" · ")}>
                      {[k.funkcija, k.telefon, k.email].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  {tel && <a href={`tel:${tel.replace(/[^\d+]/g, "")}`} className={iconLink} aria-label={`Nazovi ${k.ime || ""}`} title={tel}><Phone size={14} /></a>}
                  {mail && <a href={`mailto:${mail}`} className={iconLink} aria-label={`Pošalji mail ${k.ime || ""}`} title={mail}><Mail size={14} /></a>}
                </div>
              );
            })}
          </div>
        )}
        {kontakti.length > 4 && (
          <button type="button" onClick={() => setSviK(!sviK)} className="mt-1 text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline">
            {sviK ? "Prikaži manje" : `Prikaži sve (${kontakti.length})`}
          </button>
        )}
      </div>

      {/* historija */}
      <div className="px-5 py-4 flex-1">
        <PanelLabel>Historija kontaktiranja · {historija.length}</PanelLabel>
        <div className="flex gap-2 mb-4">
          <input aria-label="Novi zapis historije" className={inputCls + " !py-1.5"} placeholder={currentUser ? "Šta je dogovoreno? (Enter)" : "Odaberi svoje ime u meniju"}
            value={novi} disabled={!currentUser || busy} onChange={(e) => setNovi(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") dodajZapis(); }} />
          <input type="date" aria-label="Datum zapisa" className={inputCls + " !py-1.5 !w-[138px] shrink-0"} value={datum} onChange={(e) => setDatum(e.target.value)} />
        </div>
        {historija.length === 0 ? (
          <p className="text-[13px] text-slate-400 dark:text-slate-500">Još nema zapisa.</p>
        ) : (
          <ol className="relative">
            {shownH.map((h, i) => (
              <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                {i < shownH.length - 1 && <span className="absolute left-[13px] top-8 bottom-0 w-0.5 bg-slate-100 dark:bg-slate-800" />}
                <Avatar name={h.kolega || "?"} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{h.kolega || "—"}</span>
                    {" · "}{h.datum ? fmtDate(h.datum) : "bez datuma"}
                    {h.kontakt ? <span className="text-slate-400"> · {h.kontakt}</span> : null}
                  </div>
                  <p className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line mt-0.5 break-words">{h.opis}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
        {historija.length > 5 && (
          <button type="button" onClick={() => setSveH(!sveH)} className="mt-3 text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline">
            {sveH ? "Prikaži manje" : `Prikaži svih ${historija.length} zapisa`}
          </button>
        )}
        {p.napomena && (
          <div className="mt-5">
            <PanelLabel>Napomena</PanelLabel>
            <p className="text-[13px] text-slate-600 dark:text-slate-300 whitespace-pre-line bg-slate-50 dark:bg-slate-800/60 rounded-lg px-3 py-2">{p.napomena}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function PotencijaliTab({ data, kupci = [], currentUser, onAdd, onUpdate, onDelete, onBulkImport, onBulkUpdate, onBulkDelete, onViewCompany, presetStatus, onPresetConsumed }) {
  const [q, setQ] = useState("");
  const [fKolega, setFKolega] = useState(SVE_KOLEGE);
  const [fStatus, setFStatus] = useState(SVI_STATUSI);
  const [fDrzava, setFDrzava] = useState(SVE_DRZAVE);
  const [fZadnji, setFZadnji] = useState(BILO_KADA);
  const [sort, setSort] = useState({ field: "zadnji_kontakt", dir: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [openId, setOpenId] = useState(null);
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

  useEffect(() => { setPage(1); }, [q, fKolega, fStatus, fDrzava, fZadnji, sort]);

  const openP = openId ? data.find((p) => p.id === openId) : null;

  /* ---- brzi prikazi ---- */
  const VIEWS = useMemo(() => [
    { id: "sve", label: "Sve firme", set: {} },
    ...(currentUser ? [{ id: "moje", label: "Moje firme", set: { kolega: currentUser } }] : []),
    { id: "nedodijeljene", label: "Nedodijeljene", set: { kolega: NEDODIJELJENO } },
    { id: "nepoznata", label: "Nepoznata država", set: { drzava: NEPOZNATA } },
    { id: "stari", label: "Bez kontakta > 12 mj.", set: { zadnji: "Prije više od 12 mj." } },
    { id: "dobijeni", label: "Dobijeni kupci", set: { status: "Dobijen" } },
  ], [currentUser]);

  const matches = (p, f) => {
    const kol = f.kolega || SVE_KOLEGE, st = f.status || SVI_STATUSI, dr = f.drzava || SVE_DRZAVE, zk = f.zadnji || BILO_KADA;
    if (kol === NEDODIJELJENO) { if (prodavaciOf(p).length > 0) return false; }
    else if (kol !== SVE_KOLEGE && !prodavaciOf(p).includes(kol)) return false;
    if (st !== SVI_STATUSI && p.status !== st) return false;
    if (dr !== SVE_DRZAVE && (p.drzava || NEPOZNATA) !== dr) return false;
    if (!zadnjiOk(p, zk)) return false;
    return true;
  };

  const viewCounts = useMemo(() => {
    const out = {};
    for (const v of VIEWS) out[v.id] = v.id === "sve" ? data.length : data.filter((p) => matches(p, v.set)).length;
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, VIEWS]);

  const cur = { kolega: fKolega, status: fStatus, drzava: fDrzava, zadnji: fZadnji };
  const isView = (v) =>
    fKolega === (v.set.kolega || SVE_KOLEGE) && fStatus === (v.set.status || SVI_STATUSI) &&
    fDrzava === (v.set.drzava || SVE_DRZAVE) && fZadnji === (v.set.zadnji || BILO_KADA);
  const applyView = (v) => {
    setFKolega(v.set.kolega || SVE_KOLEGE);
    setFStatus(v.set.status || SVI_STATUSI);
    setFDrzava(v.set.drzava || SVE_DRZAVE);
    setFZadnji(v.set.zadnji || BILO_KADA);
  };

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const out = data.filter((p) => {
      if (!matches(p, cur)) return false;
      if (qq) {
        const hay = [p.naziv_firme, p.kontakt_osoba, p.email, p.telefon, p.djelatnost, p.grad, p.adresa,
          ...(p.dodatni_kontakti || []).flatMap((k) => [k.ime, k.email, k.telefon])].join(" ").toLowerCase();
        if (!hay.includes(qq)) return false;
      }
      return true;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    const val = (p) => {
      if (sort.field === "kolega") return prodavaciOf(p)[0] || "";
      if (sort.field === "kontakti") return String(kontaktiOf(p).length).padStart(4, "0");
      return p[sort.field] || "";
    };
    out.sort((a, b) => {
      const va = val(a), vb = val(b);
      if (!va && vb) return 1;
      if (va && !vb) return -1;
      return String(va).localeCompare(String(vb), "hr", { sensitivity: "base" }) * dir;
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, q, fKolega, fStatus, fDrzava, fZadnji, sort]);

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

  const visePro = useMemo(() => data.filter((p) => prodavaciOf(p).length > 1).length, [data]);
  const nedod = viewCounts.nedodijeljene || 0;

  return (
    <div>
      {/* ---------- zaglavlje ---------- */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Baza potencijala</h2>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">
            {fmtN(data.length)} firmi · {fmtN(visePro)} s više prodavača · {fmtN(nedod)} nedodijeljeno
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MenuButton label="Uvoz" icon={Upload} className={headerBtnSec} items={[
            { label: "Objedinjena baza (Excel)", hint: "Potencijali_objedinjeno.xlsx — firme, kontakti, historija", icon: FileSpreadsheet, onClick: () => setShowObjedinjeni(true) },
            { label: "Jednostavna tabela", hint: "Jedan red = jedna firma, kolone redom", icon: Upload, onClick: () => setShowImport(true) },
          ]} />
          <button type="button" className={headerBtnSec} onClick={exportCSV}><Download size={15} /> Izvoz</button>
          <button type="button" className={btnPrimary + " h-9"} onClick={() => setShowNew(true)} disabled={!currentUser}><Plus size={15} /> Nova firma</button>
        </div>
      </div>

      {/* ---------- brzi prikazi ---------- */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-3 -mx-1 px-1">
        {VIEWS.map((v) => <ViewChip key={v.id} label={v.label} count={viewCounts[v.id]} active={isView(v)} onClick={() => applyView(v)} />)}
      </div>

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

      <div className="xl:flex xl:items-start xl:gap-4">
        {/* ---------- tabela ---------- */}
        <div className="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 px-3.5 py-3 border-b border-slate-100 dark:border-slate-800">
            <div className="w-full sm:w-72 sm:flex-none"><SearchBox value={q} onChange={setQ} placeholder="Firma, kontakt, email, grad..." /></div>
            <FilterPill label="Prodavač" value={fKolega} defaultValue={SVE_KOLEGE} onChange={setFKolega} options={[SVE_KOLEGE, ...COLLEAGUE_NAMES, NEDODIJELJENO]} />
            <FilterPill label="Status" value={fStatus} defaultValue={SVI_STATUSI} onChange={setFStatus} options={[SVI_STATUSI, ...POTENCIJAL_STATUSI]} />
            <FilterPill label="Država" value={fDrzava} defaultValue={SVE_DRZAVE} onChange={setFDrzava} options={[SVE_DRZAVE, ...DRZAVE_FILTER]} />
            <FilterPill label="Zadnji kontakt" value={fZadnji} defaultValue={BILO_KADA} onChange={setFZadnji} options={ZADNJI_OPCIJE} />
            <span className="ml-auto text-[13px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
              <b className="text-slate-900 dark:text-slate-100">{fmtN(filtered.length)}</b> {filtered.length === 1 ? "firma" : "firmi"}
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState icon={Target} title={data.length === 0 ? "Nema unesenih potencijala" : "Nema rezultata za odabrane filtere"}
                subtitle={data.length === 0 ? "Dodaj ručno ili uvezi objedinjenu bazu potencijala iz Excela." : "Promijeni pretragu ili filtere."}
                action={data.length === 0
                  ? <button className={btnPrimary} onClick={() => setShowObjedinjeni(true)}><FileSpreadsheet size={15} /> Uvezi objedinjenu bazu</button>
                  : <button className={btnSecondary} onClick={() => { setQ(""); applyView(VIEWS[0]); }}>Poništi filtere</button>} />
            </div>
          ) : (
            <>
              {/* desktop tabela */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-800/50">
                      <th className="pl-3.5 pr-0 py-2 w-8">
                        <button onClick={toggleSelectAll} className={btnGhostIcon} aria-label={`Odaberi svih ${filtered.length}`} title={`Odaberi svih ${filtered.length}`}>
                          {allFilteredSelected ? <CheckSquare size={15} className="text-teal-600" /> : <Square size={15} />}
                        </button>
                      </th>
                      <SortHead label="Firma" field="naziv_firme" sort={sort} setSort={setSort} />
                      <SortHead label="Lokacija" field="grad" sort={sort} setSort={setSort} />
                      <SortHead label="Status" field="status" sort={sort} setSort={setSort} />
                      <SortHead label="Prodavači" field="kolega" sort={sort} setSort={setSort} />
                      <SortHead label="Kontakti" field="kontakti" sort={sort} setSort={setSort} descFirst className="hidden lg:table-cell" />
                      <SortHead label="Zadnji kontakt" field="zadnji_kontakt" sort={sort} setSort={setSort} descFirst />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {pageRows.map((p) => {
                      const open = p.id === openId;
                      const prod = prodavaciOf(p);
                      const glavni = p.kolega && p.kolega !== NEDODIJELJENO ? p.kolega : prod[0];
                      const ordered = glavni ? [glavni, ...prod.filter((x) => x !== glavni)] : [];
                      return (
                        <tr key={p.id} onClick={() => setOpenId(open ? null : p.id)}
                          className={"cursor-pointer transition-colors " + (open ? "bg-teal-50/70 dark:bg-teal-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-800/40")}>
                          <td className="relative pl-3.5 pr-0 py-2.5" onClick={(e) => e.stopPropagation()}>
                            {open && <span className="absolute left-0 inset-y-0 w-[3px] bg-teal-600" />}
                            <button onClick={() => toggleSelect(p.id)} className={btnGhostIcon} aria-label="Odaberi red">
                              {selected.has(p.id) ? <CheckSquare size={15} className="text-teal-600" /> : <Square size={15} className="text-slate-300 dark:text-slate-600" />}
                            </button>
                          </td>
                          <td className="px-3.5 py-2.5 max-w-[320px]">
                            <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">{p.naziv_firme}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{p.djelatnost || p.kontakt_osoba || " "}</div>
                          </td>
                          <td className="px-3.5 py-2.5 whitespace-nowrap">
                            <span className="inline-flex items-center gap-2 text-[13px] text-slate-700 dark:text-slate-300">
                              <span title={p.drzava || NEPOZNATA}
                                className={"text-[10px] font-bold rounded px-1 py-px border " + (!p.drzava || p.drzava === NEPOZNATA
                                  ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                                  : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300")}>
                                {drzavaKod(p.drzava)}
                              </span>
                              {p.grad || <span className="text-slate-400">—</span>}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5"><StatusPill status={p.status} /></td>
                          <td className="px-3.5 py-2.5">
                            {ordered.length === 0
                              ? <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">{NEDODIJELJENO}</span>
                              : <AvatarStack names={ordered} />}
                          </td>
                          <td className="hidden lg:table-cell px-3.5 py-2.5 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 text-[13px] text-slate-600 dark:text-slate-400"><Users size={14} className="text-slate-400" /> {kontaktiOf(p).length}</span>
                          </td>
                          <td className="px-3.5 py-2.5 whitespace-nowrap">
                            {p.zadnji_kontakt ? (
                              <>
                                <div className={"text-[13px] font-semibold " + ageCls(p.zadnji_kontakt)}>{relDate(p.zadnji_kontakt)}</div>
                                <div className="text-[11px] text-slate-400 dark:text-slate-500">{fmtDate(p.zadnji_kontakt)}</div>
                              </>
                            ) : <span className="text-[13px] text-slate-400 dark:text-slate-500">nikad</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* mobitel */}
              <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
                {pageRows.map((p) => (
                  <div key={p.id} className="flex items-start gap-2 px-3 py-3" onClick={() => setOpenId(p.id)}>
                    <button onClick={(e) => { e.stopPropagation(); toggleSelect(p.id); }} className={btnGhostIcon + " -ml-1 mt-0.5"} aria-label="Odaberi red">
                      {selected.has(p.id) ? <CheckSquare size={15} className="text-teal-600" /> : <Square size={15} className="text-slate-300" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{p.naziv_firme}</span>
                        <StatusPill status={p.status} />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {[p.grad, p.drzava].filter(Boolean).join(", ")} · {prodavaciOf(p).join(", ") || NEDODIJELJENO}
                      </p>
                      {p.zadnji_kontakt && <p className={"text-xs font-medium mt-0.5 " + ageCls(p.zadnji_kontakt)}>{relDate(p.zadnji_kontakt)}</p>}
                    </div>
                    <ChevronRight size={16} className="text-slate-300 mt-1" />
                  </div>
                ))}
              </div>

              <PageNav page={page} setPage={setPage} pageSize={pageSize} setPageSize={setPageSize} total={filtered.length} />
            </>
          )}
        </div>

        {/* ---------- bočni panel ---------- */}
        {openP && (
          <>
            <div className="xl:hidden fixed inset-0 z-40 bg-slate-900/40" onClick={() => setOpenId(null)} />
            <aside className="fixed z-50 inset-y-0 right-0 w-full max-w-md overflow-y-auto bg-white dark:bg-slate-900
              xl:sticky xl:top-0 xl:z-auto xl:inset-auto xl:w-[400px] xl:max-w-none xl:shrink-0 xl:bg-transparent xl:dark:bg-transparent xl:max-h-[calc(100vh-7rem)] xl:rounded-2xl">
              <FirmaPanel key={openP.id} p={openP} currentUser={currentUser} onClose={() => setOpenId(null)}
                onEdit={() => setEditing(openP)} onUpdate={onUpdate}
                onDelete={async (id) => { await onDelete(id); setOpenId(null); }} onViewCompany={onViewCompany} />
            </aside>
          </>
        )}
      </div>

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
