"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import {
  Home, Target, Building2, Wrench, Bell, Plus, Pencil,
  ArrowRightCircle, Phone, Mail, MapPin, Calendar, User, AlertTriangle,
  CheckCircle2, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, ChevronsUpDown, Trash2, X, Download, ExternalLink,
  LayoutGrid,
  RefreshCw, MoreHorizontal, Clock, KeyRound, GraduationCap, MessageSquare, Bug,
  AlarmClock, History, Sun, Check, FileText, FlaskConical,
} from "lucide-react";
import {
  COLLEAGUE_NAMES, SORTED_FOR_TECH, POTENCIJAL_STATUSI, STATUS_BOJE, EU_COUNTRIES,
  FORECAST_STATUSI, FORECAST_STATUS_HEX, currentMonthStr, fmtMonth, normForecastStatus,
  inputCls, btnPrimary, btnSecondary, btnGhostIcon,
  todayStr, fmtDate, licenseStatus, reminderUrgency, getReminders, daysDiff, parseDateFlexible, downloadCSV,
  getColleagueDept, getForecastStatusWeight, isForecastWon, isForecastLost,
  COLLEAGUES, companyKey, jeGlavnaLicenca, nazivLicence,
  PORODICE_LICENCI, porodicaLicence, SW_DODACI, swDodatak, vrstaLicence, oznakaVrsteFirme,
} from "../lib/crm";
import { Modal, Field, EmptyState, Toolbar, SearchBox, MetaLine, ImportModal, ConfirmDelete, DangerConfirmModal, ForecastStatusBadge } from "./ui";
import { PrijedlogKartica } from "./kontakti";
import { Avatar, StatusPill, FilterPill, PanelLabel, SortHead, PageNav, daysAgo, relDate, fmtN, headerBtnSec } from "./crmBits";
import { NadogradnjaBadge } from "./nadogradnje";
import { VanUredaTraka, KalendarDanasBlok } from "./kalendar";
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

