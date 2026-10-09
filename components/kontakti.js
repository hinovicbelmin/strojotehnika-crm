"use client";
// Kontakti — kontakt osobe kupaca za tehničku podršku (samo pregled) + prijedlozi izmjena koje prodavač potvrđuje
import { useState, useMemo, useEffect } from "react";
import {
  Users, Phone, Mail, Copy, Check, X, Lock, Download, ExternalLink, Building2, Wrench, ArrowUpCircle, UserPlus,
  Send, Pencil, UserX, Inbox, Ban,
} from "lucide-react";
import { inputCls, btnPrimary, btnSecondary, btnGhostIcon, fmtDate, daysDiff, companyKey, downloadCSV } from "../lib/crm";
import { EmptyState, SearchBox } from "./ui";
import { Avatar, PanelLabel, PageNav, headerBtnSec, fmtN, initials } from "./crmBits";
import { drzavaGrupa, TEHNICAR_PO_DRZAVI } from "./nadogradnje";

/* ---------------------------------------------------------------------- */
/*  Postavke i pomoćne funkcije                                            */
/* ---------------------------------------------------------------------- */

export const P_TIPOVI = ["Nova osoba", "Ispravka podataka", "Osoba više ne radi"];
const NEDODIJELJENO = "Nedodijeljeno";
const DRZAVE = [["Sve", "Sve"], ["BA", "BiH"], ["HR", "Hrvatska"], ["AL", "Albanija"], ["OST", "Ostalo"]];
const OBUHVAT = ["Kupci s održavanjem", "Svi kupci", "Bez kontakta", "Sve firme"];

const norm = (s) => String(s || "").trim().toLowerCase();
const firstOf = (s) => String(s || "").split(/[,;\n]/).map((x) => x.trim()).filter(Boolean)[0] || "";
function prodavaciOf(p) {
  const all = [p.kolega, ...(p.prodavaci || [])].filter((x) => x && x !== NEDODIJELJENO);
  return [...new Set(all)];
}
const jeKomponenta = (k) => /^with\b/i.test((k.naziv_proizvoda_2 || "").trim());
const licKom = (k) => { const n = Number(k.broj_licenci); return n > 0 ? n : 1; };
function porodica(k) {
  const p = (k.naziv_proizvoda || "").trim();
  if (!p) return "Ostalo";
  if (/^NOT FOR SALE/i.test(p) || /3DEXPERIENCE|^Platform\b/i.test(p)) return "3DEXPERIENCE";
  for (const f of ["SolidCAM", "SWOOD", "DriveWorks", "SolidSteel", "DraftSight"]) if (p.toLowerCase().includes(f.toLowerCase())) return f;
  if (/SOLIDWORKS|^PhotoWorks/i.test(p)) return "SOLIDWORKS";
  return "Ostalo";
}
const PORODICE = ["SOLIDWORKS", "3DEXPERIENCE", "DraftSight", "SolidCAM", "SWOOD", "DriveWorks", "SolidSteel", "Ostalo"];
function licenceFirme(rows) {
  const m = new Map();
  let maxAkt = null;
  let maxSve = null;
  let aktivno = false;
  for (const k of rows) {
    const f = porodica(k);
    if (!jeKomponenta(k)) m.set(f, (m.get(f) || 0) + licKom(k));
    const e = k.end_date ? String(k.end_date).slice(0, 10) : null;
    const akt = e ? daysDiff(e) >= 0 : /w\/support/i.test(k.izvorni_status || "") && !/wo\/support/i.test(k.izvorni_status || "");
    if (akt) aktivno = true;
    if (e && (!maxSve || e > maxSve)) maxSve = e;
    if (akt && e && (!maxAkt || e > maxAkt)) maxAkt = e;
  }
  const grupe = PORODICE.filter((f) => m.get(f) > 0).map((f) => ({ f, n: m.get(f) }));
  return { grupe, aktivno, do: maxAkt || maxSve };
}

// opis prijedloga u jednoj rečenici
export function opisPrijedloga(pr) {
  const ref = pr.ref || {};
  if (pr.tip === "Osoba više ne radi") return `${ref.ime || pr.ime || "Kontakt"} više ne radi u firmi`;
  if (pr.tip === "Ispravka podataka") return `Ispravka kontakta ${ref.ime || pr.ime || ""}`.trim();
  return "Novi kontakt";
}

/*
 * Primjena prihvaćenog prijedloga na zapis u Bazi potencijala.
 * Vraća patch (kontakt_osoba / kontakt_funkcija / telefon / email / dodatni_kontakti) i napomenu ako kontakt nije nađen.
 */
