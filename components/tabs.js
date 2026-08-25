"use client";
import { useState, useMemo } from "react";
import {
  Home, Target, TrendingUp, Building2, Wrench, Bell, Plus, Pencil,
  ArrowRightCircle, Phone, Mail, MapPin, Calendar, User, AlertTriangle,
  CheckCircle2, ChevronRight, Upload,
} from "lucide-react";
import {
  COLLEAGUE_NAMES, SORTED_FOR_TECH, POTENCIJAL_STATUSI, LEAD_STATUSI, STATUS_BOJE,
  inputCls, btnPrimary, btnSecondary, btnGhostIcon,
  todayStr, fmtDate, licenseStatus, reminderUrgency, getReminders, daysDiff,
} from "../lib/crm";
import { Modal, Field, EmptyState, Toolbar, SearchBox, MetaLine, ImportModal, ConfirmDelete } from "./ui";

/* ====================================================================== */
/*  PREGLED                                                                */
/* ====================================================================== */

function StatCard({ icon: Icon, label, value, accent, onClick }) {
  return (
    <button onClick={onClick} className="text-left bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md hover:border-slate-300 transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className={"w-9 h-9 rounded-lg flex items-center justify-center " + accent}>
          <Icon size={17} />
        </div>
      </div>
      <div className="text-2xl font-bold text-slate-900 tracking-tight">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </button>
  );
}

