"use client";
import { useState, useMemo, useEffect } from "react";
import {
  Home, Target, TrendingUp, Building2, Wrench, Bell, Plus, Pencil,
  ArrowRightCircle, Phone, Mail, MapPin, Calendar, User, AlertTriangle,
  CheckCircle2, ChevronRight, ChevronLeft, Upload, ChevronUp, ChevronDown, ChevronsUpDown, Trash2, X, Download, ExternalLink, Square, CheckSquare,
} from "lucide-react";
import {
  COLLEAGUE_NAMES, SORTED_FOR_TECH, POTENCIJAL_STATUSI, LEAD_STATUSI, STATUS_BOJE, EU_COUNTRIES,
  FORECAST_STATUSI, FORECAST_STATUS_HEX, currentMonthStr, fmtMonth,
  inputCls, btnPrimary, btnSecondary, btnGhostIcon,
  todayStr, fmtDate, licenseStatus, reminderUrgency, getReminders, daysDiff, parseDateFlexible, downloadCSV,
  getColleagueDept, getForecastStatusWeight, isForecastWon, isForecastLost,
} from "../lib/crm";
import { Modal, Field, EmptyState, Toolbar, SearchBox, MetaLine, ImportModal, ConfirmDelete, DangerConfirmModal, BulkActionBar, ForecastStatusBadge } from "./ui";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from "recharts";

/* ====================================================================== */
/*  PREGLED                                                                */
/* ====================================================================== */

const LICENCA_HEX = { Aktivno: "#22c55e", "Ističe uskoro": "#f59e0b", Isteklo: "#ef4444" };

const DAY_MS = 24 * 60 * 60 * 1000;

// Procentualna promjena; "novo" = prije 30 dana je bilo 0, a sada ima nešto
function pctChange(now, before) {
  if (before === 0) return now > 0 ? "novo" : 0;
  return Math.round(((now - before) / before) * 100);
}

// Broj zapisa kreiranih u periodu [prije fromDays dana, prije toDays dana)
function countCreatedBetween(items, fromDays, toDays) {
  const now = Date.now();
  return items.filter((i) => {
    if (!i.created_at) return false;
    const t = new Date(i.created_at).getTime();
    if (isNaN(t)) return false;
    return t > now - fromDays * DAY_MS && t <= now - toDays * DAY_MS;
  }).length;
}

// Bosanska množina: 1 licenca, 2-4 licence, 5+ licenci
function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function TrendBadge({ value, invert, title }) {
  let text, cls;
  if (value === "novo") {
    text = "▲ novo";
    cls = invert ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" : "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  } else if (value > 0) {
    text = `▲ ${value}%`;
    cls = invert ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" : "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  } else if (value < 0) {
    text = `▼ ${Math.abs(value)}%`;
    cls = invert ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400";
  } else {
    text = "bez promjene";
    cls = "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400";
  }
  return <span title={title} className={"text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap " + cls}>{text}</span>;
}

