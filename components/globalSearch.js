"use client";
import { useState, useMemo, useRef, useEffect } from "react";
import { Search, X, Target, TrendingUp, Building2, Wrench, LineChart } from "lucide-react";
import { fmtDate } from "../lib/crm";

const CATS = [
  { key: "potencijali", label: "Baza potencijala", icon: Target, tab: "potencijali", restricted: true },
  { key: "lidovi", label: "Lidovi", icon: TrendingUp, tab: "lidovi", restricted: true },
  { key: "kupci", label: "Kupci i licence", icon: Building2, tab: "kupci", restricted: false },
  { key: "podrska", label: "Tehnička podrška", icon: Wrench, tab: "podrska", restricted: false },
  { key: "forecast", label: "Forecast", icon: LineChart, tab: "forecast", restricted: true },
];

function norm(s) {
  return (s == null ? "" : String(s)).toLowerCase();
}

function companyOf(cat, item) {
  if (cat === "podrska") return item.firma;
  if (cat === "forecast") return item.kupac;
  return item.naziv_firme;
}

function subtitleOf(cat, item) {
  switch (cat) {
    case "potencijali":
      return [item.kontakt_osoba, item.status, item.kolega].filter(Boolean).join(" · ");
    case "lidovi":
      return [item.kontakt_osoba, item.status].filter(Boolean).join(" · ");
    case "kupci":
      return [item.naziv_proizvoda, item.grad].filter(Boolean).join(" · ");
    case "podrska":
      return [item.tehnicar, item.datum ? fmtDate(item.datum) : ""].filter(Boolean).join(" · ");
    case "forecast":
      return [item.softver, item.status].filter(Boolean).join(" · ");
    default:
      return "";
  }
}

// Ovim redoslijedom polja se pretražuje svaki tip zapisa
const FIELDS_BY_CAT = {
  potencijali: (p) => [p.naziv_firme, p.kontakt_osoba, p.email, p.telefon, p.grad, p.djelatnost],
  lidovi: (l) => [l.naziv_firme, l.kontakt_osoba, l.email, l.telefon, l.grad, l.izvor],
  kupci: (k) => [k.naziv_firme, k.adresa, k.grad, k.naziv_proizvoda, k.naziv_proizvoda_2, k.serijski_broj],
  podrska: (s) => [s.firma, s.tehnicar, s.opis],
  forecast: (f) => [f.kupac, f.prodavac, f.softver, f.napomena],
};

export function GlobalSearch({ potencijali, lidovi, kupci, podrska, forecast, isTehnicar, onSelectCompany, onNavigateTab }) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 150);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const dataByCat = { potencijali, lidovi, kupci, podrska, forecast: forecast || [] };

  const results = useMemo(() => {
    if (debounced.length < 2) return null;
    const q = norm(debounced);
    const out = {};
    for (const cat of CATS) {
      if (isTehnicar && cat.restricted) continue;
      const fields = FIELDS_BY_CAT[cat.key];
      out[cat.key] = (dataByCat[cat.key] || []).filter((item) => fields(item).some((v) => norm(v).includes(q)));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, potencijali, lidovi, kupci, podrska, forecast, isTehnicar]);

  const totalCount = results ? Object.values(results).reduce((s, arr) => s + arr.length, 0) : 0;

  const handleSelect = (cat, item) => {
    const company = companyOf(cat, item);
    setOpen(false);
    setQuery("");
    if (company && onSelectCompany) onSelectCompany(company);
    else if (onNavigateTab) onNavigateTab(CATS.find((c) => c.key === cat)?.tab);
  };

  return (
    <div ref={boxRef} className="relative flex-1 min-w-[120px] max-w-xl">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => query && setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Escape") { setOpen(false); e.target.blur(); } }}
          placeholder="Pretraži sve module — firma, kontakt, softver..."
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-8 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white dark:focus:bg-slate-900 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors duration-150"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setDebounced(""); setOpen(false); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && debounced.length >= 2 && (
        <div className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-[70vh] overflow-y-auto z-50">
          {totalCount === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">Nema rezultata za "{debounced}".</p>
          ) : (
            CATS.filter((c) => !(isTehnicar && c.restricted)).map(({ key, label, icon: Icon }) => {
              const items = results[key] || [];
              if (items.length === 0) return null;
              return (
                <div key={key} className="border-b last:border-b-0 border-slate-100 dark:border-slate-800">
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 flex items-center gap-1.5 bg-slate-50/60 dark:bg-slate-800/40">
                    <Icon size={11} /> {label} ({items.length})
                  </div>
                  {items.slice(0, 6).map((item, i) => (
                    <button
                      key={item.id || i}
                      onClick={() => handleSelect(key, item)}
                      className="w-full text-left px-3 py-2 hover:bg-teal-50 dark:hover:bg-teal-900/20 flex items-center justify-between gap-2 transition-colors duration-100"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{companyOf(key, item) || "—"}</span>
                        <span className="block text-xs text-slate-400 dark:text-slate-500 truncate">{subtitleOf(key, item)}</span>
                      </span>
                    </button>
                  ))}
                  {items.length > 6 && (
                    <div className="px-3 py-1.5 text-xs text-slate-400 dark:text-slate-500">+ {items.length - 6} više — suzi pretragu za precizniji prikaz</div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