export function PregledTab({ potencijali, kupci, podrska, forecast, kalendar = [], setTab, theme, onLicenseClick, currentUser }) {
  const podsjetnici = getReminders(potencijali).filter((r) => daysDiff(r.datum) <= 7);
  // samo glavne licence (bez "with …" komponenti i uloga 3DEXPERIENCE) koje ističu u narednih 30 dana
  const isticuLicence = kupci.filter((k) => jeGlavnaLicenca(k) && vrstaLicence(k) === "Komercijalna" && k.end_date && daysDiff(k.end_date) >= 0 && daysDiff(k.end_date) <= 30).sort((a, b) => new Date(a.end_date) - new Date(b.end_date));
  const otvoreniPotencijali = potencijali.filter((p) => p.status !== "Dobijen" && p.status !== "Izgubljen").length;

  const normFirma = (name) => (name || "").trim().toLowerCase();
  const brojUnikatnihKupaca = new Set(kupci.map((k) => normFirma(k.naziv_firme)).filter(Boolean)).size;
  const brojUnikatnihKupacaSaIstekom = new Set(isticuLicence.map((k) => normFirma(k.naziv_firme)).filter(Boolean)).size;

  /* ---- Trendovi (u odnosu na prije 30 dana) ---- */
  const potNovi30 = countCreatedBetween(potencijali, 30, 0);
  const potNoviPrije = countCreatedBetween(potencijali, 60, 30);
  // Kupci prije 30 dana = firme koje su tada već imale licencu (start date stariji od 30 dana ili nepoznat)
  const kupciPrije30 = new Set(
    kupci.filter((k) => !k.start_date || daysDiff(k.start_date) <= -30).map((k) => normFirma(k.naziv_firme)).filter(Boolean)
  ).size;
  // "Ističe ≤30 dana" kakvo je bilo prije 30 dana = glavne licence s krajem u zadnjih 30 dana
  const istekPrije30 = new Set(
    kupci.filter((k) => jeGlavnaLicenca(k) && vrstaLicence(k) === "Komercijalna" && k.end_date && daysDiff(k.end_date) >= -30 && daysDiff(k.end_date) <= 0).map((k) => normFirma(k.naziv_firme)).filter(Boolean)
  ).size;


  const tekuciMjesec = currentMonthStr();
  const forecastOvogMjeseca = (forecast || []).filter((f) => f.mjesec === tekuciMjesec);
  const forecastChartData = FORECAST_STATUSI.map((s) => ({
    status: s,
    broj: forecastOvogMjeseca.filter((f) => normForecastStatus(f.status) === s).length,
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
  const licenceOvajMjesec = kupci.filter((k) => jeGlavnaLicenca(k) && vrstaLicence(k) === "Komercijalna" && k.end_date && String(k.end_date).slice(0, 7) === tekuciMjesec);
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
    const noviPotencijali = potencijali.filter((p) => p.created_at && String(p.created_at).slice(0, 7) === tekuciMjesec).length;
    baner = {
      recenica: recenicaIstek,
      onRecenica: () => setTab("kupci"),
      brojevi: [
        { value: noviPotencijali, label: "Novi potencijali ovog mj.", onClick: () => setTab("potencijali") },
        { value: otvoreniPotencijali, label: "Otvoreni potencijali", onClick: () => setTab("potencijali") },
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

      <VanUredaTraka unosi={kalendar} onOpen={() => setTab("kalendar")} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={Target} label="Otvoreni potencijali" value={otvoreniPotencijali}
          accent="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" onClick={() => setTab("potencijali")}
          trend={pctChange(potNovi30, potNoviPrije)}
          trendTitle={`Novih u zadnjih 30 dana: ${potNovi30} (prethodnih 30 dana: ${potNoviPrije})`}
          caption={`${potNovi30} novih u 30 dana`}
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
                      <p className="text-sm text-slate-700 dark:text-slate-300 truncate" title={`${k.naziv_firme} — ${nazivLicence(k)}`}>
                        <span className="font-semibold">{k.naziv_firme}</span> — {nazivLicence(k)}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        {[k.grad, `${Number(k.broj_licenci) > 0 ? Number(k.broj_licenci) : 1} lic.`, `ističe ${fmtDate(k.end_date)}`].filter(Boolean).join(" · ")}
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

// PotencijalForm i PotencijaliTab su premješteni u components/potencijali.js

const MJESECI = ["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"];
const kratkiDatum = (d) => (d ? `${Number(d.slice(8, 10))}.${Number(d.slice(5, 7))}.` : "");

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
// broji se samo glavna licenca (bez "with …" komponenti i uloga 3DEXPERIENCE platforme)
const licKomG = (k) => (jeGlavnaLicenca(k) ? licKom(k) : 0);
const VRSTA_FILTER = { Komercijalne: "Komercijalna", EDU: "EDU", Research: "Research" };
const SW_TAG = "SOLIDWORKS · ";
// filter "Proizvod": porodica ili dodatni SOLIDWORKS proizvod ("SOLIDWORKS · PDM")
function proizvodOk(k, f) {
  if (f === "Svi") return true;
  if (f.startsWith(SW_TAG)) {
    const t = f.slice(SW_TAG.length), d = swDodatak(k);
    return d === t || (t === "PDM" && d === "Manage");
  }
  return porodicaLicence(k) === f;
}
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

// ---------- porodice proizvoda (Kupci i licence) ----------
// Redoslijed = redoslijed prikaza; SOLIDWORKS Add-in proizvodi su pod SOLIDWORKS,
// uloge 3DEXPERIENCE platforme i tehnički paketi ("NOT FOR SALE…") pod 3DEXPERIENCE.
const PORODICE_LIC = PORODICE_LICENCI;
const PORODICA_STIL = {
  SOLIDWORKS: ["bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900", "bg-red-600", "text-red-700 dark:text-red-300"],
  "3DEXPERIENCE": ["bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900", "bg-blue-600", "text-blue-700 dark:text-blue-300"],
  DraftSight: ["bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900", "bg-orange-600", "text-orange-700 dark:text-orange-300"],
  SolidCAM: ["bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900", "bg-green-600", "text-green-700 dark:text-green-300"],
  SWOOD: ["bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900", "bg-amber-600", "text-amber-800 dark:text-amber-300"],
  DriveWorks: ["bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900", "bg-violet-600", "text-violet-700 dark:text-violet-300"],
  SolidSteel: ["bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-900", "bg-cyan-600", "text-cyan-800 dark:text-cyan-300"],
  Geomagic: ["bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900", "bg-sky-600", "text-sky-800 dark:text-sky-300"],
  PDMShell: ["bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900", "bg-purple-600", "text-purple-700 dark:text-purple-300"],
  Ostalo: ["bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700", "bg-slate-400", "text-slate-600 dark:text-slate-300"],
};
const ISTEKLA_STIL = "bg-white text-slate-400 border-slate-200 dark:bg-slate-900 dark:text-slate-500 dark:border-slate-700";
const TEHNICKI_PAKET = /^NOT FOR SALE/i;
const jeKomponenta = (k) => /^with\b/i.test((k.naziv_proizvoda_2 || "").trim());
// naziv za prikaz u spisku (tooltip): uloga/proizvod, bez komponenti paketa
function prikazniNaziv(k) {
  const p = (k.naziv_proizvoda || "").trim(), s = (k.naziv_proizvoda_2 || "").trim();
  if (TEHNICKI_PAKET.test(p)) return s || "Tehnički paket";
  return p || s || "—";
}
// sažetak po porodicama za jednu firmu (broj = isti način brojanja kao kolona "Licenci")
function porodiceFirme(lic) {
  const m = new Map();
  for (const k of lic) {
    const f = porodicaLicence(k);
    if (!m.has(f)) m.set(f, { f, n: 0, aktivnih: 0, proizvodi: new Map() });
    const g = m.get(f);
    if (!swDodatak(k)) g.n += licKomG(k);
    if (!k.end_date || daysDiff(k.end_date) >= 0) g.aktivnih += 1;
    if (!jeKomponenta(k)) { const nz = prikazniNaziv(k); g.proizvodi.set(nz, (g.proizvodi.get(nz) || 0) + licKom(k)); }
  }
  return PORODICE_LIC.filter((f) => m.has(f)).map((f) => { const g = m.get(f); return { ...g, isteklo: g.aktivnih === 0 }; });
}
// dodatni SOLIDWORKS proizvodi firme: [{ t, n, kroz }] — Manage daje i PDM ("kroz Manage")
function dodaciFirme(lic) {
  const m = new Map();
  for (const k of lic) { const d = swDodatak(k); if (d) m.set(d, (m.get(d) || 0) + licKom(k)); }
  const out = [...m.entries()].map(([t, n]) => ({ t, n }));
  if (m.has("Manage") && !m.has("PDM")) out.push({ t: "PDM", n: 0, kroz: "Manage" });
  const red = (t) => { const i = SW_DODACI.indexOf(t); return i < 0 ? 99 : i; };
  return out.sort((a, b) => red(a.t) - red(b.t) || a.t.localeCompare(b.t));
}
const porodiceTekst = (lic) => [
  ...porodiceFirme(lic).filter((g) => g.n > 0).map((g) => `${g.f} ${fmtN(g.n)}`),
  ...dodaciFirme(lic).filter((d) => d.n > 0).map((d) => `${d.t} ${fmtN(d.n)}`),
].join(" · ");
// oznaka EDU / Research uz serijski broj ili firmu
function VrstaOznaka({ vrsta }) {
  if (!vrsta) return null;
  const research = /^Research/.test(vrsta);
  return (
    <span title={research ? "Research licence (istraživačke)" : "EDU — edukacijske licence (serijski broj 9710…)"}
      className={"inline-flex items-center gap-1 text-[10.5px] font-bold px-1.5 py-px rounded-md border whitespace-nowrap " +
        (research ? "bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-900"
          : "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900")}>
      {research ? <FlaskConical size={10} /> : <GraduationCap size={10} />}{vrsta}
    </span>
  );
}
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
      kom: f.lic.reduce((s, k) => s + licKomG(k), 0),
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
  const [fVrsta, setFVrsta] = useState("Komercijalne");
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
  useEffect(() => { setPage(1); }, [q, rok, fProizvod, fDrzava, fProdavac, fVrsta, prikaz]);

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
  const porodice = useMemo(() => {
    const s = new Set(data.map((k) => porodicaLicence(k)));
    const d = new Set(data.map((k) => swDodatak(k)).filter(Boolean));
    if (d.has("Manage")) d.add("PDM");
    const dodaci = [...SW_DODACI.filter((t) => d.has(t))];
    const out = [];
    for (const f of PORODICE_LIC) {
      if (!s.has(f)) continue;
      out.push(f);
      if (f === "SOLIDWORKS") out.push(...dodaci.map((t) => SW_TAG + t));
    }
    return out;
  }, [data]);
  // vrste licenci po firmi (za oznaku EDU / Research / "EDU + kom.") i broj firmi po vrsti
  const vrsteFirmi = useMemo(() => {
    const m = new Map();
    for (const k of data) {
      const key = companyKey(k.naziv_firme) || String(k.naziv_firme || "").trim().toLowerCase();
      if (!m.has(key)) m.set(key, new Set());
      if (jeGlavnaLicenca(k)) m.get(key).add(vrstaLicence(k));
    }
    return m;
  }, [data]);
  const nPoVrsti = useMemo(() => {
    const c = { Komercijalne: 0, EDU: 0, Research: 0, Sve: vrsteFirmi.size };
    for (const v of vrsteFirmi.values()) {
      if (v.has("Komercijalna") || v.size === 0) c.Komercijalne += 1;
      if (v.has("EDU")) c.EDU += 1;
      if (v.has("Research")) c.Research += 1;
    }
    return c;
  }, [vrsteFirmi]);
  const oznakaFirme = (key) => oznakaVrsteFirme(vrsteFirmi.get(key));
  const [tip, setTip] = useState(null); // tooltip za čip porodice
  useEffect(() => {
    if (!tip) return;
    const zatvori = () => setTip(null);
    window.addEventListener("scroll", zatvori, true);
    return () => window.removeEventListener("scroll", zatvori, true);
  }, [tip]);

  const query = q.trim().toLowerCase();
  // svi filteri osim roka (za pločice, kalendar i desnu kolonu)
  const base = useMemo(() => data.filter((k) => {
    if (query) {
      const polja = [k.naziv_firme, k.grad, k.drzava, k.naziv_proizvoda, k.naziv_proizvoda_2, k.serijski_broj, k.adresa];
      if (!polja.some((x) => (x || "").toString().toLowerCase().includes(query))) return false;
    }
    if (!proizvodOk(k, fProizvod)) return false;
    if (fVrsta !== "Sve" && vrstaLicence(k) !== VRSTA_FILTER[fVrsta]) return false;
    if (fDrzava !== "Sve" && k.drzava !== fDrzava) return false;
    if (fProdavac !== "Svi" && prodavacLicence(k) !== fProdavac) return false;
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [data, query, fProizvod, fDrzava, fProdavac, fVrsta, prodavaciIdx]);
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
    return { firme: new Set(ls.map((k) => companyKey(k.naziv_firme))).size, kom: ls.reduce((s, k) => s + licKomG(k), 0) };
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
      if (m) m.n += licKomG(k);
    }
    return mjeseci;
  }, [base]);
  const maxKal = Math.max(1, ...kalendar.map((m) => m.n));

  const poProizvodu = useMemo(() => {
    const m = new Map();
    base.forEach((k) => { const n = licKomG(k); if (!n) return; const p = swDodatak(k) ? `${SW_TAG}${swDodatak(k)}` : porodicaLicence(k); m.set(p, (m.get(p) || 0) + n); });
    // porodice po broju, a dodatni SOLIDWORKS proizvodi odmah ispod SOLIDWORKS-a
    const sve = [...m.entries()].sort((a, b) => b[1] - a[1]);
    const dodaci = sve.filter(([p]) => p.startsWith(SW_TAG));
    const out = [];
    for (const e of sve) {
      if (e[0].startsWith(SW_TAG)) continue;
      out.push(e);
      if (e[0] === "SOLIDWORKS") out.push(...dodaci);
    }
    if (!m.has("SOLIDWORKS")) out.push(...dodaci);
    return out;
  }, [base]);
  const maxProiz = poProizvodu.length ? Math.max(...poProizvodu.map((e) => e[1])) : 1;

  const nFirmiUk = useMemo(() => new Set(data.map((k) => companyKey(k.naziv_firme))).size, [data]);
  const nLicUk = useMemo(() => data.reduce((s, k) => s + licKomG(k), 0), [data]);
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
  const pokaziTip = (e, sadrzaj) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ x: r.left, y: r.bottom + 6, ...sadrzaj });
  };
  const proizvodiChips = (f) => {
    const gs = porodiceFirme(f.lic).filter((g) => g.n > 0 || g.f !== "SOLIDWORKS");
    const ds = dodaciFirme(f.lic);
    if (gs.length === 0 && ds.length === 0) return <span className="text-xs text-slate-400">—</span>;
    const vidljive = gs.slice(0, 3), ostale = gs.slice(3);
    const dVid = ds.slice(0, 4), dOst = ds.slice(4);
    return (
      <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
        {vidljive.map((g) => {
          const [cls, dot] = PORODICA_STIL[g.f] || PORODICA_STIL.Ostalo;
          const lista = [...g.proizvodi.entries()].sort((a, b) => b[1] - a[1]);
          return (
            <span key={g.f}
              onMouseEnter={(e) => pokaziTip(e, { naslov: `${g.f} · ${fmtN(g.n)} ${plural(g.n, "licenca", "licence", "licenci")}${g.isteklo ? " · sve istekle" : ""}`, stavke: lista })}
              onMouseLeave={() => setTip(null)}
              className={"inline-flex items-center gap-1.5 h-[26px] pl-2 pr-2.5 rounded-md border text-[12.5px] font-semibold whitespace-nowrap cursor-default " + (g.isteklo ? ISTEKLA_STIL : cls)}>
              <span className={"w-[7px] h-[7px] rounded-[2px] " + (g.isteklo ? "bg-slate-300 dark:bg-slate-600" : dot)} />
              {g.f} {g.n > 0 && <span className="tabular-nums">{fmtN(g.n)}</span>}
              {g.isteklo && <span className="text-[10.5px] font-semibold">istekla</span>}
            </span>
          );
        })}
        {ostale.length > 0 && (
          <span onMouseEnter={(e) => pokaziTip(e, { naslov: "Ostale porodice", stavke: ostale.map((g) => [g.f, g.n]) })} onMouseLeave={() => setTip(null)}
            className="inline-flex items-center h-[26px] px-2 rounded-md border border-dashed border-slate-300 dark:border-slate-600 text-xs font-semibold text-slate-500 dark:text-slate-400 cursor-default">
            +{ostale.length}
          </span>
        )}
      </div>
      {ds.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 mt-1.5">
          {dVid.map((d) => d.kroz ? (
            <span key={d.t} title={`uključeno kroz ${d.kroz}`} className="inline-flex items-center h-[22px] px-2 rounded-full border border-dashed border-slate-300 dark:border-slate-600 text-[11.5px] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
              {d.t} <span className="font-normal ml-1">· kroz {d.kroz}</span>
            </span>
          ) : (
            <span key={d.t} className="inline-flex items-center gap-1 h-[22px] px-2 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11.5px] font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
              {d.t} <span className="text-slate-900 dark:text-slate-100 tabular-nums">{fmtN(d.n)}</span>
            </span>
          ))}
          {dOst.length > 0 && (
            <span onMouseEnter={(e) => pokaziTip(e, { naslov: "Ostali dodatni proizvodi", stavke: dOst.map((d) => [d.t, d.n]) })} onMouseLeave={() => setTip(null)}
              className="inline-flex items-center h-[22px] px-1.5 rounded-full border border-dashed border-slate-300 dark:border-slate-600 text-[11.5px] font-semibold text-slate-500 cursor-default">+{dOst.length}</span>
          )}
        </div>
      )}
      </div>
    );
  };
  const licenceDetalji = (f) => (
    <div className="bg-white dark:bg-slate-900 border border-teal-100 dark:border-teal-900/60 rounded-xl px-3.5 pb-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2 py-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Licence · {f.lic.length} {plural(f.lic.length, "stavka", "stavke", "stavki")} · po porodici
        </span>
        <span className="flex gap-2">
          {onViewCompany && (
            <button type="button" className={headerBtnSec + " h-8 text-[12.5px] px-2.5"} onClick={() => onViewCompany(f.naziv)}><ExternalLink size={13} /> 360° firme</button>
          )}
          {canDelete && <button type="button" className={headerBtnSec + " h-8 text-[12.5px] px-2.5"} disabled={!currentUser} onClick={() => novaLicenca(f)}><Plus size={13} /> Licenca</button>}
        </span>
      </div>
      {porodiceFirme(f.lic).map((g) => {
        const [, dot, txt] = PORODICA_STIL[g.f] || PORODICA_STIL.Ostalo;
        const redovi = f.lic.filter((k) => porodicaLicence(k) === g.f);
        return (
          <div key={g.f} className="mt-1">
            <div className="flex items-center gap-2 pt-2 pb-1.5">
              <span className={"w-2 h-2 rounded-[3px] " + (g.isteklo ? "bg-slate-300" : dot)} />
              <span className={"text-[11.5px] font-extrabold uppercase tracking-wider " + (g.isteklo ? "text-slate-400" : txt)}>{g.f}{g.n > 0 && <> · {fmtN(g.n)} {plural(g.n, "licenca", "licence", "licenci")}</>}</span>
              {g.isteklo && <span className="text-[11.5px] text-slate-400">· sve istekle</span>}
            </div>
            {redovi.map((k) => (
              <div key={k.id} className={"grid grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[190px_minmax(0,1fr)_64px_190px_130px] gap-x-3.5 gap-y-1.5 items-center py-2 border-t border-dashed border-slate-200 dark:border-slate-700 " + (k.end_date && daysDiff(k.end_date) < 0 ? "opacity-60" : "")}>
                <span className="font-mono text-xs text-slate-600 dark:text-slate-400 break-all">{k.serijski_broj || "— bez serijskog broja —"}
                  {vrstaLicence(k) !== "Komercijalna" && <span className="ml-1.5 align-middle font-sans"><VrstaOznaka vrsta={vrstaLicence(k)} /></span>}
                </span>
                <span className="lg:hidden justify-self-end"><LicPill status={licenseStatus(k.end_date).label} /></span>
                <span className="text-[13px] text-slate-900 dark:text-slate-100 font-medium min-w-0">
                  {k.naziv_proizvoda || "—"}
                  {swDodatak(k) && <span className="ml-1.5 inline-flex items-center h-[20px] px-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 align-middle">{swDodatak(k)}</span>}
                  {!jeGlavnaLicenca(k) && <span className="ml-1.5 text-[11px] italic text-slate-400 font-normal">{/^with\b/i.test(String(k.naziv_proizvoda_2 || "").trim()) ? "uključeno u paket — ne broji se" : "sporedna stavka — ne broji se"}</span>}
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
      })}
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
          <div className="inline-flex border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden" role="group" aria-label="Vrsta licenci">
            {[["Komercijalne", null], ["EDU", GraduationCap], ["Research", FlaskConical], ["Sve", null]].map(([v, Ic], i) => (
              <button key={v} type="button" onClick={() => setFVrsta(v)} aria-pressed={fVrsta === v}
                title={v === "Komercijalne" ? "Komercijalne licence (9000 / 9010…)" : v === "EDU" ? "Edukacijske licence (9710…)" : v === "Research" ? "Research licence" : "Sve licence"}
                className={"h-9 px-3 inline-flex items-center gap-1.5 text-[13px] " + (i ? "border-l border-slate-300 dark:border-slate-600 " : "") +
                  (fVrsta === v ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700")}>
                {Ic && <Ic size={13} />}{v}<span className="text-[11px] opacity-60 tabular-nums">{fmtN(nPoVrsti[v])}</span>
              </button>
            ))}
          </div>
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
                          <td className="px-3.5 py-2.5 max-w-[280px] min-w-[170px]">
                            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 break-words" title={f.naziv}>{f.naziv}</div>
                            {oznakaFirme(f.key) && <div className="mt-0.5"><VrstaOznaka vrsta={oznakaFirme(f.key)} /></div>}
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
                            <td colSpan={7} className="pr-4 pb-3 pt-0.5">
                              {/* w-0 min-w-full: detalji se prilagode širini tabele i ne šire je (inače kolona Prodavač ode van vidnog polja) */}
                              <div className="w-0 min-w-full">{licenceDetalji(f)}</div>
                            </td>
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
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{f.naziv} {oznakaFirme(f.key) && <VrstaOznaka vrsta={oznakaFirme(f.key)} />}</span>
                            <LicPill status={f.status} />
                          </span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                            {porodiceTekst(f.lic) || "—"}
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
                    <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{porodiceTekst(due)}</span>
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
                  <span className={"truncate " + (p.startsWith(SW_TAG) ? "pl-3 text-slate-500 dark:text-slate-400" : "text-slate-700 dark:text-slate-300")} title={p}>{p.startsWith(SW_TAG) ? "↳ " + p.slice(SW_TAG.length) : p}</span>
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

      {tip && (
        <div className="fixed z-[60] w-[330px] rounded-xl bg-slate-900 text-slate-200 shadow-2xl px-3 py-2.5 text-xs leading-relaxed pointer-events-none"
          style={{ left: Math.max(8, Math.min(tip.x, (typeof window !== "undefined" ? window.innerWidth : 1400) - 340)), top: tip.y }}>
          <div className="font-bold text-white mb-1">{tip.naslov}</div>
          {tip.stavke.slice(0, 8).map(([n, q]) => <div key={n} className="truncate">{kratkiProizvod(n)}{q > 1 ? ` ×${fmtN(q)}` : ""}</div>)}
          {tip.stavke.length > 8 && <div className="text-slate-400">… još {tip.stavke.length - 8}</div>}
        </div>
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
        <History size={14} /> {item.tip === "Potencijal" ? "Zapiši u historiju firme" : item.tip === "Akcija" ? "Zapiši u akciju i historiju firme" : "Zapiši u historiju firme"}
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

// ---------- novi podsjetnik (bilo koja firma iz Baze potencijala) ----------
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
      <Field label="Firma" required hint="Firma iz Baze potencijala">
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

export function PodsjetniciTab({ potencijali = [], akcije = [], akcijeFirme = [], kontaktPrijedlozi = [], onResolvePrijedlog, currentUser, onClear, onPatch, onViewCompany, kalendar = [], onOpenKalendar }) {
  const [sviPrijedlozi, setSviPrijedlozi] = useState(false);
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
    // podsjetnici iz Akcija (firma u akciji) — kontakt se preuzima iz Baze potencijala
    ...(() => {
      const rows = akcijeFirme.filter((r) => r.podsjetnik_datum);
      if (!rows.length) return [];
      const naziv = new Map(akcije.map((a) => [a.id, a.naziv]));
      const pot = new Map();
      potencijali.forEach((p) => { const k = companyKey(p.naziv_firme); if (k && !pot.has(k)) pot.set(k, p); });
      return rows.map((r) => {
        const p = pot.get(r.firma_key) || {};
        return {
          key: "A" + r.id, tip: "Akcija", akcija: naziv.get(r.akcija_id) || "", rec: r, naziv: r.firma || "—", status: r.status, vlasnik: r.prodavac || "Nedodijeljeno",
          kontakt: p.kontakt_osoba || "", telefon: p.telefon || "", email: p.email || "",
        };
      });
    })(),
  ], [potencijali, akcije, akcijeFirme]);
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
      if (r.tip === "Akcija") {
        patch._zapis = { datum: danasIso(), kolega: currentUser, opis: r.opis ? `${r.opis}: ${biljeska}` : biljeska };
      } else if (r.tip === "Potencijal") {
        const zapis = { datum: danasIso(), kolega: currentUser, kontakt: r.kontakt || "", opis: r.opis ? `${r.opis}: ${biljeska}` : biljeska };
        const nova = [zapis, ...(r.rec.historija || [])];
        patch.historija = nova;
        patch.zadnji_kontakt = nova.reduce((m, h) => (h.datum && (!m || h.datum > m) ? h.datum : m), null);
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
  const tipChip = (tip, akcija) => (
    <span title={akcija ? `Akcija: ${akcija}` : undefined} className={"text-[11px] font-semibold px-1.5 py-px rounded-md max-w-[220px] truncate " + (tip === "Akcija" ? "bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300")}>{tip === "Akcija" && akcija ? `Akcija · ${akcija}` : tip}</span>
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

      {/* ---------- kalendar: moji unosi danas (i sutra s podsjetnikom) ---------- */}
      <KalendarDanasBlok unosi={kalendar} currentUser={currentUser} onOpen={onOpenKalendar} />

      {/* ---------- prijedlozi kontakata od tehničke podrške ---------- */}
      {(() => {
        const pp = kontaktPrijedlozi.filter((x) => (x.status === "Na čekanju" || x.status === "Obavijest") &&
          (mod === "moji" ? x.prodavac === currentUser || !x.prodavac : fKolega === "Svi" || (x.prodavac || "Nedodijeljeno") === fKolega))
          .sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
        if (!pp.length) return null;
        const prik = sviPrijedlozi ? pp : pp.slice(0, 3);
        return (
          <div className="mb-4 bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-900 rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300">Kontakti — izmjene od tehničke podrške · {pp.length}</span>
              <span className="text-[11.5px] text-slate-500 dark:text-slate-400">kontakt je već upisan u Bazu potencijala — klikni „Vidio sam“</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {prik.map((pr) => <PrijedlogKartica key={pr.id} pr={pr} showFirma canResolve={!!currentUser && !!onResolvePrijedlog} onResolve={onResolvePrijedlog} onViewCompany={onViewCompany} />)}
            </div>
            {pp.length > 3 && (
              <button type="button" onClick={() => setSviPrijedlozi(!sviPrijedlozi)} className="mt-2 text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline">
                {sviPrijedlozi ? "Prikaži manje" : `Prikaži sve (${pp.length})`}
              </button>
            )}
          </div>
        );
      })()}

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
            <FilterPill label="Tip" value={fTip} defaultValue="Svi" onChange={setFTip} options={["Svi", "Potencijal", ...(akcijeFirme.some((r) => r.podsjetnik_datum) ? ["Akcija"] : [])]} />
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
                subtitle={svi.length === 0 ? "Podsjetnik dodaješ ovdje ili direktno na potencijalu (poziv, sastanak, follow-up)." : mod === "moji" && base.length === 0 ? "Pogledaj podsjetnike cijelog tima ili dodaj novi." : "Promijeni pretragu ili filtere."}
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
                              {tipChip(r.tip, r.akcija)}
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