export function primijeniPrijedlog(pot, pr) {
  const ref = pr.ref || {};
  const novo = { ime: (pr.ime || "").trim(), funkcija: (pr.funkcija || "").trim(), telefon: (pr.telefon || "").trim(), email: (pr.email || "").trim() };
  const dodatni = [...(pot.dodatni_kontakti || [])];
  const imaGlavni = !!(pot.kontakt_osoba || pot.telefon || pot.email);
  const patch = {};
  const glavniJe = () => imaGlavni && (norm(pot.kontakt_osoba) === norm(ref.ime) && (norm(ref.ime) || norm(pot.email) === norm(ref.email)));
  const idxDod = () => dodatni.findIndex((k) => (norm(ref.ime) ? norm(k.ime) === norm(ref.ime) : (norm(ref.email) && norm(k.email) === norm(ref.email)) || (norm(ref.telefon) && norm(k.telefon) === norm(ref.telefon))));
  const dodajNovi = () => {
    if (!imaGlavni) Object.assign(patch, { kontakt_osoba: novo.ime, kontakt_funkcija: novo.funkcija, telefon: novo.telefon, email: novo.email });
    else dodatni.push({ ...novo, napomena: (pr.napomena || "").trim(), dodao: pr.predlozio || "" });
  };
  let napomena = null;
  if (pr.tip === "Nova osoba") {
    dodajNovi();
  } else if (pr.tip === "Ispravka podataka") {
    const nonEmpty = Object.fromEntries(Object.entries(novo).filter(([, v]) => v));
    if (ref.glavni && glavniJe()) {
      if (nonEmpty.ime) patch.kontakt_osoba = nonEmpty.ime;
      if (nonEmpty.funkcija) patch.kontakt_funkcija = nonEmpty.funkcija;
      if (nonEmpty.telefon) patch.telefon = nonEmpty.telefon;
      if (nonEmpty.email) patch.email = nonEmpty.email;
    } else {
      const i = idxDod();
      if (i >= 0) dodatni[i] = { ...dodatni[i], ...nonEmpty };
      else { dodajNovi(); napomena = "Kontakt za ispravku nije nađen — dodan je kao nova osoba"; }
    }
  } else if (pr.tip === "Osoba više ne radi") {
    if (ref.glavni && glavniJe()) {
      const sljedeci = dodatni.shift();
      Object.assign(patch, sljedeci
        ? { kontakt_osoba: sljedeci.ime || "", kontakt_funkcija: sljedeci.funkcija || "", telefon: sljedeci.telefon || "", email: sljedeci.email || "" }
        : { kontakt_osoba: "", kontakt_funkcija: "", telefon: "", email: "" });
    } else {
      const i = idxDod();
      if (i >= 0) dodatni.splice(i, 1);
      else napomena = "Kontakt više nije u bazi — ništa nije uklonjeno";
    }
  }
  patch.dodatni_kontakti = dodatni;
  return { patch, napomena };
}

/* ---------------------------------------------------------------------- */
/*  Kartice prijedloga (Baza potencijala, Podsjetnici)                     */
/* ---------------------------------------------------------------------- */

const PRIHVATI_LABEL = { "Nova osoba": "Dodaj u kontakte", "Ispravka podataka": "Primijeni ispravku", "Osoba više ne radi": "Ukloni kontakt" };

