"use client";
import { useState, useMemo } from "react";
import { Plus, Pencil, ChevronLeft, ChevronRight, TrendingUp, Target, Download, Copy, Link2, ExternalLink } from "lucide-react";
import {
  FORECAST_PRODAVACI, FORECAST_SOFTVERI, FORECAST_TIPOVI_LICENCE, POTENCIJAL_STATUSI, STATUS_BOJE, STATUS_WEIGHTS,
  inputCls, btnPrimary, btnSecondary, btnGhostIcon,
  currentMonthStr, fmtMonth, downloadCSV,
} from "../lib/crm";
import { Modal, Field, EmptyState, SearchBox, ConfirmDelete } from "./ui";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";

/* ---------------------------------------------------------------------- */
/*  FORMA ZA UNOS / UREĐIVANJE STAVKE                                     */
/* ---------------------------------------------------------------------- */

function ForecastForm({ initial, currentUser, defaultMjesec, potencijali, kupci, onSave, onClose }) {
  const [f, setF] = useState(
    initial || {
      mjesec: defaultMjesec,
      prodavac: "",
      kupac: "",
      softver: "",
      tip_licence: "",
      broj_licenci: "",
      status: "Novi kontakt",
      napomena: "",
    }
  );
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const uniqueFirme = useMemo(() => {
    const names = [
      ...potencijali.map((p) => p.naziv_firme),
      ...(kupci || []).map((k) => k.naziv_firme),
    ].filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, "hr"));
  }, [potencijali, kupci]);

  const submit = async () => {
    if (!f.mjesec || !f.kupac.trim() || !currentUser) return;
    setBusy(true);
    try {
      const matched = potencijali.find((p) => p.naziv_firme === f.kupac);
      const payload = {
        ...f,
        broj_licenci: f.broj_licenci === "" ? null : Number(f.broj_licenci),
        potencijal_id: matched ? matched.id : null,
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
    <Modal title={initial ? "Uredi stavku forecasta" : "Nova stavka forecasta"} onClose={onClose} wide>
      <datalist id="forecast-kupac-list">
        {uniqueFirme.map((name) => <option key={name} value={name} />)}
      </datalist>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label="Mjesec" required>
          <input type="month" className={inputCls} value={f.mjesec} onChange={set("mjesec")} />
        </Field>
        <Field label="Prodavač">
          <select className={inputCls} value={f.prodavac} onChange={set("prodavac")}>
            <option value="">— odaberi —</option>
            {FORECAST_PRODAVACI.map((n) => <option key={n}>{n}</option>)}
          </select>
        </Field>
        <Field label="Kupac" required hint="Odaberi iz baze potencijala/kupaca ili upiši novu firmu">
          <input list="forecast-kupac-list" className={inputCls} value={f.kupac} onChange={set("kupac")} placeholder="Odaberi ili upiši naziv firme" />
        </Field>
        <Field label="Softver">
          <select className={inputCls} value={f.softver} onChange={set("softver")}>
            <option value="">— odaberi —</option>
            {FORECAST_SOFTVERI.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Tip licence">
          <select className={inputCls} value={f.tip_licence} onChange={set("tip_licence")}>
            <option value="">— odaberi —</option>
            {FORECAST_TIPOVI_LICENCE.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Broj licenci">
          <input type="number" min="0" className={inputCls} value={f.broj_licenci ?? ""} onChange={set("broj_licenci")} />
        </Field>
        <Field label="Status" hint={`% šanse: ${Math.round((STATUS_WEIGHTS[f.status] ?? 0) * 100)}%`}>
          <select className={inputCls} value={f.status} onChange={set("status")}>
            {POTENCIJAL_STATUSI.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Napomena">
        <textarea className={inputCls} rows={3} value={f.napomena || ""} onChange={set("napomena")} />
      </Field>
      <div className="flex justify-end gap-2 mt-2">
        <button className={btnSecondary} onClick={onClose}>Otkaži</button>
        <button className={btnPrimary} onClick={submit} disabled={!f.mjesec || !f.kupac.trim() || !currentUser || busy}>
          {busy ? "Čuvam..." : "Sačuvaj"}
        </button>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/*  GRAFIKON TRENDA (zadnjih 12 mjeseci)                                  */
/* ---------------------------------------------------------------------- */

function TrendChart({ data, theme }) {
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const chartData = months.map((m) => {
    const rows = data.filter((f) => f.mjesec === m);
    const ukupno = rows.reduce((sum, r) => sum + (Number(r.broj_licenci) || 0), 0);
    const prodano = rows.filter((r) => r.status === "Dobijen").reduce((sum, r) => sum + (Number(r.broj_licenci) || 0), 0);
    const ponderisano = Math.round(rows.reduce((sum, r) => sum + (Number(r.broj_licenci) || 0) * (STATUS_WEIGHTS[r.status] ?? 0), 0));
    return { mjesec: fmtMonth(m), ukupno, prodano, ponderisano };
  });

  const isDark = theme === "dark";
  const axisColor = isDark ? "#94a3b8" : "#64748b";
  const gridColor = isDark ? "#334155" : "#f1f5f9";
  const tooltipStyle = {
    borderRadius: 10,
    border: isDark ? "1px solid #334155" : "1px solid #e2e8f0",
    fontSize: 13,
    backgroundColor: isDark ? "#1e293b" : "#ffffff",
    color: isDark ? "#e2e8f0" : "#0f172a",
  };

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
        <XAxis dataKey="mjesec" tick={{ fontSize: 11, fill: axisColor }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: axisColor }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12, color: axisColor }} />
        <Bar dataKey="ukupno" name="Potencijalne licence" fill="#94a3b8" radius={[4, 4, 0, 0]} />
        <Bar dataKey="ponderisano" name="Ponderisana procjena" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="prodano" name="Prodano" fill="#22c55e" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ---------------------------------------------------------------------- */
/*  GLAVNI TAB                                                            */
/* ---------------------------------------------------------------------- */

export function ForecastTab({ data, potencijali, kupci, currentUser, onAdd, onUpdate, onDelete, onBulkAdd, onLinkToKupac, theme, onViewCompany }) {
  const [mjesec, setMjesec] = useState(currentMonthStr());
  const [fProdavac, setFProdavac] = useState("Svi prodavači");
  const [fKupac, setFKupac] = useState("");
  const [fSoftver, setFSoftver] = useState("Svi softveri");
  const [fTipLicence, setFTipLicence] = useState("Svi tipovi");
  const [editing, setEditing] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [linkPrompt, setLinkPrompt] = useState(null);
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");

  const shiftMonth = (delta) => {
    const [y, m] = mjesec.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMjesec(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const prevMjesec = useMemo(() => {
    const [y, m] = mjesec.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, [mjesec]);

  const filtered = data.filter((f) => {
    if (f.mjesec !== mjesec) return false;
    if (fProdavac !== "Svi prodavači" && f.prodavac !== fProdavac) return false;
    if (fSoftver !== "Svi softveri" && f.softver !== fSoftver) return false;
    if (fTipLicence !== "Svi tipovi" && f.tip_licence !== fTipLicence) return false;
    if (fKupac && !(f.kupac || "").toLowerCase().includes(fKupac.toLowerCase())) return false;
    return true;
  });

  const ukupnoLicenci = filtered.reduce((sum, f) => sum + (Number(f.broj_licenci) || 0), 0);
  const prodanoLicenci = filtered.filter((f) => f.status === "Dobijen").reduce((sum, f) => sum + (Number(f.broj_licenci) || 0), 0);
  const ponderisanoLicenci = Math.round(
    filtered.reduce((sum, f) => sum + (Number(f.broj_licenci) || 0) * (STATUS_WEIGHTS[f.status] ?? 0), 0)
  );

  const handleSave = async (payload) => {
    const wasAlreadyDobijen = editing && editing.status === "Dobijen";
    if (editing) await onUpdate(editing.id, payload);
    else await onAdd(payload);
    if (payload.status === "Dobijen" && !wasAlreadyDobijen && onLinkToKupac) {
      setLinkPrompt(payload);
    }
  };

  const handleCopyFromPrevMonth = async () => {
    const openRows = data.filter((f) => f.mjesec === prevMjesec && f.status !== "Dobijen" && f.status !== "Izgubljen");
    if (openRows.length === 0) {
      setCopyMsg("Nema otvorenih stavki u prethodnom mjesecu.");
      setTimeout(() => setCopyMsg(""), 3500);
      return;
    }
    setCopyBusy(true);
    try {
      const ts = new Date().toISOString();
      const newRows = openRows.map((r) => ({
        mjesec,
        prodavac: r.prodavac,
        kupac: r.kupac,
        softver: r.softver,
        tip_licence: r.tip_licence,
        broj_licenci: r.broj_licenci,
        status: r.status,
        napomena: r.napomena,
        potencijal_id: r.potencijal_id || null,
        created_by: currentUser || "Kopija", created_at: ts,
        updated_by: currentUser || "Kopija", updated_at: ts,
      }));
      await onBulkAdd(newRows);
      setCopyMsg(`Kopirano ${newRows.length} stavki iz ${fmtMonth(prevMjesec)}.`);
    } finally {
      setCopyBusy(false);
      setTimeout(() => setCopyMsg(""), 4500);
    }
  };

  const exportCSV = () => {
    const headers = [
      "Mjesec", "Prodavač", "Kupac", "Softver", "Tip licence", "Broj licenci", "Status", "Napomena",
      "Kreirao", "Datum kreiranja", "Zadnja izmjena od", "Datum zadnje izmjene",
    ];
    const rows = filtered.map((f) => [
      fmtMonth(f.mjesec), f.prodavac, f.kupac, f.softver, f.tip_licence, f.broj_licenci, f.status, f.napomena,
      f.created_by, f.created_at, f.updated_by, f.updated_at,
    ]);
    downloadCSV(`forecast_${mjesec}.csv`, headers, rows);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5">
          <button className={btnGhostIcon} onClick={() => shiftMonth(-1)} title="Prethodni mjesec"><ChevronLeft size={16} /></button>
          <input type="month" className="text-sm font-semibold text-slate-800 dark:text-slate-200 border-none focus:outline-none focus:ring-0 bg-transparent" value={mjesec} onChange={(e) => setMjesec(e.target.value)} />
          <button className={btnGhostIcon} onClick={() => shiftMonth(1)} title="Sljedeći mjesec"><ChevronRight size={16} /></button>
        </div>
        <button className={btnPrimary} onClick={() => setShowNew(true)} disabled={!currentUser}>
          <Plus size={15} /> Dodaj stavku za {fmtMonth(mjesec)}
        </button>
        <button className={btnSecondary} onClick={handleCopyFromPrevMonth} disabled={!currentUser || copyBusy}>
          <Copy size={15} /> {copyBusy ? "Kopiram..." : `Kopiraj otvorene iz ${fmtMonth(prevMjesec)}`}
        </button>
        {copyMsg && <span className="text-xs text-slate-500 dark:text-slate-400">{copyMsg}</span>}
      </div>

      <div
        className="grid items-center gap-2 mb-4"
        style={{ gridTemplateColumns: "minmax(140px,220px) minmax(140px,220px) minmax(120px,180px) minmax(120px,180px) 1fr minmax(70px,150px)" }}
      >
        <select className={inputCls} value={fProdavac} onChange={(e) => setFProdavac(e.target.value)}>
          <option>Svi prodavači</option>
          {FORECAST_PRODAVACI.map((n) => <option key={n}>{n}</option>)}
        </select>
        <SearchBox value={fKupac} onChange={setFKupac} placeholder="Pretraži po kupcu..." />
        <select className={inputCls} value={fSoftver} onChange={(e) => setFSoftver(e.target.value)}>
          <option>Svi softveri</option>
          {FORECAST_SOFTVERI.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className={inputCls} value={fTipLicence} onChange={(e) => setFTipLicence(e.target.value)}>
          <option>Svi tipovi</option>
          {FORECAST_TIPOVI_LICENCE.map((t) => <option key={t}>{t}</option>)}
        </select>
        <div />
        <button
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          onClick={exportCSV}
        >
          <Download size={15} /> Izvoz CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs mb-1">
            <Target size={14} /> Ukupno potencijalnih licenci ({fmtMonth(mjesec)})
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{ukupnoLicenci}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-2 text-blue-600 text-xs mb-1">
            <TrendingUp size={14} /> Ponderisana procjena
          </div>
          <div className="text-2xl font-bold text-blue-700">{ponderisanoLicenci}</div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">na osnovu % šanse po statusu</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-2 text-green-600 text-xs mb-1">
            <TrendingUp size={14} /> Prodano ({fmtMonth(mjesec)})
          </div>
          <div className="text-2xl font-bold text-green-700">
            {prodanoLicenci} <span className="text-sm font-normal text-slate-400 dark:text-slate-500">/ {ukupnoLicenci}</span>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Target}
          title={`Nema unesenih stavki za ${fmtMonth(mjesec)}`}
          subtitle="Dodaj prodajne prilike za odabrani mjesec — svaki unos prati prodavača, kupca, softver, tip i broj licenci."
          action={<button className={btnPrimary} onClick={() => setShowNew(true)} disabled={!currentUser}><Plus size={15} /> Dodaj prvu stavku</button>}
        />
      ) : (
        <>
        <div className="hidden sm:block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-2.5">Prodavač</th>
                  <th className="px-4 py-2.5">Kupac</th>
                  <th className="px-4 py-2.5">Softver</th>
                  <th className="px-4 py-2.5">Tip licence</th>
                  <th className="px-4 py-2.5 text-center">Broj licenci</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 cursor-pointer" onClick={() => setEditing(f)}>
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">{f.prodavac || "—"}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">
                      <span className="inline-flex items-center gap-1.5">
                        {f.kupac}
                        {onViewCompany && (
                          <button onClick={(e) => { e.stopPropagation(); onViewCompany(f.kupac); }} className="text-slate-300 dark:text-slate-600 hover:text-teal-600 dark:hover:text-teal-400" title="360° pregled firme">
                            <ExternalLink size={12} />
                          </button>
                        )}
                      </span>
                      {f.napomena && <div className="text-xs text-slate-400 dark:text-slate-500 font-normal">{f.napomena}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">{f.softver || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">{f.tip_licence || "—"}</td>
                    <td className="px-4 py-2.5 text-center text-slate-600 dark:text-slate-400">{f.broj_licenci ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={"text-xs px-2 py-0.5 rounded-full whitespace-nowrap " + (STATUS_BOJE[f.status] || "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400")}>{f.status}</span>
                    </td>
                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        <button className={btnGhostIcon} onClick={() => setEditing(f)} title="Uredi"><Pencil size={14} /></button>
                        <ConfirmDelete label={f.kupac} onConfirm={() => onDelete(f.id)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobilne kartice */}
        <div className="sm:hidden space-y-2.5 mb-6">
          {filtered.map((f) => (
            <div key={f.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4" onClick={() => setEditing(f)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100">{f.kupac}</h4>
                    {onViewCompany && (
                      <button onClick={(e) => { e.stopPropagation(); onViewCompany(f.kupac); }} className="text-slate-300 dark:text-slate-600 hover:text-teal-600 dark:hover:text-teal-400" title="360° pregled firme">
                        <ExternalLink size={12} />
                      </button>
                    )}
                    <span className={"text-xs px-2 py-0.5 rounded-full " + (STATUS_BOJE[f.status] || "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400")}>{f.status}</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{f.prodavac || "—"} · {f.softver || "—"} {f.broj_licenci ? `· ${f.broj_licenci} lic.` : ""}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button className={btnGhostIcon} onClick={() => setEditing(f)} title="Uredi"><Pencil size={14} /></button>
                  <ConfirmDelete label={f.kupac} onConfirm={() => onDelete(f.id)} />
                </div>
              </div>
            </div>
          ))}
        </div>
        </>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-1.5">
          <TrendingUp size={15} className="text-slate-400 dark:text-slate-500" /> Trend — potencijalne vs ponderisane vs prodane licence (zadnjih 12 mjeseci)
        </h3>
        <TrendChart data={data} theme={theme} />
      </div>

      {(showNew || editing) && (
        <ForecastForm
          initial={editing}
          currentUser={currentUser}
          defaultMjesec={mjesec}
          potencijali={potencijali}
          kupci={kupci}
          onSave={handleSave}
          onClose={() => { setShowNew(false); setEditing(null); }}
        />
      )}

      {linkPrompt && (
        <Modal title="Povezati sa Kupcima?" onClose={() => setLinkPrompt(null)}>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 flex items-start gap-2">
            <Link2 size={16} className="text-teal-600 shrink-0 mt-0.5" />
            <span>
              Stavka za <strong>{linkPrompt.kupac}</strong> je označena kao <strong className="text-green-700">Dobijeno</strong>.
              Želite li automatski kreirati ili ažurirati zapis u "Kupci i licence" (proizvod: {linkPrompt.softver || "—"}, {linkPrompt.broj_licenci || 0} licenci)?
            </span>
          </p>
          <div className="flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => setLinkPrompt(null)}>Ne, hvala</button>
            <button
              className={btnPrimary}
              onClick={async () => {
                await onLinkToKupac(linkPrompt);
                setLinkPrompt(null);
              }}
            >
              Da, poveži
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
