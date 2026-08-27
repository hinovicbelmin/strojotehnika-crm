"use client";
import { useState, useMemo } from "react";
import {
  Home, Target, TrendingUp, Building2, Wrench, Bell, Plus, Pencil,
  ArrowRightCircle, Phone, Mail, MapPin, Calendar, User, AlertTriangle,
  CheckCircle2, ChevronRight, ChevronLeft, Upload, ChevronUp, ChevronDown, ChevronsUpDown, Trash2, X, Download,
} from "lucide-react";
import {
  COLLEAGUE_NAMES, SORTED_FOR_TECH, POTENCIJAL_STATUSI, LEAD_STATUSI, STATUS_BOJE, EU_COUNTRIES,
  inputCls, btnPrimary, btnSecondary, btnGhostIcon,
  todayStr, fmtDate, licenseStatus, reminderUrgency, getReminders, daysDiff, parseDateFlexible,
} from "../lib/crm";
import { Modal, Field, EmptyState, Toolbar, SearchBox, MetaLine, ImportModal, ConfirmDelete, DangerConfirmModal } from "./ui";

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

  const normFirma = (name) => (name || "").trim().toLowerCase();
  const brojUnikatnihKupaca = new Set(kupci.map((k) => normFirma(k.naziv_firme)).filter(Boolean)).size;
  const brojUnikatnihKupacaSaIstekom = new Set(isticuLicence.map((k) => normFirma(k.naziv_firme)).filter(Boolean)).size;

  const ukupnoLidova = lidovi.length;
  const konvertovanoLidova = lidovi.filter((l) => l.status === "Konvertovan").length;
  const potencijaliIzLeada = potencijali.filter((p) => p.origin_lead_id);
  const dobijenoIzLeada = potencijaliIzLeada.filter((p) => p.status === "Dobijen").length;
  const izgubljenoIzLeada = potencijaliIzLeada.filter((p) => p.status === "Izgubljen").length;
  const stopaKonverzije = ukupnoLidova > 0 ? Math.round((konvertovanoLidova / ukupnoLidova) * 100) : 0;
  const stopaDobijanja = konvertovanoLidova > 0 ? Math.round((dobijenoIzLeada / konvertovanoLidova) * 100) : 0;

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard icon={Target} label="Otvoreni potencijali" value={otvoreniPotencijali} accent="bg-blue-50 text-blue-600" onClick={() => setTab("potencijali")} />
        <StatCard icon={TrendingUp} label="Aktivni lidovi" value={aktivniLidovi} accent="bg-violet-50 text-violet-600" onClick={() => setTab("lidovi")} />
        <StatCard icon={Building2} label="Kupci" value={brojUnikatnihKupaca} accent="bg-teal-50 text-teal-600" onClick={() => setTab("kupci")} />
        <StatCard icon={AlertTriangle} label="Licence ističu ≤30 dana" value={brojUnikatnihKupacaSaIstekom} accent="bg-amber-50 text-amber-600" onClick={() => setTab("kupci")} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
        <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-1.5">
          <TrendingUp size={15} className="text-slate-400" /> Konverzija lidova
        </h3>
        <div className="flex flex-col sm:flex-row items-stretch gap-3">
          <div className="flex-1 rounded-lg bg-slate-50 border border-slate-100 p-4 text-center">
            <div className="text-2xl font-bold text-slate-900">{ukupnoLidova}</div>
            <div className="text-xs text-slate-500 mt-0.5">Ukupno lidova</div>
          </div>
          <div className="flex items-center justify-center text-slate-300 sm:rotate-0 rotate-90">
            <ChevronRight size={20} />
          </div>
          <div className="flex-1 rounded-lg bg-violet-50 border border-violet-100 p-4 text-center">
            <div className="text-2xl font-bold text-violet-700">{konvertovanoLidova}</div>
            <div className="text-xs text-violet-600 mt-0.5">Konvertovano u potencijal {ukupnoLidova > 0 && `(${stopaKonverzije}%)`}</div>
          </div>
          <div className="flex items-center justify-center text-slate-300 sm:rotate-0 rotate-90">
            <ChevronRight size={20} />
          </div>
          <div className="flex-1 rounded-lg bg-green-50 border border-green-100 p-4 text-center">
            <div className="text-2xl font-bold text-green-700">{dobijenoIzLeada}</div>
            <div className="text-xs text-green-600 mt-0.5">Postalo kupac {konvertovanoLidova > 0 && `(${stopaDobijanja}%)`}</div>
          </div>
        </div>
        {izgubljenoIzLeada > 0 && (
          <p className="text-xs text-slate-400 mt-3">
            Od konvertovanih, {izgubljenoIzLeada} {izgubljenoIzLeada === 1 ? "je označen" : "je označeno"} kao izgubljeno, ostalo je još u toku.
          </p>
        )}
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

