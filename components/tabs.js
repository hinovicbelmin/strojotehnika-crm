"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import {
  Home, Target, TrendingUp, Building2, Wrench, Bell, Plus, Pencil,
  ArrowRightCircle, Phone, Mail, MapPin, Calendar, User, AlertTriangle,
  CheckCircle2, ChevronRight, ChevronLeft, Upload, ChevronUp, ChevronDown, ChevronsUpDown, Trash2, X, Download, ExternalLink, Square, CheckSquare,
  ArrowRight, Trophy, Newspaper, List, LayoutGrid,
  RefreshCw, MoreHorizontal, Clock, KeyRound, GraduationCap, MessageSquare, Bug,
  AlarmClock, History, Sun, Check, FileText,
} from "lucide-react";
import {
  COLLEAGUE_NAMES, SORTED_FOR_TECH, POTENCIJAL_STATUSI, LEAD_STATUSI, STATUS_BOJE, EU_COUNTRIES,
  FORECAST_STATUSI, FORECAST_STATUS_HEX, currentMonthStr, fmtMonth,
  inputCls, btnPrimary, btnSecondary, btnGhostIcon,
  todayStr, fmtDate, licenseStatus, reminderUrgency, getReminders, daysDiff, parseDateFlexible, downloadCSV,
  getColleagueDept, getForecastStatusWeight, isForecastWon, isForecastLost,
  COLLEAGUES, companyKey,
} from "../lib/crm";
import { Modal, Field, EmptyState, Toolbar, SearchBox, MetaLine, ImportModal, ConfirmDelete, DangerConfirmModal, BulkActionBar, ForecastStatusBadge } from "./ui";
import { Avatar, StatusPill, FilterPill, PanelLabel, SortHead, PageNav, daysAgo, relDate, fmtN, headerBtnSec } from "./crmBits";
import { NadogradnjaBadge } from "./nadogradnje";
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
  // Lead je "postao kupac" ako je njegov povezani potencijal Dobijen ILI je na samom leadu označeno "Postao kupac"
  // (npr. uvezeni lidovi koji nisu konvertovani kroz CRM pa nemaju povezan potencijal)
  const dobijeniLeadIds = new Set(potencijaliIzLeada.filter((p) => p.status === "Dobijen").map((p) => p.origin_lead_id));
  lidovi.forEach((l) => { if (l.postao_kupac) dobijeniLeadIds.add(l.id); });
  const dobijenoIzLeada = dobijeniLeadIds.size;
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
      podsjetnik_datum: "", podsjetnik_opis: "", postao_kupac: false,
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
        <Field label="Ishod">
          <label className="flex items-center gap-2 h-[38px] text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              checked={!!f.postao_kupac}
              onChange={(e) => setF({ ...f, postao_kupac: e.target.checked })}
            />
            Postao kupac
          </label>
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

const MJESECI = ["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"];
const L_SVI_IZVORI = "Svi izvori";
const L_BEZ_IZVORA = "(bez izvora)";
const L_SVE_KOLEGE = "Sve kolege";
const L_BILO_KADA = "Bilo kada";
const L_PERIODI = [L_BILO_KADA, "Ovaj mjesec", "Zadnjih 30 dana", "Zadnjih 90 dana", "Ova godina"];
const leadDatum = (l) => String(l.created_at || "").slice(0, 10);
const kratkiDatum = (d) => (d ? `${Number(d.slice(8, 10))}.${Number(d.slice(5, 7))}.` : "");

function periodOk(l, period) {
  if (period === L_BILO_KADA) return true;
  const d = leadDatum(l);
  if (!d) return false;
  const now = new Date();
  if (period === "Ovaj mjesec") return d.slice(0, 7) === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (period === "Ova godina") return d.slice(0, 4) === String(now.getFullYear());
  const n = daysAgo(d);
  if (n == null) return false;
  return period === "Zadnjih 30 dana" ? n <= 30 : n <= 90;
}

function KupacBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full whitespace-nowrap">
      <Trophy size={12} /> Postao kupac
    </span>
  );
}

function LidKpi({ label, value, sub, cls }) {
  return (
    <div className={"flex-1 min-w-[140px] rounded-2xl border px-4 py-3.5 " + cls}>
      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-2xl sm:text-[28px] font-bold tracking-tight leading-tight mt-0.5">{fmtN(value)}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400">{sub}</div>
    </div>
  );
}