export function PrijedlogKartica({ pr, canResolve, onResolve, showFirma = false, onViewCompany }) {
  const [busy, setBusy] = useState(false);
  const run = async (prihvati) => { setBusy(true); try { await onResolve(pr, prihvati); } catch (e) { /* toast je već prikazan */ } finally { setBusy(false); } };
  const ref = pr.ref || {};
  return (
    <div className="flex gap-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl px-3 py-2.5">
      <Avatar name={pr.predlozio || "?"} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] text-amber-900 dark:text-amber-300">
          <b>{pr.predlozio || "—"}</b> · {{ "Nova osoba": "novi kontakt", "Ispravka podataka": "ispravka kontakta", "Osoba više ne radi": "osoba više ne radi" }[pr.tip] || "prijedlog"} · {pr.created_at ? fmtDate(String(pr.created_at).slice(0, 10)) : ""}
        </div>
        {showFirma && (
          <button type="button" onClick={() => onViewCompany && onViewCompany(pr.firma)} className="text-[12.5px] font-semibold text-slate-700 dark:text-slate-200 hover:text-teal-700 truncate max-w-full block text-left">{pr.firma}</button>
        )}
        {pr.tip !== "Osoba više ne radi" && (
          <>
            <div className="text-[13.5px] font-bold text-slate-900 dark:text-slate-100 mt-0.5">{[pr.ime, pr.funkcija].filter(Boolean).join(" · ") || (ref.ime ? `${ref.ime} (bez izmjene imena)` : "—")}</div>
            {(pr.telefon || pr.email) && <div className="text-[12.5px] text-slate-600 dark:text-slate-400">{[pr.telefon, pr.email].filter(Boolean).join(" · ")}</div>}
            {pr.tip === "Ispravka podataka" && ref.ime && <div className="text-[11.5px] text-slate-500 dark:text-slate-400">dosad: {[ref.ime, ref.telefon, ref.email].filter(Boolean).join(" · ")}</div>}
          </>
        )}
        {pr.tip === "Osoba više ne radi" && <div className="text-[13.5px] font-bold text-slate-900 dark:text-slate-100 mt-0.5 line-through decoration-red-400">{[ref.ime, ref.funkcija].filter(Boolean).join(" · ")}</div>}
        {pr.napomena && <div className="text-[12.5px] text-slate-600 dark:text-slate-400 italic mt-0.5">„{pr.napomena}“</div>}
        {canResolve && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            <button type="button" disabled={busy} className={btnPrimary + " !py-1 !px-2.5 text-[12.5px]"} onClick={() => run(true)}><Check size={13} /> {PRIHVATI_LABEL[pr.tip] || "Prihvati"}</button>
            <button type="button" disabled={busy} className={btnSecondary + " !py-1 !px-2.5 text-[12.5px]"} onClick={() => run(false)}>Odbaci</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Model: firme i kontakt osobe                                           */
/* ---------------------------------------------------------------------- */

function izgradiKontakte({ kupci, potencijali, nadFirme }) {
  const firme = new Map();
  const firma = (key, naziv, drzava) => {
    if (!firme.has(key)) firme.set(key, { key, naziv, drzava: drzava || "", kupciRows: [], pots: [], nad: null, kontakti: [] });
    const f = firme.get(key);
    if (!f.drzava && drzava) f.drzava = drzava;
    return f;
  };
  for (const k of kupci || []) {
    const key = companyKey(k.naziv_firme);
    if (!key) continue;
    firma(key, String(k.naziv_firme || "").trim(), k.drzava).kupciRows.push(k);
  }
  for (const p of potencijali || []) {
    const key = companyKey(p.naziv_firme);
    if (!key) continue;
    const f = firma(key, String(p.naziv_firme || "").trim(), p.drzava);
    f.pots.push(p);
  }
  for (const n of nadFirme || []) if (firme.has(n.key)) firme.get(n.key).nad = n;

  for (const f of firme.values()) {
    f.grupa = drzavaGrupa(f.drzava);
    f.lic = licenceFirme(f.kupciRows);
    f.jeKupac = f.kupciRows.length > 0;
    // glavni zapis u Bazi potencijala: onaj s prodavačem
    f.pot = f.pots.find((p) => prodavaciOf(p).length) || f.pots[0] || null;
    f.prodavac = f.pot ? prodavaciOf(f.pot)[0] || "" : "";
    const vidjeni = new Set();
    const dodaj = (o) => {
      const sig = norm(o.ime) || norm(firstOf(o.email)) || norm(firstOf(o.telefon));
      if (!sig || vidjeni.has(sig)) return;
      vidjeni.add(sig);
      f.kontakti.push(o);
    };
    for (const p of f.pots) {
      if (p.kontakt_osoba || p.telefon || p.email) {
        dodaj({ ime: p.kontakt_osoba || "", funkcija: p.kontakt_funkcija || "", telefon: p.telefon || "", email: p.email || "", izvor: "Baza potencijala", glavni: true, potId: p.id });
      }
      for (const k of p.dodatni_kontakti || []) {
        dodaj({ ime: k.ime || "", funkcija: k.funkcija || "", telefon: k.telefon || "", email: k.email || "", izvor: k.dodao ? "Dodala podrška" : "Baza potencijala", dodao: k.dodao || "", glavni: false, potId: p.id });
      }
    }
    const nr = f.nad ? f.nad.rec || f.nad.prev : null;
    if (nr && (nr.kontakt || nr.mail)) dodaj({ ime: nr.kontakt || "", funkcija: "", telefon: "", email: nr.mail || "", izvor: "Nadogradnje", glavni: false });
  }
  return firme;
}

/* ---------------------------------------------------------------------- */
/*  Mali UI elementi                                                       */
/* ---------------------------------------------------------------------- */

const IZVOR_CLS = {
  "Baza potencijala": "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
  Nadogradnje: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  "Dodala podrška": "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
};
function IzvorChip({ k }) {
  return <span title={k.dodao ? `Predložio: ${k.dodao}` : undefined} className={"text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap " + (IZVOR_CLS[k.izvor] || IZVOR_CLS["Baza potencijala"])}>{k.izvor}</span>;
}
function LicChips({ lic, max = 2 }) {
  if (!lic.grupe.length) return <span className="text-[11.5px] text-slate-400">nije kupac</span>;
  const prik = lic.grupe.slice(0, max);
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      {prik.map((g) => (
        <span key={g.f} className={"inline-flex items-center gap-1.5 h-[22px] px-2 rounded-md border text-[11.5px] font-semibold whitespace-nowrap " +
          (lic.aktivno ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900" : "bg-white text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700")}>
          <span className={"w-1.5 h-1.5 rounded-sm " + (lic.aktivno ? "bg-red-600" : "bg-slate-300")} />{g.f} {fmtN(g.n)}
        </span>
      ))}
      {lic.grupe.length > max && <span className="text-[11px] text-slate-500">+{lic.grupe.length - max}</span>}
      {lic.do && <span className="text-[11.5px] text-slate-500 dark:text-slate-400 whitespace-nowrap">{lic.aktivno ? "održ. do" : "isteklo"} {fmtDate(lic.do)}</span>}
    </span>
  );
}
function KopirajBtn({ text, label }) {
  const [ok, setOk] = useState(false);
  if (!text) return null;
  return (
    <button type="button" title={`Kopiraj ${label}`} aria-label={`Kopiraj ${label}`}
      onClick={(e) => { e.stopPropagation(); try { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200); } catch (err) { /* */ } }}
      className="w-7 h-7 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-teal-700 hover:border-teal-300">
      {ok ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
    </button>
  );
}
const telHref = (t) => `tel:${firstOf(t).replace(/[^\d+]/g, "")}`;

/* ---------------------------------------------------------------------- */
/*  Prijedlog (novi / ispravka / više ne radi)                             */
/* ---------------------------------------------------------------------- */

function PrijedlogModal({ f, pocetni, currentUser, onClose, onSave }) {
  const [tip, setTip] = useState(pocetni?.tip || "Nova osoba");
  const [refIdx, setRefIdx] = useState(pocetni?.refIdx ?? (f.kontakti.length ? 0 : -1));
  const ref = refIdx >= 0 ? f.kontakti[refIdx] : null;
  const prazno = { ime: "", funkcija: "", telefon: "", email: "" };
  const [v, setV] = useState(() => (pocetni?.tip === "Ispravka podataka" && ref ? { ime: ref.ime, funkcija: ref.funkcija, telefon: ref.telefon, email: ref.email } : prazno));
  const [napomena, setNapomena] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const odaberiTip = (t) => {
    setTip(t);
    if (t === "Ispravka podataka" && ref) setV({ ime: ref.ime, funkcija: ref.funkcija, telefon: ref.telefon, email: ref.email });
    if (t === "Nova osoba") setV(prazno);
  };
  const odaberiRef = (i) => {
    setRefIdx(i);
    const r = f.kontakti[i];
    if (tip === "Ispravka podataka" && r) setV({ ime: r.ime, funkcija: r.funkcija, telefon: r.telefon, email: r.email });
  };
  const trebaRef = tip !== "Nova osoba";
  const izmijenjeno = ref && ["ime", "funkcija", "telefon", "email"].some((k) => (v[k] || "").trim() !== (ref[k] || "").trim());
  const ok = !!currentUser && (tip === "Nova osoba" ? !!(v.ime.trim() && (v.telefon.trim() || v.email.trim() || v.funkcija.trim()))
    : tip === "Ispravka podataka" ? !!(ref && izmijenjeno) : !!ref);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const submit = async () => {
    if (!ok || busy) return;
    setBusy(true);
    try {
      await onSave({
        firma: f.naziv, firma_key: f.key, drzava: f.drzava || null, potencijal_id: f.pot ? String(f.pot.id) : null, tip,
        ime: tip === "Osoba više ne radi" ? null : v.ime.trim() || null, funkcija: tip === "Osoba više ne radi" ? null : v.funkcija.trim() || null,
        telefon: tip === "Osoba više ne radi" ? null : v.telefon.trim() || null, email: tip === "Osoba više ne radi" ? null : v.email.trim() || null,
        napomena: napomena.trim() || null,
        ref: trebaRef && ref ? { ime: ref.ime, funkcija: ref.funkcija, telefon: ref.telefon, email: ref.email, glavni: !!ref.glavni, izvor: ref.izvor } : null,
        prodavac: f.prodavac || null, predlozio: currentUser, status: "Na čekanju",
      });
      onClose();
    } catch (e) {
      /* toast je već prikazan */
    } finally {
      setBusy(false);
    }
  };
  const kontaktiZaRef = f.kontakti.map((k, i) => ({ k, i })).filter(({ k }) => k.izvor !== "Nadogradnje");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className="max-w-xl w-full bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col border border-transparent dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Javi prodavaču: novi ili pogrešan kontakt</h3>
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
              {f.naziv} · {f.prodavac ? <>prodavač <Avatar name={f.prodavac} size="sm" /> {f.prodavac}</> : "nema prodavača — ide prodaji (nedodijeljeno)"}
            </p>
          </div>
          <button type="button" onClick={onClose} className={btnGhostIcon} aria-label="Zatvori"><X size={18} /></button>
        </div>
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {P_TIPOVI.map((t) => (
              <button key={t} type="button" onClick={() => odaberiTip(t)} disabled={t !== "Nova osoba" && !kontaktiZaRef.length}
                className={"h-8 px-3 rounded-lg text-[13px] disabled:opacity-40 " + (tip === t ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold" : "border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300")}>
                {t}
              </button>
            ))}
          </div>
          {trebaRef && (
            <label className="block">
              <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Koji kontakt?</span>
              <select className={inputCls} value={refIdx} onChange={(e) => odaberiRef(Number(e.target.value))}>
                {kontaktiZaRef.map(({ k, i }) => <option key={i} value={i}>{[k.ime || "(bez imena)", k.funkcija, firstOf(k.telefon) || firstOf(k.email)].filter(Boolean).join(" · ")}</option>)}
              </select>
            </label>
          )}
          {tip !== "Osoba više ne radi" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[["ime", "Ime i prezime"], ["funkcija", "Funkcija"], ["telefon", "Telefon"], ["email", "Mail"]].map(([k, l]) => (
                <label key={k} className="block">
                  <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">{l}{k === "ime" && tip === "Nova osoba" ? " *" : ""}</span>
                  <input className={inputCls} value={v[k] || ""} onChange={set(k)} autoFocus={k === "ime"} />
                </label>
              ))}
            </div>
          )}
          <label className="block">
            <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Napomena za prodavača</span>
            <input className={inputCls} value={napomena} onChange={(e) => setNapomena(e.target.value)}
              placeholder={tip === "Osoba više ne radi" ? "npr. ko je preuzeo licence" : "npr. preuzela licence od kolege"} />
          </label>
          <p className="text-[12px] text-teal-700 dark:text-teal-400">Prodavač dobije prijedlog u Bazi potencijala i u Podsjetnicima — kontakt se mijenja tek kad ga potvrdi.</p>
        </div>
        <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
          <button type="button" className={btnSecondary} onClick={onClose}>Otkaži</button>
          <button type="button" className={btnPrimary} onClick={submit} disabled={!ok || busy}><Send size={14} /> {busy ? "Šaljem…" : "Pošalji prodavaču"}</button>
        </div>
      </div>
    </div>
  );
}

const STATUS_P_CLS = {
  "Na čekanju": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Prihvaćeno: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  Odbijeno: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};
function MojiPrijedloziModal({ lista, onClose, onPovuci, onViewCompany }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className="max-w-2xl w-full bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-h-[85vh] flex flex-col border border-transparent dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Moji prijedlozi kontakata</h3>
          <button type="button" onClick={onClose} className={btnGhostIcon} aria-label="Zatvori"><X size={18} /></button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto">
          {lista.length === 0 ? <p className="text-sm text-slate-500">Još nisi slao prijedloge.</p> : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {lista.map((pr) => (
                <div key={pr.id} className="py-2.5 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <button type="button" onClick={() => onViewCompany && onViewCompany(pr.firma)} className="text-[13.5px] font-semibold text-slate-900 dark:text-slate-100 hover:text-teal-700 text-left">{pr.firma}</button>
                    <div className="text-[12.5px] text-slate-600 dark:text-slate-400">{opisPrijedloga(pr)}{pr.ime ? `: ${[pr.ime, pr.funkcija].filter(Boolean).join(" · ")}` : ""}</div>
                    <div className="text-[11.5px] text-slate-400">
                      {pr.created_at ? fmtDate(String(pr.created_at).slice(0, 10)) : ""} · za {pr.prodavac || NEDODIJELJENO}
                      {pr.rijesio ? ` · ${pr.status === "Prihvaćeno" ? "prihvatio" : "odbio"} ${pr.rijesio}${pr.rijeseno_at ? " " + fmtDate(String(pr.rijeseno_at).slice(0, 10)) : ""}` : ""}
                    </div>
                  </div>
                  <span className={"text-[11.5px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap " + (STATUS_P_CLS[pr.status] || STATUS_P_CLS["Na čekanju"])}>{pr.status}</span>
                  {pr.status === "Na čekanju" && <button type="button" className="text-xs text-slate-500 hover:text-red-600 whitespace-nowrap" onClick={() => onPovuci(pr)}>Povuci</button>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Panel firme                                                            */
/* ---------------------------------------------------------------------- */

function FirmaPanel({ f, podrska, prijedlozi, currentUser, onClose, onPredlozi, onViewCompany }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const intervencije = useMemo(() => podrska.filter((s) => companyKey(s.firma) === f.key)
    .sort((a, b) => String(b.datum || "").localeCompare(String(a.datum || ""))).slice(0, 3), [podrska, f.key]);
  const naCekanju = prijedlozi.filter((p) => p.firma_key === f.key && p.status === "Na čekanju");
  const lokacija = [f.pot && f.pot.grad, f.drzava].filter(Boolean).join(" · ");
  return (
    <div className="fixed inset-0 z-40 bg-slate-900/40 dark:bg-black/60 xl:static xl:z-auto xl:bg-transparent xl:dark:bg-transparent" onClick={onClose}>
      <div className="absolute right-0 top-0 h-full w-full max-w-[440px] xl:static xl:h-auto xl:max-h-[calc(100vh-7rem)] xl:w-[400px] xl:max-w-none xl:sticky xl:top-2 bg-white dark:bg-slate-900 xl:border border-slate-200 dark:border-slate-800 xl:rounded-2xl shadow-2xl xl:shadow-lg xl:shadow-slate-900/5 flex flex-col overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-3.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 inline-flex items-center justify-center text-slate-500 shrink-0"><Building2 size={18} /></span>
            <div className="flex-1 min-w-0">
              <h3 className="text-[16px] font-bold text-slate-900 dark:text-slate-100 leading-snug break-words">{f.naziv}</h3>
              {lokacija && <p className="text-[12.5px] text-slate-500 dark:text-slate-400">{lokacija}</p>}
            </div>
            {onViewCompany && <button type="button" className={btnSecondary + " !py-1 !px-2 text-[12.5px] whitespace-nowrap"} onClick={() => onViewCompany(f.naziv)}><ExternalLink size={13} /> 360°</button>}
            <button type="button" className={btnGhostIcon} onClick={onClose} aria-label="Zatvori"><X size={18} /></button>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5"><LicChips lic={f.lic} max={4} /></div>
          <div className="mt-2 flex items-center gap-1.5 text-[12.5px] text-slate-600 dark:text-slate-400">
            Prodavač: {f.prodavac ? <><Avatar name={f.prodavac} size="sm" /><b className="font-semibold text-slate-800 dark:text-slate-200">{f.prodavac}</b></> : <span className="italic text-slate-400">nije dodijeljen{f.pot ? "" : " (firma nije u Bazi potencijala)"}</span>}
          </div>
        </div>

        <div className="px-5 py-4 space-y-5">
          <div>
            <PanelLabel>Kontakt osobe · {f.kontakti.length}</PanelLabel>
            {f.kontakti.length === 0 ? (
              <p className="text-[13px] text-slate-400">Nema unesenih kontakt osoba.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {f.kontakti.map((k, i) => {
                  const tel = firstOf(k.telefon);
                  const mail = firstOf(k.email);
                  return (
                    <div key={i} className="flex gap-2.5 py-2.5 first:pt-0.5 group">
                      <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold inline-flex items-center justify-center shrink-0">{k.ime ? initials(k.ime) : "?"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13.5px] font-semibold text-slate-900 dark:text-slate-100 truncate">{k.ime || "(bez imena)"}</span>
                          {k.glavni && f.kontakti.length > 1 && <span className="text-[10px] font-bold text-teal-700 bg-teal-100 dark:bg-teal-900/40 dark:text-teal-300 px-1.5 rounded-full shrink-0">glavni</span>}
                        </div>
                        {k.funkcija && <div className="text-xs text-slate-500 dark:text-slate-400">{k.funkcija}</div>}
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[12.5px]">
                          {tel && <a href={telHref(k.telefon)} className="inline-flex items-center gap-1 text-teal-700 dark:text-teal-400 hover:underline"><Phone size={12} />{k.telefon}</a>}
                          {mail && <a href={`mailto:${mail}`} className="inline-flex items-center gap-1 text-teal-700 dark:text-teal-400 hover:underline break-all"><Mail size={12} />{k.email}</a>}
                          {!tel && !mail && <span className="text-slate-400">bez telefona i maila</span>}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <IzvorChip k={k} />
                          {currentUser && k.izvor !== "Nadogradnje" && (
                            <>
                              <button type="button" className="text-[11.5px] text-slate-500 hover:text-teal-700 inline-flex items-center gap-1" onClick={() => onPredlozi(f, { tip: "Ispravka podataka", refIdx: i })}><Pencil size={11} /> ispravi</button>
                              <button type="button" className="text-[11.5px] text-slate-500 hover:text-red-600 inline-flex items-center gap-1" onClick={() => onPredlozi(f, { tip: "Osoba više ne radi", refIdx: i })}><UserX size={11} /> više ne radi</button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <KopirajBtn text={tel} label="telefon" />
                        <KopirajBtn text={mail} label="mail" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {naCekanju.length > 0 && (
            <div>
              <PanelLabel>Čeka potvrdu prodavača · {naCekanju.length}</PanelLabel>
              <div className="space-y-2">{naCekanju.map((pr) => <PrijedlogKartica key={pr.id} pr={pr} canResolve={false} onResolve={async () => {}} />)}</div>
            </div>
          )}

          <div>
            <PanelLabel>Zadnje intervencije podrške</PanelLabel>
            {intervencije.length === 0 ? <p className="text-[13px] text-slate-400">Nema zapisa.</p> : intervencije.map((s) => (
              <div key={s.id} className="flex gap-2 py-1.5 border-t border-slate-100 dark:border-slate-800 first:border-t-0 text-[12.5px] text-slate-700 dark:text-slate-300">
                <Wrench size={13} className="text-slate-400 mt-0.5 shrink-0" />
                <span className="text-slate-500 whitespace-nowrap">{fmtDate(s.datum)}</span>
                <span className="min-w-0 break-words">{s.opis || s.vrsta || "—"}{s.tehnicar ? <span className="text-slate-400"> · {s.tehnicar}</span> : null}</span>
              </div>
            ))}
          </div>

          {f.nad && (
            <div className="flex items-start gap-2 bg-violet-50 dark:bg-violet-950/30 rounded-xl px-3 py-2 text-[12.5px] text-violet-800 dark:text-violet-300">
              <ArrowUpCircle size={15} className="mt-0.5 shrink-0" />
              <span>Nadogradnje: <b>{f.nad.status}</b>{f.nad.tehnicar ? ` · ${f.nad.tehnicar}` : ""}</span>
            </div>
          )}

          {currentUser && (
            <button type="button" className={btnSecondary + " w-full justify-center text-[13px]"} onClick={() => onPredlozi(f, { tip: "Nova osoba" })}>
              <UserPlus size={15} /> Novi ili pogrešan kontakt? Javi prodavaču
            </button>
          )}
          <p className="text-[11.5px] text-slate-400 -mt-3">Kontakte uređuje prodavač u Bazi potencijala; ovdje se samo predlaže izmjena.</p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Tab                                                                    */
/* ---------------------------------------------------------------------- */

export function KontaktiTab({
  kupci = [], potencijali = [], podrska = [], nadFirme = [], prijedlozi = [], currentUser,
  onPredlozi, onPovuci, onViewCompany, odjave = [], onOpenMailing,
}) {
  const odjavljeni = useMemo(() => new Set((odjave || []).map((o) => String(o.email || "").toLowerCase())), [odjave]);
  const mojaDrzava = Object.entries(TEHNICAR_PO_DRZAVI).find(([, t]) => t === currentUser);
  const [fDrz, setFDrz] = useState(mojaDrzava ? mojaDrzava[0] : "Sve");
  const [fObuhvat, setFObuhvat] = useState("Kupci s održavanjem");
  const [fFali, setFFali] = useState(false);
  const [q, setQ] = useState("");
  const [panelKey, setPanelKey] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [modal, setModal] = useState(null); // { f, pocetni }
  const [showMoji, setShowMoji] = useState(false);
  useEffect(() => { setPage(1); }, [fDrz, fObuhvat, fFali, q]);

  const firme = useMemo(() => izgradiKontakte({ kupci, potencijali, nadFirme }), [kupci, potencijali, nadFirme]);
  const uDrzavi = useMemo(() => [...firme.values()].filter((f) => fDrz === "Sve" || f.grupa === fDrz), [firme, fDrz]);
  const nDrz = useMemo(() => {
    const m = { Sve: 0 };
    for (const f of firme.values()) if (f.jeKupac) { m.Sve += 1; m[f.grupa] = (m[f.grupa] || 0) + 1; }
    return m;
  }, [firme]);
  const saOdrz = uDrzavi.filter((f) => f.lic.aktivno);
  const kpi = {
    osoba: saOdrz.reduce((s, f) => s + f.kontakti.length, 0),
    firmi: saOdrz.length,
    bez: saOdrz.filter((f) => !f.kontakti.length).length,
    fali: saOdrz.reduce((s, f) => s + f.kontakti.filter((k) => !firstOf(k.telefon) || !firstOf(k.email)).length, 0),
  };

  const qq = q.trim().toLowerCase();
  const redovi = useMemo(() => {
    let fs = uDrzavi;
    if (fObuhvat === "Kupci s održavanjem") fs = fs.filter((f) => f.lic.aktivno);
    else if (fObuhvat === "Svi kupci") fs = fs.filter((f) => f.jeKupac);
    else if (fObuhvat === "Bez kontakta") fs = fs.filter((f) => f.lic.aktivno && !f.kontakti.length);
    const out = [];
    for (const f of fs) {
      if (!f.kontakti.length) {
        if (fObuhvat === "Bez kontakta" || fObuhvat === "Svi kupci" || (fObuhvat === "Kupci s održavanjem" && !fFali)) {
          if (!qq || f.naziv.toLowerCase().includes(qq)) out.push({ f, k: null });
        }
        continue;
      }
      for (const k of f.kontakti) {
        if (fFali && firstOf(k.telefon) && firstOf(k.email)) continue;
        if (qq && ![f.naziv, k.ime, k.funkcija, k.telefon, k.email].join(" ").toLowerCase().includes(qq)) continue;
        out.push({ f, k });
      }
    }
    out.sort((a, b) => a.f.naziv.localeCompare(b.f.naziv, "hr") || (b.k && b.k.glavni ? 1 : 0) - (a.k && a.k.glavni ? 1 : 0));
    return out;
  }, [uDrzavi, fObuhvat, fFali, qq]);
  const stranica = redovi.slice((page - 1) * pageSize, page * pageSize);
  const panelFirma = panelKey ? firme.get(panelKey) : null;
  const moji = useMemo(() => prijedlozi.filter((p) => p.predlozio === currentUser).sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))), [prijedlozi, currentUser]);
  const mojiNaCekanju = moji.filter((p) => p.status === "Na čekanju").length;

  const izvoz = () => {
    downloadCSV(`Kontakti_${new Date().toISOString().slice(0, 10)}.csv`,
      ["Firma", "Država", "Licence", "Održavanje do", "Ime i prezime", "Funkcija", "Telefon", "Mail", "Izvor", "Prodavač"],
      redovi.map(({ f, k }) => [f.naziv, f.drzava, f.lic.grupe.map((g) => `${g.f} ${g.n}`).join(" · "), f.lic.do ? fmtDate(f.lic.do) : "",
        k ? k.ime : "", k ? k.funkcija : "", k ? k.telefon : "", k ? k.email : "", k ? k.izvor : "nema kontakta", f.prodavac || NEDODIJELJENO]));
  };

  const chip = (on) => "h-8 px-3 rounded-full border text-[13px] whitespace-nowrap inline-flex items-center gap-1.5 transition-colors " +
    (on ? "bg-teal-600 border-teal-600 text-white font-semibold" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-teal-400");
  const G = "md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.5fr)_150px_minmax(0,1fr)_118px_30px]";
  const tiles = [
    ["Kontakt osoba", kpi.osoba, "kod kupaca s održavanjem", () => { setFObuhvat("Kupci s održavanjem"); setFFali(false); }, fObuhvat === "Kupci s održavanjem" && !fFali, ""],
    ["Kupci s održavanjem", kpi.firmi, fDrz === "Sve" ? "firmi" : `firmi · ${DRZAVE.find((d) => d[0] === fDrz)[1]}`, () => { setFObuhvat("Kupci s održavanjem"); setFFali(false); }, false, ""],
    ["Kupci bez kontakta", kpi.bez, "imaju održavanje, a nijednu osobu", () => { setFObuhvat("Bez kontakta"); setFFali(false); }, fObuhvat === "Bez kontakta", "warn"],
    ["Bez telefona ili maila", kpi.fali, "osoba kojima nešto fali", () => { setFObuhvat("Kupci s održavanjem"); setFFali(true); }, fFali, ""],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Kontakti</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Ko je kontakt osoba kod kupca — telefon i mail na jednom mjestu. Podaci dolaze iz Baze potencijala i Nadogradnji.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg px-2.5 py-1.5"><Lock size={13} /> Samo pregled</span>
          {currentUser && (
            <button type="button" className={headerBtnSec} onClick={() => setShowMoji(true)}>
              <Inbox size={15} /> Moji prijedlozi{mojiNaCekanju ? <span className="text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 px-1.5 rounded-full">{mojiNaCekanju}</span> : null}
            </button>
          )}
          <button type="button" className={headerBtnSec} onClick={izvoz} disabled={!redovi.length}><Download size={15} /> Izvoz</button>
          {onOpenMailing && <button type="button" className={btnPrimary} onClick={onOpenMailing}><Mail size={15} /> Izvoz za mailing</button>}
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {tiles.map(([l, v, s, fn, on, tone]) => (
          <button key={l} type="button" onClick={fn}
            className={"text-left rounded-2xl border px-4 py-3 transition-all hover:shadow-sm " +
              (on ? "border-teal-500 ring-2 ring-teal-500/25 bg-white dark:bg-slate-900" : tone === "warn" && v > 0 ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900")}>
            <span className="block text-xs font-semibold text-slate-600 dark:text-slate-400">{l}</span>
            <span className="block text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">{fmtN(v)}</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{s}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col xl:flex-row gap-4 items-start">
        <div className="flex-1 min-w-0 w-full space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <SearchBox value={q} onChange={setQ} placeholder="Ime, firma, telefon ili mail…" />
            {DRZAVE.filter(([k]) => k === "Sve" || nDrz[k]).map(([k, l]) => (
              <button key={k} type="button" className={chip(fDrz === k)} onClick={() => setFDrz(k)}>{l} <span className="opacity-70 text-[11px]">{nDrz[k] || 0}</span></button>
            ))}
            <span className="w-px h-6 bg-slate-200 dark:bg-slate-700 hidden sm:block" />
            {OBUHVAT.map((o) => <button key={o} type="button" className={chip(fObuhvat === o && !fFali)} onClick={() => { setFObuhvat(o); setFFali(false); }}>{o}</button>)}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            {redovi.length === 0 ? (
              <div className="p-6">
                <EmptyState icon={Users} title="Nema kontakata za ove filtere" subtitle={kupci.length ? "Promijeni državu, obuhvat ili pretragu." : "Lista se puni iz Kupaca i licenci i Baze potencijala."} />
              </div>
            ) : (
              <>
                <div className={"hidden md:grid gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 " + G}>
                  <span>Osoba</span><span>Firma · licence</span><span>Telefon</span><span>Mail</span><span>Izvor</span><span>Prod.</span>
                </div>
                {stranica.map(({ f, k }, i) => {
                  const sel = panelKey === f.key;
                  const tel = k ? firstOf(k.telefon) : "";
                  const mail = k ? firstOf(k.email) : "";
                  return (
                    <div key={f.key + "|" + i} onClick={() => setPanelKey(sel ? null : f.key)}
                      className={"grid grid-cols-1 gap-x-3 gap-y-1 items-center px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 first:border-t-0 cursor-pointer transition-colors " + G + " " +
                        (sel ? "bg-teal-50/70 dark:bg-teal-950/30 shadow-[inset_3px_0_0_0_#0d9488]" : "hover:bg-slate-50 dark:hover:bg-slate-800/40")}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        {k ? (
                          <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold inline-flex items-center justify-center shrink-0">{k.ime ? initials(k.ime) : "?"}</span>
                        ) : <span className="w-8 h-8 rounded-full border border-dashed border-amber-400 inline-flex items-center justify-center text-amber-600 shrink-0"><UserX size={14} /></span>}
                        <div className="min-w-0">
                          <div className={"text-[13.5px] font-semibold truncate " + (k ? "text-slate-900 dark:text-slate-100" : "text-amber-700 dark:text-amber-400 italic")}>{k ? k.ime || "(bez imena)" : "nema kontakt osobe"}</div>
                          {k && k.funkcija && <div className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate">{k.funkcija}</div>}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-slate-700 dark:text-slate-200 truncate">{f.naziv}</div>
                        <div className="mt-0.5 overflow-hidden"><LicChips lic={f.lic} /></div>
                      </div>
                      <div className="min-w-0" onClick={(e) => tel && e.stopPropagation()}>
                        {tel ? <a href={telHref(k.telefon)} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-teal-700 dark:text-teal-400 hover:underline whitespace-nowrap"><Phone size={13} />{tel}</a>
                          : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </div>
                      <div className="min-w-0" onClick={(e) => mail && e.stopPropagation()}>
                        {mail ? <a href={`mailto:${mail}`} title={odjavljeni.has(mail.toLowerCase()) ? "Ne šalji masovne mailove" : undefined}
                          className={"inline-flex items-center gap-1.5 text-[13px] hover:underline max-w-full " + (odjavljeni.has(mail.toLowerCase()) ? "text-red-600 dark:text-red-400" : "text-teal-700 dark:text-teal-400")}>
                          {odjavljeni.has(mail.toLowerCase()) ? <Ban size={13} className="shrink-0" /> : <Mail size={13} className="shrink-0" />}<span className="truncate">{mail}</span></a>
                          : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </div>
                      <div>{k ? <IzvorChip k={k} /> : currentUser ? (
                        <button type="button" onClick={(e) => { e.stopPropagation(); setModal({ f, pocetni: { tip: "Nova osoba" } }); }}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-300 border border-dashed border-teal-300 dark:border-teal-700 px-2 py-0.5 rounded-full whitespace-nowrap hover:bg-teal-50"><UserPlus size={11} /> predloži</button>
                      ) : null}</div>
                      <div className="hidden md:block">{f.prodavac ? <Avatar name={f.prodavac} size="sm" /> : <span title="Nema prodavača" className="inline-block w-6 h-6 rounded-full border border-dashed border-slate-300 dark:border-slate-600" />}</div>
                    </div>
                  );
                })}
                <PageNav page={page} setPage={setPage} pageSize={pageSize} setPageSize={setPageSize} total={redovi.length} />
              </>
            )}
          </div>
        </div>

        {panelFirma && (
          <FirmaPanel f={panelFirma} podrska={podrska} prijedlozi={prijedlozi} currentUser={currentUser}
            onClose={() => setPanelKey(null)} onPredlozi={(f, pocetni) => setModal({ f, pocetni })} onViewCompany={onViewCompany} />
        )}
      </div>

      {modal && <PrijedlogModal f={modal.f} pocetni={modal.pocetni} currentUser={currentUser} onClose={() => setModal(null)} onSave={onPredlozi} />}
      {showMoji && <MojiPrijedloziModal lista={moji} onClose={() => setShowMoji(false)} onPovuci={onPovuci} onViewCompany={onViewCompany} />}
    </div>
  );
}

// Za Bazu potencijala i Podsjetnike: prijedlozi na čekanju
export function prijedloziNaCekanju(prijedlozi) {
  return (prijedlozi || []).filter((p) => p.status === "Na čekanju")
    .sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
}
