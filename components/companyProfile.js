"use client";
import { Building2, Phone, Mail, User, MapPin, Briefcase, Wrench, LineChart, Calendar } from "lucide-react";
import { fmtDate, fmtMonth, licenseStatus, STATUS_BOJE } from "../lib/crm";
import { Modal } from "./ui";

function norm(s) {
  return (s || "").trim().toLowerCase();
}

export function CompanyProfileModal({ name, potencijali, kupci, podrska, forecast, onClose }) {
  const target = norm(name);
  const potencijal = potencijali.find((p) => norm(p.naziv_firme) === target);
  const licence = kupci.filter((k) => norm(k.naziv_firme) === target);
  const istorija = podrska.filter((s) => norm(s.firma) === target).sort((a, b) => new Date(b.datum) - new Date(a.datum));
  const forecastStavke = (forecast || []).filter((f) => norm(f.kupac) === target).sort((a, b) => (a.mjesec < b.mjesec ? 1 : -1));

  return (
    <Modal title={name} onClose={onClose} wide>
      {/* Kontakt info */}
      <div className="mb-6">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
          <User size={13} /> Kontakt info
        </h4>
        {potencijal ? (
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3 text-sm space-y-1.5">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-700 dark:text-slate-300">
              {(potencijal.grad || potencijal.drzava) && (
                <span className="flex items-center gap-1"><MapPin size={13} className="text-slate-400" /> {[potencijal.grad, potencijal.drzava].filter(Boolean).join(", ")}</span>
              )}
              {potencijal.djelatnost && <span className="flex items-center gap-1"><Briefcase size={13} className="text-slate-400" /> {potencijal.djelatnost}</span>}
              {potencijal.kolega && <span className="flex items-center gap-1"><User size={13} className="text-slate-400" /> {potencijal.kolega}</span>}
            </div>
            {(potencijal.kontakt_osoba || potencijal.telefon || potencijal.email) && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700 mt-1.5">
                {potencijal.kontakt_osoba && <span>{potencijal.kontakt_osoba}</span>}
                {potencijal.telefon && <span className="flex items-center gap-1"><Phone size={12} /> {potencijal.telefon}</span>}
                {potencijal.email && <span className="flex items-center gap-1"><Mail size={12} /> {potencijal.email}</span>}
              </div>
            )}
            {(potencijal.dodatni_kontakti || []).length > 0 && (
              <div className="pt-1.5 space-y-1">
                {potencijal.dodatni_kontakti.map((k, i) => (
                  <div key={i} className="flex flex-wrap gap-x-3 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium">{k.ime}</span>
                    {k.telefon && <span>{k.telefon}</span>}
                    {k.email && <span>{k.email}</span>}
                  </div>
                ))}
              </div>
            )}
            <div className="pt-1.5">
              <span className={"text-xs px-2 py-0.5 rounded-full " + (STATUS_BOJE[potencijal.status] || "bg-slate-100 text-slate-600")}>{potencijal.status}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400 dark:text-slate-500">Nema zapisa u Bazi potencijala za ovu firmu.</p>
        )}
      </div>

      {/* Licence */}
      <div className="mb-6">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
          <Building2 size={13} /> Licence ({licence.length})
        </h4>
        {licence.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Nema evidentiranih licenci.</p>
        ) : (
          <div className="space-y-1.5">
            {licence.map((k) => {
              const s = licenseStatus(k.end_date);
              return (
                <div key={k.id} className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{k.naziv_proizvoda || "—"}</span>
                    <span className="text-slate-400 dark:text-slate-500 text-xs ml-2">{k.broj_licenci ? `${k.broj_licenci} lic.` : ""}</span>
                    <div className="text-xs text-slate-400 dark:text-slate-500">{fmtDate(k.start_date)} – {fmtDate(k.end_date)}</div>
                  </div>
                  <span className={"text-xs px-2 py-0.5 rounded-full shrink-0 " + s.cls}>{s.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Historija podrške */}
      <div className="mb-6">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
          <Wrench size={13} /> Historija tehničke podrške ({istorija.length})
        </h4>
        {istorija.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Nema zabilježenih intervencija.</p>
        ) : (
          <div className="space-y-1.5">
            {istorija.map((s) => (
              <div key={s.id} className="bg-slate-50 dark:bg-slate-800/60 rounded-lg px-3 py-2 text-sm">
                <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 mb-0.5">
                  <Calendar size={11} /> {fmtDate(s.datum)} · {s.tehnicar}
                </div>
                <p className="text-slate-700 dark:text-slate-300">{s.opis}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Forecast stavke */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
          <LineChart size={13} /> Forecast stavke ({forecastStavke.length})
        </h4>
        {forecastStavke.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Nema forecast stavki za ovu firmu.</p>
        ) : (
          <div className="space-y-1.5">
            {forecastStavke.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg px-3 py-2 text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-slate-800 dark:text-slate-200">{fmtMonth(f.mjesec)}</span>
                  <span className="text-slate-400 dark:text-slate-500 text-xs ml-2">{f.softver} {f.broj_licenci ? `· ${f.broj_licenci} lic.` : ""}</span>
                </div>
                <span className={"text-xs px-2 py-0.5 rounded-full shrink-0 " + (STATUS_BOJE[f.status] || "bg-slate-100 text-slate-600")}>{f.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