export function LidoviTab({ data, potencijali = [], currentUser, onAdd, onUpdate, onDelete, onBulkImport, onConvert, onBulkUpdate, onBulkDelete, onViewCompany }) {
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("Svi");
  const [fIzvor, setFIzvor] = useState(L_SVI_IZVORI);
  const [fKolega, setFKolega] = useState(L_SVE_KOLEGE);
  const [fPeriod, setFPeriod] = useState(L_BILO_KADA);
  const [prikaz, setPrikaz] = useState("lista");
  const [limit, setLimit] = useState(100);
  const [editing, setEditing] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => { setLimit(100); }, [q, fStatus, fIzvor, fKolega, fPeriod]);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Isto pravilo kao u Pregledu: povezani potencijal je Dobijen ILI je lead označen "Postao kupac"
  const kupacIds = useMemo(() => {
    const s = new Set(potencijali.filter((p) => p.origin_lead_id && p.status === "Dobijen").map((p) => p.origin_lead_id));
    data.forEach((l) => { if (l.postao_kupac) s.add(l.id); });
    return s;
  }, [potencijali, data]);
  const isKupac = (l) => kupacIds.has(l.id);

  const izvorOf = (l) => (l.izvor || "").trim() || L_BEZ_IZVORA;
  const izvori = useMemo(() => [...new Set(data.map(izvorOf))].sort((a, b) => a.localeCompare(b, "hr")), [data]);

  const qMatch = (l) => {
    const qq = q.trim().toLowerCase();
    if (!qq) return true;
    return [l.naziv_firme, l.grad, l.kontakt_osoba, l.email, l.telefon, l.napomena].join(" ").toLowerCase().includes(qq);
  };
  const passes = (l, skip = {}) =>
    qMatch(l) &&
    (skip.izvor || fIzvor === L_SVI_IZVORI || izvorOf(l) === fIzvor) &&
    (skip.kolega || fKolega === L_SVE_KOLEGE || l.kolega === fKolega) &&
    periodOk(l, fPeriod);

  // osnova za brojke: svi filteri osim statusa
  const base = useMemo(() => data.filter((l) => passes(l)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, q, fIzvor, fKolega, fPeriod]);
  const statusCount = (s) => (s === "Svi" ? base.length : base.filter((l) => l.status === s).length);

  const filtered = useMemo(() => base
    .filter((l) => fStatus === "Svi" || l.status === fStatus)
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))),
  [base, fStatus]);

  const tot = base.length;
  const konv = base.filter((l) => l.status === "Konvertovan").length;
  const kup = base.filter(isKupac).length;
  const otv = base.filter((l) => l.status !== "Konvertovan" && l.status !== "Odbačen").length;
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
  const filtriran = q || fIzvor !== L_SVI_IZVORI || fKolega !== L_SVE_KOLEGE || fPeriod !== L_BILO_KADA;

  // po kolegi (ne gleda filter kolege) i po izvoru (ne gleda filter izvora)
  const poKolegi = useMemo(() => {
    const m = new Map();
    data.filter((l) => passes(l, { kolega: true })).forEach((l) => {
      const k = l.kolega || "—";
      const e = m.get(k) || { n: 0, kup: 0 };
      e.n++; if (isKupac(l)) e.kup++;
      m.set(k, e);
    });
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, q, fIzvor, fPeriod, kupacIds]);
  const poIzvoru = useMemo(() => {
    const m = new Map();
    data.filter((l) => passes(l, { izvor: true })).forEach((l) => {
      const k = izvorOf(l);
      const e = m.get(k) || { n: 0, kup: 0 };
      e.n++; if (isKupac(l)) e.kup++;
      m.set(k, e);
    });
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, q, fKolega, fPeriod, kupacIds]);
  const maxKol = poKolegi.length ? poKolegi[0][1].n : 1;

  const handleSave = async (payload) => {
    if (editing) await onUpdate(editing.id, payload);
    else await onAdd(payload);
  };

  const exportCSV = () => {
    const headers = [
      "Naziv firme", "Grad", "Država", "Kontakt osoba", "Telefon", "Email", "Izvor",
      "Kolega", "Status", "Postao kupac", "Napomena", "Podsjetnik datum", "Podsjetnik opis",
      "Kreirao", "Datum kreiranja", "Zadnja izmjena od", "Datum zadnje izmjene",
    ];
    const rows = filtered.map((l) => [
      l.naziv_firme, l.grad, l.drzava, l.kontakt_osoba, l.telefon, l.email, l.izvor,
      l.kolega, l.status, isKupac(l) ? "DA" : "NE", l.napomena, l.podsjetnik_datum, l.podsjetnik_opis,
      l.created_by, l.created_at, l.updated_by, l.updated_at,
    ]);
    downloadCSV(`lidovi_${todayStr()}.csv`, headers, rows);
  };

  // grupisanje liste po mjesecu
  const shown = filtered.slice(0, limit);
  const grupe = [];
  for (const l of shown) {
    const d = leadDatum(l);
    const key = d ? d.slice(0, 7) : "bez";
    let g = grupe[grupe.length - 1];
    if (!g || g.key !== key) {
      g = { key, label: d ? `${MJESECI[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}` : "Bez datuma", items: [] };
      grupe.push(g);
    }
    g.items.push(l);
  }
  const grupaCount = (key) => filtered.filter((l) => (leadDatum(l) ? leadDatum(l).slice(0, 7) : "bez") === key).length;

  const canConvert = (l) => l.status !== "Konvertovan" && l.status !== "Odbačen";
  const convertBtn = (l) => (
    <button type="button" disabled={!currentUser} onClick={(e) => { e.stopPropagation(); onConvert(l); }}
      className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-xs font-semibold whitespace-nowrap hover:bg-teal-100 dark:hover:bg-teal-900/50 disabled:opacity-50">
      Konvertuj <ArrowRight size={13} />
    </button>
  );

  const prikazBtn = (id, Icon, label) => (
    <button type="button" aria-label={label} title={label} onClick={() => setPrikaz(id)}
      className={"w-9 h-8 inline-flex items-center justify-center " + (prikaz === id ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100" : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200")}>
      <Icon size={15} />
    </button>
  );

  return (
    <div>
      {/* ---------- zaglavlje ---------- */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Lidovi</h2>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">
            {fmtN(data.length)} lidova · {fmtN(data.filter((l) => l.status !== "Konvertovan" && l.status !== "Odbačen").length)} čeka konverziju
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={headerBtnSec} onClick={() => setShowImport(true)}><Upload size={15} /> Uvoz</button>
          <button type="button" className={headerBtnSec} onClick={exportCSV}><Download size={15} /> Izvoz</button>
          <button type="button" className={btnPrimary + " h-9"} onClick={() => setShowNew(true)} disabled={!currentUser}><Plus size={15} /> Novi lead</button>
        </div>
      </div>

      {/* ---------- lijevak ---------- */}
      <div className="flex flex-wrap items-stretch gap-2 sm:gap-2.5 mb-4">
        <LidKpi label={filtriran ? "Lidova (filtrirano)" : "Ukupno lidova"} value={tot} sub="svi izvori" cls="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100" />
        <div className="hidden sm:flex items-center text-slate-300 dark:text-slate-600"><ChevronRight size={20} /></div>
        <LidKpi label="Konvertovano u potencijal" value={konv} sub={`${pct(konv, tot)}% lidova`} cls="bg-violet-50/70 dark:bg-violet-900/20 border-violet-100 dark:border-violet-900/50 text-violet-700 dark:text-violet-300" />
        <div className="hidden sm:flex items-center text-slate-300 dark:text-slate-600"><ChevronRight size={20} /></div>
        <LidKpi label="Postalo kupac" value={kup} sub={`${pct(kup, konv)}% konvertovanih`} cls="bg-emerald-50/70 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300" />
        <div className="hidden sm:block w-px bg-slate-200 dark:bg-slate-700 mx-1" />
        <LidKpi label="Čeka konverziju" value={otv} sub="još nije potencijal" cls="bg-amber-50/70 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/50 text-amber-700 dark:text-amber-300" />
      </div>

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

      <div className="xl:flex xl:items-start xl:gap-4">
        <div className="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
          {/* statusi */}
          <div className="flex items-center gap-4 px-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-4 overflow-x-auto -mb-px">
              {["Svi", ...LEAD_STATUSI].map((s) => {
                const on = fStatus === s;
                return (
                  <button key={s} type="button" onClick={() => setFStatus(s)}
                    className={"h-11 inline-flex items-center gap-1.5 border-b-2 text-[13.5px] whitespace-nowrap transition-colors " +
                      (on ? "border-teal-600 text-teal-700 dark:text-teal-400 font-semibold" : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200")}>
                    {s}
                    <span className={"text-[11px] px-1.5 rounded-full " + (on ? "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400")}>{statusCount(s)}</span>
                  </button>
                );
              })}
            </div>
            <div className="ml-auto hidden sm:flex border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden shrink-0">
              {prikazBtn("lista", List, "Prikaz: lista")}
              {prikazBtn("ploca", LayoutGrid, "Prikaz: ploča po statusu")}
            </div>
          </div>

          {/* filteri */}
          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <div className="w-full sm:w-72 sm:flex-none"><SearchBox value={q} onChange={setQ} placeholder="Firma, kontakt, grad..." /></div>
            <FilterPill label="Izvor" value={fIzvor} defaultValue={L_SVI_IZVORI} onChange={setFIzvor} options={[L_SVI_IZVORI, ...izvori]} />
            <FilterPill label="Kolega" value={fKolega} defaultValue={L_SVE_KOLEGE} onChange={setFKolega} options={[L_SVE_KOLEGE, ...COLLEAGUE_NAMES]} />
            <FilterPill label="Period" value={fPeriod} defaultValue={L_BILO_KADA} onChange={setFPeriod} options={L_PERIODI} />
          </div>

          {filtered.length === 0 ? (
            <div className="px-4 pb-4">
              <EmptyState icon={TrendingUp} title={data.length === 0 ? "Nema unesenih lidova" : "Nema lidova za odabrane filtere"}
                subtitle={data.length === 0 ? "Dodaj ručno ili uvezi generisanu bazu lidova." : "Promijeni pretragu ili filtere."}
                action={data.length === 0 ? <button className={btnPrimary} onClick={() => setShowNew(true)} disabled={!currentUser}><Plus size={15} /> Dodaj prvi lead</button> : null} />
            </div>
          ) : prikaz === "ploca" ? (
            /* ---------- ploča po statusu ---------- */
            <div className="px-4 pb-4 overflow-x-auto">
              <div className="grid grid-cols-5 gap-3 min-w-[980px]">
                {LEAD_STATUSI.map((s) => {
                  const items = filtered.filter((l) => l.status === s);
                  return (
                    <div key={s} className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-2.5 flex flex-col gap-2 min-h-[120px]">
                      <div className="flex items-center justify-between px-1">
                        <StatusPill status={s} />
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{items.length}</span>
                      </div>
                      {items.slice(0, 60).map((l) => (
                        <div key={l.id} onClick={() => setEditing(l)}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 cursor-pointer hover:border-teal-300 dark:hover:border-teal-700 hover:shadow-sm transition-all">
                          <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 leading-snug">{l.naziv_firme}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{[l.kontakt_osoba, l.grad].filter(Boolean).join(" · ") || l.email}</div>
                          <div className="flex items-center justify-between gap-1.5 mt-2">
                            <Avatar name={l.kolega} size="sm" />
                            {isKupac(l) ? <KupacBadge /> : canConvert(l) ? convertBtn(l) : <span className="text-[11px] text-slate-400">{kratkiDatum(leadDatum(l))}</span>}
                          </div>
                        </div>
                      ))}
                      {items.length > 60 && <div className="text-center text-xs text-slate-400 py-1">+ {items.length - 60} više</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ---------- lista po mjesecima ---------- */
            <div className="pb-2">
              {grupe.map((g) => (
                <div key={g.key}>
                  <div className="flex items-center gap-2.5 px-4 pt-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {g.label}
                    <span className="font-semibold text-slate-400 dark:text-slate-500 tracking-normal">{grupaCount(g.key)}</span>
                    <span className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
                  </div>
                  {g.items.map((l) => (
                    <div key={l.id} onClick={() => setEditing(l)}
                      className="group grid grid-cols-[28px_minmax(0,1fr)_auto] md:grid-cols-[28px_minmax(0,1.2fr)_minmax(0,1.2fr)_128px_122px_30px_164px] gap-x-3 gap-y-1 items-center px-4 py-2.5 border-t border-slate-50 dark:border-slate-800/60 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <button type="button" onClick={(e) => { e.stopPropagation(); toggleSelect(l.id); }} className={btnGhostIcon} aria-label="Odaberi lead">
                        {selected.has(l.id) ? <CheckSquare size={15} className="text-teal-600" /> : <Square size={15} className="text-slate-300 dark:text-slate-600" />}
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{l.naziv_firme}</span>
                          {onViewCompany && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); onViewCompany(l.naziv_firme); }}
                              className="text-slate-300 dark:text-slate-600 hover:text-teal-600 dark:hover:text-teal-400 opacity-0 group-hover:opacity-100 shrink-0" aria-label="360° pregled firme" title="360° pregled firme">
                              <ExternalLink size={12} />
                            </button>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {[l.kontakt_osoba, l.grad].filter(Boolean).join(" · ") || l.email || "—"}
                          {l.izvor ? <span className="text-slate-400 dark:text-slate-500"> · {l.izvor}</span> : null}
                        </div>
                        {/* mobitel: status i ishod ispod naziva */}
                        <div className="md:hidden flex flex-wrap items-center gap-1.5 mt-1.5">
                          <StatusPill status={l.status} />{isKupac(l) && <KupacBadge />}
                        </div>
                      </div>
                      <div className="hidden md:block text-[12.5px] text-slate-600 dark:text-slate-400 truncate" title={l.napomena || ""}>{l.napomena || ""}</div>
                      <div className="hidden md:block"><StatusPill status={l.status} /></div>
                      <div className="hidden md:block">{isKupac(l) && <KupacBadge />}</div>
                      <div className="hidden md:block"><Avatar name={l.kolega} /></div>
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">{kratkiDatum(leadDatum(l))}</span>
                        {canConvert(l) && convertBtn(l)}
                        <span className="inline-flex items-center opacity-40 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                          <ConfirmDelete label={l.naziv_firme} onConfirm={() => onDelete(l.id)} />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              {filtered.length > limit && (
                <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-center">
                  <button type="button" className={btnSecondary} onClick={() => setLimit(limit + 100)}>
                    Prikaži još ({fmtN(filtered.length - limit)} preostalo)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ---------- desna kolona ---------- */}
        <div className="hidden xl:flex flex-col gap-4 w-[300px] shrink-0">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
            <PanelLabel right={fKolega !== L_SVE_KOLEGE && <button type="button" className="text-xs text-teal-700 dark:text-teal-400 hover:underline" onClick={() => setFKolega(L_SVE_KOLEGE)}>Svi</button>}>Po kolegi</PanelLabel>
            <div className="flex flex-col gap-2.5 mt-1">
              {poKolegi.length === 0 && <p className="text-xs text-slate-400">Nema podataka.</p>}
              {poKolegi.map(([k, v]) => (
                <button key={k} type="button" onClick={() => setFKolega(fKolega === k ? L_SVE_KOLEGE : k)}
                  className={"flex items-center gap-2.5 text-left rounded-lg -mx-1.5 px-1.5 py-1 " + (fKolega === k ? "bg-teal-50 dark:bg-teal-900/30" : "hover:bg-slate-50 dark:hover:bg-slate-800/60")}>
                  <Avatar name={k} size="sm" />
                  <span className="flex-1 min-w-0">
                    <span className="flex justify-between gap-2 text-[12.5px] text-slate-700 dark:text-slate-300">
                      <span className="truncate">{k}</span>
                      <span className="whitespace-nowrap"><b className="text-slate-900 dark:text-slate-100">{v.n}</b>{v.kup > 0 && <span className="text-emerald-700 dark:text-emerald-400"> · {v.kup} kup.</span>}</span>
                    </span>
                    <span className="block h-1.5 mt-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <span className="block h-full rounded-full bg-teal-500" style={{ width: `${Math.round((v.n / maxKol) * 100)}%` }} />
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
            <PanelLabel right={fIzvor !== L_SVI_IZVORI && <button type="button" className="text-xs text-teal-700 dark:text-teal-400 hover:underline" onClick={() => setFIzvor(L_SVI_IZVORI)}>Svi</button>}>Po izvoru</PanelLabel>
            <div className="flex flex-col gap-1 mt-1">
              {poIzvoru.length === 0 && <p className="text-xs text-slate-400">Nema podataka.</p>}
              {poIzvoru.map(([k, v]) => (
                <button key={k} type="button" onClick={() => setFIzvor(fIzvor === k ? L_SVI_IZVORI : k)}
                  className={"flex items-center gap-2.5 text-left rounded-lg -mx-1.5 px-1.5 py-1.5 " + (fIzvor === k ? "bg-teal-50 dark:bg-teal-900/30" : "hover:bg-slate-50 dark:hover:bg-slate-800/60")}>
                  <span className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 inline-flex items-center justify-center shrink-0"><Newspaper size={15} /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold text-slate-800 dark:text-slate-100 truncate">{k}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{v.n} {v.n === 1 ? "lead" : "lidova"} · {v.kup} {v.kup === 1 ? "kupac" : "kupaca"}</span>
                  </span>
                  <b className="text-sm text-slate-900 dark:text-slate-100" title="Udio lidova koji su postali kupac">{pct(v.kup, v.n)}%</b>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {(showNew || editing) && (
        <LeadForm initial={editing} currentUser={currentUser} existingList={data} onSave={handleSave}
          onClose={() => { setShowNew(false); setEditing(null); }} />
      )}

      {showImport && (
        <ImportModal
          title="Uvezi bazu lidova"
          columns={["Naziv firme", "Grad", "Država", "Kontakt osoba", "Telefon", "Email", "Izvor", "Kolega", "Status", "Napomena (nije obavezno)", "Datum leada (nije obavezno)", "Postao kupac DA/NE (nije obavezno)"]}
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
              postao_kupac: /^(da|yes|1|true)$/i.test(String(r[11] || "").trim()),
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
/*  ZAJEDNIČKO: KPI pločica, meni "više", firme                            */
/* ====================================================================== */

const KPI_TON = {
  neutral: ["bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700", "text-slate-900 dark:text-slate-100", "text-slate-600 dark:text-slate-300"],
  amber: ["bg-amber-50/70 dark:bg-amber-900/20 border-amber-200/80 dark:border-amber-900/50", "text-amber-800 dark:text-amber-300", "text-amber-700 dark:text-amber-300"],
  blue: ["bg-blue-50/70 dark:bg-blue-900/20 border-blue-200/80 dark:border-blue-900/50", "text-blue-700 dark:text-blue-300", "text-blue-700 dark:text-blue-300"],
  red: ["bg-red-50/70 dark:bg-red-900/20 border-red-200/80 dark:border-red-900/50", "text-red-700 dark:text-red-300", "text-red-700 dark:text-red-300"],
};
function KpiTile({ icon: Icon, label, value, sub, tone = "neutral", active, onClick }) {
  const [box, val, ic] = KPI_TON[tone];
  return (
    <button type="button" onClick={onClick}
      className={"flex-1 min-w-[190px] text-left rounded-2xl border px-4 py-3.5 flex items-start gap-3 transition-all hover:shadow-sm " + box +
        (active ? " ring-2 ring-teal-500 dark:ring-teal-400" : "")}>
      <span className={"w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-inherit inline-flex items-center justify-center shrink-0 " + ic}>
        <Icon size={17} />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-slate-600 dark:text-slate-400">{label}</span>
        <span className={"block text-2xl sm:text-[26px] font-bold tracking-tight leading-tight " + val}>{value}</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">{sub}</span>
      </span>
    </button>
  );
}

// Dugme "⋯" s padajućim menijem (npr. rijetke / opasne akcije)
function IconMenu({ label, items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" aria-label={label} title={label} aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className={headerBtnSec + " w-9 justify-center px-0"}>
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1.5 z-30 w-60 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-1.5">
          {items.map((it) => (
            <button key={it.label} type="button" disabled={it.disabled} onClick={() => { setOpen(false); it.onClick(); }}
              className={"w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm disabled:opacity-40 " +
                (it.danger ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30" : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800")}>
              {it.icon && <it.icon size={15} />} {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const PRODAVACI_IMENA = COLLEAGUES.filter((c) => c.dept === "Prodaja").map((c) => c.name);
// glavni + dodatni prodavač firme iz Baze potencijala
function prodavaciPotencijala(p) {
  return [...new Set([p.kolega, ...(p.prodavaci || [])].filter((x) => x && x !== "Nedodijeljeno"))];
}

const DRZAVA_KOD = {
  "Bosna i Hercegovina": "BA", Hrvatska: "HR", Albanija: "AL", Srbija: "RS", Slovenija: "SI",
  "Crna Gora": "ME", Kosovo: "XK", "Sjeverna Makedonija": "MK", Austrija: "AT", Njemačka: "DE", Italija: "IT",
};

/* ====================================================================== */
/*  KUPCI                                                                   */
/* ====================================================================== */

const KUPAC_PRAZNO = {
  naziv_firme: "", grad: "", drzava: "", adresa: "", postanski_broj: "",
  serijski_broj: "", broj_licenci: "",
  naziv_proizvoda: "", naziv_proizvoda_2: "", revenue_type: "", izvorni_status: "",
  start_date: "", end_date: "", napomena: "",
};

function KupacForm({ initial, prefill, currentUser, onSave, onClose }) {
  const [f, setF] = useState(initial || { ...KUPAC_PRAZNO, ...(prefill || {}) });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async () => {
    if (!f.naziv_firme.trim() || !currentUser) return;
    setBusy(true);
    try {
      const payload = {
        ...f,
        broj_licenci: f.broj_licenci === "" || f.broj_licenci == null ? null : Number(f.broj_licenci),
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
  const title = initial ? "Uredi licencu" : prefill ? `Nova licenca — ${prefill.naziv_firme}` : "Novi kupac";
  return (
    <Modal title={title} onClose={onClose} wide>
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

// ---------- pomoćne funkcije za licence ----------
const K_ROKOVI = ["Sve", "Ističe u 30 dana", "Obnova za 31–90 dana", "Isteklo", "Aktivno"];
const K_PRESET = { "Ističe uskoro": "Ističe u 30 dana", Isteklo: "Isteklo", Aktivno: "Aktivno" };
const POZNATI_PROIZVODI = ["SOLIDWORKS", "SolidCAM", "DraftSight", "SWOOD", "DriveWorks", "3DEXPERIENCE", "SolidSteel", "Geomagic", "Fikus", "PDM", "Simulation", "Composer"];
const BEZ_PROIZVODA = "(bez proizvoda)";

const licKom = (k) => { const n = Number(k.broj_licenci); return n > 0 ? n : 1; };
const licDana = (k) => (k.end_date ? daysDiff(k.end_date) : null);
function rokOk(k, rok) {
  if (rok === "Sve") return true;
  const n = licDana(k);
  if (n == null) return false;
  if (rok === "Ističe u 30 dana") return n >= 0 && n <= 30;
  if (rok === "Obnova za 31–90 dana") return n > 30 && n <= 90;
  if (rok === "Isteklo") return n < 0;
  return n > 30; // Aktivno
}
function proizvodPorodica(naziv) {
  const t = String(naziv || "").trim().split(/\s+/)[0];
  if (!t) return BEZ_PROIZVODA;
  return POZNATI_PROIZVODI.find((p) => p.toUpperCase() === t.toUpperCase()) || t;
}
const kratkiProizvod = (s) => String(s || "")
  .replace(/^SOLIDWORKS\s+/i, "SW ").replace(/^DraftSight\s+/i, "DS ").replace(/^3DEXPERIENCE\s+Works\s+/i, "3DX ").trim();
function dokle(dateStr) {
  if (!dateStr) return "—";
  const n = daysDiff(dateStr);
  if (n === 0) return "danas";
  const a = Math.abs(n);
  const t = a <= 45 ? `${a} ${a === 1 ? "dan" : "dana"}` : `${Math.round(a / 30.4)} mj.`;
  return n > 0 ? `za ${t}` : `prije ${t}`;
}
function dokleCls(dateStr) {
  if (!dateStr) return "text-slate-400 dark:text-slate-500";
  const n = daysDiff(dateStr);
  if (n < 0) return "text-red-700 dark:text-red-400";
  if (n <= 30) return "text-amber-700 dark:text-amber-400";
  if (n <= 90) return "text-blue-700 dark:text-blue-400";
  return "text-slate-700 dark:text-slate-300";
}
const kratakDatum = (d) => (d ? `${Number(d.slice(8, 10))}.${Number(d.slice(5, 7))}.${d.slice(0, 4)}.` : "—");

const LIC_PILL = {
  Aktivno: ["bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-300", "bg-green-500"],
  "Ističe uskoro": ["bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300", "bg-amber-500"],
  Isteklo: ["bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300", "bg-red-500"],
  Nepoznato: ["bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300", "bg-slate-400"],
};
function LicPill({ status }) {
  const [cls, dot] = LIC_PILL[status] || LIC_PILL.Nepoznato;
  return (
    <span className={"inline-flex items-center gap-1.5 text-xs font-semibold pl-2 pr-2.5 py-0.5 rounded-full whitespace-nowrap " + cls}>
      <span className={"w-2 h-2 rounded-full " + dot} /> {status}
    </span>
  );
}
function ProizvodChip({ children }) {
  return <span className="text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-px rounded-md whitespace-nowrap">{children}</span>;
}
function PeriodBar({ start, end }) {
  if (!start || !end) return <span className="text-xs text-slate-400">{kratakDatum(start)} – {kratakDatum(end)}</span>;
  const s = new Date(start + "T00:00:00"), e = new Date(end + "T00:00:00");
  const tot = Math.max(1, (e - s) / DAY_MS);
  const done = Math.min(tot, Math.max(0, (Date.now() - s) / DAY_MS));
  const n = daysDiff(end);
  const col = n < 0 ? "bg-red-500" : n <= 30 ? "bg-amber-500" : "bg-teal-500";
  return (
    <div className="min-w-[140px]" title={`${fmtDate(start)} – ${fmtDate(end)}`}>
      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className={"h-full rounded-full " + col} style={{ width: `${Math.round((done / tot) * 100)}%` }} />
      </div>
      <div className="flex justify-between text-[11px] text-slate-400 dark:text-slate-500 mt-1"><span>{kratakDatum(start)}</span><span>{kratakDatum(end)}</span></div>
    </div>
  );
}

// grupiše licence po firmi (isti ključ kao i drugdje u CRM-u: "ACO Sarajevo" = "ACO SARAJEVO d.o.o.")
function grupisiPoFirmi(licence, prodavaciIdx) {
  const m = new Map();
  for (const k of licence) {
    const key = companyKey(k.naziv_firme) || String(k.naziv_firme || "").trim().toLowerCase();
    let f = m.get(key);
    if (!f) {
      f = { key, naziv: k.naziv_firme || "—", grad: "", drzava: "", adresa: "", postanski_broj: "", lic: [] };
      m.set(key, f);
    }
    f.lic.push(k);
    for (const p of ["grad", "drzava", "adresa", "postanski_broj"]) if (!f[p] && k[p]) f[p] = k[p];
  }
  return [...m.values()].map((f) => {
    const ends = f.lic.map((k) => k.end_date).filter(Boolean);
    const buduci = ends.filter((d) => daysDiff(d) >= 0).sort();
    const sljedeca = buduci[0] || ends.sort().slice(-1)[0] || null;
    return {
      ...f,
      sljedeca,
      status: sljedeca ? licenseStatus(sljedeca).label : "Nepoznato",
      kom: f.lic.reduce((s, k) => s + licKom(k), 0),
      isteklih: f.lic.filter((k) => k.end_date && daysDiff(k.end_date) < 0).length,
      prodavaci: prodavaciIdx.get(f.key) || [],
    };
  });
}
// sortiranje po sljedećoj obnovi: prvo one koje dolaze (najbliže prve), pa istekle (najsvježije prve), pa bez datuma
function obnovaRang(f) {
  if (!f.sljedeca) return [2, 0];
  const n = daysDiff(f.sljedeca);
  return n >= 0 ? [0, n] : [1, -n];
}

export function KupciTab({ data, potencijali = [], nadogradnjeInfo, currentUser, onAdd, onUpdate, onDelete, onBulkImportKupci, onDeleteAll, canDelete = true, onViewCompany, presetLicenca, onPresetConsumed }) {
  const [q, setQ] = useState("");
  const [rok, setRok] = useState("Sve");
  const [fProizvod, setFProizvod] = useState("Svi");
  const [fDrzava, setFDrzava] = useState("Sve");
  const [fProdavac, setFProdavac] = useState("Svi");
  const [prikaz, setPrikaz] = useState("firme");
  const [sortF, setSortF] = useState({ field: "sljedeca", dir: "asc" });
  const [sortL, setSortL] = useState({ field: "end_date", dir: "asc" });
  const [otvorene, setOtvorene] = useState(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [editing, setEditing] = useState(null);
  const [prefill, setPrefill] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showDeleteAll, setShowDeleteAll] = useState(false);

  useEffect(() => {
    if (presetLicenca) {
      setRok(K_PRESET[presetLicenca] || "Sve");
      setPage(1);
      onPresetConsumed && onPresetConsumed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetLicenca]);
  useEffect(() => { setPage(1); }, [q, rok, fProizvod, fDrzava, fProdavac, prikaz]);

  // prodavač firme iz Baze potencijala
  const prodavaciIdx = useMemo(() => {
    const m = new Map();
    for (const p of potencijali) {
      const key = companyKey(p.naziv_firme);
      if (!key) continue;
      const imena = prodavaciPotencijala(p);
      if (imena.length && !m.has(key)) m.set(key, imena);
    }
    return m;
  }, [potencijali]);
  const prodavacLicence = (k) => (prodavaciIdx.get(companyKey(k.naziv_firme)) || [])[0] || "Nedodijeljeno";

  const drzave = useMemo(() => [...new Set(data.map((k) => k.drzava).filter(Boolean))].sort((a, b) => a.localeCompare(b, "hr")), [data]);
  const porodice = useMemo(() => [...new Set(data.map((k) => proizvodPorodica(k.naziv_proizvoda)))].sort((a, b) => a.localeCompare(b, "hr")), [data]);

  const query = q.trim().toLowerCase();
  // svi filteri osim roka (za pločice, kalendar i desnu kolonu)
  const base = useMemo(() => data.filter((k) => {
    if (query) {
      const polja = [k.naziv_firme, k.grad, k.drzava, k.naziv_proizvoda, k.naziv_proizvoda_2, k.serijski_broj, k.adresa];
      if (!polja.some((x) => (x || "").toString().toLowerCase().includes(query))) return false;
    }
    if (fProizvod !== "Svi" && proizvodPorodica(k.naziv_proizvoda) !== fProizvod) return false;
    if (fDrzava !== "Sve" && k.drzava !== fDrzava) return false;
    if (fProdavac !== "Svi" && prodavacLicence(k) !== fProdavac) return false;
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [data, query, fProizvod, fDrzava, fProdavac, prodavaciIdx]);
  const filtered = useMemo(() => base.filter((k) => rokOk(k, rok)), [base, rok]);

  const relevance = (naziv) => {
    if (!query) return 0;
    const n = (naziv || "").toLowerCase();
    return n.startsWith(query) ? 0 : n.includes(query) ? 1 : 2;
  };

  // ---------- po firmi ----------
  const firme = useMemo(() => {
    const arr = grupisiPoFirmi(filtered, prodavaciIdx);
    const dir = sortF.dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      const r = relevance(a.naziv) - relevance(b.naziv);
      if (r) return r;
      if (sortF.field === "naziv") return a.naziv.localeCompare(b.naziv, "hr") * dir;
      if (sortF.field === "kom") return (a.kom - b.kom) * dir;
      const ra = obnovaRang(a), rb = obnovaRang(b);
      return (ra[0] - rb[0] || ra[1] - rb[1]) * dir;
    });
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, prodavaciIdx, sortF, query]);

  // ---------- po licenci ----------
  const licence = useMemo(() => {
    const arr = [...filtered];
    const dir = sortL.dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      const r = relevance(a.naziv_firme) - relevance(b.naziv_firme);
      if (r) return r;
      if (sortL.field === "broj_licenci") return ((Number(a.broj_licenci) || 0) - (Number(b.broj_licenci) || 0)) * dir;
      const va = (a[sortL.field] || "").toString().toLowerCase(), vb = (b[sortL.field] || "").toString().toLowerCase();
      if (!va && vb) return 1;
      if (va && !vb) return -1;
      return va.localeCompare(vb, "hr") * dir;
    });
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortL, query]);

  const ukupno = prikaz === "firme" ? firme.length : licence.length;
  const totalPages = Math.max(1, Math.ceil(ukupno / pageSize));
  const cp = Math.min(page, totalPages);
  const firmePage = firme.slice((cp - 1) * pageSize, cp * pageSize);
  const licencePage = licence.slice((cp - 1) * pageSize, cp * pageSize);

  // ---------- brojke (pločice, desna kolona) ----------
  const stat = (r) => {
    const ls = base.filter((k) => rokOk(k, r));
    return { firme: new Set(ls.map((k) => companyKey(k.naziv_firme))).size, kom: ls.reduce((s, k) => s + licKom(k), 0) };
  };
  const sSve = stat("Sve"), s30 = stat("Ističe u 30 dana"), s90 = stat("Obnova za 31–90 dana"), sIst = stat("Isteklo");
  const firmeBase = useMemo(() => grupisiPoFirmi(base, prodavaciIdx), [base, prodavaciIdx]);
  const zaObnovu = firmeBase
    .filter((f) => f.sljedeca && daysDiff(f.sljedeca) >= 0 && daysDiff(f.sljedeca) <= 30)
    .sort((a, b) => a.sljedeca.localeCompare(b.sljedeca));

  const kalendar = useMemo(() => {
    const now = new Date();
    const mjeseci = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      mjeseci.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: MJESECI[d.getMonth()].slice(0, 3).toLowerCase(), god: d.getFullYear(), n: 0 });
    }
    for (const k of base) {
      if (!k.end_date || daysDiff(k.end_date) < 0) continue;
      const m = mjeseci.find((x) => x.key === k.end_date.slice(0, 7));
      if (m) m.n += licKom(k);
    }
    return mjeseci;
  }, [base]);
  const maxKal = Math.max(1, ...kalendar.map((m) => m.n));

  const poProizvodu = useMemo(() => {
    const m = new Map();
    base.forEach((k) => { const p = proizvodPorodica(k.naziv_proizvoda); m.set(p, (m.get(p) || 0) + licKom(k)); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [base]);
  const maxProiz = poProizvodu.length ? poProizvodu[0][1] : 1;

  const nFirmiUk = useMemo(() => new Set(data.map((k) => companyKey(k.naziv_firme))).size, [data]);
  const nLicUk = useMemo(() => data.reduce((s, k) => s + licKom(k), 0), [data]);
  const zadnjiUvoz = useMemo(() => data.map((k) => String(k.created_at || "").slice(0, 10)).filter(Boolean).sort().slice(-1)[0], [data]);

  const toggleFirma = (key) => setOtvorene((prev) => {
    const n = new Set(prev);
    if (n.has(key)) n.delete(key); else n.add(key);
    return n;
  });
  const otvoriFirmu = (f) => {
    setPrikaz("firme");
    setOtvorene((prev) => new Set(prev).add(f.key));
  };
  const toggleRok = (r) => setRok(rok === r ? "Sve" : r);

  const handleSave = async (payload) => {
    if (editing) await onUpdate(editing.id, payload);
    else await onAdd(payload);
  };
  const novaLicenca = (f) => {
    setEditing(null);
    setPrefill({ naziv_firme: f.naziv, grad: f.grad, drzava: f.drzava, adresa: f.adresa, postanski_broj: f.postanski_broj });
    setShowNew(true);
  };

  const exportCSV = () => {
    const headers = [
      "Naziv firme", "Grad", "Država", "Adresa", "Poštanski broj", "Serijski broj", "Broj licenci",
      "Naziv proizvoda", "Naziv proizvoda 2", "Revenue Type", "Status (izvorni)", "Start datum", "End datum",
      "Status licence", "Prodavač", "Napomena", "Kreirao", "Datum kreiranja", "Zadnja izmjena od", "Datum zadnje izmjene",
    ];
    const rows = licence.map((k) => [
      k.naziv_firme, k.grad, k.drzava, k.adresa, k.postanski_broj, k.serijski_broj, k.broj_licenci,
      k.naziv_proizvoda, k.naziv_proizvoda_2, k.revenue_type, k.izvorni_status, k.start_date, k.end_date,
      licenseStatus(k.end_date).label, prodavacLicence(k), k.napomena, k.created_by, k.created_at, k.updated_by, k.updated_at,
    ]);
    downloadCSV(`kupci_${todayStr()}.csv`, headers, rows);
  };

  const lokacija = (grad, drzava) => {
    const kod = DRZAVA_KOD[drzava];
    return (
      <span className="inline-flex items-center gap-1.5 min-w-0">
        {kod && <span className="text-[10.5px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1 leading-4">{kod}</span>}
        <span className="truncate">{[grad, kod ? "" : drzava].filter(Boolean).join(" · ") || (kod ? "" : "—")}</span>
      </span>
    );
  };
  const proizvodiChips = (f) => {
    const ps = f.lic.map((k) => kratkiProizvod(k.naziv_proizvoda) + (licKom(k) > 1 ? ` ×${licKom(k)}` : "")).filter((x) => x.trim());
    const uniq = [...new Set(ps)];
    return (
      <div className="flex flex-wrap gap-1.5">
        {uniq.slice(0, 2).map((p) => <ProizvodChip key={p}>{p}</ProizvodChip>)}
        {uniq.length > 2 && <ProizvodChip>+{uniq.length - 2}</ProizvodChip>}
        {uniq.length === 0 && <span className="text-xs text-slate-400">—</span>}
      </div>
    );
  };
  const licenceDetalji = (f) => (
    <div className="bg-white dark:bg-slate-900 border border-teal-100 dark:border-teal-900/60 rounded-xl px-3.5 pb-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2 py-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Licence · {f.lic.length} {plural(f.lic.length, "serijski broj", "serijska broja", "serijskih brojeva")}
        </span>
        <span className="flex gap-2">
          {onViewCompany && (
            <button type="button" className={headerBtnSec + " h-8 text-[12.5px] px-2.5"} onClick={() => onViewCompany(f.naziv)}><ExternalLink size={13} /> 360° firme</button>
          )}
          {canDelete && <button type="button" className={headerBtnSec + " h-8 text-[12.5px] px-2.5"} disabled={!currentUser} onClick={() => novaLicenca(f)}><Plus size={13} /> Licenca</button>}
        </span>
      </div>
      {f.lic.map((k) => (
        <div key={k.id} className="grid grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[190px_minmax(0,1fr)_64px_190px_130px] gap-x-3.5 gap-y-1.5 items-center py-2 border-t border-dashed border-slate-200 dark:border-slate-700">
          <span className="font-mono text-xs text-slate-600 dark:text-slate-400 break-all">{k.serijski_broj || "— bez serijskog broja —"}</span>
          <span className="lg:hidden justify-self-end"><LicPill status={licenseStatus(k.end_date).label} /></span>
          <span className="text-[13px] text-slate-900 dark:text-slate-100 font-medium min-w-0">
            {k.naziv_proizvoda || "—"}
            {k.naziv_proizvoda_2 && <span className="text-slate-400 dark:text-slate-500 font-normal"> · {k.naziv_proizvoda_2}</span>}
            {k.napomena && <span className="block text-xs text-slate-500 dark:text-slate-400 font-normal truncate" title={k.napomena}>{k.napomena}</span>}
          </span>
          <span className="text-[13px] text-slate-700 dark:text-slate-300">{k.broj_licenci ?? "—"} kom.</span>
          <PeriodBar start={k.start_date} end={k.end_date} />
          <span className="hidden lg:block"><LicPill status={licenseStatus(k.end_date).label} /></span>
        </div>
      ))}
    </div>
  );

  const prikazBtn = (id, Icon, label) => (
    <button type="button" onClick={() => setPrikaz(id)}
      className={"h-8 px-3 inline-flex items-center gap-1.5 text-[13px] " +
        (prikaz === id ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200")}>
      <Icon size={14} /> {label}
    </button>
  );

  return (
    <div>
      {/* ---------- zaglavlje ---------- */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Kupci i licence</h2>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">
            {fmtN(nFirmiUk)} {plural(nFirmiUk, "firma", "firme", "firmi")} · {fmtN(nLicUk)} {plural(nLicUk, "licenca", "licence", "licenci")}
            {zadnjiUvoz && <> · zadnje ažuriranje {fmtDate(zadnjiUvoz)}</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canDelete && <button type="button" className={headerBtnSec} onClick={() => setShowImport(true)}><RefreshCw size={15} /> Mjesečno ažuriranje</button>}
          <button type="button" className={headerBtnSec} onClick={exportCSV}><Download size={15} /> Izvoz</button>
          {canDelete && <button type="button" className={btnPrimary + " h-9"} onClick={() => { setEditing(null); setPrefill(null); setShowNew(true); }} disabled={!currentUser}><Plus size={15} /> Novi kupac</button>}
          {canDelete && (
            <IconMenu label="Više opcija" items={[
              { label: "Obriši sve kupce", icon: Trash2, danger: true, disabled: data.length === 0, onClick: () => setShowDeleteAll(true) },
            ]} />
          )}
        </div>
      </div>

      {/* ---------- pločice (ujedno brzi filteri) ---------- */}
      <div className="flex flex-wrap gap-2.5 mb-4">
        <KpiTile icon={Building2} label="Svi kupci" value={fmtN(sSve.firme)} active={rok === "Sve"} onClick={() => setRok("Sve")}
          sub={`${plural(sSve.firme, "firma", "firme", "firmi")} · ${fmtN(sSve.kom)} ${plural(sSve.kom, "licenca", "licence", "licenci")}`} />
        <KpiTile icon={Clock} tone="amber" label="Ističe u 30 dana" value={fmtN(s30.firme)} active={rok === "Ističe u 30 dana"} onClick={() => toggleRok("Ističe u 30 dana")}
          sub={`${plural(s30.firme, "firma", "firme", "firmi")} · ${fmtN(s30.kom)} ${plural(s30.kom, "licenca", "licence", "licenci")} za obnovu`} />
        <KpiTile icon={Calendar} tone="blue" label="Obnova za 31–90 dana" value={fmtN(s90.firme)} active={rok === "Obnova za 31–90 dana"} onClick={() => toggleRok("Obnova za 31–90 dana")}
          sub={`${plural(s90.firme, "firma", "firme", "firmi")} · ${fmtN(s90.kom)} ${plural(s90.kom, "licenca", "licence", "licenci")} · planirati kontakt`} />
        <KpiTile icon={AlertTriangle} tone="red" label="Isteklo — neobnovljeno" value={fmtN(sIst.firme)} active={rok === "Isteklo"} onClick={() => toggleRok("Isteklo")}
          sub={`${plural(sIst.firme, "firma", "firme", "firmi")} · ${fmtN(sIst.kom)} ${plural(sIst.kom, "licenca", "licence", "licenci")}`} />
      </div>

      <div className="xl:flex xl:items-start xl:gap-4">
        <div className="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
          {/* filteri */}
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <div className="w-full sm:w-64 sm:flex-none"><SearchBox value={q} onChange={setQ} placeholder="Firma, proizvod, serijski broj..." /></div>
            <FilterPill label="Rok" value={rok} defaultValue="Sve" onChange={setRok} options={K_ROKOVI} />
            <FilterPill label="Proizvod" value={fProizvod} defaultValue="Svi" onChange={setFProizvod} options={["Svi", ...porodice]} />
            <FilterPill label="Država" value={fDrzava} defaultValue="Sve" onChange={setFDrzava} options={["Sve", ...drzave]} />
            <FilterPill label="Prodavač" value={fProdavac} defaultValue="Svi" onChange={setFProdavac} options={["Svi", ...PRODAVACI_IMENA, "Nedodijeljeno"]} />
            <div className="ml-auto flex border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden shrink-0">
              {prikazBtn("firme", Building2, "Po firmi")}
              <span className="w-px bg-slate-200 dark:bg-slate-700" />
              {prikazBtn("licence", KeyRound, "Po licenci")}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState icon={Building2} title={data.length === 0 ? "Nema unesenih kupaca" : "Nema kupaca za odabrane filtere"}
                subtitle={data.length === 0 ? "Dodaj ručno ili uvezi tabelu postojećih kupaca i licenci." : "Promijeni pretragu ili filtere."}
                action={data.length === 0 ? <button className={btnPrimary} onClick={() => setShowNew(true)} disabled={!currentUser}><Plus size={15} /> Dodaj prvog kupca</button> : null} />
            </div>
          ) : prikaz === "firme" ? (
            <>
              {/* ---------- desktop: tabela po firmi ---------- */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60">
                      <th className="w-9" />
                      <SortHead label="Firma" field="naziv" sort={sortF} setSort={setSortF} />
                      <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Proizvodi</th>
                      <SortHead label="Licenci" field="kom" sort={sortF} setSort={setSortF} descFirst className="text-center" />
                      <SortHead label="Sljedeća obnova" field="sljedeca" sort={sortF} setSort={setSortF} />
                      <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                      <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Prodavač</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {firmePage.map((f) => {
                      const open = otvorene.has(f.key);
                      return [
                        <tr key={f.key} onClick={() => toggleFirma(f.key)}
                          className={"group border-t border-slate-100 dark:border-slate-800 cursor-pointer transition-colors " + (open ? "bg-teal-50/60 dark:bg-teal-900/20" : "hover:bg-slate-50/70 dark:hover:bg-slate-800/40")}>
                          <td className={"pl-2.5 relative " + (open ? "shadow-[inset_3px_0_0_0_#0d9488]" : "")}>
                            <span className={"inline-flex w-7 h-7 items-center justify-center " + (open ? "text-teal-700 dark:text-teal-400" : "text-slate-400")}>
                              {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 max-w-[280px]">
                            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{f.naziv}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{lokacija(f.grad, f.drzava)}</div>
                            {nadogradnjeInfo && nadogradnjeInfo.get(f.key) && <div className="mt-1"><NadogradnjaBadge info={nadogradnjeInfo.get(f.key)} /></div>}
                          </td>
                          <td className="px-3.5 py-2.5">{proizvodiChips(f)}</td>
                          <td className="px-3.5 py-2.5 text-center font-semibold text-slate-900 dark:text-slate-100">{f.kom}</td>
                          <td className="px-3.5 py-2.5 whitespace-nowrap">
                            <div className={"text-[13px] font-semibold " + dokleCls(f.sljedeca)}>{dokle(f.sljedeca)}</div>
                            <div className="text-[11.5px] text-slate-400 dark:text-slate-500">{kratakDatum(f.sljedeca)}</div>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <LicPill status={f.status} />
                            {f.isteklih > 0 && f.status !== "Isteklo" && (
                              <div className="text-[11px] text-red-600 dark:text-red-400 mt-1">{f.isteklih} {plural(f.isteklih, "istekla", "istekle", "isteklih")}</div>
                            )}
                          </td>
                          <td className="px-3.5 py-2.5">
                            {f.prodavaci.length ? <Avatar name={f.prodavaci[0]} /> : <span className="text-xs text-slate-400">—</span>}
                          </td>
                          <td className="pr-3 text-right" onClick={(e) => e.stopPropagation()}>
                            {onViewCompany && (
                              <button type="button" className={btnGhostIcon + " opacity-40 group-hover:opacity-100"} onClick={() => onViewCompany(f.naziv)} title="360° pregled firme" aria-label="360° pregled firme">
                                <ExternalLink size={14} />
                              </button>
                            )}
                          </td>
                        </tr>,
                        open && (
                          <tr key={f.key + "-d"} className="bg-teal-50/60 dark:bg-teal-900/20">
                            <td className="shadow-[inset_3px_0_0_0_#0d9488]" />
                            <td colSpan={7} className="pr-4 pb-3 pt-0.5">{licenceDetalji(f)}</td>
                          </tr>
                        ),
                      ];
                    })}
                  </tbody>
                </table>
              </div>

              {/* ---------- mobitel: kartice po firmi ---------- */}
              <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
                {firmePage.map((f) => {
                  const open = otvorene.has(f.key);
                  return (
                    <div key={f.key} className={open ? "bg-teal-50/60 dark:bg-teal-900/20" : ""}>
                      <button type="button" onClick={() => toggleFirma(f.key)} className="w-full text-left px-4 py-3 flex items-start gap-2">
                        <span className="mt-0.5 text-slate-400">{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{f.naziv}</span>
                            <LicPill status={f.status} />
                          </span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                            {f.lic.map((k) => kratkiProizvod(k.naziv_proizvoda)).filter(Boolean).join(", ") || "—"} · {f.kom} kom.
                          </span>
                          <span className={"block text-xs font-semibold mt-0.5 " + dokleCls(f.sljedeca)}>Obnova {dokle(f.sljedeca)} · {kratakDatum(f.sljedeca)}</span>
                          {nadogradnjeInfo && nadogradnjeInfo.get(f.key) && <span className="block mt-1"><NadogradnjaBadge info={nadogradnjeInfo.get(f.key)} /></span>}
                        </span>
                      </button>
                      {open && <div className="px-3 pb-3">{licenceDetalji(f)}</div>}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {/* ---------- po licenci ---------- */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60">
                      <SortHead label="Firma" field="naziv_firme" sort={sortL} setSort={setSortL} />
                      <SortHead label="Lokacija" field="grad" sort={sortL} setSort={setSortL} />
                      <SortHead label="Proizvod" field="naziv_proizvoda" sort={sortL} setSort={setSortL} />
                      <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Serijski broj</th>
                      <SortHead label="Kom." field="broj_licenci" sort={sortL} setSort={setSortL} descFirst className="text-center" />
                      <SortHead label="Pretplata" field="end_date" sort={sortL} setSort={setSortL} />
                      <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {licencePage.map((k) => (
                      <tr key={k.id} className="group border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="px-3.5 py-2.5 max-w-[240px]">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">{k.naziv_firme}</span>
                            {onViewCompany && (
                              <button type="button" onClick={() => onViewCompany(k.naziv_firme)} className="text-slate-300 dark:text-slate-600 hover:text-teal-600 dark:hover:text-teal-400 opacity-0 group-hover:opacity-100 shrink-0" title="360° pregled firme" aria-label="360° pregled firme">
                                <ExternalLink size={12} />
                              </button>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 dark:text-slate-500 truncate">{prodavacLicence(k)}</div>
                        </td>
                        <td className="px-3.5 py-2.5 text-xs text-slate-600 dark:text-slate-400">{lokacija(k.grad, k.drzava)}</td>
                        <td className="px-3.5 py-2.5 text-slate-700 dark:text-slate-300">
                          {k.naziv_proizvoda || "—"}
                          {k.naziv_proizvoda_2 && <div className="text-xs text-slate-400 dark:text-slate-500">{k.naziv_proizvoda_2}</div>}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{k.serijski_broj || "—"}</td>
                        <td className="px-3.5 py-2.5 text-center text-slate-700 dark:text-slate-300">{k.broj_licenci ?? "—"}</td>
                        <td className="px-3.5 py-2.5"><PeriodBar start={k.start_date} end={k.end_date} /></td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <LicPill status={licenseStatus(k.end_date).label} />
                          <div className={"text-[11px] mt-1 " + dokleCls(k.end_date)}>{dokle(k.end_date)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
                {licencePage.map((k) => (
                  <div key={k.id} className="px-4 py-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{k.naziv_firme}</span>
                        <LicPill status={licenseStatus(k.end_date).label} />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{k.naziv_proizvoda || "—"} · {k.broj_licenci ?? "—"} kom.</p>
                      <p className={"text-xs mt-0.5 " + dokleCls(k.end_date)}>{fmtDate(k.start_date)} – {fmtDate(k.end_date)} · {dokle(k.end_date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {filtered.length > 0 && <PageNav page={cp} setPage={setPage} pageSize={pageSize} setPageSize={setPageSize} total={ukupno} />}
        </div>

        {/* ---------- desna kolona ---------- */}
        <div className="hidden xl:flex flex-col gap-4 w-[330px] shrink-0">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
            <PanelLabel right={<span className="text-[11px] text-slate-400">broj licenci</span>}>Obnove — narednih 12 mj.</PanelLabel>
            <div className="flex items-end gap-0.5 mt-2" role="img" aria-label="Broj licenci koje ističu po mjesecima, narednih 12 mjeseci">
              {kalendar.map((m, i) => (
                <div key={m.key} className="flex-1 flex flex-col items-center gap-1" title={`${MJESECI[Number(m.key.slice(5, 7)) - 1]} ${m.god}: ${m.n} ${plural(m.n, "licenca", "licence", "licenci")}`}>
                  <span className="text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 h-3.5">{m.n || ""}</span>
                  <div className="h-24 w-full flex items-end justify-center">
                    <div className={"w-3 rounded-t " + (i === 0 ? "bg-amber-500" : "bg-teal-500")} style={{ height: m.n ? `${Math.max(4, Math.round((m.n / maxKal) * 96))}px` : 0 }} />
                  </div>
                  <span className={"text-[10.5px] " + (i === 0 ? "font-bold text-amber-700 dark:text-amber-400" : "text-slate-500 dark:text-slate-400")}>{m.label}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-[11.5px] text-slate-600 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />Ovaj mjesec</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-teal-500" />Kasnije</span>
              {sIst.kom > 0 && (
                <button type="button" onClick={() => toggleRok("Isteklo")} className="ml-auto inline-flex items-center gap-1 font-semibold text-red-700 dark:text-red-400 hover:underline">
                  <AlertTriangle size={12} /> {fmtN(sIst.kom)} isteklih
                </button>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
            <PanelLabel right={<span className="text-[11px] font-semibold text-amber-800 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-px rounded-full">{zaObnovu.length} {plural(zaObnovu.length, "firma", "firme", "firmi")}</span>}>Za obnovu u 30 dana</PanelLabel>
            {zaObnovu.length === 0 && <p className="text-xs text-slate-400 py-2">Nema obnova u narednih 30 dana.</p>}
            {zaObnovu.slice(0, 6).map((f) => {
              const due = f.lic.filter((k) => k.end_date === f.sljedeca);
              return (
                <button key={f.key} type="button" onClick={() => { setRok("Ističe u 30 dana"); otvoriFirmu(f); }}
                  className="w-full text-left flex items-center gap-2.5 py-2 border-t border-slate-100 dark:border-slate-800 first:border-t-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg -mx-1.5 px-1.5">
                  {f.prodavaci.length ? <Avatar name={f.prodavaci[0]} /> : <span className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 shrink-0" />}
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate">{f.naziv}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{due.map((k) => kratkiProizvod(k.naziv_proizvoda) + (licKom(k) > 1 ? ` ×${licKom(k)}` : "")).join(", ")}</span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block text-[12.5px] font-semibold text-amber-700 dark:text-amber-400">{dokle(f.sljedeca)}</span>
                    <span className="block text-[11px] text-slate-400">{kratakDatum(f.sljedeca)}</span>
                  </span>
                </button>
              );
            })}
            {zaObnovu.length > 6 && (
              <button type="button" onClick={() => setRok("Ističe u 30 dana")} className="w-full text-center text-xs text-teal-700 dark:text-teal-400 hover:underline pt-2">
                Prikaži sve ({zaObnovu.length})
              </button>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
            <PanelLabel right={fProizvod !== "Svi" ? <button type="button" className="text-xs text-teal-700 dark:text-teal-400 hover:underline" onClick={() => setFProizvod("Svi")}>Svi</button> : <span className="text-[11px] text-slate-400">kom.</span>}>Licence po proizvodu</PanelLabel>
            <div className="flex flex-col gap-1 mt-1">
              {poProizvodu.map(([p, n]) => (
                <button key={p} type="button" onClick={() => setFProizvod(fProizvod === p ? "Svi" : p)}
                  className={"grid grid-cols-[100px_minmax(0,1fr)_32px] gap-2.5 items-center text-left text-[12.5px] rounded-lg -mx-1.5 px-1.5 py-1 " + (fProizvod === p ? "bg-teal-50 dark:bg-teal-900/30" : "hover:bg-slate-50 dark:hover:bg-slate-800/60")}>
                  <span className="truncate text-slate-700 dark:text-slate-300">{p}</span>
                  <span className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <span className="block h-full rounded-r bg-teal-500" style={{ width: `${Math.max(3, Math.round((n / maxProiz) * 100))}%` }} />
                  </span>
                  <b className="text-right font-semibold text-slate-900 dark:text-slate-100">{fmtN(n)}</b>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {(showNew || editing) && (
        <KupacForm initial={editing} prefill={prefill} currentUser={currentUser} onSave={handleSave}
          onClose={() => { setShowNew(false); setEditing(null); setPrefill(null); }} />
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

const PODRSKA_VRSTE = ["Licenciranje", "Problem", "Instalacija", "Obuka", "Konsultacija", "Ostalo"];
const BEZ_VRSTE = "(bez vrste)";
const VRSTA_STIL = {
  Licenciranje: { cls: "bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300", bar: "bg-amber-500", icon: KeyRound },
  Problem: { cls: "bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300", bar: "bg-rose-500", icon: Bug },
  Instalacija: { cls: "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", bar: "bg-blue-500", icon: Download },
  Obuka: { cls: "bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300", bar: "bg-violet-500", icon: GraduationCap },
  Konsultacija: { cls: "bg-slate-200/70 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200", bar: "bg-slate-500", icon: MessageSquare },
  Ostalo: { cls: "bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300", bar: "bg-teal-500", icon: Wrench },
  [BEZ_VRSTE]: { cls: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400", bar: "bg-slate-300 dark:bg-slate-600", icon: Wrench },
};
const vrstaOf = (s) => (PODRSKA_VRSTE.includes(s.vrsta) ? s.vrsta : BEZ_VRSTE);
const PODRSKA_PROIZVODI = ["SOLIDWORKS", "SolidCAM", "DraftSight", "SWOOD", "DriveWorks", "3DEXPERIENCE", "SolidSteel", "PDM", "Simulation", "Composer", "Geomagic"];
const P_PERIODI = ["Bilo kada", "Ovaj mjesec", "Prošli mjesec", "Zadnjih 30 dana", "Zadnjih 90 dana", "Ova godina"];
const P_LICENCA = ["Sve", "Istekla", "Ističe uskoro", "Aktivna", "Nije kupac"];
const MJESECI_LOK = ["januaru", "februaru", "martu", "aprilu", "maju", "junu", "julu", "augustu", "septembru", "oktobru", "novembru", "decembru"];
const DANI = ["nedjelja", "ponedjeljak", "utorak", "srijeda", "četvrtak", "petak", "subota"];
const mjKey = (offset = 0) => {
  const d = new Date();
  const x = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
};
function podrskaPeriodOk(datum, period) {
  if (period === "Bilo kada") return true;
  const d = String(datum || "").slice(0, 10);
  if (!d) return false;
  if (period === "Ovaj mjesec") return d.slice(0, 7) === mjKey(0);
  if (period === "Prošli mjesec") return d.slice(0, 7) === mjKey(-1);
  if (period === "Ova godina") return d.slice(0, 4) === String(new Date().getFullYear());
  const n = daysAgo(d);
  if (n == null) return false;
  return period === "Zadnjih 30 dana" ? n <= 30 : n <= 90;
}
function danNaslov(d) {
  if (!d) return "Bez datuma";
  const dt = new Date(d + "T00:00:00");
  const n = daysAgo(d);
  const dan = DANI[dt.getDay()];
  const dat = `${dt.getDate()}.${dt.getMonth() + 1}.${dt.getFullYear() !== new Date().getFullYear() ? dt.getFullYear() + "." : ""}`;
  if (n === 0) return `Danas · ${dan} ${dat}`;
  if (n === 1) return `Jučer · ${dan} ${dat}`;
  return `${dan.charAt(0).toUpperCase() + dan.slice(1)} ${dat}`;
}
function VrstaChip({ vrsta }) {
  if (!PODRSKA_VRSTE.includes(vrsta)) return null;
  const st = VRSTA_STIL[vrsta];
  return (
    <span className={"inline-flex items-center gap-1 text-xs font-semibold pl-1.5 pr-2 py-0.5 rounded-full whitespace-nowrap " + st.cls}>
      <st.icon size={12} /> {vrsta}
    </span>
  );
}

// status licence firme (iz Kupci i licence), za upozorenje uz intervenciju
function licencaIndex(kupci) {
  const m = new Map();
  for (const f of grupisiPoFirmi(kupci, new Map())) m.set(f.key, f);
  return m;
}
function licencaGrupa(f) {
  if (!f) return "Nije kupac";
  if (f.status === "Isteklo") return "Istekla";
  if (f.status === "Ističe uskoro") return "Ističe uskoro";
  if (f.status === "Aktivno") return "Aktivna";
  return "Nije kupac";
}

function PodrskaForm({ initial, currentUser, kupci, onSave, onClose }) {
  const [f, setF] = useState(
    initial
      ? { ...initial, vrsta: initial.vrsta || "", proizvod: initial.proizvod || "" }
      : {
          firma: "", tehnicar: SORTED_FOR_TECH.includes(currentUser) ? currentUser : "",
          datum: todayStr(), vrsta: "", proizvod: "", opis: "", napomena: "",
        }
  );
  const [busy, setBusy] = useState(false);
  const uniqueFirme = useMemo(
    () => Array.from(new Set(kupci.map((k) => k.naziv_firme).filter(Boolean))).sort((a, b) => a.localeCompare(b, "hr")),
    [kupci]
  );
  const proizvodiFirme = useMemo(() => {
    const key = companyKey(f.firma);
    const vlastiti = key ? kupci.filter((k) => companyKey(k.naziv_firme) === key).map((k) => proizvodPorodica(k.naziv_proizvoda)).filter((p) => p !== BEZ_PROIZVODA) : [];
    return [...new Set([...vlastiti, ...PODRSKA_PROIZVODI])];
  }, [f.firma, kupci]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async () => {
    if (!f.firma.trim() || !f.tehnicar || !f.opis.trim() || !currentUser) return;
    setBusy(true);
    try {
      const payload = { ...f, vrsta: f.vrsta || null, proizvod: (f.proizvod || "").trim() || null, updated_by: currentUser, updated_at: new Date().toISOString() };
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
      <datalist id="podrska-proizvodi-form">
        {proizvodiFirme.map((p) => <option key={p} value={p} />)}
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
        <Field label="Vrsta intervencije">
          <select className={inputCls} value={f.vrsta || ""} onChange={set("vrsta")}>
            <option value="">— odaberi —</option>
            {PODRSKA_VRSTE.map((v) => <option key={v}>{v}</option>)}
          </select>
        </Field>
        <Field label="Proizvod" hint="npr. SOLIDWORKS, SolidCAM, DraftSight">
          <input list="podrska-proizvodi-form" className={inputCls} value={f.proizvod || ""} onChange={set("proizvod")} placeholder="Odaberi ili upiši" />
        </Field>
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

// Brzi unos intervencije direktno iznad liste
function PodrskaBrziUnos({ currentUser, kupci, firme, onAdd }) {
  const prazno = () => ({ opis: "", firma: "", vrsta: "", proizvod: "", tehnicar: SORTED_FOR_TECH.includes(currentUser) ? currentUser : "", datum: todayStr() });
  const [f, setF] = useState(prazno);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const proizvodi = useMemo(() => {
    const key = companyKey(f.firma);
    const vlastiti = key ? kupci.filter((k) => companyKey(k.naziv_firme) === key).map((k) => proizvodPorodica(k.naziv_proizvoda)).filter((p) => p !== BEZ_PROIZVODA) : [];
    return [...new Set([...vlastiti, ...PODRSKA_PROIZVODI])];
  }, [f.firma, kupci]);
  const ok = f.opis.trim() && f.firma.trim() && f.tehnicar && f.datum && currentUser;
  const spremi = async () => {
    if (!ok || busy) return;
    setBusy(true);
    try {
      const now = new Date().toISOString();
      await onAdd({
        firma: f.firma.trim(), tehnicar: f.tehnicar, datum: f.datum, opis: f.opis.trim(), napomena: "",
        vrsta: f.vrsta || null, proizvod: f.proizvod.trim() || null,
        created_by: currentUser, created_at: now, updated_by: currentUser, updated_at: now,
      });
      setF({ ...prazno(), tehnicar: f.tehnicar, datum: f.datum });
    } finally {
      setBusy(false);
    }
  };
  const sel = "h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-[12.5px] text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500";
  return (
    <div className="mx-4 mt-3 mb-1 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/20">
      <datalist id="podrska-brzo-firme">{firme.map((n) => <option key={n} value={n} />)}</datalist>
      <datalist id="podrska-brzo-proizvodi">{proizvodi.map((p) => <option key={p} value={p} />)}</datalist>
      <input aria-label="Opis nove intervencije" value={f.opis} onChange={set("opis")}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); spremi(); } }}
        placeholder="Nova intervencija — šta je urađeno? npr. „Aktivacija licence nakon zamjene računara…“"
        className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none py-1" />
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <input aria-label="Firma" list="podrska-brzo-firme" value={f.firma} onChange={set("firma")} placeholder="Firma…" className={sel + " w-48"} />
        <select aria-label="Vrsta intervencije" value={f.vrsta} onChange={set("vrsta")} className={sel}>
          <option value="">Vrsta…</option>
          {PODRSKA_VRSTE.map((v) => <option key={v}>{v}</option>)}
        </select>
        <input aria-label="Proizvod" list="podrska-brzo-proizvodi" value={f.proizvod} onChange={set("proizvod")} placeholder="Proizvod…" className={sel + " w-36"} />
        <select aria-label="Tehničar" value={f.tehnicar} onChange={set("tehnicar")} className={sel}>
          <option value="">Tehničar…</option>
          {SORTED_FOR_TECH.map((n) => <option key={n}>{n}</option>)}
        </select>
        <input aria-label="Datum" type="date" value={f.datum} onChange={set("datum")} className={sel} />
        <span className="flex-1" />
        <span className="hidden md:inline text-xs text-slate-400">Enter za spremanje</span>
        <button type="button" className={btnPrimary + " h-8 text-[13px]"} disabled={!ok || busy} onClick={spremi}>{busy ? "Čuvam..." : "Spremi"}</button>
      </div>
    </div>
  );
}

export function PodrskaTab({ data, kupci, currentUser, onAdd, onUpdate, onDelete, onViewCompany }) {
  const [q, setQ] = useState("");
  const [fFirma, setFFirma] = useState("Sve");
  const [fTeh, setFTeh] = useState("Svi");
  const [fVrsta, setFVrsta] = useState("Sve");
  const [fPeriod, setFPeriod] = useState("Bilo kada");
  const [fLic, setFLic] = useState("Sve");
  const [limit, setLimit] = useState(60);
  const [editing, setEditing] = useState(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => { setLimit(60); }, [q, fFirma, fTeh, fVrsta, fPeriod, fLic]);

  const licIdx = useMemo(() => licencaIndex(kupci), [kupci]);
  const licOf = (firma) => licIdx.get(companyKey(firma));

  const firme = useMemo(() => {
    const set = new Set([...kupci.map((k) => k.naziv_firme), ...data.map((d) => d.firma)]);
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b, "hr"));
  }, [kupci, data]);

  const qq = q.trim().toLowerCase();
  const passes = (s, skip = {}) =>
    (!qq || [s.firma, s.opis, s.napomena, s.proizvod].join(" ").toLowerCase().includes(qq)) &&
    (skip.firma || fFirma === "Sve" || s.firma === fFirma) &&
    (skip.teh || fTeh === "Svi" || s.tehnicar === fTeh) &&
    (skip.vrsta || fVrsta === "Sve" || vrstaOf(s) === fVrsta) &&
    (fLic === "Sve" || licencaGrupa(licOf(s.firma)) === fLic) &&
    podrskaPeriodOk(s.datum, fPeriod);

  const filtered = useMemo(() => data.filter((s) => passes(s))
    .sort((a, b) => String(b.datum || "").localeCompare(String(a.datum || "")) || String(b.created_at || "").localeCompare(String(a.created_at || ""))),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [data, qq, fFirma, fTeh, fVrsta, fPeriod, fLic, licIdx]);

  // ---------- pločice: tekući mjesec ----------
  const ovaj = data.filter((s) => podrskaPeriodOk(s.datum, "Ovaj mjesec"));
  const prosli = data.filter((s) => podrskaPeriodOk(s.datum, "Prošli mjesec"));
  const razlika = ovaj.length - prosli.length;
  const firmiOvaj = new Set(ovaj.map((s) => companyKey(s.firma))).size;
  const vrsteOvaj = new Map();
  ovaj.forEach((s) => { if (PODRSKA_VRSTE.includes(s.vrsta)) vrsteOvaj.set(s.vrsta, (vrsteOvaj.get(s.vrsta) || 0) + 1); });
  const topVrsta = [...vrsteOvaj.entries()].sort((a, b) => b[1] - a[1])[0];
  const bezLic = ovaj.filter((s) => licencaGrupa(licOf(s.firma)) === "Istekla");
  const bezLicFirmi = new Set(bezLic.map((s) => companyKey(s.firma))).size;

  // ---------- desna kolona ----------
  const poTeh = useMemo(() => {
    const m = new Map();
    data.filter((s) => passes(s, { teh: true })).forEach((s) => { const k = s.tehnicar || "—"; m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, qq, fFirma, fVrsta, fPeriod, fLic, licIdx]);
  const maxTeh = poTeh.length ? poTeh[0][1] : 1;
  const poVrsti = useMemo(() => {
    const m = new Map();
    data.filter((s) => passes(s, { vrsta: true })).forEach((s) => { const k = vrstaOf(s); m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, qq, fFirma, fTeh, fPeriod, fLic, licIdx]);
  const ukVrsta = poVrsti.reduce((s, [, n]) => s + n, 0);
  const topFirme = useMemo(() => {
    const m = new Map();
    data.filter((s) => podrskaPeriodOk(s.datum, "Zadnjih 90 dana")).forEach((s) => {
      const k = companyKey(s.firma) || s.firma;
      const e = m.get(k) || { naziv: s.firma, n: 0 };
      e.n++;
      m.set(k, e);
    });
    return [...m.values()].sort((a, b) => b.n - a.n).slice(0, 5);
  }, [data]);

  const nTeh = new Set(data.map((s) => s.tehnicar).filter(Boolean)).size;
  const nFirmi = new Set(data.map((s) => companyKey(s.firma))).size;
  const filtriran = qq || fFirma !== "Sve" || fTeh !== "Svi" || fVrsta !== "Sve" || fPeriod !== "Bilo kada" || fLic !== "Sve";

  const handleSave = async (payload) => {
    if (editing) await onUpdate(editing.id, payload);
    else await onAdd(payload);
  };
  const exportCSV = () => {
    const headers = ["Datum", "Firma", "Tehničar", "Vrsta", "Proizvod", "Opis", "Napomena", "Status licence", "Kreirao", "Datum kreiranja", "Zadnja izmjena od", "Datum zadnje izmjene"];
    const rows = filtered.map((s) => [s.datum, s.firma, s.tehnicar, s.vrsta || "", s.proizvod || "", s.opis, s.napomena, licencaGrupa(licOf(s.firma)), s.created_by, s.created_at, s.updated_by, s.updated_at]);
    downloadCSV(`tehnicka_podrska_${todayStr()}.csv`, headers, rows);
  };

  const shown = filtered.slice(0, limit);
  const grupe = [];
  for (const s of shown) {
    const d = String(s.datum || "").slice(0, 10);
    let g = grupe[grupe.length - 1];
    if (!g || g.key !== d) { g = { key: d, items: [] }; grupe.push(g); }
    g.items.push(s);
  }
  const grupaCount = (d) => filtered.filter((s) => String(s.datum || "").slice(0, 10) === d).length;

  const licUpozorenje = (firma) => {
    const f = licOf(firma);
    if (!f || !f.sljedeca) return null;
    if (f.status === "Isteklo") return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 bg-white dark:bg-slate-900 px-2 py-px rounded-full whitespace-nowrap" title="Sve licence ove firme su istekle — prilika za obnovu">
        <AlertTriangle size={12} /> Licenca istekla {kratkiDatum(f.sljedeca)}
      </span>
    );
    if (f.status === "Ističe uskoro") return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 px-2 py-px rounded-full whitespace-nowrap" title={`Pretplata ističe ${fmtDate(f.sljedeca)}`}>
        <Clock size={12} /> Obnova {dokle(f.sljedeca)}
      </span>
    );
    return null;
  };

  return (
    <div>
      {/* ---------- zaglavlje ---------- */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Tehnička podrška</h2>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">
            {fmtN(data.length)} {plural(data.length, "intervencija", "intervencije", "intervencija")} · {fmtN(nFirmi)} {plural(nFirmi, "firma", "firme", "firmi")} · {nTeh} {plural(nTeh, "tehničar", "tehničara", "tehničara")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={headerBtnSec} onClick={exportCSV} disabled={filtered.length === 0}><Download size={15} /> Izvoz</button>
          <button type="button" className={btnPrimary + " h-9"} onClick={() => setShowNew(true)} disabled={!currentUser}><Plus size={15} /> Nova intervencija</button>
        </div>
      </div>

      {/* ---------- pločice (tekući mjesec) ---------- */}
      <div className="flex flex-wrap gap-2.5 mb-4">
        <KpiTile icon={Wrench} label={`Intervencija u ${MJESECI_LOK[new Date().getMonth()]}`}
          value={fmtN(ovaj.length)} active={fPeriod === "Ovaj mjesec" && fVrsta === "Sve" && fLic === "Sve"}
          onClick={() => { setFPeriod(fPeriod === "Ovaj mjesec" ? "Bilo kada" : "Ovaj mjesec"); setFVrsta("Sve"); setFLic("Sve"); }}
          sub={razlika === 0 ? "isto kao prošli mjesec" : `${razlika > 0 ? "+" : "−"}${Math.abs(razlika)} u odnosu na prošli mjesec`} />
        <KpiTile icon={Building2} label="Firmi podržano" value={fmtN(firmiOvaj)} sub="u tekućem mjesecu"
          onClick={() => { setFPeriod("Ovaj mjesec"); }} />
        <KpiTile icon={topVrsta ? VRSTA_STIL[topVrsta[0]].icon : Wrench} label={topVrsta ? `Najčešće: ${topVrsta[0].toLowerCase()}` : "Najčešća vrsta"}
          value={topVrsta ? fmtN(topVrsta[1]) : "—"} active={!!topVrsta && fVrsta === topVrsta[0] && fPeriod === "Ovaj mjesec"}
          onClick={() => { if (topVrsta) { setFVrsta(fVrsta === topVrsta[0] ? "Sve" : topVrsta[0]); setFPeriod("Ovaj mjesec"); } }}
          sub={topVrsta ? `${Math.round((topVrsta[1] / Math.max(1, ovaj.length)) * 100)}% intervencija ovog mjeseca` : "unesi vrstu pri novom zapisu"} />
        <KpiTile icon={AlertTriangle} tone="red" label="Podrška bez aktivne licence" value={fmtN(bezLic.length)}
          active={fLic === "Istekla" && fPeriod === "Ovaj mjesec"}
          onClick={() => { const on = fLic === "Istekla" && fPeriod === "Ovaj mjesec"; setFLic(on ? "Sve" : "Istekla"); setFPeriod(on ? "Bilo kada" : "Ovaj mjesec"); }}
          sub={`${bezLicFirmi} ${plural(bezLicFirmi, "firma", "firme", "firmi")} · prilika za obnovu`} />
      </div>

      <div className="xl:flex xl:items-start xl:gap-4">
        <div className="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
          {/* filteri */}
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <div className="w-full sm:w-60 sm:flex-none"><SearchBox value={q} onChange={setQ} placeholder="Firma ili opis..." /></div>
            <FilterPill label="Firma" value={fFirma} defaultValue="Sve" onChange={setFFirma} options={["Sve", ...firme]} />
            <FilterPill label="Tehničar" value={fTeh} defaultValue="Svi" onChange={setFTeh} options={["Svi", ...SORTED_FOR_TECH]} />
            <FilterPill label="Vrsta" value={fVrsta} defaultValue="Sve" onChange={setFVrsta} options={["Sve", ...PODRSKA_VRSTE, BEZ_VRSTE]} />
            <FilterPill label="Period" value={fPeriod} defaultValue="Bilo kada" onChange={setFPeriod} options={P_PERIODI} />
            <FilterPill label="Licenca" value={fLic} defaultValue="Sve" onChange={setFLic} options={P_LICENCA} />
            <span className="ml-auto text-[13px] text-slate-500 dark:text-slate-400 whitespace-nowrap"><b className="text-slate-900 dark:text-slate-100">{fmtN(filtered.length)}</b> {plural(filtered.length, "zapis", "zapisa", "zapisa")}</span>
          </div>

          {currentUser && <PodrskaBrziUnos currentUser={currentUser} kupci={kupci} firme={firme} onAdd={onAdd} />}

          {filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState icon={Wrench} title={data.length === 0 ? "Nema zapisa o tehničkoj podršci" : "Nema zapisa za odabrane filtere"}
                subtitle={data.length === 0 ? "Svaki put kad tehničar odradi podršku za firmu, unosi zapis ovdje — tako se gradi historija po kupcu." : "Promijeni pretragu ili filtere."}
                action={data.length === 0 ? <button className={btnPrimary} onClick={() => setShowNew(true)} disabled={!currentUser}><Plus size={15} /> Dodaj prvu intervenciju</button> : null} />
            </div>
          ) : (
            <div className="pb-2">
              {grupe.map((g) => (
                <div key={g.key || "bez"}>
                  <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {danNaslov(g.key)}
                    <span className="font-semibold text-slate-400 dark:text-slate-500 tracking-normal">{grupaCount(g.key)}</span>
                    <span className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
                  </div>
                  {g.items.map((s) => {
                    const v = vrstaOf(s);
                    const St = VRSTA_STIL[v];
                    return (
                      <div key={s.id} className="group flex gap-3 px-4 py-2.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <span className={"w-8 h-8 rounded-full inline-flex items-center justify-center shrink-0 " + St.cls} title={v}><St.icon size={15} /></span>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{s.firma}</span>
                            {onViewCompany && (
                              <button type="button" onClick={() => onViewCompany(s.firma)} className="text-slate-300 dark:text-slate-600 hover:text-teal-600 dark:hover:text-teal-400" title="360° pregled firme" aria-label="360° pregled firme">
                                <ExternalLink size={12} />
                              </button>
                            )}
                            <VrstaChip vrsta={s.vrsta} />
                            {s.proizvod && <ProizvodChip>{s.proizvod}</ProizvodChip>}
                            {licUpozorenje(s.firma)}
                          </div>
                          <p className="text-[13.5px] text-slate-700 dark:text-slate-300 leading-snug mt-1 whitespace-pre-line">{s.opis}</p>
                          {s.napomena && (
                            <p className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-1 flex gap-1.5"><MessageSquare size={13} className="mt-0.5 shrink-0 text-slate-400" /><span className="whitespace-pre-line">{s.napomena}</span></p>
                          )}
                          <div className="sm:hidden flex items-center gap-1.5 mt-1.5 text-xs text-slate-500 dark:text-slate-400"><Avatar name={s.tehnicar} size="sm" /> {s.tehnicar}</div>
                          {s.created_by && s.created_by !== s.tehnicar && (
                            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Unio: {s.created_by}</div>
                          )}
                        </div>
                        <div className="flex items-start gap-1 shrink-0">
                          <span className="hidden sm:inline-flex items-center gap-1.5 text-[12.5px] text-slate-600 dark:text-slate-400 mt-1 mr-1 whitespace-nowrap"><Avatar name={s.tehnicar} size="sm" /> {s.tehnicar}</span>
                          <span className="inline-flex items-center opacity-40 group-hover:opacity-100">
                            <button className={btnGhostIcon} onClick={() => setEditing(s)} title="Uredi" aria-label="Uredi"><Pencil size={14} /></button>
                            <ConfirmDelete label={"zapis"} onConfirm={() => onDelete(s.id)} />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              {filtered.length > limit && (
                <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-center">
                  <button type="button" className={btnSecondary} onClick={() => setLimit(limit + 60)}>
                    Prikaži još ({fmtN(filtered.length - limit)} preostalo)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ---------- desna kolona ---------- */}
        <div className="hidden xl:flex flex-col gap-4 w-[320px] shrink-0">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
            <PanelLabel right={fTeh !== "Svi" ? <button type="button" className="text-xs text-teal-700 dark:text-teal-400 hover:underline" onClick={() => setFTeh("Svi")}>Svi</button> : <span className="text-[11px] text-slate-400">{filtriran ? "filtrirano" : "ukupno"}</span>}>Po tehničaru</PanelLabel>
            <div className="flex flex-col gap-2 mt-1">
              {poTeh.length === 0 && <p className="text-xs text-slate-400">Nema podataka.</p>}
              {poTeh.map(([k, n]) => (
                <button key={k} type="button" onClick={() => setFTeh(fTeh === k ? "Svi" : k)}
                  className={"flex items-center gap-2.5 text-left rounded-lg -mx-1.5 px-1.5 py-1 " + (fTeh === k ? "bg-teal-50 dark:bg-teal-900/30" : "hover:bg-slate-50 dark:hover:bg-slate-800/60")}>
                  <Avatar name={k} size="sm" />
                  <span className="flex-1 min-w-0">
                    <span className="flex justify-between gap-2 text-[12.5px] text-slate-700 dark:text-slate-300"><span className="truncate">{k}</span><b className="text-slate-900 dark:text-slate-100">{n}</b></span>
                    <span className="block h-1.5 mt-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <span className="block h-full rounded-full bg-teal-500" style={{ width: `${Math.round((n / maxTeh) * 100)}%` }} />
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
            <PanelLabel right={fVrsta !== "Sve" && <button type="button" className="text-xs text-teal-700 dark:text-teal-400 hover:underline" onClick={() => setFVrsta("Sve")}>Sve</button>}>Vrsta intervencije</PanelLabel>
            {ukVrsta > 0 && (
              <div className="flex gap-0.5 h-2.5 rounded overflow-hidden mt-1 mb-2" role="img" aria-label="Udio vrsta intervencija">
                {poVrsti.map(([k, n]) => <div key={k} className={VRSTA_STIL[k].bar} style={{ width: `${(n / ukVrsta) * 100}%` }} title={`${k}: ${n}`} />)}
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              {poVrsti.length === 0 && <p className="text-xs text-slate-400">Nema podataka.</p>}
              {poVrsti.map(([k, n]) => {
                const St = VRSTA_STIL[k];
                return (
                  <button key={k} type="button" onClick={() => setFVrsta(fVrsta === k ? "Sve" : k)}
                    className={"flex items-center gap-2 text-left text-[12.5px] rounded-lg -mx-1.5 px-1.5 py-1 " + (fVrsta === k ? "bg-teal-50 dark:bg-teal-900/30" : "hover:bg-slate-50 dark:hover:bg-slate-800/60")}>
                    <span className={"w-5 h-5 rounded-full inline-flex items-center justify-center " + St.cls}><St.icon size={11} /></span>
                    <span className="flex-1 text-slate-700 dark:text-slate-300">{k}</span>
                    <b className="text-slate-900 dark:text-slate-100">{n}</b>
                    <span className="w-9 text-right text-slate-400">{Math.round((n / Math.max(1, ukVrsta)) * 100)}%</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
            <PanelLabel>Najviše podrške · 90 dana</PanelLabel>
            {topFirme.length === 0 && <p className="text-xs text-slate-400">Nema intervencija u zadnjih 90 dana.</p>}
            {topFirme.map((t) => {
              const g = licencaGrupa(licOf(t.naziv));
              const boja = g === "Istekla" ? "text-red-700 dark:text-red-400" : g === "Ističe uskoro" ? "text-amber-700 dark:text-amber-400" : g === "Aktivna" ? "text-green-700 dark:text-green-400" : "text-slate-400";
              const tacka = g === "Istekla" ? "bg-red-500" : g === "Ističe uskoro" ? "bg-amber-500" : g === "Aktivna" ? "bg-green-500" : "bg-slate-300";
              return (
                <button key={t.naziv} type="button" onClick={() => setFFirma(fFirma === t.naziv ? "Sve" : t.naziv)}
                  className={"w-full text-left flex items-center gap-2.5 py-2 border-t border-slate-100 dark:border-slate-800 first:border-t-0 rounded-lg -mx-1.5 px-1.5 " + (fFirma === t.naziv ? "bg-teal-50 dark:bg-teal-900/30" : "hover:bg-slate-50 dark:hover:bg-slate-800/50")}>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate">{t.naziv}</span>
                    <span className={"flex items-center gap-1.5 text-[11.5px] " + boja}><span className={"w-1.5 h-1.5 rounded-full " + tacka} />{g === "Nije kupac" ? "nije u Kupcima" : `licenca: ${g.toLowerCase()}`}</span>
                  </span>
                  <b className="text-[13px] text-slate-900 dark:text-slate-100">{t.n}</b>
                  <span className="text-[11.5px] text-slate-400 w-10">interv.</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

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

const OTVORENI_STATUSI = ["Novi kontakt", "U pregovorima", "Ponuda poslana", "Na čekanju"];
const DANI_KRATKO = ["ned", "pon", "uto", "sri", "čet", "pet", "sub"];
const PRIJEDLOZI_OPISA = ["Poziv", "Follow-up ponude", "Poslati ponudu", "Sastanak", "Demo / prezentacija", "Poslati mail"];

// lokalni datum (ne UTC), da podsjetnik ne "preskoči" dan oko ponoći
function isoLokalno(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function danasIso() { return isoLokalno(new Date()); }
function plusDana(n) { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return isoLokalno(d); }
function sljedeciPonedjeljak() { const d = new Date(); const wd = d.getDay(); return plusDana(wd === 1 ? 7 : (8 - wd) % 7 || 7); }
const BRZI_DATUMI = [
  { label: "Sutra", fn: () => plusDana(1) },
  { label: "Za 3 dana", fn: () => plusDana(3) },
  { label: "Sljedeći ponedjeljak", fn: sljedeciPonedjeljak },
  { label: "Za 1 sedmicu", fn: () => plusDana(7) },
  { label: "Za 1 mjesec", fn: () => plusDana(30) },
];

function vlasnikPotencijala(p) {
  if (p.kolega && p.kolega !== "Nedodijeljeno") return p.kolega;
  return (p.prodavaci || []).find((x) => x && x !== "Nedodijeljeno") || "Nedodijeljeno";
}
function zadnjiKontakt(p) {
  let m = p.zadnji_kontakt ? String(p.zadnji_kontakt).slice(0, 10) : null;
  for (const h of p.historija || []) if (h.datum && (!m || h.datum > m)) m = h.datum;
  return m;
}
function vrstaPodsjetnika(opis) {
  const o = String(opis || "").toLowerCase();
  if (/(demo|prezent|webinar)/.test(o)) return { icon: LayoutGrid, label: "Demo / prezentacija" };
  if (/(sastan|posjet|obilaz)/.test(o)) return { icon: User, label: "Sastanak" };
  if (/(ponud|obnov|ugovor)/.test(o)) return { icon: FileText, label: "Ponuda / obnova" };
  if (/(mail|poslati info)/.test(o)) return { icon: Mail, label: "Mail" };
  return { icon: Phone, label: "Poziv" };
}
function sekcijaPodsjetnika(datum) {
  const n = daysDiff(datum);
  if (n < 0) return "kasni";
  if (n === 0) return "danas";
  if (n === 1) return "sutra";
  const wd = new Date().getDay(); // 0 = nedjelja
  const doNedjelje = wd === 0 ? 0 : 7 - wd;
  if (n <= doNedjelje) return "sedmica";
  if (n <= doNedjelje + 7) return "sljedeca";
  return "kasnije";
}
const P_SEKCIJE = ["kasni", "danas", "sutra", "sedmica", "sljedeca", "kasnije"];
function sekcijaNaslov(key) {
  const d = new Date();
  const s = new Date(); s.setDate(d.getDate() + 1);
  if (key === "kasni") return "Kasni";
  if (key === "danas") return `Danas · ${DANI[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`;
  if (key === "sutra") return `Sutra · ${DANI[s.getDay()]} ${s.getDate()}.${s.getMonth() + 1}.`;
  if (key === "sedmica") return "Ostatak ove sedmice";
  if (key === "sljedeca") return "Sljedeća sedmica";
  return "Kasnije";
}
function kadaTekst(datum) {
  const n = daysDiff(datum);
  if (n < 0) return `kasni ${-n} ${-n === 1 ? "dan" : "dana"}`;
  if (n === 0) return "danas";
  if (n === 1) return "sutra";
  return n <= 45 ? `za ${n} dana` : `za ${Math.round(n / 30.4)} mj.`;
}
const prviTelefon = (t) => String(t || "").split(/[,;/]| i /)[0].trim();

// ---------- dugme "Odgodi" s brzim izborom datuma ----------
function OdgodiMenu({ disabled, onPick }) {
  const [open, setOpen] = useState(false);
  const [datum, setDatum] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" disabled={disabled} onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[12.5px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50">
        <AlarmClock size={14} className="text-slate-500" /> Odgodi <ChevronDown size={12} className="opacity-60" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1.5 z-30 w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-1.5">
          {BRZI_DATUMI.map((b) => (
            <button key={b.label} type="button" onClick={() => { setOpen(false); onPick(b.fn()); }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
              <span>{b.label}</span><span className="text-xs text-slate-400">{fmtDate(b.fn())}</span>
            </button>
          ))}
          <div className="flex items-center gap-1.5 px-2 pt-2 mt-1 border-t border-slate-100 dark:border-slate-800">
            <input type="date" aria-label="Odgodi na datum" value={datum} min={plusDana(1)} onChange={(e) => setDatum(e.target.value)}
              className="flex-1 min-w-0 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs text-slate-700 dark:text-slate-200" />
            <button type="button" disabled={!datum} onClick={() => { setOpen(false); onPick(datum); setDatum(""); }}
              className="h-8 px-2.5 rounded-lg bg-teal-600 text-white text-xs font-semibold disabled:opacity-40">OK</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- "Obavljeno": zapis u historiju + sljedeći podsjetnik ----------
function ZavrsiPanel({ item, currentUser, onCancel, onDone }) {
  const [biljeska, setBiljeska] = useState("");
  const [izbor, setIzbor] = useState("Bez novog");
  const [datum, setDatum] = useState("");
  const [opis, setOpis] = useState(item.opis || "");
  const [busy, setBusy] = useState(false);
  const sljedeci = izbor === "Bez novog" ? null : izbor === "Datum" ? datum || null : (BRZI_DATUMI.find((b) => b.label === izbor) || BRZI_DATUMI[0]).fn();
  const chip = (label, on) => (
    <button key={label} type="button" onClick={() => setIzbor(label)}
      className={"h-7 px-2.5 rounded-full border text-[12.5px] whitespace-nowrap transition-colors " +
        (on ? "bg-teal-600 border-teal-600 text-white font-semibold" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-teal-400")}>
      {label}
    </button>
  );
  const spremi = async () => {
    if (busy || !currentUser) return;
    setBusy(true);
    try {
      await onDone({ biljeska: biljeska.trim(), sljedeci, opis: opis.trim() || item.opis || "" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="bg-white dark:bg-slate-900 border border-green-200 dark:border-green-900/60 rounded-xl p-3.5 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-wider text-green-700 dark:text-green-400">
        <History size={14} /> {item.tip === "Potencijal" ? "Zapiši u historiju firme" : "Zapiši u napomenu leada"}
      </div>
      <textarea className={inputCls} rows={2} value={biljeska} onChange={(e) => setBiljeska(e.target.value)} autoFocus
        placeholder="Šta je dogovoreno? (nije obavezno)" />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[12.5px] font-semibold text-slate-600 dark:text-slate-400 mr-1">Sljedeći podsjetnik:</span>
        {["Bez novog", "Sutra", "Za 3 dana", "Za 1 sedmicu", "Za 1 mjesec"].map((l) => chip(l, izbor === l))}
        <span className="inline-flex items-center gap-1">
          {chip("Datum", izbor === "Datum")}
          {izbor === "Datum" && (
            <input type="date" aria-label="Datum sljedećeg podsjetnika" value={datum} min={plusDana(1)} onChange={(e) => setDatum(e.target.value)}
              className="h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs text-slate-700 dark:text-slate-200" />
          )}
        </span>
      </div>
      {izbor !== "Bez novog" && (
        <input className={inputCls} value={opis} onChange={(e) => setOpis(e.target.value)} aria-label="Opis sljedećeg podsjetnika" placeholder="Opis sljedećeg podsjetnika (npr. Poslati ponudu)" />
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-8 px-3 text-[13px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">Odustani</button>
        <button type="button" className={btnPrimary + " h-8 text-[13px]"} disabled={busy || !currentUser || (izbor === "Datum" && !datum)} onClick={spremi}>
          <Check size={14} /> {busy ? "Čuvam..." : sljedeci ? `Spremi · novi ${fmtDate(sljedeci)}` : "Spremi i zatvori"}
        </button>
      </div>
    </div>
  );
}

// ---------- novi podsjetnik (bilo koja firma iz Baze potencijala ili Lidova) ----------
function NoviPodsjetnikModal({ zapisi, pocetni, currentUser, onSave, onClose }) {
  const [q, setQ] = useState("");
  const [odabran, setOdabran] = useState(pocetni || null);
  const [datum, setDatum] = useState(plusDana(1));
  const [opis, setOpis] = useState("");
  const [busy, setBusy] = useState(false);
  const pogodci = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return [];
    return zapisi.filter((z) => [z.naziv, z.kontakt].join(" ").toLowerCase().includes(qq))
      .sort((a, b) => (a.naziv.toLowerCase().startsWith(qq) ? 0 : 1) - (b.naziv.toLowerCase().startsWith(qq) ? 0 : 1))
      .slice(0, 8);
  }, [q, zapisi]);
  const spremi = async () => {
    if (!odabran || !datum || !currentUser) return;
    setBusy(true);
    try {
      await onSave(odabran, datum, opis.trim());
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Novi podsjetnik" onClose={onClose}>
      <Field label="Firma" required hint="Potencijal iz Baze potencijala ili lead">
        {odabran ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50/60 dark:bg-teal-900/20 px-3 py-2">
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{odabran.naziv}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">{odabran.tip} · {odabran.status || "—"} · {odabran.vlasnik}</span>
            </span>
            <button type="button" className="text-xs text-teal-700 dark:text-teal-400 hover:underline shrink-0" onClick={() => setOdabran(null)}>Promijeni</button>
          </div>
        ) : (
          <div>
            <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Upiši naziv firme ili kontakt..." autoFocus />
            {pogodci.length > 0 && (
              <div className="mt-1.5 rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                {pogodci.map((z) => (
                  <button key={z.key} type="button" onClick={() => setOdabran(z)} className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                    <span className="block text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{z.naziv}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{z.tip} · {z.status || "—"} · {z.vlasnik}{z.kontakt ? ` · ${z.kontakt}` : ""}</span>
                  </button>
                ))}
              </div>
            )}
            {q.trim() && pogodci.length === 0 && <p className="text-xs text-slate-400 mt-1.5">Nema firme s tim nazivom.</p>}
          </div>
        )}
      </Field>
      {odabran && odabran.rec.podsjetnik_datum && (
        <div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 mb-3">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>Ova firma već ima podsjetnik ({fmtDate(odabran.rec.podsjetnik_datum)}{odabran.rec.podsjetnik_opis ? ` — ${odabran.rec.podsjetnik_opis}` : ""}). Novi će ga zamijeniti.</span>
        </div>
      )}
      <Field label="Datum" required>
        <div className="flex flex-wrap items-center gap-1.5">
          <input type="date" className={inputCls + " w-auto"} value={datum} onChange={(e) => setDatum(e.target.value)} />
          {BRZI_DATUMI.map((b) => (
            <button key={b.label} type="button" onClick={() => setDatum(b.fn())}
              className={"h-7 px-2.5 rounded-full border text-xs " + (datum === b.fn() ? "bg-teal-600 border-teal-600 text-white font-semibold" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-teal-400")}>
              {b.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Opis" hint="npr. poziv, sastanak, poslati ponudu">
        <input className={inputCls} list="podsjetnik-opisi" value={opis} onChange={(e) => setOpis(e.target.value)} placeholder="Šta treba uraditi?" />
        <datalist id="podsjetnik-opisi">{PRIJEDLOZI_OPISA.map((o) => <option key={o} value={o} />)}</datalist>
      </Field>
      <div className="flex justify-end gap-2 mt-2">
        <button className={btnSecondary} onClick={onClose}>Otkaži</button>
        <button className={btnPrimary} onClick={spremi} disabled={!odabran || !datum || !currentUser || busy}>{busy ? "Čuvam..." : "Sačuvaj podsjetnik"}</button>
      </div>
    </Modal>
  );
}

export function PodsjetniciTab({ potencijali = [], lidovi = [], currentUser, onClear, onPatch, onViewCompany }) {
  const [mod, setMod] = useState(currentUser ? "moji" : "tim");
  const [fKolega, setFKolega] = useState("Svi");
  const [fTip, setFTip] = useState("Svi");
  const [fStatus, setFStatus] = useState("Svi");
  const [fRok, setFRok] = useState("Sve");
  const [fDan, setFDan] = useState(null);
  const [q, setQ] = useState("");
  const [zavrsava, setZavrsava] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
  const [showNovi, setShowNovi] = useState(false);
  const [noviPocetni, setNoviPocetni] = useState(null);
  const [mjesec, setMjesec] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [bezLimit, setBezLimit] = useState(5);

  useEffect(() => { if (!currentUser) setMod("tim"); }, [currentUser]);

  // svi zapisi (za novi podsjetnik) i aktivni podsjetnici
  const zapisi = useMemo(() => [
    ...potencijali.map((p) => ({
      key: "P" + p.id, tip: "Potencijal", rec: p, naziv: p.naziv_firme || "—", status: p.status, vlasnik: vlasnikPotencijala(p),
      kontakt: p.kontakt_osoba || "", telefon: p.telefon || "", email: p.email || "",
    })),
    ...lidovi.filter((l) => l.status !== "Konvertovan" || l.podsjetnik_datum).map((l) => ({
      key: "L" + l.id, tip: "Lead", rec: l, naziv: l.naziv_firme || "—", status: l.status, vlasnik: l.kolega || "Nedodijeljeno",
      kontakt: l.kontakt_osoba || "", telefon: l.telefon || "", email: l.email || "",
    })),
  ], [potencijali, lidovi]);
  const svi = useMemo(() => zapisi
    .filter((z) => z.rec.podsjetnik_datum)
    .map((z) => ({ ...z, datum: String(z.rec.podsjetnik_datum).slice(0, 10), opis: z.rec.podsjetnik_opis || "" }))
    .sort((a, b) => a.datum.localeCompare(b.datum) || a.naziv.localeCompare(b.naziv, "hr")), [zapisi]);

  const statusi = useMemo(() => [...new Set(svi.map((r) => r.status).filter(Boolean))], [svi]);
  const qq = q.trim().toLowerCase();
  const scope = (r) =>
    (mod === "moji" ? r.vlasnik === currentUser : fKolega === "Svi" || r.vlasnik === fKolega) &&
    (fTip === "Svi" || r.tip === fTip) &&
    (fStatus === "Svi" || r.status === fStatus) &&
    (!qq || [r.naziv, r.kontakt, r.opis, r.telefon, r.email].join(" ").toLowerCase().includes(qq));
  const base = useMemo(() => svi.filter(scope),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [svi, mod, fKolega, fTip, fStatus, qq, currentUser]);
  const rokOk = (r) => {
    if (fRok === "Sve") return true;
    const s = sekcijaPodsjetnika(r.datum);
    if (fRok === "Kasni") return s === "kasni";
    if (fRok === "Danas") return s === "danas";
    if (fRok === "Do kraja sedmice") return s === "sutra" || s === "sedmica";
    return s === "sljedeca" || s === "kasnije";
  };
  const lista = base.filter((r) => rokOk(r) && (!fDan || r.datum === fDan));

  const broj = (keys) => base.filter((r) => keys.includes(sekcijaPodsjetnika(r.datum))).length;
  const nKasni = broj(["kasni"]), nDanas = broj(["danas"]), nSedm = broj(["sutra", "sedmica"]), nKasnije = broj(["sljedeca", "kasnije"]);
  const najstariji = base.find((r) => daysDiff(r.datum) < 0);

  // tim: aktivni podsjetnici po kolegi
  const tim = useMemo(() => {
    const m = new Map();
    for (const r of svi) {
      const e = m.get(r.vlasnik) || { n: 0, kasni: 0 };
      e.n++; if (daysDiff(r.datum) < 0) e.kasni++;
      m.set(r.vlasnik, e);
    }
    const imena = [...new Set([...COLLEAGUE_NAMES.filter((n) => getColleagueDept(n) === "Prodaja"), ...m.keys()])];
    return imena.map((n) => [n, m.get(n) || { n: 0, kasni: 0 }]).sort((a, b) => b[1].n - a[1].n);
  }, [svi]);

  // firme u pregovorima bez podsjetnika i bez kontakta > 90 dana
  const bezKoraka = useMemo(() => {
    const ko = mod === "moji" ? currentUser : fKolega !== "Svi" ? fKolega : null;
    return potencijali
      .filter((p) => OTVORENI_STATUSI.includes(p.status) && !p.podsjetnik_datum)
      .filter((p) => !ko || vlasnikPotencijala(p) === ko || (p.prodavaci || []).includes(ko))
      .map((p) => ({ p, zk: zadnjiKontakt(p) }))
      .filter((x) => !x.zk || daysAgo(x.zk) > 90)
      .sort((a, b) => (a.zk || "9999").localeCompare(b.zk || "9999"));
  }, [potencijali, mod, fKolega, currentUser]);
  useEffect(() => { setBezLimit(5); }, [mod, fKolega]);

  // kalendar
  const kalDani = useMemo(() => {
    const m = new Map();
    for (const r of base) { const e = m.get(r.datum) || { n: 0, kasni: false }; e.n++; if (daysDiff(r.datum) < 0) e.kasni = true; m.set(r.datum, e); }
    return m;
  }, [base]);
  const prviDan = new Date(mjesec.y, mjesec.m, 1);
  const pomak = (prviDan.getDay() + 6) % 7; // ponedjeljak prvi
  const danaUMj = new Date(mjesec.y, mjesec.m + 1, 0).getDate();
  const pomjeriMj = (d) => setMjesec(({ y, m }) => { const x = new Date(y, m + d, 1); return { y: x.getFullYear(), m: x.getMonth() }; });
  const danas = danasIso();

  // ---------- akcije ----------
  const odgodi = async (r, novi) => {
    setBusyKey(r.key);
    try { await onPatch(r.tip, r.rec.id, { podsjetnik_datum: novi }, `Podsjetnik pomjeren na ${fmtDate(novi)}`); }
    finally { setBusyKey(null); }
  };
  const zavrsi = async (r, { biljeska, sljedeci, opis }) => {
    const patch = { podsjetnik_datum: sljedeci || null, podsjetnik_opis: sljedeci ? opis : "" };
    if (biljeska) {
      if (r.tip === "Potencijal") {
        const zapis = { datum: danasIso(), kolega: currentUser, kontakt: r.kontakt || "", opis: r.opis ? `${r.opis}: ${biljeska}` : biljeska };
        const nova = [zapis, ...(r.rec.historija || [])];
        patch.historija = nova;
        patch.zadnji_kontakt = nova.reduce((m, h) => (h.datum && (!m || h.datum > m) ? h.datum : m), null);
      } else {
        const d = new Date();
        const red = `[${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}. ${currentUser}] ${r.opis ? r.opis + ": " : ""}${biljeska}`;
        patch.napomena = r.rec.napomena ? `${r.rec.napomena}\n${red}` : red;
      }
    }
    await onPatch(r.tip, r.rec.id, patch, sljedeci ? `Obavljeno · novi podsjetnik ${fmtDate(sljedeci)}` : "Podsjetnik obavljen");
    setZavrsava(null);
  };
  const noviPodsjetnik = async (z, datum, opis) => {
    await onPatch(z.tip, z.rec.id, { podsjetnik_datum: datum, podsjetnik_opis: opis }, `Podsjetnik za ${fmtDate(datum)} sačuvan`);
  };
  const otvoriNovi = (z = null) => { setNoviPocetni(z); setShowNovi(true); };

  // ---------- grupe ----------
  const grupe = P_SEKCIJE.map((k) => ({ key: k, items: lista.filter((r) => sekcijaPodsjetnika(r.datum) === k) })).filter((g) => g.items.length);
  const tipChip = (tip) => (
    <span className={"text-[11px] font-semibold px-1.5 py-px rounded-md " + (tip === "Lead" ? "bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300")}>{tip}</span>
  );
  const filtriran = fTip !== "Svi" || fStatus !== "Svi" || fRok !== "Sve" || fDan || qq || (mod === "tim" && fKolega !== "Svi");
  const ocisti = () => { setFTip("Svi"); setFStatus("Svi"); setFRok("Sve"); setFDan(null); setQ(""); setFKolega("Svi"); };
  const toggleRok = (r) => { setFRok(fRok === r ? "Sve" : r); setFDan(null); };

  const modBtn = (id, label, count, icon) => (
    <button type="button" onClick={() => { setMod(id); if (id === "moji") setFKolega("Svi"); }} disabled={id === "moji" && !currentUser}
      className={"h-9 px-3 inline-flex items-center gap-1.5 text-[13px] disabled:opacity-40 " +
        (mod === id ? "bg-teal-600 text-white font-semibold" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white")}>
      {icon} {label}
      <span className={"text-[11px] px-1.5 rounded-full " + (mod === id ? "bg-white/25" : "bg-slate-100 dark:bg-slate-800 text-slate-500")}>{count}</span>
    </button>
  );
  const nMojih = svi.filter((r) => r.vlasnik === currentUser).length;

  return (
    <div>
      {/* ---------- zaglavlje ---------- */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Podsjetnici</h2>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">
            {mod === "moji" ? `${base.length} tvojih aktivnih` : `${base.length} aktivnih${fKolega !== "Svi" ? ` · ${fKolega}` : " u timu"}`} · {nKasni} kasni · {nDanas} danas
          </p>
        </div>
        <button type="button" className={btnPrimary + " h-9"} onClick={() => otvoriNovi()} disabled={!currentUser}><Plus size={15} /> Novi podsjetnik</button>
      </div>

      {/* ---------- pločice ---------- */}
      <div className="flex flex-wrap gap-2.5 mb-4">
        <KpiTile icon={AlertTriangle} tone="red" label="Kasni" value={nKasni} active={fRok === "Kasni"} onClick={() => toggleRok("Kasni")}
          sub={najstariji ? `najstariji ${kadaTekst(najstariji.datum)}` : "sve je na vrijeme"} />
        <KpiTile icon={Sun} tone="amber" label="Danas" value={nDanas} active={fRok === "Danas"} onClick={() => toggleRok("Danas")}
          sub={nDanas ? `${nDanas} ${plural(nDanas, "zadatak", "zadatka", "zadataka")} za danas` : "ništa za danas"} />
        <KpiTile icon={Calendar} tone="blue" label="Do kraja sedmice" value={nSedm} active={fRok === "Do kraja sedmice"} onClick={() => toggleRok("Do kraja sedmice")}
          sub="od sutra do nedjelje" />
        <KpiTile icon={Clock} label="Kasnije" value={nKasnije} active={fRok === "Kasnije"} onClick={() => toggleRok("Kasnije")}
          sub="sljedeća sedmica i dalje" />
      </div>

      <div className="xl:flex xl:items-start xl:gap-4">
        <div className="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
          {/* filteri */}
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden shrink-0">
              {modBtn("moji", "Moji", nMojih, currentUser ? <Avatar name={currentUser} size="sm" /> : null)}
              <span className="w-px bg-slate-200 dark:bg-slate-700" />
              {modBtn("tim", "Cijeli tim", svi.length, <User size={14} />)}
            </div>
            <div className="w-full sm:w-56 sm:flex-none"><SearchBox value={q} onChange={setQ} placeholder="Firma, kontakt, opis..." /></div>
            {mod === "tim" && <FilterPill label="Kolega" value={fKolega} defaultValue="Svi" onChange={setFKolega} options={["Svi", ...tim.map(([n]) => n)]} />}
            <FilterPill label="Tip" value={fTip} defaultValue="Svi" onChange={setFTip} options={["Svi", "Potencijal", "Lead"]} />
            <FilterPill label="Status" value={fStatus} defaultValue="Svi" onChange={setFStatus} options={["Svi", ...statusi]} />
            {fDan && (
              <span className="inline-flex items-center h-9 rounded-lg border border-teal-300 bg-teal-50 text-teal-800 dark:border-teal-700 dark:bg-teal-900/30 dark:text-teal-200 text-[13px] pl-3">
                <span className="opacity-75 mr-1.5">Dan:</span><b className="font-semibold">{fmtDate(fDan)}</b>
                <button type="button" aria-label="Ukloni filter dana" onClick={() => setFDan(null)} className="h-full px-2"><X size={13} /></button>
              </span>
            )}
            {filtriran && <button type="button" onClick={ocisti} className="text-xs text-teal-700 dark:text-teal-400 hover:underline ml-1">Očisti filtere</button>}
          </div>

          {lista.length === 0 ? (
            <div className="p-4">
              <EmptyState icon={Bell}
                title={svi.length === 0 ? "Nema aktivnih podsjetnika" : base.length === 0 && mod === "moji" ? "Nemaš aktivnih podsjetnika" : "Nema podsjetnika za odabrane filtere"}
                subtitle={svi.length === 0 ? "Podsjetnik dodaješ ovdje ili direktno na potencijalu ili leadu (poziv, sastanak, follow-up)." : mod === "moji" && base.length === 0 ? "Pogledaj podsjetnike cijelog tima ili dodaj novi." : "Promijeni pretragu ili filtere."}
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    {mod === "moji" && base.length === 0 && svi.length > 0 && <button className={btnSecondary} onClick={() => setMod("tim")}>Prikaži cijeli tim</button>}
                    {currentUser && <button className={btnPrimary} onClick={() => otvoriNovi()}><Plus size={15} /> Novi podsjetnik</button>}
                  </div>
                } />
            </div>
          ) : (
            <div className="pb-2">
              {grupe.map((g) => (
                <div key={g.key}>
                  <div className={"flex items-center gap-2.5 px-4 pt-3.5 pb-1.5 text-[11px] font-bold uppercase tracking-wider " +
                    (g.key === "kasni" ? "text-red-700 dark:text-red-400" : g.key === "danas" ? "text-amber-800 dark:text-amber-400" : "text-slate-500 dark:text-slate-400")}>
                    {sekcijaNaslov(g.key)}
                    <span className="font-semibold text-slate-400 dark:text-slate-500 tracking-normal">{g.items.length}</span>
                    <span className={"flex-1 h-px " + (g.key === "kasni" ? "bg-red-100 dark:bg-red-900/50" : "bg-slate-100 dark:bg-slate-800")} />
                  </div>
                  {g.items.map((r) => {
                    const n = daysDiff(r.datum);
                    const dt = new Date(r.datum + "T00:00:00");
                    const V = vrstaPodsjetnika(r.opis);
                    const kutija = n < 0 ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                      : n === 0 ? "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                      : "bg-slate-50 text-slate-900 dark:bg-slate-800 dark:text-slate-100";
                    const kadaCls = n < 0 ? "text-red-700 dark:text-red-400" : n === 0 ? "text-amber-800 dark:text-amber-400" : "text-slate-600 dark:text-slate-400";
                    const otvoren = zavrsava === r.key;
                    const tel = prviTelefon(r.telefon);
                    return (
                      <div key={r.key} className={"border-t border-slate-50 dark:border-slate-800/60 " + (otvoren ? "bg-green-50/60 dark:bg-green-900/10" : "")}>
                        <div className="group grid grid-cols-[48px_minmax(0,1fr)] md:grid-cols-[52px_34px_minmax(0,1fr)_100px_30px_auto] gap-x-3.5 gap-y-2 items-center px-4 py-2.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                          <div className={"w-12 md:w-[52px] h-12 md:h-[52px] rounded-xl flex flex-col items-center justify-center leading-none " + kutija}>
                            <span className="text-lg md:text-xl font-bold">{dt.getDate()}</span>
                            <span className="text-[10.5px] font-semibold opacity-75 mt-1">{DANI_KRATKO[dt.getDay()]} · {dt.getMonth() + 1}.</span>
                          </div>
                          <span title={V.label} className="hidden md:inline-flex w-[34px] h-[34px] rounded-full bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 items-center justify-center"><V.icon size={16} /></span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[420px]">{r.naziv}</span>
                              {onViewCompany && (
                                <button type="button" onClick={() => onViewCompany(r.naziv)} className="text-slate-300 dark:text-slate-600 hover:text-teal-600 dark:hover:text-teal-400 opacity-0 group-hover:opacity-100" title="360° pregled firme" aria-label="360° pregled firme">
                                  <ExternalLink size={12} />
                                </button>
                              )}
                              {tipChip(r.tip)}
                              {r.status && <StatusPill status={r.status} />}
                            </div>
                            <div className="text-[13.5px] text-slate-700 dark:text-slate-300 mt-0.5">{r.opis || <span className="text-slate-400">Podsjetnik</span>}</div>
                            {(r.kontakt || tel || r.email) && (
                              <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 mt-1 text-[12.5px]">
                                {r.kontakt && <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400"><User size={13} className="text-slate-400" />{r.kontakt}</span>}
                                {tel && <a href={`tel:${tel.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1.5 font-medium text-teal-700 dark:text-teal-400 hover:underline"><Phone size={13} />{r.telefon}</a>}
                                {r.email && <a href={`mailto:${String(r.email).split(/[,;\s]+/)[0]}`} className="inline-flex items-center gap-1.5 text-teal-700 dark:text-teal-400 hover:underline" title={r.email} aria-label={`Pošalji mail ${r.kontakt || ""}`}><Mail size={13} /><span className="hidden lg:inline max-w-[200px] truncate">{String(r.email).split(/[,;\s]+/)[0]}</span></a>}
                              </div>
                            )}
                            <div className={"md:hidden text-xs font-semibold mt-1 " + kadaCls}>{kadaTekst(r.datum)} · {r.vlasnik}</div>
                          </div>
                          <div className={"hidden md:block text-[13px] font-semibold whitespace-nowrap " + kadaCls}>{kadaTekst(r.datum)}</div>
                          <div className="hidden md:block"><Avatar name={r.vlasnik} size="sm" /></div>
                          <div className="col-span-2 md:col-span-1 flex items-center justify-end gap-1.5">
                            {otvoren ? (
                              <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-[13px] font-semibold"><Check size={14} /> Obavljeno</span>
                            ) : (
                              <>
                                <OdgodiMenu disabled={!currentUser || busyKey === r.key} onPick={(d) => odgodi(r, d)} />
                                <button type="button" disabled={!currentUser || busyKey === r.key} onClick={() => setZavrsava(r.key)}
                                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-[12.5px] font-semibold hover:bg-green-100 dark:hover:bg-green-900/50 disabled:opacity-50">
                                  <Check size={14} /> Obavljeno
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        {otvoren && (
                          <div className="px-4 pb-3.5 md:pl-[118px]">
                            <ZavrsiPanel item={r} currentUser={currentUser} onCancel={() => setZavrsava(null)} onDone={(x) => zavrsi(r, x)} />
                            <div className="text-right mt-1.5">
                              <button type="button" className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:underline"
                                onClick={async () => { await onClear({ id: r.rec.id, tip: r.tip, kolega: r.vlasnik }); setZavrsava(null); }}>
                                Samo zatvori podsjetnik, bez zapisa
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ---------- desna kolona ---------- */}
        <div className="hidden xl:flex flex-col gap-4 w-[320px] shrink-0">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
            <PanelLabel right={
              <span className="flex gap-0.5">
                <button type="button" className={btnGhostIcon} aria-label="Prethodni mjesec" onClick={() => pomjeriMj(-1)}><ChevronLeft size={15} /></button>
                <button type="button" className={btnGhostIcon} aria-label="Sljedeći mjesec" onClick={() => pomjeriMj(1)}><ChevronRight size={15} /></button>
              </span>
            }>{MJESECI[mjesec.m]} {mjesec.y}</PanelLabel>
            <div className="grid grid-cols-7 gap-0.5 mt-1">
              {["po", "ut", "sr", "če", "pe", "su", "ne"].map((d) => <span key={d} className="text-center text-[10.5px] font-bold uppercase text-slate-400">{d}</span>)}
              {Array.from({ length: pomak }).map((_, i) => <span key={"p" + i} />)}
              {Array.from({ length: danaUMj }).map((_, i) => {
                const iso = `${mjesec.y}-${String(mjesec.m + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
                const info = kalDani.get(iso);
                const vikend = (pomak + i) % 7 >= 5;
                const on = fDan === iso;
                return (
                  <button key={iso} type="button" disabled={!info} onClick={() => { setFDan(on ? null : iso); setFRok("Sve"); }}
                    title={info ? `${info.n} ${plural(info.n, "podsjetnik", "podsjetnika", "podsjetnika")}` : undefined}
                    className={"h-9 rounded-lg flex flex-col items-center justify-center gap-0.5 text-[12.5px] transition-colors " +
                      (on ? "bg-teal-600 text-white font-bold" : info ? "bg-teal-50 dark:bg-teal-900/30 text-slate-900 dark:text-slate-100 font-bold hover:bg-teal-100 dark:hover:bg-teal-900/50" : vikend ? "text-slate-300 dark:text-slate-600" : "text-slate-500 dark:text-slate-400") +
                      (iso === danas && !on ? " ring-1 ring-teal-500" : "")}>
                    {i + 1}
                    <span className="flex gap-0.5 h-1">
                      {info && Array.from({ length: Math.min(3, info.n) }).map((_, j) => (
                        <span key={j} className={"w-1 h-1 rounded-full " + (on ? "bg-white" : info.kasni ? "bg-red-500" : "bg-teal-600")} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2 mt-2.5">Klik na dan prikazuje samo podsjetnike tog dana.</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
            <PanelLabel>Tim · aktivni podsjetnici</PanelLabel>
            <div className="flex flex-col gap-0.5 mt-1">
              {tim.map(([ime, v]) => {
                const on = (mod === "moji" && ime === currentUser) || (mod === "tim" && fKolega === ime);
                return (
                  <button key={ime} type="button"
                    onClick={() => { if (on && mod === "tim") setFKolega("Svi"); else if (ime === currentUser) { setMod("moji"); setFKolega("Svi"); } else { setMod("tim"); setFKolega(ime); } }}
                    className={"flex items-center gap-2.5 text-left rounded-lg -mx-1.5 px-1.5 py-1.5 " + (on ? "bg-teal-50 dark:bg-teal-900/30" : "hover:bg-slate-50 dark:hover:bg-slate-800/60")}>
                    <Avatar name={ime} size="sm" />
                    <span className="flex-1 text-[12.5px] text-slate-700 dark:text-slate-300 truncate">{ime}</span>
                    {v.kasni > 0 && <span className="text-[11px] font-semibold text-red-700 bg-red-100 dark:bg-red-900/40 dark:text-red-300 px-1.5 rounded-full">{v.kasni} kasni</span>}
                    <b className="text-[13px] text-slate-900 dark:text-slate-100 w-5 text-right">{v.n}</b>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
            <PanelLabel right={<span className="text-[11px] font-semibold text-amber-800 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-px rounded-full">{fmtN(bezKoraka.length)} {plural(bezKoraka.length, "firma", "firme", "firmi")}</span>}>Bez sljedećeg koraka</PanelLabel>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug mb-1">
              {mod === "moji" ? "Tvoje firme" : fKolega !== "Svi" ? `Firme (${fKolega})` : "Firme"} u pregovorima bez podsjetnika i bez kontakta duže od 3 mjeseca.
            </p>
            {bezKoraka.length === 0 && <p className="text-xs text-green-700 dark:text-green-400 py-1">Sve firme u pregovorima imaju sljedeći korak.</p>}
            <div className={bezLimit > 5 ? "max-h-[360px] overflow-y-auto -mx-1 px-1" : ""}>
              {bezKoraka.slice(0, bezLimit).map(({ p, zk }) => (
                <div key={p.id} className="flex items-center gap-2 py-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate">{p.naziv_firme}</div>
                    <div className="text-[11.5px] text-slate-500 dark:text-slate-400">{p.status} · {zk ? `zadnji kontakt ${relDate(zk)}` : "bez zabilježenog kontakta"}</div>
                  </div>
                  <button type="button" disabled={!currentUser} onClick={() => otvoriNovi(zapisi.find((z) => z.key === "P" + p.id))}
                    className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 text-teal-700 dark:text-teal-400 inline-flex items-center justify-center hover:bg-teal-50 dark:hover:bg-teal-900/30 shrink-0 disabled:opacity-40"
                    aria-label={`Dodaj podsjetnik za ${p.naziv_firme}`} title="Dodaj podsjetnik">
                    <Bell size={14} />
                  </button>
                </div>
              ))}
            </div>
            {bezKoraka.length > bezLimit && (
              <button type="button" onClick={() => setBezLimit(bezLimit + 20)} className="w-full mt-2 h-8 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-teal-700 dark:text-teal-400 hover:bg-slate-50 dark:hover:bg-slate-800">
                Prikaži još ({fmtN(bezKoraka.length - bezLimit)})
              </button>
            )}
          </div>
        </div>
      </div>

      {showNovi && (
        <NoviPodsjetnikModal zapisi={zapisi} pocetni={noviPocetni} currentUser={currentUser}
          onSave={noviPodsjetnik} onClose={() => { setShowNovi(false); setNoviPocetni(null); }} />
      )}
    </div>
  );
}