function CountrySelect({ value, onChange }) {
  const options = value && !EU_COUNTRIES.includes(value) ? [value, ...EU_COUNTRIES] : EU_COUNTRIES;
  return (
    <select className={inputCls} value={value || ""} onChange={onChange}>
      <option value="">— odaberi državu —</option>
      {options.map((c) => <option key={c}>{c}</option>)}
    </select>
  );
}

function PotencijalForm({ initial, currentUser, onSave, onClose }) {
  const [f, setF] = useState(
    initial || {
      naziv_firme: "", grad: "", drzava: "", djelatnost: "", kontakt_osoba: "", telefon: "", email: "",
      kolega: currentUser || "", status: "Novi kontakt", napomena: "",
      podsjetnik_datum: "", podsjetnik_opis: "", dodatni_kontakti: [],
    }
  );
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const dodatniKontakti = f.dodatni_kontakti || [];
  const addKontakt = () => setF({ ...f, dodatni_kontakti: [...dodatniKontakti, { ime: "", telefon: "", email: "", napomena: "" }] });
  const updateKontakt = (idx, key, val) => {
    const arr = dodatniKontakti.map((k, i) => (i === idx ? { ...k, [key]: val } : k));
    setF({ ...f, dodatni_kontakti: arr });
  };
  const removeKontakt = (idx) => setF({ ...f, dodatni_kontakti: dodatniKontakti.filter((_, i) => i !== idx) });

  const submit = async () => {
    if (!f.naziv_firme.trim() || !f.kolega || !currentUser) return;
    setBusy(true);
    try {
      const payload = {
        ...f,
        podsjetnik_datum: f.podsjetnik_datum || null,
        dodatni_kontakti: dodatniKontakti.filter((k) => (k.ime || "").trim() || (k.telefon || "").trim() || (k.email || "").trim()),
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
        <Field label="Država"><CountrySelect value={f.drzava} onChange={set("drzava")} /></Field>
        <Field label="Djelatnost" hint="npr. metalna industrija, IT usluge..."><input className={inputCls} value={f.djelatnost || ""} onChange={set("djelatnost")} /></Field>
        <Field label="Status">
          <select className={inputCls} value={f.status} onChange={set("status")}>
            {POTENCIJAL_STATUSI.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Kontakt osoba" hint="Glavni kontakt"><input className={inputCls} value={f.kontakt_osoba || ""} onChange={set("kontakt_osoba")} /></Field>
        <Field label="Telefon"><input className={inputCls} value={f.telefon || ""} onChange={set("telefon")} /></Field>
        <Field label="Email"><input className={inputCls} value={f.email || ""} onChange={set("email")} /></Field>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Dodatni kontakti</span>
          <button type="button" onClick={addKontakt} className="text-xs text-teal-600 font-medium hover:underline flex items-center gap-1">
            <Plus size={13} /> Dodaj kontakt
          </button>
        </div>
        {dodatniKontakti.length === 0 ? (
          <p className="text-xs text-slate-400">Nema dodatnih kontakata — koristi ovo ako firma ima više osoba za kontakt.</p>
        ) : (
          <div className="space-y-2">
            {dodatniKontakti.map((k, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-start bg-slate-50 border border-slate-100 rounded-lg p-2.5">
                <input className={inputCls} placeholder="Ime i prezime" value={k.ime || ""} onChange={(e) => updateKontakt(idx, "ime", e.target.value)} />
                <input className={inputCls} placeholder="Telefon" value={k.telefon || ""} onChange={(e) => updateKontakt(idx, "telefon", e.target.value)} />
                <input className={inputCls} placeholder="Email" value={k.email || ""} onChange={(e) => updateKontakt(idx, "email", e.target.value)} />
                <button type="button" onClick={() => removeKontakt(idx)} className={btnGhostIcon} title="Ukloni kontakt">
                  <X size={15} />
                </button>
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
  const [fKolega, setFKolega] = useState("Sve kolege");
  const [fStatus, setFStatus] = useState("Svi statusi");
  const [fDrzava, setFDrzava] = useState("Sve države");
  const [editing, setEditing] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const filtered = data.filter((p) => {
    if (fKolega !== "Sve kolege" && p.kolega !== fKolega) return false;
    if (fStatus !== "Svi statusi" && p.status !== fStatus) return false;
    if (fDrzava !== "Sve države" && p.drzava !== fDrzava) return false;
    if (q && !((p.naziv_firme || "") + (p.kontakt_osoba || "") + (p.djelatnost || "") + (p.grad || "")).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const handleSave = async (payload) => {
    if (editing) await onUpdate(editing.id, payload);
    else await onAdd(payload);
  };

  const exportCSV = () => {
    const headers = [
      "Naziv firme", "Grad", "Država", "Djelatnost", "Kontakt osoba", "Telefon", "Email",
      "Kolega", "Status", "Napomena", "Podsjetnik datum", "Podsjetnik opis",
      "Kreirao", "Datum kreiranja", "Zadnja izmjena od", "Datum zadnje izmjene",
    ];
    const esc = (val) => {
      const s = val == null ? "" : String(val);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const rows = filtered.map((p) =>
      [
        p.naziv_firme, p.grad, p.drzava, p.djelatnost, p.kontakt_osoba, p.telefon, p.email,
        p.kolega, p.status, p.napomena, p.podsjetnik_datum, p.podsjetnik_opis,
        p.created_by, p.created_at, p.updated_by, p.updated_at,
      ].map(esc).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `potencijali_${todayStr()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="w-96 max-w-full">
          <SearchBox value={q} onChange={setQ} placeholder="Pretraži po firmi, kontaktu, djelatnosti..." />
        </div>
        <select className={inputCls + " w-28 shrink-0"} value={fKolega} onChange={(e) => setFKolega(e.target.value)}>
          <option>Sve kolege</option>
          {COLLEAGUE_NAMES.map((n) => <option key={n}>{n}</option>)}
        </select>
        <select className={inputCls + " w-28 shrink-0"} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option>Svi statusi</option>
          {POTENCIJAL_STATUSI.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className={inputCls + " w-28 shrink-0"} value={fDrzava} onChange={(e) => setFDrzava(e.target.value)}>
          <option>Sve države</option>
          {EU_COUNTRIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button className={btnSecondary + " shrink-0"} onClick={exportCSV}>
          <Download size={15} /> Izvoz CSV
        </button>
      </div>
      <Toolbar>
        <button className={btnSecondary} onClick={() => setShowImport(true)}><Upload size={15} /> Uvezi</button>
        <button className={btnPrimary} onClick={() => setShowNew(true)} disabled={!currentUser}><Plus size={15} /> Dodaj potencijala</button>
      </Toolbar>

      {filtered.length === 0 ? (
        <EmptyState icon={Target} title="Nema unesenih potencijala" subtitle="Dodaj ručno ili uvezi postojeću bazu potencijala iz Excela."
          action={<button className={btnPrimary} onClick={() => setShowNew(true)} disabled={!currentUser}><Plus size={15} /> Dodaj prvi potencijal</button>} />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-200">
                  <th className="px-4 py-2.5">Firma</th>
                  <th className="px-4 py-2.5">Grad</th>
                  <th className="px-4 py-2.5">Država</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Kolega</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 cursor-pointer" onClick={() => setEditing(p)}>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{p.naziv_firme}</td>
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{p.grad || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{p.drzava || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={"text-xs px-2 py-0.5 rounded-full whitespace-nowrap " + (STATUS_BOJE[p.status] || "bg-slate-100 text-slate-600")}>{p.status}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{p.kolega || "—"}</td>
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
        <Field label="Država"><CountrySelect value={f.drzava} onChange={set("drzava")} /></Field>
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
      naziv_firme: "", grad: "", drzava: "", adresa: "", postanski_broj: "",
      serijski_broj: "", broj_licenci: "",
      naziv_proizvoda: "", naziv_proizvoda_2: "", revenue_type: "", izvorni_status: "",
      start_date: "", end_date: "", napomena: "",
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
        <Field label="Naziv proizvoda 2" hint="ako firma ima i drugi proizvod/paket"><input className={inputCls} value={f.naziv_proizvoda_2 || ""} onChange={set("naziv_proizvoda_2")} /></Field>
        <Field label="Grad"><input className={inputCls} value={f.grad || ""} onChange={set("grad")} /></Field>
        <Field label="Država"><input className={inputCls} value={f.drzava || ""} onChange={set("drzava")} /></Field>
        <Field label="Adresa"><input className={inputCls} value={f.adresa || ""} onChange={set("adresa")} /></Field>
        <Field label="Poštanski broj"><input className={inputCls} value={f.postanski_broj || ""} onChange={set("postanski_broj")} /></Field>
        <Field label="Serijski broj licence"><input className={inputCls} value={f.serijski_broj || ""} onChange={set("serijski_broj")} /></Field>
        <Field label="Broj licenci"><input type="number" min="0" className={inputCls} value={f.broj_licenci ?? ""} onChange={set("broj_licenci")} /></Field>
        <Field label="Revenue Type"><input className={inputCls} value={f.revenue_type || ""} onChange={set("revenue_type")} /></Field>
        <Field label="Status (izvorni, iz tabele)"><input className={inputCls} value={f.izvorni_status || ""} onChange={set("izvorni_status")} /></Field>
        <Field label="Start subscription date"><input type="date" className={inputCls} value={f.start_date || ""} onChange={set("start_date")} /></Field>
        <Field label="End subscription date (Support End Date)"><input type="date" className={inputCls} value={f.end_date || ""} onChange={set("end_date")} /></Field>
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

function SortableHeader({ label, field, sortField, sortDir, onSort, align }) {
  const active = sortField === field;
  return (
    <th
      className={"px-4 py-2.5 cursor-pointer select-none hover:text-slate-800 " + (align === "center" ? "text-center" : "")}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (sortDir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : <ChevronsUpDown size={12} className="text-slate-300" />}
      </span>
    </th>
  );
}

function Pagination({ page, setPage, pageSize, setPageSize, total }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const from = total === 0 ? 0 : (clampedPage - 1) * pageSize + 1;
  const to = Math.min(clampedPage * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/50">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span>Prikaz po strani:</span>
        <select
          className="text-sm rounded-lg border border-slate-300 px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
        >
          {[25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <span>{total === 0 ? "0 rezultata" : `${from}–${to} od ${total}`}</span>
        <div className="flex items-center gap-1">
          <button className={btnGhostIcon} disabled={clampedPage <= 1} onClick={() => setPage(clampedPage - 1)}>
            <ChevronLeft size={16} />
          </button>
          <span className="px-2">Strana {clampedPage} / {totalPages}</span>
          <button className={btnGhostIcon} disabled={clampedPage >= totalPages} onClick={() => setPage(clampedPage + 1)}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function KupciTab({ data, currentUser, onAdd, onUpdate, onDelete, onBulkImportKupci, onDeleteAll }) {
  const [q, setQ] = useState("");
  const [fLicenca, setFLicenca] = useState("Sve");
  const [editing, setEditing] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [sortField, setSortField] = useState("naziv_firme");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const handleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
    setPage(1);
  };

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return data.filter((k) => {
      if (query) {
        const haystack = [k.naziv_firme, k.grad, k.drzava, k.naziv_proizvoda, k.naziv_proizvoda_2, k.serijski_broj, k.adresa]
          .filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (fLicenca !== "Sve" && licenseStatus(k.end_date).label !== fLicenca) return false;
      return true;
    });
  }, [data, q, fLicenca]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let va = a[sortField], vb = b[sortField];
      if (sortField === "broj_licenci") { va = Number(va) || 0; vb = Number(vb) || 0; return (va - vb) * dir; }
      va = (va || "").toString().toLowerCase();
      vb = (vb || "").toString().toLowerCase();
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageData = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSave = async (payload) => {
    if (editing) await onUpdate(editing.id, payload);
    else await onAdd(payload);
  };

  return (
    <div>
      <Toolbar>
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Pretraži po firmi, gradu, proizvodu, serijskom broju..." />
        <select className={inputCls + " w-auto"} value={fLicenca} onChange={(e) => { setFLicenca(e.target.value); setPage(1); }}>
          <option>Sve</option><option>Aktivno</option><option>Ističe uskoro</option><option>Isteklo</option>
        </select>
        <button className={btnSecondary} onClick={() => setShowImport(true)}><Upload size={15} /> Uvezi / mjesečno ažuriranje</button>
        <button
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          onClick={() => setShowDeleteAll(true)}
          disabled={data.length === 0}
        >
          <Trash2 size={15} /> Obriši sve kupce
        </button>
        <button className={btnPrimary} onClick={() => setShowNew(true)} disabled={!currentUser}><Plus size={15} /> Dodaj kupca</button>
      </Toolbar>

      {sorted.length === 0 ? (
        <EmptyState icon={Building2} title="Nema unesenih kupaca" subtitle="Dodaj ručno ili uvezi tabelu postojećih kupaca i licenci."
          action={<button className={btnPrimary} onClick={() => setShowNew(true)} disabled={!currentUser}><Plus size={15} /> Dodaj prvog kupca</button>} />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-200">
                  <SortableHeader label="Firma" field="naziv_firme" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Grad / Država" field="grad" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                  <th className="px-4 py-2.5">Adresa</th>
                  <SortableHeader label="Proizvod" field="naziv_proizvoda" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                  <th className="px-3 py-2.5 whitespace-nowrap">Serijski broj</th>
                  <SortableHeader label="Broj licenci" field="broj_licenci" sortField={sortField} sortDir={sortDir} onSort={handleSort} align="center" />
                  <SortableHeader label="Start" field="start_date" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Ističe" field="end_date" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageData.map((k) => {
                  const s = licenseStatus(k.end_date);
                  return (
                    <tr key={k.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 font-medium text-slate-800">
                        {k.naziv_firme}
                        <div className="text-xs text-slate-400 font-normal"><MetaLine record={k} /></div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {k.grad && <div>{k.grad}</div>}
                        {k.drzava && <div className="text-xs text-slate-400">{k.drzava}</div>}
                        {!k.grad && !k.drzava && "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">{[k.adresa, k.postanski_broj].filter(Boolean).join(", ") || "—"}</td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {k.naziv_proizvoda || "—"}
                        {k.naziv_proizvoda_2 && <div className="text-xs text-slate-400">{k.naziv_proizvoda_2}</div>}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 font-mono text-xs whitespace-nowrap">{k.serijski_broj || "—"}</td>
                      <td className="px-2 py-2.5 text-center text-slate-600 whitespace-nowrap">{k.broj_licenci ?? "—"}</td>
                      <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{fmtDate(k.start_date)}</td>
                      <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{fmtDate(k.end_date)}</td>
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
          <Pagination page={currentPage} setPage={setPage} pageSize={pageSize} setPageSize={setPageSize} total={sorted.length} />
        </div>
      )}

      {(showNew || editing) && (
        <KupacForm initial={editing} currentUser={currentUser} onSave={handleSave}
          onClose={() => { setShowNew(false); setEditing(null); }} />
      )}

      {showImport && (
        <ImportModal
          title="Uvezi / ažuriraj kupce (mjesečni export)"
          columns={[
            "Final customer name", "Serial number", "Product name", "Product name 2",
            "License Qty", "Revenue Type", "Status", "Start Date", "Support End Date",
            "City", "Address", "Postal Code", "Country",
          ]}
          onClose={() => setShowImport(false)}
          onImport={async (rows) => {
            const parsed = rows.map((r) => ({
              naziv_firme: r[0] || "",
              serijski_broj: r[1] || "",
              naziv_proizvoda: r[2] || "",
              naziv_proizvoda_2: r[3] || "",
              broj_licenci: r[4] ? Number(String(r[4]).replace(",", ".")) : null,
              revenue_type: r[5] || "",
              izvorni_status: r[6] || "",
              start_date: parseDateFlexible(r[7]),
              end_date: parseDateFlexible(r[8]),
              grad: r[9] || "",
              adresa: r[10] || "",
              postanski_broj: r[11] || "",
              drzava: r[12] || "",
              napomena: "",
            }));
            await onBulkImportKupci(parsed);
          }}
        />
      )}

      {showDeleteAll && (
        <DangerConfirmModal
          title="Obriši sve kupce"
          message={`Ovo će trajno obrisati svih ${data.length} zapisa iz sekcije Kupci i licence. Ova akcija se ne može poništiti.`}
          confirmWord="OBRIŠI"
          confirmLabel="Obriši sve kupce"
          onClose={() => setShowDeleteAll(false)}
          onConfirm={onDeleteAll}
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
  const uniqueFirme = useMemo(
    () => Array.from(new Set(kupci.map((k) => k.naziv_firme).filter(Boolean))).sort((a, b) => a.localeCompare(b, "hr")),
    [kupci]
  );
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
        {uniqueFirme.map((name) => <option key={name} value={name} />)}
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
  const [fKolega, setFKolega] = useState("Svi");
  const allItems = getReminders(potencijali, lidovi);
  const items = fKolega === "Svi" ? allItems : allItems.filter((r) => r.kolega === fKolega);

  return (
    <div>
      <Toolbar>
        <select className={inputCls + " w-auto"} value={fKolega} onChange={(e) => setFKolega(e.target.value)}>
          <option>Svi</option>
          {COLLEAGUE_NAMES.map((n) => <option key={n}>{n}</option>)}
        </select>
        {fKolega !== "Svi" && (
          <span className="text-sm text-slate-500">
            {items.length} {items.length === 1 ? "podsjetnik" : "podsjetnika"} za <span className="font-medium text-slate-700">{fKolega}</span>
          </span>
        )}
      </Toolbar>

      {items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={fKolega === "Svi" ? "Nema aktivnih podsjetnika" : `Nema podsjetnika za ${fKolega}`}
          subtitle="Podsjetnike dodaješ direktno na potencijalu ili leadu (poziv, sastanak, follow-up)."
        />
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