function StatCard({ icon: Icon, label, value, accent, onClick, trend, trendInvert, trendTitle, caption, warn }) {
  return (
    <button
      onClick={onClick}
      className={
        "text-left rounded-2xl border p-5 shadow-sm hover:shadow-md dark:hover:shadow-black/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-150 " +
        (warn
          ? "bg-amber-50 dark:bg-amber-900/15 border-amber-200 dark:border-amber-800/60 hover:border-amber-300 dark:hover:border-amber-700"
          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600")
      }
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className={"w-10 h-10 rounded-xl flex items-center justify-center " + accent}>
          <Icon size={18} />
        </div>
        {trend !== undefined && <TrendBadge value={trend} invert={trendInvert} title={trendTitle} />}
      </div>
      <div className={"text-3xl font-bold tracking-tight " + (warn ? "text-amber-800 dark:text-amber-300" : "text-slate-900 dark:text-slate-100")}>{value}</div>
      <div className={"text-sm mt-0.5 " + (warn ? "text-amber-700 dark:text-amber-400" : "text-slate-500 dark:text-slate-400")}>{label}</div>
      {caption && <div className={"text-[11px] mt-1 " + (warn ? "text-amber-600/80 dark:text-amber-500/80" : "text-slate-400 dark:text-slate-500")}>{caption}</div>}
    </button>
  );
}

// Oznaka ispod stupca: dugi nazivi statusa idu u dva reda
function StatusTick({ x, y, payload, fill }) {
  const words = String(payload.value).split(" ");
  const lines = words.length > 1 ? [words.slice(0, Math.ceil(words.length / 2)).join(" "), words.slice(Math.ceil(words.length / 2)).join(" ")] : words;
  return (
    <text x={x} y={y + 12} textAnchor="middle" fontSize={11} fill={fill}>
      {lines.map((l, i) => <tspan key={i} x={x} dy={i === 0 ? 0 : 13}>{l}</tspan>)}
    </text>
  );
}

const panelCls = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 transition-shadow duration-150 hover:shadow-md dark:hover:shadow-black/30";
const panelTitleCls = "text-[15px] font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2";

export function PregledTab({ potencijali, lidovi, kupci, podrska, forecast, setTab, theme, onLicenseClick, currentUser }) {
  const podsjetnici = getReminders(potencijali, lidovi).filter((r) => daysDiff(r.datum) <= 7);
  const isticuLicence = kupci.filter((k) => k.end_date && daysDiff(k.end_date) <= 30).sort((a, b) => new Date(a.end_date) - new Date(b.end_date));
  const aktivniLidovi = lidovi.filter((l) => l.status !== "Konvertovan" && l.status !== "Odbačen").length;
  const otvoreniPotencijali = potencijali.filter((p) => p.status !== "Dobijen" && p.status !== "Izgubljen").length;

  const normFirma = (name) => (name || "").trim().toLowerCase();
  const brojUnikatnihKupaca = new Set(kupci.map((k) => normFirma(k.naziv_firme)).filter(Boolean)).size;
  const brojUnikatnihKupacaSaIstekom = new Set(isticuLicence.map((k) => normFirma(k.naziv_firme)).filter(Boolean)).size;

  /* ---- Trendovi (u odnosu na prije 30 dana) ---- */
  const potNovi30 = countCreatedBetween(potencijali, 30, 0);
  const potNoviPrije = countCreatedBetween(potencijali, 60, 30);
  const lidNovi30 = countCreatedBetween(lidovi, 30, 0);
  const lidNoviPrije = countCreatedBetween(lidovi, 60, 30);
  // Kupci prije 30 dana = firme koje su tada već imale licencu (start date stariji od 30 dana ili nepoznat)
  const kupciPrije30 = new Set(
    kupci.filter((k) => !k.start_date || daysDiff(k.start_date) <= -30).map((k) => normFirma(k.naziv_firme)).filter(Boolean)
  ).size;
  // "Ističe ≤30 dana" kakvo je bilo prije 30 dana = licence s krajem do danas
  const istekPrije30 = new Set(
    kupci.filter((k) => k.end_date && daysDiff(k.end_date) <= 0).map((k) => normFirma(k.naziv_firme)).filter(Boolean)
  ).size;

  const ukupnoLidova = lidovi.length;
  const konvertovanoLidova = lidovi.filter((l) => l.status === "Konvertovan").length;
  const potencijaliIzLeada = potencijali.filter((p) => p.origin_lead_id);
  const dobijenoIzLeada = potencijaliIzLeada.filter((p) => p.status === "Dobijen").length;
  const izgubljenoIzLeada = potencijaliIzLeada.filter((p) => p.status === "Izgubljen").length;
  const stopaKonverzije = ukupnoLidova > 0 ? Math.round((konvertovanoLidova / ukupnoLidova) * 100) : 0;
  const stopaDobijanja = konvertovanoLidova > 0 ? Math.round((dobijenoIzLeada / konvertovanoLidova) * 100) : 0;

  const tekuciMjesec = currentMonthStr();
  const forecastOvogMjeseca = (forecast || []).filter((f) => f.mjesec === tekuciMjesec);
  const forecastChartData = FORECAST_STATUSI.map((s) => ({
    status: s,
    broj: forecastOvogMjeseca.filter((f) => f.status === s).length,
  }));
  const ocekivanaProdaja = Math.round(
    forecastOvogMjeseca.reduce((sum, f) => sum + (Number(f.broj_licenci) || 0) * getForecastStatusWeight(f.status), 0)
  );

  const RANK = { Isteklo: 3, "Ističe uskoro": 2, Aktivno: 1, Nepoznato: 0 };
  const companyStatusMap = new Map();
  kupci.forEach((k) => {
    const name = normFirma(k.naziv_firme);
    if (!name) return;
    const s = licenseStatus(k.end_date).label;
    const current = companyStatusMap.get(name);
    if (!current || RANK[s] > RANK[current]) companyStatusMap.set(name, s);
  });
  const licencaChartData = ["Aktivno", "Ističe uskoro", "Isteklo"]
    .map((label) => ({ name: label, value: Array.from(companyStatusMap.values()).filter((v) => v === label).length }))
    .filter((d) => d.value > 0);
  const licencaUkupno = licencaChartData.reduce((s, d) => s + d.value, 0);

  /* ---- Pozdravni baner — sadržaj zavisi od odjela prijavljenog kolege ---- */
  const odjel = getColleagueDept(currentUser);
  const [danas, setDanas] = useState({ datum: "", pozdrav: "" });
  useEffect(() => {
    const d = new Date();
    // Ručno formatiranje (ne oslanja se na jezik preglednika): 29.9.2026 UTO
    const dani = ["NED", "PON", "UTO", "SRI", "ČET", "PET", "SUB"];
    const datum = `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()} ${dani[d.getDay()]}`;
    const h = d.getHours();
    const pozdrav = h < 11 ? "Dobro jutro" : h < 18 ? "Dobar dan" : "Dobro veče";
    setDanas({ datum, pozdrav });
  }, []);
  const ime = (currentUser || "").split(" ")[0];

  // Licence koje ističu u tekućem kalendarskom mjesecu
  const licenceOvajMjesec = kupci.filter((k) => k.end_date && String(k.end_date).slice(0, 7) === tekuciMjesec);
  const brojLicenciIstek = licenceOvajMjesec.reduce((s, k) => s + (Number(k.broj_licenci) || 1), 0);
  const brojFirmiIstek = new Set(licenceOvajMjesec.map((k) => normFirma(k.naziv_firme)).filter(Boolean)).size;
  const recenicaIstek =
    brojLicenciIstek === 0
      ? "U ovom mjesecu ne ističe nijedna licenca."
      : `U ovom mjesecu ${plural(brojLicenciIstek, "ističe", "ističu", "ističe")} ${brojLicenciIstek} ${plural(brojLicenciIstek, "licenca", "licence", "licenci")} kod ${brojFirmiIstek} ${plural(brojFirmiIstek, "firme", "firme", "firmi")}.`;

  let baner = null;
  if (odjel === "Prodaja") {
    const mojForecast = forecastOvogMjeseca.filter((f) => f.prodavac === currentUser);
    // Zatvorene ponude = broj firmi kojima je ovog mjeseca prodata licenca (status Dobijeno)
    const mojeZatvorene = new Set(
      mojForecast.filter((f) => isForecastWon(f.status)).map((f) => normFirma(f.kupac)).filter(Boolean)
    ).size;
    const mojeOtvorene = new Set(
      mojForecast.filter((f) => !isForecastWon(f.status) && !isForecastLost(f.status)).map((f) => normFirma(f.kupac)).filter(Boolean)
    ).size;
    baner = {
      recenica: recenicaIstek,
      onRecenica: () => setTab("kupci"),
      brojevi: [
        { value: mojeZatvorene, label: "Zatvorene ponude", onClick: () => setTab("forecast") },
        { value: mojeOtvorene, label: "Otvorene ponude", onClick: () => setTab("forecast") },
      ],
    };
  } else if (odjel === "Tehnička podrška") {
    const podrskaOvogMjeseca = podrska.filter((s) => s.datum && String(s.datum).slice(0, 7) === tekuciMjesec);
    const mojeIntervencije = podrskaOvogMjeseca.filter((s) => s.tehnicar === currentUser).length;
    const kupciPodrskaIstice = new Set(
      kupci.filter((k) => k.end_date && daysDiff(k.end_date) >= 0 && daysDiff(k.end_date) <= 30).map((k) => normFirma(k.naziv_firme)).filter(Boolean)
    ).size;
    const n = podrskaOvogMjeseca.length;
    baner = {
      recenica: `${recenicaIstek} Intervencija podrške ovog mjeseca: ${n}.`,
      onRecenica: () => setTab("kupci"),
      brojevi: [
        { value: mojeIntervencije, label: "Moje intervencije ovog mj.", onClick: () => setTab("podrska") },
        { value: kupciPodrskaIstice, label: "Podrška ističe ≤30 dana", onClick: () => setTab("kupci") },
      ],
    };
  } else if (odjel === "Marketing") {
    const noviLidovi = lidovi.filter((l) => l.created_at && String(l.created_at).slice(0, 7) === tekuciMjesec).length;
    const recenica =
      noviLidovi === 0
        ? "Ovog mjeseca još nije stigao nijedan novi lid."
        : plural(noviLidovi, `Ovog mjeseca je stigao ${noviLidovi} novi lid.`, `Ovog mjeseca su stigla ${noviLidovi} nova lida.`, `Ovog mjeseca je stiglo ${noviLidovi} novih lidova.`);
    baner = {
      recenica,
      onRecenica: () => setTab("lidovi"),
      brojevi: [
        { value: noviLidovi, label: "Novi lidovi ovog mj.", onClick: () => setTab("lidovi") },
        { value: `${stopaKonverzije}%`, label: "Konverzija lidova", onClick: () => setTab("lidovi") },
      ],
    };
  }

  const isDark = theme === "dark";
  const axisColor = isDark ? "#94a3b8" : "#64748b";
  const gridColor = isDark ? "#334155" : "#f1f5f9";
  const labelColor = isDark ? "#e2e8f0" : "#0f172a";
  const tooltipStyle = {
    borderRadius: 10,
    border: isDark ? "1px solid #334155" : "1px solid #e2e8f0",
    fontSize: 13,
    backgroundColor: isDark ? "#1e293b" : "#ffffff",
    color: isDark ? "#e2e8f0" : "#0f172a",
  };

  return (
    <div className="space-y-5">
      {baner && (
        <div className="rounded-2xl px-6 py-6 sm:px-8 sm:py-7 flex flex-col md:flex-row md:items-center md:justify-between gap-5 bg-gradient-to-br from-teal-700 via-teal-600 to-teal-500 shadow-lg shadow-teal-600/20 dark:shadow-black/30">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-100">{danas.datum || "\u00a0"}</p>
            <h2 className="text-2xl sm:text-[28px] font-bold text-white mt-1 tracking-tight">{danas.pozdrav ? `${danas.pozdrav}, ${ime}` : `Zdravo, ${ime}`}</h2>
            <button onClick={baner.onRecenica} className="text-sm text-teal-50 mt-1.5 hover:text-white hover:underline text-left">
              {baner.recenica}
            </button>
          </div>
          <div className="flex gap-3 shrink-0">
            {baner.brojevi.map((b) => (
              <button key={b.label} onClick={b.onClick} className="rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 px-5 py-3 text-center min-w-[120px] transition-colors">
                <div className="text-2xl font-bold text-white">{b.value}</div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-teal-100">{b.label}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Target} label="Otvoreni potencijali" value={otvoreniPotencijali}
          accent="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" onClick={() => setTab("potencijali")}
          trend={pctChange(potNovi30, potNoviPrije)}
          trendTitle={`Novih u zadnjih 30 dana: ${potNovi30} (prethodnih 30 dana: ${potNoviPrije})`}
          caption={`${potNovi30} novih u 30 dana`}
        />
        <StatCard
          icon={TrendingUp} label="Aktivni lidovi" value={aktivniLidovi}
          accent="bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400" onClick={() => setTab("lidovi")}
          trend={pctChange(lidNovi30, lidNoviPrije)}
          trendTitle={`Novih u zadnjih 30 dana: ${lidNovi30} (prethodnih 30 dana: ${lidNoviPrije})`}
          caption={`${lidNovi30} novih u 30 dana`}
        />
        <StatCard
          icon={Building2} label="Kupci" value={brojUnikatnihKupaca}
          accent="bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400" onClick={() => setTab("kupci")}
          trend={pctChange(brojUnikatnihKupaca, kupciPrije30)}
          trendTitle={`Prije 30 dana: ${kupciPrije30} kupaca`}
          caption="u odnosu na prije 30 dana"
        />
        <StatCard
          icon={AlertTriangle} label="Licence ističu ≤30 dana" value={brojUnikatnihKupacaSaIstekom} warn
          accent="bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400" onClick={() => setTab("kupci")}
          trend={pctChange(brojUnikatnihKupacaSaIstekom, istekPrije30)} trendInvert
          trendTitle={`Prije 30 dana: ${istekPrije30} firmi`}
          caption="u odnosu na prije 30 dana"
        />
      </div>

      <div className={panelCls}>
        <h3 className={panelTitleCls + " mb-4"}>
          <TrendingUp size={16} className="text-slate-400 dark:text-slate-500" /> Konverzija lidova
        </h3>
        <div className="flex flex-col sm:flex-row items-stretch gap-3">
          <div className="flex-1 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 p-4 text-center">
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{ukupnoLidova}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Ukupno lidova</div>
          </div>
          <div className="flex items-center justify-center text-slate-300 dark:text-slate-600 sm:rotate-0 rotate-90">
            <ChevronRight size={20} />
          </div>
          <div className="flex-1 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800/50 p-4 text-center">
            <div className="text-2xl font-bold text-violet-700 dark:text-violet-400">{konvertovanoLidova}</div>
            <div className="text-xs text-violet-600 dark:text-violet-400 mt-0.5">Konvertovano u potencijal {ukupnoLidova > 0 && `(${stopaKonverzije}%)`}</div>
          </div>
          <div className="flex items-center justify-center text-slate-300 dark:text-slate-600 sm:rotate-0 rotate-90">
            <ChevronRight size={20} />
          </div>
          <div className="flex-1 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/50 p-4 text-center">
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">{dobijenoIzLeada}</div>
            <div className="text-xs text-green-600 dark:text-green-400 mt-0.5">Postalo kupac {konvertovanoLidova > 0 && `(${stopaDobijanja}%)`}</div>
          </div>
        </div>
        {izgubljenoIzLeada > 0 && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
            Od konvertovanih, {izgubljenoIzLeada} {izgubljenoIzLeada === 1 ? "je označen" : "je označeno"} kao izgubljeno, ostalo je još u toku.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className={panelCls + " lg:col-span-3"}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
            <h3 className={panelTitleCls}>
              <Target size={16} className="text-slate-400 dark:text-slate-500" /> Forecast po statusu — {fmtMonth(tekuciMjesec)}
            </h3>
            <button onClick={() => setTab("forecast")} className="text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/30 px-3 py-1 rounded-full hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors">
              Očekivana prodaja: {ocekivanaProdaja} lic.
            </button>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={forecastChartData} margin={{ top: 22, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
              <XAxis dataKey="status" interval={0} height={42} tickLine={false} axisLine={{ stroke: gridColor }} tick={<StatusTick fill={axisColor} />} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: isDark ? "rgba(148,163,184,0.08)" : "rgba(15,23,42,0.04)" }} formatter={(value) => [value, "Broj stavki"]} />
              <Bar dataKey="broj" radius={[8, 8, 0, 0]} maxBarSize={56} cursor="pointer">
                <LabelList dataKey="broj" position="top" style={{ fontSize: 12, fontWeight: 700, fill: labelColor }} />
                {forecastChartData.map((d, i) => (
                  <Cell key={i} fill={FORECAST_STATUS_HEX[d.status] || "#94a3b8"} onClick={() => setTab("forecast")} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={panelCls + " lg:col-span-2"}>
          <h3 className={panelTitleCls + " mb-5"}>
            <Building2 size={16} className="text-slate-400 dark:text-slate-500" /> Kupci po statusu licence
          </h3>
          {licencaChartData.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 py-16 text-center">Nema podataka o licencama.</p>
          ) : (
            <div className="flex items-center gap-5">
              <div className="relative w-[55%] shrink-0">
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie data={licencaChartData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={2} stroke="none" cursor={onLicenseClick ? "pointer" : "default"}>
                      {licencaChartData.map((d, i) => (
                        <Cell key={i} fill={LICENCA_HEX[d.name]} onClick={() => onLicenseClick && onLicenseClick(d.name)} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-none">{licencaUkupno}</span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">ukupno</span>
                </div>
              </div>
              <div className="flex-1 space-y-3">
                {licencaChartData.map((d) => (
                  <button
                    key={d.name}
                    onClick={() => onLicenseClick && onLicenseClick(d.name)}
                    className="w-full flex items-center justify-between text-sm rounded-lg px-2 py-1.5 -mx-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: LICENCA_HEX[d.name] }} />
                      {d.name}
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {d.value}
                      <span className="text-xs font-normal text-slate-400 dark:text-slate-500 ml-1">({Math.round((d.value / licencaUkupno) * 100)}%)</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className={panelCls}>
          <div className="flex items-center justify-between mb-3">
            <h3 className={panelTitleCls}>
              <Bell size={16} className="text-slate-400 dark:text-slate-500" /> Podsjetnici (narednih 7 dana)
            </h3>
            <button onClick={() => setTab("podsjetnici")} className="text-xs text-teal-600 dark:text-teal-400 font-semibold hover:underline flex items-center gap-0.5">
              Svi <ChevronRight size={13} />
            </button>
          </div>
          {podsjetnici.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 py-8 text-center">Nema podsjetnika u narednih 7 dana.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {podsjetnici.slice(0, 6).map((r) => {
                const u = reminderUrgency(r.datum);
                return (
                  <li key={r.tip + r.id} className="py-3 flex items-center gap-3">
                    <span className={"w-2 h-2 rounded-full shrink-0 " + u.dotCls} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-700 dark:text-slate-300 truncate">
                        <span className="font-semibold">{r.firma}</span> — {r.opis || "podsjetnik"}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        {r.tip} · {r.kolega} · {fmtDate(r.datum)}
                      </p>
                    </div>
                    <span className={"text-xs font-medium px-2.5 py-0.5 rounded-full shrink-0 " + u.cls}>{u.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className={panelCls}>
          <div className="flex items-center justify-between mb-3">
            <h3 className={panelTitleCls}>
              <AlertTriangle size={16} className="text-slate-400 dark:text-slate-500" /> Licence koje ističu
            </h3>
            <button onClick={() => setTab("kupci")} className="text-xs text-teal-600 dark:text-teal-400 font-semibold hover:underline flex items-center gap-0.5">
              Svi kupci <ChevronRight size={13} />
            </button>
          </div>
          {isticuLicence.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 py-8 text-center">Nema licenci koje ističu u narednih 30 dana.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {isticuLicence.slice(0, 6).map((k) => {
                const s = licenseStatus(k.end_date);
                return (
                  <li key={k.id} className="py-3 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-700 dark:text-slate-300 truncate">
                        <span className="font-semibold">{k.naziv_firme}</span> — {k.naziv_proizvoda}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        {k.grad} · ističe {fmtDate(k.end_date)}
                      </p>
                    </div>
                    <span className={"text-xs font-medium px-2.5 py-0.5 rounded-full shrink-0 " + s.cls}>{s.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className={panelCls}>
        <h3 className={panelTitleCls + " mb-3"}>
          <Wrench size={16} className="text-slate-400 dark:text-slate-500" /> Posljednja tehnička podrška
        </h3>
        {podrska.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 py-8 text-center">Još nema unesenih intervencija podrške.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {[...podrska].sort((a, b) => new Date(b.datum) - new Date(a.datum)).slice(0, 5).map((s) => (
              <li key={s.id} className="py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-700 dark:text-slate-300 truncate">
                    <span className="font-semibold">{s.firma}</span> — {s.opis}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
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

function normNaziv(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9čćžšđ]/gi, "");
}

// PotencijalForm i PotencijaliTab su premješteni u components/potencijali.js

/* ====================================================================== */
/*  LIDOVI                                                                  */
/* ====================================================================== */

function LeadForm({ initial, currentUser, existingList, onSave, onClose }) {
  const [f, setF] = useState(
    initial || {
      naziv_firme: "", grad: "", drzava: "", kontakt_osoba: "", telefon: "", email: "",
      izvor: "", kolega: currentUser || "", status: "Novi", napomena: "",
      podsjetnik_datum: "", podsjetnik_opis: "",
    }
  );
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const duplicateMatch = useMemo(() => {
    const target = normNaziv(f.naziv_firme);
    if (target.length < 3) return null;
    return (
      (existingList || []).find((l) => {
        if (initial && l.id === initial.id) return false;
        const ln = normNaziv(l.naziv_firme);
        if (!ln) return false;
        return ln === target || ln.includes(target) || target.includes(ln);
      }) || null
    );
  }, [f.naziv_firme, existingList, initial]);
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
      {duplicateMatch && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 flex items-start gap-1.5">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          Moguć duplikat — već postoji lead <strong className="mx-1">{duplicateMatch.naziv_firme}</strong> (kolega: {duplicateMatch.kolega || "—"}, status: {duplicateMatch.status}).
        </p>
      )}
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

export function LidoviTab({ data, currentUser, onAdd, onUpdate, onDelete, onBulkImport, onConvert, onBulkUpdate, onBulkDelete, onViewCompany }) {
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("Svi");
  const [editing, setEditing] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = data.filter((l) => {
    if (fStatus !== "Svi" && l.status !== fStatus) return false;
    if (q && !((l.naziv_firme || "") + (l.grad || "") + (l.kontakt_osoba || "")).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const handleSave = async (payload) => {
    if (editing) await onUpdate(editing.id, payload);
    else await onAdd(payload);
  };

  const exportCSV = () => {
    const headers = [
      "Naziv firme", "Grad", "Država", "Kontakt osoba", "Telefon", "Email", "Izvor",
      "Kolega", "Status", "Napomena", "Podsjetnik datum", "Podsjetnik opis",
      "Kreirao", "Datum kreiranja", "Zadnja izmjena od", "Datum zadnje izmjene",
    ];
    const rows = filtered.map((l) => [
      l.naziv_firme, l.grad, l.drzava, l.kontakt_osoba, l.telefon, l.email, l.izvor,
      l.kolega, l.status, l.napomena, l.podsjetnik_datum, l.podsjetnik_opis,
      l.created_by, l.created_at, l.updated_by, l.updated_at,
    ]);
    downloadCSV(`lidovi_${todayStr()}.csv`, headers, rows);
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
        <button
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          onClick={exportCSV}
        >
          <Download size={15} /> Izvoz CSV
        </button>
        <button className={btnPrimary} onClick={() => setShowNew(true)} disabled={!currentUser}><Plus size={15} /> Dodaj lead</button>
      </Toolbar>

      {selected.size > 0 && (
        <BulkActionBar count={selected.size} onClear={() => setSelected(new Set())}>
          <select className="text-sm rounded-lg border border-white/30 bg-white/10 px-2 py-1.5 text-white" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
            <option value="" className="text-slate-800">— odaberi status —</option>
            {LEAD_STATUSI.map((s) => <option key={s} className="text-slate-800">{s}</option>)}
          </select>
          <button
            className="text-sm bg-white text-teal-700 rounded-lg px-3 py-1.5 font-medium hover:bg-teal-50 active:scale-95 transition-transform disabled:opacity-50"
            disabled={!bulkStatus || bulkBusy}
            onClick={async () => {
              setBulkBusy(true);
              try {
                await onBulkUpdate(Array.from(selected), { status: bulkStatus, updated_by: currentUser || "Grupna izmjena", updated_at: new Date().toISOString() });
                setSelected(new Set());
                setBulkStatus("");
              } finally {
                setBulkBusy(false);
              }
            }}
          >
            Promijeni status
          </button>
          <button
            className="text-sm bg-red-500 text-white rounded-lg px-3 py-1.5 font-medium hover:bg-red-600 active:scale-95 transition-transform disabled:opacity-50"
            disabled={bulkBusy}
            onClick={async () => {
              if (!window.confirm(`Obrisati ${selected.size} odabranih lidova?`)) return;
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
        <EmptyState icon={TrendingUp} title="Nema unesenih lidova" subtitle="Dodaj ručno ili uvezi generisanu bazu lidova."
          action={<button className={btnPrimary} onClick={() => setShowNew(true)} disabled={!currentUser}><Plus size={15} /> Dodaj prvi lead</button>} />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((l) => (
            <div key={l.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md dark:hover:shadow-black/20 hover:-translate-y-0.5 transition-all duration-150">
              <div className="flex items-start gap-3">
                <button onClick={() => toggleSelect(l.id)} className={btnGhostIcon + " mt-0.5"}>
                  {selected.has(l.id) ? <CheckSquare size={15} className="text-teal-600" /> : <Square size={15} />}
                </button>
                <div className="flex items-start justify-between gap-3 flex-1 min-w-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100">{l.naziv_firme}</h4>
                    {onViewCompany && (
                      <button onClick={() => onViewCompany(l.naziv_firme)} className="text-slate-300 dark:text-slate-600 hover:text-teal-600 dark:hover:text-teal-400" title="360° pregled firme">
                        <ExternalLink size={12} />
                      </button>
                    )}
                    <span className={"text-xs px-2 py-0.5 rounded-full " + (STATUS_BOJE[l.status] || "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400")}>{l.status}</span>
                    {l.izvor && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">{l.izvor}</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                    {(l.grad || l.drzava) && <span className="flex items-center gap-1"><MapPin size={12} /> {[l.grad, l.drzava].filter(Boolean).join(", ")}</span>}
                    {l.kontakt_osoba && <span className="flex items-center gap-1"><User size={12} /> {l.kontakt_osoba}</span>}
                    {l.telefon && <span className="flex items-center gap-1"><Phone size={12} /> {l.telefon}</span>}
                    <span className="flex items-center gap-1 font-medium text-slate-600 dark:text-slate-400"><User size={12} /> {l.kolega}</span>
                  </div>
                  {l.napomena && <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{l.napomena}</p>}
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
            </div>
          ))}
        </div>
      )}

      {(showNew || editing) && (
        <LeadForm initial={editing} currentUser={currentUser} existingList={data} onSave={handleSave}
          onClose={() => { setShowNew(false); setEditing(null); }} />
      )}

      {showImport && (
        <ImportModal
          title="Uvezi bazu lidova"
          columns={["Naziv firme", "Grad", "Država", "Kontakt osoba", "Telefon", "Email", "Izvor", "Kolega", "Status", "Napomena (nije obavezno)", "Datum leada (nije obavezno)"]}
          existingNames={data.map((l) => l.naziv_firme)}
          onClose={() => setShowImport(false)}
          onImport={async (rows) => {
            // Datum leada: prihvata 2026-05-19 ili 19.5.2026.
            const parseLeadDate = (s) => {
              const t = String(s || "").trim();
              let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
              if (m) return `${m[1]}-${m[2]}-${m[3]}T09:00:00.000Z`;
              m = t.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
              if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}T09:00:00.000Z`;
              return null;
            };
            const novi = rows.map((r) => ({
              naziv_firme: r[0] || "", grad: r[1] || "", drzava: r[2] || "", kontakt_osoba: r[3] || "",
              telefon: r[4] || "", email: r[5] || "", izvor: r[6] || "",
              kolega: COLLEAGUE_NAMES.includes(r[7]) ? r[7] : currentUser || "",
              status: LEAD_STATUSI.includes(r[8]) ? r[8] : "Novi",
              napomena: r[9] || "", podsjetnik_datum: null, podsjetnik_opis: "",
              created_by: currentUser || "Uvoz", created_at: parseLeadDate(r[10]) || new Date().toISOString(),
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
      className={"px-4 py-2.5 cursor-pointer select-none hover:text-slate-800 dark:text-slate-200 " + (align === "center" ? "text-center" : "")}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (sortDir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : <ChevronsUpDown size={12} className="text-slate-300 dark:text-slate-600" />}
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
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50">
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <span>Prikaz po strani:</span>
        <select
          className="text-sm rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
        >
          {[25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
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

export function KupciTab({ data, currentUser, onAdd, onUpdate, onDelete, onBulkImportKupci, onDeleteAll, canDelete = true, onViewCompany, presetLicenca, onPresetConsumed }) {
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

  useEffect(() => {
    if (presetLicenca) {
      setFLicenca(presetLicenca);
      setPage(1);
      onPresetConsumed && onPresetConsumed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetLicenca]);

  const handleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
    setPage(1);
  };

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return data.filter((k) => {
      if (query) {
        const fields = [k.naziv_firme, k.grad, k.drzava, k.naziv_proizvoda, k.naziv_proizvoda_2, k.serijski_broj, k.adresa];
        const matches = fields.some((f) => (f || "").toString().toLowerCase().includes(query));
        if (!matches) return false;
      }
      if (fLicenca !== "Sve" && licenseStatus(k.end_date).label !== fLicenca) return false;
      return true;
    });
  }, [data, q, fLicenca]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    const query = q.trim().toLowerCase();

    const relevance = (k) => {
      if (!query) return 0;
      const naziv = (k.naziv_firme || "").toLowerCase();
      if (naziv.startsWith(query)) return 0; // naziv firme počinje sa pretragom - najrelevantnije
      if (naziv.includes(query)) return 1; // naziv firme sadrži pretragu
      return 2; // pretraga je pogodila neko drugo polje (proizvod, serijski broj, adresa...)
    };

    arr.sort((a, b) => {
      if (query) {
        const ra = relevance(a);
        const rb = relevance(b);
        if (ra !== rb) return ra - rb;
      }
      let va = a[sortField], vb = b[sortField];
      if (sortField === "broj_licenci") { va = Number(va) || 0; vb = Number(vb) || 0; return (va - vb) * dir; }
      va = (va || "").toString().toLowerCase();
      vb = (vb || "").toString().toLowerCase();
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return arr;
  }, [filtered, sortField, sortDir, q]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageData = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSave = async (payload) => {
    if (editing) await onUpdate(editing.id, payload);
    else await onAdd(payload);
  };

  const exportCSV = () => {
    const headers = [
      "Naziv firme", "Grad", "Država", "Adresa", "Poštanski broj", "Serijski broj", "Broj licenci",
      "Naziv proizvoda", "Naziv proizvoda 2", "Revenue Type", "Status (izvorni)", "Start datum", "End datum",
      "Napomena", "Kreirao", "Datum kreiranja", "Zadnja izmjena od", "Datum zadnje izmjene",
    ];
    const rows = sorted.map((k) => [
      k.naziv_firme, k.grad, k.drzava, k.adresa, k.postanski_broj, k.serijski_broj, k.broj_licenci,
      k.naziv_proizvoda, k.naziv_proizvoda_2, k.revenue_type, k.izvorni_status, k.start_date, k.end_date,
      k.napomena, k.created_by, k.created_at, k.updated_by, k.updated_at,
    ]);
    downloadCSV(`kupci_${todayStr()}.csv`, headers, rows);
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
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          onClick={exportCSV}
        >
          <Download size={15} /> Izvoz CSV
        </button>
        {canDelete && (
          <button
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            onClick={() => setShowDeleteAll(true)}
            disabled={data.length === 0}
          >
            <Trash2 size={15} /> Obriši sve kupce
          </button>
        )}
        <button className={btnPrimary} onClick={() => setShowNew(true)} disabled={!currentUser}><Plus size={15} /> Dodaj kupca</button>
      </Toolbar>

      {sorted.length === 0 ? (
        <EmptyState icon={Building2} title="Nema unesenih kupaca" subtitle="Dodaj ručno ili uvezi tabelu postojećih kupaca i licenci."
          action={<button className={btnPrimary} onClick={() => setShowNew(true)} disabled={!currentUser}><Plus size={15} /> Dodaj prvog kupca</button>} />
      ) : (
        <>
        <div className="hidden sm:block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
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
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pageData.map((k) => {
                  const s = licenseStatus(k.end_date);
                  return (
                    <tr key={k.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">
                        <span className="inline-flex items-center gap-1.5">
                          {k.naziv_firme}
                          {onViewCompany && (
                            <button onClick={() => onViewCompany(k.naziv_firme)} className="text-slate-300 dark:text-slate-600 hover:text-teal-600 dark:hover:text-teal-400" title="360° pregled firme">
                              <ExternalLink size={12} />
                            </button>
                          )}
                        </span>
                        <div className="text-xs text-slate-400 dark:text-slate-500 font-normal"><MetaLine record={k} /></div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">
                        {k.grad && <div>{k.grad}</div>}
                        {k.drzava && <div className="text-xs text-slate-400 dark:text-slate-500">{k.drzava}</div>}
                        {!k.grad && !k.drzava && "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 text-xs">{[k.adresa, k.postanski_broj].filter(Boolean).join(", ") || "—"}</td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">
                        {k.naziv_proizvoda || "—"}
                        {k.naziv_proizvoda_2 && <div className="text-xs text-slate-400 dark:text-slate-500">{k.naziv_proizvoda_2}</div>}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 font-mono text-xs whitespace-nowrap">{k.serijski_broj || "—"}</td>
                      <td className="px-2 py-2.5 text-center text-slate-600 dark:text-slate-400 whitespace-nowrap">{k.broj_licenci ?? "—"}</td>
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">{fmtDate(k.start_date)}</td>
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">{fmtDate(k.end_date)}</td>
                      <td className="px-4 py-2.5"><span className={"text-xs px-2 py-0.5 rounded-full whitespace-nowrap " + s.cls}>{s.label}</span></td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1 justify-end">
                          <button className={btnGhostIcon} onClick={() => setEditing(k)} title="Uredi"><Pencil size={14} /></button>
                          {canDelete && <ConfirmDelete label={k.naziv_firme} onConfirm={() => onDelete(k.id)} />}
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

        {/* Mobilne kartice */}
        <div className="sm:hidden space-y-2.5">
          {pageData.map((k) => {
            const s = licenseStatus(k.end_date);
            return (
              <div key={k.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="font-semibold text-slate-900 dark:text-slate-100">{k.naziv_firme}</h4>
                      {onViewCompany && (
                        <button onClick={() => onViewCompany(k.naziv_firme)} className="text-slate-300 dark:text-slate-600 hover:text-teal-600 dark:hover:text-teal-400" title="360° pregled firme">
                          <ExternalLink size={12} />
                        </button>
                      )}
                      <span className={"text-xs px-2 py-0.5 rounded-full " + s.cls}>{s.label}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{k.naziv_proizvoda || "—"} · {[k.grad, k.drzava].filter(Boolean).join(", ")}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{fmtDate(k.start_date)} – {fmtDate(k.end_date)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button className={btnGhostIcon} onClick={() => setEditing(k)} title="Uredi"><Pencil size={14} /></button>
                    {canDelete && <ConfirmDelete label={k.naziv_firme} onConfirm={() => onDelete(k.id)} />}
                  </div>
                </div>
              </div>
            );
          })}
          <Pagination page={currentPage} setPage={setPage} pageSize={pageSize} setPageSize={setPageSize} total={sorted.length} />
        </div>
        </>
      )}

      {(showNew || editing) && (
        <KupacForm initial={editing} currentUser={currentUser} onSave={handleSave}
          onClose={() => { setShowNew(false); setEditing(null); }} />
      )}

      {showImport && (
        <ImportModal
          title="Uvezi / ažuriraj kupce (mjesečni export)"
          existingNames={data.map((k) => k.naziv_firme)}
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

export function PodrskaTab({ data, kupci, currentUser, onAdd, onUpdate, onDelete, onViewCompany }) {
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
            <div key={s.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md dark:hover:shadow-black/20 hover:-translate-y-0.5 transition-all duration-150">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100">{s.firma}</h4>
                    {onViewCompany && (
                      <button onClick={() => onViewCompany(s.firma)} className="text-slate-300 dark:text-slate-600 hover:text-teal-600 dark:hover:text-teal-400" title="360° pregled firme">
                        <ExternalLink size={12} />
                      </button>
                    )}
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center gap-1"><Calendar size={11} /> {fmtDate(s.datum)}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 flex items-center gap-1"><Wrench size={11} /> {s.tehnicar}</span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mt-2">{s.opis}</p>
                  {s.napomena && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{s.napomena}</p>}
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
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {items.length} {items.length === 1 ? "podsjetnik" : "podsjetnika"} za <span className="font-medium text-slate-700 dark:text-slate-300">{fKolega}</span>
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
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((r) => {
            const u = reminderUrgency(r.datum);
            return (
              <div key={r.tip + r.id} className="p-4 flex items-center gap-3">
                <span className={"w-2.5 h-2.5 rounded-full shrink-0 " + u.dotCls} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800 dark:text-slate-200">
                    <span className="font-semibold">{r.firma}</span>{" "}
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 ml-1">{r.tip}</span>
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{r.opis || "Podsjetnik"} · zadužen: {r.kolega} · {fmtDate(r.datum)}</p>
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