export function PregledTab({ potencijali, lidovi, kupci, podrska, setTab }) {
  const podsjetnici = getReminders(potencijali, lidovi).filter((r) => daysDiff(r.datum) <= 7);
  const isticuLicence = kupci.filter((k) => k.end_date && daysDiff(k.end_date) <= 30).sort((a, b) => new Date(a.end_date) - new Date(b.end_date));
  const aktivniLidovi = lidovi.filter((l) => l.status !== "Konvertovan" && l.status !== "Odbačen").length;
  const otvoreniPotencijali = potencijali.filter((p) => p.status !== "Dobijen" && p.status !== "Izgubljen").length;

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard icon={Target} label="Otvoreni potencijali" value={otvoreniPotencijali} accent="bg-blue-50 text-blue-600" onClick={() => setTab("potencijali")} />
        <StatCard icon={TrendingUp} label="Aktivni lidovi" value={aktivniLidovi} accent="bg-violet-50 text-violet-600" onClick={() => setTab("lidovi")} />
        <StatCard icon={Building2} label="Kupci / licence" value={kupci.length} accent="bg-teal-50 text-teal-600" onClick={() => setTab("kupci")} />
        <StatCard icon={AlertTriangle} label="Licence ističu ≤30 dana" value={isticuLicence.length} accent="bg-amber-50 text-amber-600" onClick={() => setTab("kupci")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              <Bell size={15} className="text-slate-400" /> Podsjetnici (narednih 7 dana)
            </h3>
            <button onClick={() => setTab("podsjetnici")} className="text-xs text-teal-600 font-medium hover:underline flex items-center gap-0.5">
              Svi <ChevronRight size={13} />
            </button>
          </div>
          {podsjetnici.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">Nema podsjetnika u narednih 7 dana.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {podsjetnici.slice(0, 6).map((r) => {
                const u = reminderUrgency(r.datum);
                return (
                  <li key={r.tip + r.id} className="py-2.5 flex items-center gap-3">
                    <span className={"w-2 h-2 rounded-full shrink-0 " + u.dotCls} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-700 truncate">
                        <span className="font-medium">{r.firma}</span> — {r.opis || "podsjetnik"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {r.tip} · {r.kolega} · {fmtDate(r.datum)}
                      </p>
                    </div>
                    <span className={"text-xs px-2 py-0.5 rounded-full shrink-0 " + u.cls}>{u.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              <AlertTriangle size={15} className="text-slate-400" /> Licence koje ističu
            </h3>
            <button onClick={() => setTab("kupci")} className="text-xs text-teal-600 font-medium hover:underline flex items-center gap-0.5">
              Svi kupci <ChevronRight size={13} />
            </button>
          </div>
          {isticuLicence.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">Nema licenci koje ističu u narednih 30 dana.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {isticuLicence.slice(0, 6).map((k) => {
                const s = licenseStatus(k.end_date);
                return (
                  <li key={k.id} className="py-2.5 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-700 truncate">
                        <span className="font-medium">{k.naziv_firme}</span> — {k.naziv_proizvoda}
                      </p>
                      <p className="text-xs text-slate-400">
                        {k.grad} · ističe {fmtDate(k.end_date)}
                      </p>
                    </div>
                    <span className={"text-xs px-2 py-0.5 rounded-full shrink-0 " + s.cls}>{s.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 mt-4">
        <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-1.5">
          <Wrench size={15} className="text-slate-400" /> Posljednja tehnička podrška
        </h3>
        {podrska.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">Još nema unesenih intervencija podrške.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {[...podrska].sort((a, b) => new Date(b.datum) - new Date(a.datum)).slice(0, 5).map((s) => (
              <li key={s.id} className="py-2.5 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-700 truncate">
                    <span className="font-medium">{s.firma}</span> — {s.opis}
                  </p>
                  <p className="text-xs text-slate-400">
                    {s.tehnicar} · {fmtDate(s.datum)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ====================================================================== */
/*  POTENCIJALI                                                            */
/* ====================================================================== */

function PotencijalForm({ initial, currentUser, onSave, onClose }) {
  const [f, setF] = useState(
    initial || {
      naziv_firme: "", grad: "", drzava: "", kontakt_osoba: "", telefon: "", email: "",
      kolega: currentUser || "", status: "Novi kontakt", napomena: "",
      podsjetnik_datum: "", podsjetnik_opis: "",
    }
  );
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async () => {
    if (!f.naziv_firme.trim() || !f.kolega || !currentUser) return;
    setBusy(true);
    try {
      const payload = { ...f, podsjetnik_datum: f.podsjetnik_datum || null, updated_by: currentUser, updated_at: new Date().toISOString() };
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
        <Field label="Kolega (vlasnik kontakta)" required>
          <select className={inputCls} value={f.kolega} onChange={set("kolega")}>
            <option value="">— odaberi —</option>
            {COLLEAGUE_NAMES.map((n) => <option key={n}>{n}</option>)}
          </select>
        </Field>
        <Field label="Grad"><input className={inputCls} value={f.grad || ""} onChange={set("grad")} /></Field>
        <Field label="Država"><input className={inputCls} value={f.drzava || ""} onChange={set("drzava")} /></Field>
        <Field label="Kontakt osoba"><input className={inputCls} value={f.kontakt_osoba || ""} onChange={set("kontakt_osoba")} /></Field>
        <Field label="Status">
          <select className={inputCls} value={f.status} onChange={set("status")}>
            {POTENCIJAL_STATUSI.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Telefon"><input className={inputCls} value={f.telefon || ""} onChange={set("telefon")} /></Field>
        <Field label="Email"><input className={inputCls} value={f.email || ""} onChange={set("email")} /></Field>
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
        <input className={inputCls + " bg-slate-50"} value={currentUser || "— odaberite se u vrhu stranice —"} disabled />
      </Field>
      <div className="flex justify-end gap-2 mt-2">
        <button className={btnSecondary} onClick={onClose}>Otkaži</button>
        <button className={btnPrimary} onClick={submit} disabled={!f.naziv_firme.trim() || !f.kolega || !currentUser || busy}>
          {busy ? "Čuvam..." : "Sačuvaj"}
        </button>
      </div>
    </Modal>
  );
}

export function PotencijaliTab({ data, currentUser, onAdd, onUpdate, onDelete, onBulkImport }) {
  const [q, setQ] = useState("");
  const [fKolega, setFKolega] = useState("Svi");
  const [fStatus, setFStatus] = useState("Svi");
  const [editing, setEditing] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const filtered = data.filter((p) => {
    if (fKolega !== "Svi" && p.kolega !== fKolega) return false;
    if (fStatus !== "Svi" && p.status !== fStatus) return false;
    if (q && !((p.naziv_firme || "") + (p.grad || "") + (p.kontakt_osoba || "")).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const handleSave = async (payload) => {
    if (editing) await onUpdate(editing.id, payload);
    else await onAdd(payload);
  };

  return (
    <div>
      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="Pretraži po firmi, gradu, kontaktu..." />
        <select className={inputCls + " w-auto"} value={fKolega} onChange={(e) => setFKolega(e.target.value)}>
          <option>Svi</option>
          {COLLEAGUE_NAMES.map((n) => <option key={n}>{n}</option>)}
        </select>
        <select className={inputCls + " w-auto"} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option>Svi</option>
          {POTENCIJAL_STATUSI.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className={btnSecondary} onClick={() => setShowImport(true)}><Upload size={15} /> Uvezi</button>
        <button className={btnPrimary} onClick={() => setShowNew(true)} disabled={!currentUser}><Plus size={15} /> Dodaj potencijala</button>
      </Toolbar>

      {filtered.length === 0 ? (
        <EmptyState icon={Target} title="Nema unesenih potencijala" subtitle="Dodaj ručno ili uvezi postojeću bazu potencijala iz Excela."
          action={<button className={btnPrimary} onClick={() => setShowNew(true)} disabled={!currentUser}><Plus size={15} /> Dodaj prvi potencijal</button>} />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((p) => (
            <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-slate-900">{p.naziv_firme}</h4>
                    <span className={"text-xs px-2 py-0.5 rounded-full " + (STATUS_BOJE[p.status] || "bg-slate-100 text-slate-600")}>{p.status}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mt-1.5">
                    {(p.grad || p.drzava) && <span className="flex items-center gap-1"><MapPin size={12} /> {[p.grad, p.drzava].filter(Boolean).join(", ")}</span>}
                    {p.kontakt_osoba && <span className="flex items-center gap-1"><User size={12} /> {p.kontakt_osoba}</span>}
                    {p.telefon && <span className="flex items-center gap-1"><Phone size={12} /> {p.telefon}</span>}
                    {p.email && <span className="flex items-center gap-1"><Mail size={12} /> {p.email}</span>}
                    <span className="flex items-center gap-1 font-medium text-slate-600"><User size={12} /> {p.kolega}</span>
                  </div>
                  {p.napomena && <p className="text-sm text-slate-600 mt-2">{p.napomena}</p>}
                  {p.podsjetnik_datum && (
                    <div className="mt-2 inline-flex items-center gap-1.5">
                      <span className={"text-xs px-2 py-0.5 rounded-full flex items-center gap-1 " + reminderUrgency(p.podsjetnik_datum).cls}>
                        <Bell size={11} /> {fmtDate(p.podsjetnik_datum)} {p.podsjetnik_opis ? `— ${p.podsjetnik_opis}` : ""}
                      </span>
                    </div>
                  )}
                  <MetaLine record={p} />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button className={btnGhostIcon} onClick={() => setEditing(p)} title="Uredi"><Pencil size={15} /></button>
                  <ConfirmDelete label={p.naziv_firme} onConfirm={() => onDelete(p.id)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showNew || editing) && (
        <PotencijalForm initial={editing} currentUser={currentUser} onSave={handleSave}
          onClose={() => { setShowNew(false); setEditing(null); }} />
      )}

      {showImport && (
        <ImportModal
          title="Uvezi bazu potencijala"
          columns={["Naziv firme", "Grad", "Država", "Kontakt osoba", "Telefon", "Email", "Kolega", "Status", "Napomena"]}
          onClose={() => setShowImport(false)}
          onImport={async (rows) => {
            const novi = rows.map((r) => ({
              naziv_firme: r[0] || "", grad: r[1] || "", drzava: r[2] || "", kontakt_osoba: r[3] || "",
              telefon: r[4] || "", email: r[5] || "",
              kolega: COLLEAGUE_NAMES.includes(r[6]) ? r[6] : currentUser || "",
              status: POTENCIJAL_STATUSI.includes(r[7]) ? r[7] : "Novi kontakt",
              napomena: r[8] || "", podsjetnik_datum: null, podsjetnik_opis: "",
              created_by: currentUser || "Uvoz", created_at: new Date().toISOString(),
              updated_by: currentUser || "Uvoz", updated_at: new Date().toISOString(),
            }));
            await onBulkImport(novi);
          }}
        />
      )}
    </div>
  );
}

/* ====================================================================== */
/*  LIDOVI                                                                  */
/* ====================================================================== */

function LeadForm({ initial, currentUser, onSave, onClose }) {
  const [f, setF] = useState(
    initial || {
      naziv_firme: "", grad: "", drzava: "", kontakt_osoba: "", telefon: "", email: "",
      izvor: "", kolega: currentUser || "", status: "Novi", napomena: "",
      podsjetnik_datum: "", podsjetnik_opis: "",
    }
  );
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async () => {
    if (!f.naziv_firme.trim() || !f.kolega || !currentUser) return;
    setBusy(true);
    try {
      const payload = { ...f, podsjetnik_datum: f.podsjetnik_datum || null, updated_by: currentUser, updated_at: new Date().toISOString() };
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
    <Modal title={initial ? "Uredi lead" : "Novi lead"} onClose={onClose} wide>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label="Naziv firme" required><input className={inputCls} value={f.naziv_firme} onChange={set("naziv_firme")} /></Field>
        <Field label="Kolega" required>
          <select className={inputCls} value={f.kolega} onChange={set("kolega")}>
            <option value="">— odaberi —</option>
            {COLLEAGUE_NAMES.map((n) => <option key={n}>{n}</option>)}
          </select>
        </Field>
        <Field label="Grad"><input className={inputCls} value={f.grad || ""} onChange={set("grad")} /></Field>
        <Field label="Država"><input className={inputCls} value={f.drzava || ""} onChange={set("drzava")} /></Field>
        <Field label="Kontakt osoba"><input className={inputCls} value={f.kontakt_osoba || ""} onChange={set("kontakt_osoba")} /></Field>
        <Field label="Izvor leada" hint="npr. web forma, sajam, preporuka..."><input className={inputCls} value={f.izvor || ""} onChange={set("izvor")} /></Field>
        <Field label="Telefon"><input className={inputCls} value={f.telefon || ""} onChange={set("telefon")} /></Field>
        <Field label="Email"><input className={inputCls} value={f.email || ""} onChange={set("email")} /></Field>
        <Field label="Status">
          <select className={inputCls} value={f.status} onChange={set("status")}>
            {LEAD_STATUSI.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Napomena"><textarea className={inputCls} rows={3} value={f.napomena || ""} onChange={set("napomena")} /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label="Podsjetnik — datum"><input type="date" className={inputCls} value={f.podsjetnik_datum || ""} onChange={set("podsjetnik_datum")} /></Field>
        <Field label="Podsjetnik — opis"><input className={inputCls} placeholder="npr. poziv, sastanak..." value={f.podsjetnik_opis || ""} onChange={set("podsjetnik_opis")} /></Field>
      </div>
      <div className="flex justify-end gap-2 mt-2">
        <button className={btnSecondary} onClick={onClose}>Otkaži</button>
        <button className={btnPrimary} onClick={submit} disabled={!f.naziv_firme.trim() || !f.kolega || !currentUser || busy}>
          {busy ? "Čuvam..." : "Sačuvaj"}
        </button>
      </div>
    </Modal>
  );
}

export function LidoviTab({ data, currentUser, onAdd, onUpdate, onDelete, onBulkImport, onConvert }) {
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("Svi");
  const [editing, setEditing] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const filtered = data.filter((l) => {
    if (fStatus !== "Svi" && l.status !== fStatus) return false;
    if (q && !((l.naziv_firme || "") + (l.grad || "") + (l.kontakt_osoba || "")).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const handleSave = async (payload) => {
    if (editing) await onUpdate(editing.id, payload);
    else await onAdd(payload);
  };

  return (
    <div>
      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="Pretraži po firmi, gradu, kontaktu..." />
        <select className={inputCls + " w-auto"} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option>Svi</option>
          {LEAD_STATUSI.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className={btnSecondary} onClick={() => setShowImport(true)}><Upload size={15} /> Uvezi</button>
        <button className={btnPrimary} onClick={() => setShowNew(true)} disabled={!currentUser}><Plus size={15} /> Dodaj lead</button>
      </Toolbar>

      {filtered.length === 0 ? (
        <EmptyState icon={TrendingUp} title="Nema unesenih lidova" subtitle="Dodaj ručno ili uvezi generisanu bazu lidova."
          action={<button className={btnPrimary} onClick={() => setShowNew(true)} disabled={!currentUser}><Plus size={15} /> Dodaj prvi lead</button>} />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((l) => (
            <div key={l.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-slate-900">{l.naziv_firme}</h4>
                    <span className={"text-xs px-2 py-0.5 rounded-full " + (STATUS_BOJE[l.status] || "bg-slate-100 text-slate-600")}>{l.status}</span>
                    {l.izvor && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200">{l.izvor}</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mt-1.5">
                    {(l.grad || l.drzava) && <span className="flex items-center gap-1"><MapPin size={12} /> {[l.grad, l.drzava].filter(Boolean).join(", ")}</span>}
                    {l.kontakt_osoba && <span className="flex items-center gap-1"><User size={12} /> {l.kontakt_osoba}</span>}
                    {l.telefon && <span className="flex items-center gap-1"><Phone size={12} /> {l.telefon}</span>}
                    <span className="flex items-center gap-1 font-medium text-slate-600"><User size={12} /> {l.kolega}</span>
                  </div>
                  {l.napomena && <p className="text-sm text-slate-600 mt-2">{l.napomena}</p>}
                  {l.podsjetnik_datum && (
                    <div className="mt-2 inline-flex items-center gap-1.5">
                      <span className={"text-xs px-2 py-0.5 rounded-full flex items-center gap-1 " + reminderUrgency(l.podsjetnik_datum).cls}>
                        <Bell size={11} /> {fmtDate(l.podsjetnik_datum)} {l.podsjetnik_opis ? `— ${l.podsjetnik_opis}` : ""}
                      </span>
                    </div>
                  )}
                  <MetaLine record={l} />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {l.status !== "Konvertovan" && (
                    <button className={btnGhostIcon} title="Konvertuj u potencijal" onClick={() => onConvert(l)} disabled={!currentUser}>
                      <ArrowRightCircle size={16} className="text-teal-600" />
                    </button>
                  )}
                  <button className={btnGhostIcon} onClick={() => setEditing(l)} title="Uredi"><Pencil size={15} /></button>
                  <ConfirmDelete label={l.naziv_firme} onConfirm={() => onDelete(l.id)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showNew || editing) && (
        <LeadForm initial={editing} currentUser={currentUser} onSave={handleSave}
          onClose={() => { setShowNew(false); setEditing(null); }} />
      )}

      {showImport && (
        <ImportModal
          title="Uvezi bazu lidova"
          columns={["Naziv firme", "Grad", "Država", "Kontakt osoba", "Telefon", "Email", "Izvor", "Kolega", "Status"]}
          onClose={() => setShowImport(false)}
          onImport={async (rows) => {
            const novi = rows.map((r) => ({
              naziv_firme: r[0] || "", grad: r[1] || "", drzava: r[2] || "", kontakt_osoba: r[3] || "",
              telefon: r[4] || "", email: r[5] || "", izvor: r[6] || "",
              kolega: COLLEAGUE_NAMES.includes(r[7]) ? r[7] : currentUser || "",
              status: LEAD_STATUSI.includes(r[8]) ? r[8] : "Novi",
              napomena: "", podsjetnik_datum: null, podsjetnik_opis: "",
              created_by: currentUser || "Uvoz", created_at: new Date().toISOString(),
              updated_by: currentUser || "Uvoz", updated_at: new Date().toISOString(),
            }));
            await onBulkImport(novi);
          }}
        />
      )}
    </div>
  );
}

/* ====================================================================== */
/*  KUPCI                                                                   */
/* ====================================================================== */

function KupacForm({ initial, currentUser, onSave, onClose }) {
  const [f, setF] = useState(
    initial || {
      naziv_firme: "", grad: "", drzava: "", serijski_broj: "", broj_licenci: "",
      naziv_proizvoda: "", start_date: "", end_date: "", napomena: "",
    }
  );
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async () => {
    if (!f.naziv_firme.trim() || !currentUser) return;
    setBusy(true);
    try {
      const payload = {
        ...f,
        broj_licenci: f.broj_licenci === "" ? null : Number(f.broj_licenci),
        start_date: f.start_date || null,
        end_date: f.end_date || null,
        updated_by: currentUser, updated_at: new Date().toISOString(),
      };
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
    <Modal title={initial ? "Uredi kupca" : "Novi kupac"} onClose={onClose} wide>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label="Naziv firme" required><input className={inputCls} value={f.naziv_firme} onChange={set("naziv_firme")} /></Field>
        <Field label="Naziv proizvoda" hint="npr. SolidWorks Standard"><input className={inputCls} value={f.naziv_proizvoda || ""} onChange={set("naziv_proizvoda")} /></Field>
        <Field label="Grad"><input className={inputCls} value={f.grad || ""} onChange={set("grad")} /></Field>
        <Field label="Država"><input className={inputCls} value={f.drzava || ""} onChange={set("drzava")} /></Field>
        <Field label="Serijski broj licence"><input className={inputCls} value={f.serijski_broj || ""} onChange={set("serijski_broj")} /></Field>
        <Field label="Broj licenci"><input type="number" min="0" className={inputCls} value={f.broj_licenci ?? ""} onChange={set("broj_licenci")} /></Field>
        <Field label="Start subscription date"><input type="date" className={inputCls} value={f.start_date || ""} onChange={set("start_date")} /></Field>
        <Field label="End subscription date"><input type="date" className={inputCls} value={f.end_date || ""} onChange={set("end_date")} /></Field>
      </div>
      <Field label="Napomena"><textarea className={inputCls} rows={3} value={f.napomena || ""} onChange={set("napomena")} /></Field>
      <div className="flex justify-end gap-2 mt-2">
        <button className={btnSecondary} onClick={onClose}>Otkaži</button>
        <button className={btnPrimary} onClick={submit} disabled={!f.naziv_firme.trim() || !currentUser || busy}>
          {busy ? "Čuvam..." : "Sačuvaj"}
        </button>
      </div>
    </Modal>
  );
}

export function KupciTab({ data, currentUser, onAdd, onUpdate, onDelete, onBulkImportKupci }) {
  const [q, setQ] = useState("");
  const [fLicenca, setFLicenca] = useState("Sve");
  const [editing, setEditing] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const filtered = data
    .filter((k) => {
      if (q && !((k.naziv_firme || "") + (k.grad || "") + (k.naziv_proizvoda || "") + (k.serijski_broj || "")).toLowerCase().includes(q.toLowerCase())) return false;
      if (fLicenca !== "Sve") {
        const s = licenseStatus(k.end_date).label;
        if (s !== fLicenca) return false;
      }
      return true;
    })
    .sort((a, b) => (a.end_date || "9999").localeCompare(b.end_date || "9999"));

  const handleSave = async (payload) => {
    if (editing) await onUpdate(editing.id, payload);
    else await onAdd(payload);
  };

  return (
    <div>
      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="Pretraži po firmi, gradu, proizvodu, serijskom broju..." />
        <select className={inputCls + " w-auto"} value={fLicenca} onChange={(e) => setFLicenca(e.target.value)}>
          <option>Sve</option><option>Aktivno</option><option>Ističe uskoro</option><option>Isteklo</option>
        </select>
        <button className={btnSecondary} onClick={() => setShowImport(true)}><Upload size={15} /> Uvezi / mjesečno ažuriranje</button>
        <button className={btnPrimary} onClick={() => setShowNew(true)} disabled={!currentUser}><Plus size={15} /> Dodaj kupca</button>
      </Toolbar>

      {filtered.length === 0 ? (
        <EmptyState icon={Building2} title="Nema unesenih kupaca" subtitle="Dodaj ručno ili uvezi tabelu postojećih kupaca i licenci."
          action={<button className={btnPrimary} onClick={() => setShowNew(true)} disabled={!currentUser}><Plus size={15} /> Dodaj prvog kupca</button>} />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-200">
                  <th className="px-4 py-2.5">Firma</th>
                  <th className="px-4 py-2.5">Grad / Država</th>
                  <th className="px-4 py-2.5">Proizvod</th>
                  <th className="px-4 py-2.5">Serijski broj</th>
                  <th className="px-4 py-2.5 text-center">Broj licenci</th>
                  <th className="px-4 py-2.5">Start</th>
                  <th className="px-4 py-2.5">Ističe</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((k) => {
                  const s = licenseStatus(k.end_date);
                  return (
                    <tr key={k.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 font-medium text-slate-800">
                        {k.naziv_firme}
                        <div className="text-xs text-slate-400 font-normal"><MetaLine record={k} /></div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{[k.grad, k.drzava].filter(Boolean).join(", ") || "—"}</td>
                      <td className="px-4 py-2.5 text-slate-600">{k.naziv_proizvoda || "—"}</td>
                      <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{k.serijski_broj || "—"}</td>
                      <td className="px-4 py-2.5 text-center text-slate-600">{k.broj_licenci ?? "—"}</td>
                      <td className="px-4 py-2.5 text-slate-500">{fmtDate(k.start_date)}</td>
                      <td className="px-4 py-2.5 text-slate-500">{fmtDate(k.end_date)}</td>
                      <td className="px-4 py-2.5"><span className={"text-xs px-2 py-0.5 rounded-full whitespace-nowrap " + s.cls}>{s.label}</span></td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1 justify-end">
                          <button className={btnGhostIcon} onClick={() => setEditing(k)} title="Uredi"><Pencil size={14} /></button>
                          <ConfirmDelete label={k.naziv_firme} onConfirm={() => onDelete(k.id)} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(showNew || editing) && (
        <KupacForm initial={editing} currentUser={currentUser} onSave={handleSave}
          onClose={() => { setShowNew(false); setEditing(null); }} />
      )}

      {showImport && (
        <ImportModal
          title="Uvezi / ažuriraj kupce"
          columns={["Naziv firme", "Grad", "Država", "Serijski broj", "Broj licenci", "Naziv proizvoda", "Start datum (GGGG-MM-DD)", "End datum (GGGG-MM-DD)", "Napomena"]}
          onClose={() => setShowImport(false)}
          onImport={async (rows) => {
            const parsed = rows.map((r) => ({
              naziv_firme: r[0] || "", grad: r[1] || "", drzava: r[2] || "",
              serijski_broj: r[3] || "", broj_licenci: r[4] ? Number(r[4]) : null,
              naziv_proizvoda: r[5] || "", start_date: r[6] || null, end_date: r[7] || null,
              napomena: r[8] || "",
            }));
            await onBulkImportKupci(parsed);
          }}
        />
      )}
    </div>
  );
}

/* ====================================================================== */
/*  TEHNIČKA PODRŠKA                                                        */
/* ====================================================================== */

function PodrskaForm({ initial, currentUser, kupci, onSave, onClose }) {
  const [f, setF] = useState(
    initial || {
      firma: "", tehnicar: SORTED_FOR_TECH.includes(currentUser) ? currentUser : "",
      datum: todayStr(), opis: "", napomena: "",
    }
  );
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async () => {
    if (!f.firma.trim() || !f.tehnicar || !f.opis.trim() || !currentUser) return;
    setBusy(true);
    try {
      const payload = { ...f, updated_by: currentUser, updated_at: new Date().toISOString() };
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
    <Modal title={initial ? "Uredi zapis podrške" : "Nova intervencija podrške"} onClose={onClose} wide>
      <datalist id="firme-list">
        {kupci.map((k) => <option key={k.id} value={k.naziv_firme} />)}
      </datalist>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label="Firma" required>
          <input list="firme-list" className={inputCls} value={f.firma} onChange={set("firma")} placeholder="Odaberi ili upiši naziv" />
        </Field>
        <Field label="Tehničar" required hint="Odabir imena kolege">
          <select className={inputCls} value={f.tehnicar} onChange={set("tehnicar")}>
            <option value="">— odaberi —</option>
            {SORTED_FOR_TECH.map((n) => <option key={n}>{n}</option>)}
          </select>
        </Field>
        <Field label="Datum" required><input type="date" className={inputCls} value={f.datum} onChange={set("datum")} /></Field>
      </div>
      <Field label="Opis intervencije" required>
        <textarea className={inputCls} rows={3} value={f.opis} onChange={set("opis")} placeholder="Šta je urađeno, koji problem je riješen..." />
      </Field>
      <Field label="Napomena"><textarea className={inputCls} rows={2} value={f.napomena || ""} onChange={set("napomena")} /></Field>
      <div className="flex justify-end gap-2 mt-2">
        <button className={btnSecondary} onClick={onClose}>Otkaži</button>
        <button className={btnPrimary} onClick={submit} disabled={!f.firma.trim() || !f.tehnicar || !f.opis.trim() || !currentUser || busy}>
          {busy ? "Čuvam..." : "Sačuvaj"}
        </button>
      </div>
    </Modal>
  );
}

export function PodrskaTab({ data, kupci, currentUser, onAdd, onUpdate, onDelete }) {
  const [q, setQ] = useState("");
  const [fFirma, setFFirma] = useState("Sve");
  const [fTeh, setFTeh] = useState("Svi");
  const [editing, setEditing] = useState(null);
  const [showNew, setShowNew] = useState(false);

  const firme = useMemo(() => {
    const set = new Set([...kupci.map((k) => k.naziv_firme), ...data.map((d) => d.firma)]);
    return Array.from(set).filter(Boolean).sort();
  }, [kupci, data]);

  const filtered = [...data].sort((a, b) => new Date(b.datum) - new Date(a.datum)).filter((s) => {
    if (fFirma !== "Sve" && s.firma !== fFirma) return false;
    if (fTeh !== "Svi" && s.tehnicar !== fTeh) return false;
    if (q && !((s.firma || "") + (s.opis || "")).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const handleSave = async (payload) => {
    if (editing) await onUpdate(editing.id, payload);
    else await onAdd(payload);
  };

  return (
    <div>
      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="Pretraži po firmi ili opisu..." />
        <select className={inputCls + " w-auto"} value={fFirma} onChange={(e) => setFFirma(e.target.value)}>
          <option>Sve</option>
          {firme.map((f) => <option key={f}>{f}</option>)}
        </select>
        <select className={inputCls + " w-auto"} value={fTeh} onChange={(e) => setFTeh(e.target.value)}>
          <option>Svi</option>
          {SORTED_FOR_TECH.map((n) => <option key={n}>{n}</option>)}
        </select>
        <button className={btnPrimary} onClick={() => setShowNew(true)} disabled={!currentUser}><Plus size={15} /> Nova intervencija</button>
      </Toolbar>

      {filtered.length === 0 ? (
        <EmptyState icon={Wrench} title="Nema zapisa o tehničkoj podršci"
          subtitle="Svaki put kad tehničar odradi podršku za firmu, unosi zapis ovdje — tako se gradi historija po kupcu."
          action={<button className={btnPrimary} onClick={() => setShowNew(true)} disabled={!currentUser}><Plus size={15} /> Dodaj prvu intervenciju</button>} />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((s) => (
            <div key={s.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-slate-900">{s.firma}</h4>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex items-center gap-1"><Calendar size={11} /> {fmtDate(s.datum)}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 flex items-center gap-1"><Wrench size={11} /> {s.tehnicar}</span>
                  </div>
                  <p className="text-sm text-slate-700 mt-2">{s.opis}</p>
                  {s.napomena && <p className="text-sm text-slate-500 mt-1">{s.napomena}</p>}
                  <MetaLine record={s} />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button className={btnGhostIcon} onClick={() => setEditing(s)} title="Uredi"><Pencil size={15} /></button>
                  <ConfirmDelete label={"zapis"} onConfirm={() => onDelete(s.id)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showNew || editing) && (
        <PodrskaForm initial={editing} currentUser={currentUser} kupci={kupci} onSave={handleSave}
          onClose={() => { setShowNew(false); setEditing(null); }} />
      )}
    </div>
  );
}

/* ====================================================================== */
/*  PODSJETNICI                                                             */
/* ====================================================================== */

export function PodsjetniciTab({ potencijali, lidovi, onClear }) {
  const items = getReminders(potencijali, lidovi);
  return (
    <div>
      {items.length === 0 ? (
        <EmptyState icon={Bell} title="Nema aktivnih podsjetnika" subtitle="Podsjetnike dodaješ direktno na potencijalu ili leadu (poziv, sastanak, follow-up)." />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {items.map((r) => {
            const u = reminderUrgency(r.datum);
            return (
              <div key={r.tip + r.id} className="p-4 flex items-center gap-3">
                <span className={"w-2.5 h-2.5 rounded-full shrink-0 " + u.dotCls} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800">
                    <span className="font-semibold">{r.firma}</span>{" "}
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 ml-1">{r.tip}</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{r.opis || "Podsjetnik"} · zadužen: {r.kolega} · {fmtDate(r.datum)}</p>
                </div>
                <span className={"text-xs px-2 py-0.5 rounded-full shrink-0 " + u.cls}>{u.label}</span>
                <button className={btnGhostIcon} title="Označi kao obavljeno" onClick={() => onClear(r)}>
                  <CheckCircle2 size={17} className="text-green-600" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
