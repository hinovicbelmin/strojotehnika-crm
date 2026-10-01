"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Home, Target, TrendingUp, Building2, Wrench, Bell, AlertTriangle, LogOut, LineChart, Lock, Sun, Moon, Minimize2, Maximize2,
  Calculator, Tags, ArrowUpCircle,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import {
  COLLEAGUE_NAMES, fetchAllData, insertRow, updateRow, deleteRow, deleteAllRows, bulkInsert, upsertRows, bulkUpdateRows, bulkDeleteRows, todayStr, getColleagueDept, RENAMED_COLLEAGUES,
  getReminders, daysDiff, currentMonthStr, isForecastWon, isForecastLost,
} from "../lib/crm";
import { idbGet, idbSet, idbRemove } from "../lib/idbCache";
import {
  PregledTab, LidoviTab, KupciTab, PodrskaTab, PodsjetniciTab,
} from "../components/tabs";
import { PotencijaliTab } from "../components/potencijali";
import { ForecastTab } from "../components/forecast";
import { KalkulatorTab, CjenovnikTab } from "../components/kalkulator";
import { NadogradnjeTab, izgradiNadogradnje, nadogradnjeBadge, nadogradnjeSazetak, aktuelnaKampanja } from "../components/nadogradnje";
import { CompanyProfileModal } from "../components/companyProfile";
import { GlobalSearch } from "../components/globalSearch";
import { Sidebar } from "../components/sidebar";
import { AppSkeleton } from "../components/skeleton";
import { ToastStack } from "../components/toast";

const TABS = [
  { id: "pregled", label: "Pregled", icon: Home },
  { id: "forecast", label: "Forecast", icon: LineChart },
  { id: "potencijali", label: "Baza potencijala", icon: Target },
  { id: "lidovi", label: "Lidovi", icon: TrendingUp },
  { id: "kalkulator", label: "Kalkulator zarade", icon: Calculator },
  { id: "cjenovnik", label: "Cjenovnik", icon: Tags },
  { id: "kupci", label: "Kupci i licence", icon: Building2 },
  { id: "podrska", label: "Tehnička podrška", icon: Wrench },
  { id: "nadogradnje", label: "Nadogradnje", icon: ArrowUpCircle },
  { id: "podsjetnici", label: "Podsjetnici", icon: Bell },
];

// Tabovi kojima tehničari nemaju pristup (vidljivi, ali "zaleđeni")
const TECH_RESTRICTED_TABS = ["forecast", "potencijali", "lidovi", "kalkulator", "cjenovnik"];

const CACHE_KEY = "crm_data_cache_v1";

export default function HomePage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [session, setSession] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [dataReady, setDataReady] = useState(false);
  const [tab, setTab] = useState("pregled");
  const [navOpen, setNavOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState("");
  const [theme, setTheme] = useState("light");
  const [density, setDensity] = useState("comfortable");
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [viewingCompany, setViewingCompany] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [chartFilter, setChartFilter] = useState(null); // { tab: 'potencijali'|'kupci', value: string }

  const [potencijali, setPotencijali] = useState([]);
  const [lidovi, setLidovi] = useState([]);
  const [kupci, setKupci] = useState([]);
  const [podrska, setPodrska] = useState([]);
  const [forecast, setForecast] = useState([]);
  const [cjenovnik, setCjenovnik] = useState([]);
  const [kalkulacije, setKalkulacije] = useState([]);
  const [kalkNacrt, setKalkNacrt] = useState(null); // otvorena kalkulacija ostaje i kad se prebaci na drugi tab
  const [nadKampanje, setNadKampanje] = useState([]);
  const [nadLicence, setNadLicence] = useState([]);
  const [nadFirme, setNadFirme] = useState([]);

  // Auth guard
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push("/login");
      } else {
        setSession(data.session);
        let saved = localStorage.getItem("crm_trenutni_korisnik") || "";
        if (RENAMED_COLLEAGUES[saved]) {
          saved = RENAMED_COLLEAGUES[saved];
          localStorage.setItem("crm_trenutni_korisnik", saved);
        }
        setCurrentUser(saved);
      }
      setCheckingAuth(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (!sess) router.push("/login");
    });
    return () => listener.subscription.unsubscribe();
  }, [router]);

  // Load data once authenticated — prvo pokaži zadnje keširano stanje (ako postoji), pa tiho osvježi u pozadini
  useEffect(() => {
    if (!session) return;
    (async () => {
      const cached = await idbGet(CACHE_KEY);
      if (cached) {
        setPotencijali(cached.potencijali || []);
        setLidovi(cached.lidovi || []);
        setKupci(cached.kupci || []);
        setPodrska(cached.podrska || []);
        setForecast(cached.forecast || []);
        setCjenovnik(cached.cjenovnik || []);
        setKalkulacije(cached.kalkulacije || []);
        setNadKampanje(cached.nadKampanje || []);
        setNadLicence(cached.nadLicence || []);
        setNadFirme(cached.nadFirme || []);
        setLoadingData(false);
        setDataReady(true);
      } else {
        setLoadingData(true);
      }
      const all = await fetchAllData();
      setPotencijali(all.potencijali);
      setLidovi(all.lidovi);
      setKupci(all.kupci);
      setPodrska(all.podrska);
      setForecast(all.forecast || []);
      setCjenovnik(all.cjenovnik || []);
      setKalkulacije(all.kalkulacije || []);
      setNadKampanje(all.nadKampanje || []);
      setNadLicence(all.nadLicence || []);
      setNadFirme(all.nadFirme || []);
      setLoadingData(false);
      setDataReady(true);
    })();
  }, [session]);

  // Automatski ažuriraj lokalni keš pri svakoj promjeni podataka (dodavanje/izmjena/brisanje/uvoz)
  useEffect(() => {
    if (!dataReady) return;
    idbSet(CACHE_KEY, { potencijali, lidovi, kupci, podrska, forecast, cjenovnik, kalkulacije, nadKampanje, nadLicence, nadFirme });
  }, [dataReady, potencijali, lidovi, kupci, podrska, forecast, cjenovnik, kalkulacije, nadKampanje, nadLicence, nadFirme]);

  // Nadogradnje: model (licence s aktivnim održavanjem + stanje iz baze) — za tab, meni, Kupce i 360°
  const nadAkt = aktuelnaKampanja(nadKampanje);
  const nadModel = useMemo(() => izgradiNadogradnje({ kupci, licRows: nadLicence, firmRows: nadFirme, akt: nadAkt }), [kupci, nadLicence, nadFirme, nadAkt]);
  const nadSazetak = useMemo(() => nadogradnjeSazetak(nadModel, nadAkt), [nadModel, nadAkt]);

  // Tema (svijetla/tamna) — pamti se po uređaju/browseru
  useEffect(() => {
    const saved = localStorage.getItem("crm_theme") || "light";
    setTheme(saved);
    document.documentElement.classList.toggle("dark", saved === "dark");
    const savedDensity = localStorage.getItem("crm_density") || "comfortable";
    setDensity(savedDensity);
    setNavCollapsed(localStorage.getItem("crm_sidebar_collapsed") === "1");
  }, []);

  const toggleNavCollapsed = () => {
    setNavCollapsed((c) => {
      const next = !c;
      localStorage.setItem("crm_sidebar_collapsed", next ? "1" : "0");
      return next;
    });
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("crm_theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  const toggleDensity = () => {
    const next = density === "compact" ? "comfortable" : "compact";
    setDensity(next);
    localStorage.setItem("crm_density", next);
  };

  const chooseUser = (name) => {
    setCurrentUser(name);
    localStorage.setItem("crm_trenutni_korisnik", name);
  };

  const isTehnicar = getColleagueDept(currentUser) === "Tehnička podrška";

  const signOut = async () => {
    await supabase.auth.signOut();
    await idbRemove(CACHE_KEY);
    router.push("/login");
  };

  /* ---------------- Toast / Undo infrastruktura ---------------- */
  const dismissToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));
  const showToast = (message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => dismissToast(id), 3200);
  };
  const showUndoToast = (message, onUndo) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type: "success", actionLabel: "Poništi", onAction: onUndo }]);
    setTimeout(() => dismissToast(id), 5200);
  };
  // Optimistički ukloni iz prikaza odmah, a stvarno brisanje iz baze izvrši tek nakon 5s (ako se ne poništi)
  const scheduleUndoDelete = (label, restoreLocally, commitDelete) => {
    let undone = false;
    const timerId = setTimeout(async () => {
      if (undone) return;
      try {
        await commitDelete();
      } catch (e) {
        console.error(e);
        showToast(`Greška pri brisanju: ${label}`, "error");
        restoreLocally();
      }
    }, 5000);
    showUndoToast(`Obrisano: ${label}`, () => {
      undone = true;
      clearTimeout(timerId);
      restoreLocally();
    });
  };

  /* ---------------- Potencijali handlers ---------------- */
  const addPotencijal = async (payload) => {
    try {
      const rec = await insertRow("potencijali", payload);
      setPotencijali((prev) => [rec, ...prev]);
      showToast("Potencijal sačuvan");
    } catch (e) {
      showToast("Greška pri čuvanju potencijala", "error");
      throw e;
    }
  };
  const updatePotencijal = async (id, patch) => {
    try {
      const rec = await updateRow("potencijali", id, patch);
      setPotencijali((prev) => prev.map((p) => (p.id === id ? rec : p)));
      showToast("Potencijal sačuvan");
    } catch (e) {
      showToast("Greška pri čuvanju potencijala", "error");
      throw e;
    }
  };
  const deletePotencijal = (id) => {
    const item = potencijali.find((p) => p.id === id);
    if (!item) return;
    setPotencijali((prev) => prev.filter((p) => p.id !== id));
    scheduleUndoDelete(
      item.naziv_firme || "potencijal",
      () => setPotencijali((prev) => [item, ...prev]),
      () => deleteRow("potencijali", id)
    );
  };
  const bulkImportPotencijali = async (rows, opts) => {
    try {
      const inserted = await bulkInsert("potencijali", rows, opts);
      setPotencijali((prev) => [...inserted, ...prev]);
      showToast(`Uvezeno ${inserted.length} potencijala`);
    } catch (e) {
      showToast("Greška pri uvozu potencijala", "error");
      throw e;
    }
  };
  const bulkUpdatePotencijali = async (ids, patch) => {
    try {
      const updated = await bulkUpdateRows("potencijali", ids, patch);
      const updatedMap = new Map(updated.map((u) => [u.id, u]));
      setPotencijali((prev) => prev.map((p) => (updatedMap.has(p.id) ? updatedMap.get(p.id) : p)));
      showToast(`Izmijenjeno ${updated.length} potencijala`);
    } catch (e) {
      showToast("Greška pri grupnoj izmjeni", "error");
      throw e;
    }
  };
  const bulkDeletePotencijali = (ids) => {
    const items = potencijali.filter((p) => ids.includes(p.id));
    if (items.length === 0) return;
    setPotencijali((prev) => prev.filter((p) => !ids.includes(p.id)));
    scheduleUndoDelete(
      `${items.length} potencijala`,
      () => setPotencijali((prev) => [...items, ...prev]),
      () => bulkDeleteRows("potencijali", ids)
    );
  };

  /* ---------------- Lidovi handlers ---------------- */
  const addLead = async (payload) => {
    try {
      const rec = await insertRow("lidovi", payload);
      setLidovi((prev) => [rec, ...prev]);
      showToast("Lead sačuvan");
    } catch (e) {
      showToast("Greška pri čuvanju leada", "error");
      throw e;
    }
  };
  const updateLead = async (id, patch) => {
    try {
      const rec = await updateRow("lidovi", id, patch);
      setLidovi((prev) => prev.map((l) => (l.id === id ? rec : l)));
      showToast("Lead sačuvan");
    } catch (e) {
      showToast("Greška pri čuvanju leada", "error");
      throw e;
    }
  };
  const deleteLead = (id) => {
    const item = lidovi.find((l) => l.id === id);
    if (!item) return;
    setLidovi((prev) => prev.filter((l) => l.id !== id));
    scheduleUndoDelete(
      item.naziv_firme || "lead",
      () => setLidovi((prev) => [item, ...prev]),
      () => deleteRow("lidovi", id)
    );
  };
  const bulkImportLidovi = async (rows) => {
    try {
      const inserted = await bulkInsert("lidovi", rows);
      setLidovi((prev) => [...inserted, ...prev]);
      showToast(`Uvezeno ${inserted.length} lidova`);
    } catch (e) {
      showToast("Greška pri uvozu lidova", "error");
      throw e;
    }
  };
  const bulkUpdateLidovi = async (ids, patch) => {
    try {
      const updated = await bulkUpdateRows("lidovi", ids, patch);
      const updatedMap = new Map(updated.map((u) => [u.id, u]));
      setLidovi((prev) => prev.map((l) => (updatedMap.has(l.id) ? updatedMap.get(l.id) : l)));
      showToast(`Izmijenjeno ${updated.length} lidova`);
    } catch (e) {
      showToast("Greška pri grupnoj izmjeni", "error");
      throw e;
    }
  };
  const bulkDeleteLidovi = (ids) => {
    const items = lidovi.filter((l) => ids.includes(l.id));
    if (items.length === 0) return;
    setLidovi((prev) => prev.filter((l) => !ids.includes(l.id)));
    scheduleUndoDelete(
      `${items.length} lidova`,
      () => setLidovi((prev) => [...items, ...prev]),
      () => bulkDeleteRows("lidovi", ids)
    );
  };
  const convertLead = async (lead) => {
    try {
      const novi = {
        naziv_firme: lead.naziv_firme, grad: lead.grad, drzava: lead.drzava,
        kontakt_osoba: lead.kontakt_osoba, telefon: lead.telefon, email: lead.email,
        kolega: lead.kolega, status: "Novi kontakt",
        napomena: (lead.napomena ? lead.napomena + " " : "") + `(konvertovano iz leada, izvor: ${lead.izvor || "n/a"})`,
        podsjetnik_datum: null, podsjetnik_opis: "",
        origin_lead_id: lead.id,
        created_by: currentUser || lead.kolega, created_at: new Date().toISOString(),
        updated_by: currentUser || lead.kolega, updated_at: new Date().toISOString(),
      };
      const recPot = await insertRow("potencijali", novi);
      setPotencijali((prev) => [recPot, ...prev]);
      const recLead = await updateRow("lidovi", lead.id, {
        status: "Konvertovan", updated_by: currentUser || lead.kolega, updated_at: new Date().toISOString(),
      });
      setLidovi((prev) => prev.map((l) => (l.id === lead.id ? recLead : l)));
      showToast(`${lead.naziv_firme} konvertovan u potencijal`);
    } catch (e) {
      showToast("Greška pri konverziji leada", "error");
      throw e;
    }
  };

  /* ---------------- Kupci handlers ---------------- */
  const addKupac = async (payload) => {
    try {
      const rec = await insertRow("kupci", payload);
      setKupci((prev) => [rec, ...prev]);
      showToast("Kupac sačuvan");
    } catch (e) {
      showToast("Greška pri čuvanju kupca", "error");
      throw e;
    }
  };
  const updateKupac = async (id, patch) => {
    try {
      const rec = await updateRow("kupci", id, patch);
      setKupci((prev) => prev.map((k) => (k.id === id ? rec : k)));
      showToast("Kupac sačuvan");
    } catch (e) {
      showToast("Greška pri čuvanju kupca", "error");
      throw e;
    }
  };
  const deleteKupac = (id) => {
    const item = kupci.find((k) => k.id === id);
    if (!item) return;
    setKupci((prev) => prev.filter((k) => k.id !== id));
    scheduleUndoDelete(
      item.naziv_firme || "kupac",
      () => setKupci((prev) => [item, ...prev]),
      () => deleteRow("kupci", id)
    );
  };
  const deleteAllKupci = async () => {
    try {
      await deleteAllRows("kupci");
      setKupci([]);
      showToast("Svi kupci obrisani");
    } catch (e) {
      showToast("Greška pri brisanju svih kupaca", "error");
      throw e;
    }
  };

  /* ---------------- Forecast handlers ---------------- */
  const addForecast = async (payload) => {
    try {
      const rec = await insertRow("forecast", payload);
      setForecast((prev) => [rec, ...prev]);
      showToast("Forecast stavka sačuvana");
    } catch (e) {
      showToast("Greška pri čuvanju forecast stavke", "error");
      throw e;
    }
  };
  const updateForecast = async (id, patch) => {
    try {
      const rec = await updateRow("forecast", id, patch);
      setForecast((prev) => prev.map((f) => (f.id === id ? rec : f)));
      showToast("Forecast stavka sačuvana");
    } catch (e) {
      showToast("Greška pri čuvanju forecast stavke", "error");
      throw e;
    }
  };
  const deleteForecast = (id) => {
    const item = forecast.find((f) => f.id === id);
    if (!item) return;
    setForecast((prev) => prev.filter((f) => f.id !== id));
    scheduleUndoDelete(
      item.kupac || "forecast stavka",
      () => setForecast((prev) => [item, ...prev]),
      () => deleteRow("forecast", id)
    );
  };
  const bulkDeleteForecast = (ids) => {
    const items = forecast.filter((f) => ids.includes(f.id));
    if (items.length === 0) return;
    setForecast((prev) => prev.filter((f) => !ids.includes(f.id)));
    scheduleUndoDelete(
      `${items.length} forecast stavki`,
      () => setForecast((prev) => [...items, ...prev]),
      () => bulkDeleteRows("forecast", ids)
    );
  };
  const bulkAddForecast = async (rows) => {
    try {
      const inserted = await bulkInsert("forecast", rows);
      setForecast((prev) => [...inserted, ...prev]);
      showToast(`Dodano ${inserted.length} forecast stavki`);
    } catch (e) {
      showToast("Greška pri uvozu forecast stavki", "error");
      throw e;
    }
  };
  // Svaki red iz fajla je UVIJEK poseban zapis (bez spajanja/upsert-a po serijskom broju).
  // Napomena: ako se isti fajl uveze ponovo (npr. mjesečno), stariji zapisi ostaju —
  // za čist mjesečni presjek, prije uvoza obrišite stare zapise (Supabase → SQL Editor → DELETE FROM kupci;)
  const bulkImportKupci = async (rows) => {
    try {
      const ts = new Date().toISOString();
      const payload = rows.map((row) => ({
        ...row,
        created_by: currentUser || "Uvoz",
        created_at: ts,
        updated_by: currentUser || "Uvoz",
        updated_at: ts,
      }));
      const inserted = await bulkInsert("kupci", payload);
      setKupci((prev) => [...inserted, ...prev]);
      showToast(`Uvezeno ${inserted.length} kupaca`);
    } catch (e) {
      showToast("Greška pri uvozu kupaca", "error");
      throw e;
    }
  };

  /* ---------------- Podrška handlers ---------------- */
  const addPodrska = async (payload) => {
    try {
      const rec = await insertRow("podrska", payload);
      setPodrska((prev) => [rec, ...prev]);
      showToast("Intervencija sačuvana");
    } catch (e) {
      showToast("Greška pri čuvanju intervencije", "error");
      throw e;
    }
  };
  const updatePodrska = async (id, patch) => {
    try {
      const rec = await updateRow("podrska", id, patch);
      setPodrska((prev) => prev.map((s) => (s.id === id ? rec : s)));
      showToast("Intervencija sačuvana");
    } catch (e) {
      showToast("Greška pri čuvanju intervencije", "error");
      throw e;
    }
  };
  const deletePodrska = (id) => {
    const item = podrska.find((s) => s.id === id);
    if (!item) return;
    setPodrska((prev) => prev.filter((s) => s.id !== id));
    scheduleUndoDelete(
      item.firma || "intervencija",
      () => setPodrska((prev) => [item, ...prev]),
      () => deleteRow("podrska", id)
    );
  };

  /* ---------------- Podsjetnici handler ---------------- */
  const clearReminder = async (item) => {
    try {
      const table = item.tip === "Potencijal" ? "potencijali" : "lidovi";
      const rec = await updateRow(table, item.id, {
        podsjetnik_datum: null, podsjetnik_opis: "",
        updated_by: currentUser || item.kolega, updated_at: new Date().toISOString(),
      });
      if (table === "potencijali") setPotencijali((prev) => prev.map((p) => (p.id === item.id ? rec : p)));
      else setLidovi((prev) => prev.map((l) => (l.id === item.id ? rec : l)));
      showToast("Podsjetnik označen kao obavljen");
    } catch (e) {
      showToast("Greška pri ažuriranju podsjetnika", "error");
      throw e;
    }
  };

  /* ---------------- Cjenovnik i kalkulacije ---------------- */
  const addProizvod = async (payload) => {
    try {
      const rec = await insertRow("cjenovnik", payload);
      setCjenovnik((prev) => [rec, ...prev]);
      showToast("Proizvod dodan u cjenovnik");
    } catch (e) {
      showToast("Greška pri čuvanju proizvoda", "error");
      throw e;
    }
  };
  const updateProizvod = async (id, patch) => {
    try {
      const rec = await updateRow("cjenovnik", id, patch);
      setCjenovnik((prev) => prev.map((p) => (p.id === id ? rec : p)));
      showToast("Proizvod sačuvan");
    } catch (e) {
      showToast("Greška pri čuvanju proizvoda", "error");
      throw e;
    }
  };
  const deleteProizvod = (id) => {
    const item = cjenovnik.find((p) => p.id === id);
    if (!item) return;
    setCjenovnik((prev) => prev.filter((p) => p.id !== id));
    scheduleUndoDelete(
      `${item.naziv} ${item.oznaka || ""}`.trim(),
      () => setCjenovnik((prev) => [item, ...prev]),
      () => deleteRow("cjenovnik", id)
    );
  };
  const bulkImportCjenovnik = async (rows) => {
    try {
      const inserted = await bulkInsert("cjenovnik", rows);
      setCjenovnik((prev) => [...inserted, ...prev]);
      showToast(`Uvezeno ${inserted.length} proizvoda`);
    } catch (e) {
      showToast("Greška pri uvozu cjenovnika", "error");
      throw e;
    }
  };
  const saveKalkulacija = async (id, payload) => {
    try {
      const rec = id ? await updateRow("kalkulacije", id, payload) : await insertRow("kalkulacije", payload);
      setKalkulacije((prev) => (id ? prev.map((x) => (x.id === id ? rec : x)) : [rec, ...prev]));
      showToast(id ? "Kalkulacija ažurirana" : "Kalkulacija spremljena");
      return rec;
    } catch (e) {
      showToast("Greška pri spremanju kalkulacije", "error");
      return null;
    }
  };
  const deleteKalkulacija = (id) => {
    const item = kalkulacije.find((x) => x.id === id);
    if (!item) return;
    setKalkulacije((prev) => prev.filter((x) => x.id !== id));
    if (kalkNacrt && kalkNacrt.id === id) setKalkNacrt({ ...kalkNacrt, id: null, _izmjena: true });
    scheduleUndoDelete(
      item.naziv || "kalkulacija",
      () => setKalkulacije((prev) => [item, ...prev]),
      () => deleteRow("kalkulacije", id)
    );
  };

  /* ---------------- Nadogradnje ---------------- */
  // items: [{ id | null, data }] — postojeći zapis se ažurira, novi se upisuje
  const saveNadLicence = async (items) => {
    try {
      const nove = items.filter((i) => !i.id).map((i) => i.data);
      const izmjene = items.filter((i) => i.id);
      const inserted = nove.length ? await upsertRows("nadogradnje_licence", nove, "kampanja,serijski_broj,proizvod") : [];
      const updated = [];
      for (const i of izmjene) updated.push(await updateRow("nadogradnje_licence", i.id, i.data));
      const um = new Map([...updated, ...inserted].map((u) => [u.id, u]));
      setNadLicence((prev) => {
        const ids = new Set(prev.map((r) => r.id));
        return [...inserted.filter((r) => !ids.has(r.id)), ...prev.map((r) => (um.has(r.id) ? um.get(r.id) : r))];
      });
      showToast(items.length > 1 ? `Sačuvano ${items.length} licenci` : "Licenca sačuvana");
    } catch (e) {
      console.error(e);
      showToast("Greška pri čuvanju nadogradnje", "error");
      throw e;
    }
  };
  const saveNadFirma = async (id, data) => {
    try {
      const rec = id ? await updateRow("nadogradnje_firme", id, data) : (await upsertRows("nadogradnje_firme", [data], "kampanja,firma_key"))[0];
      setNadFirme((prev) => (prev.some((r) => r.id === rec.id) ? prev.map((r) => (r.id === rec.id ? rec : r)) : [rec, ...prev]));
      showToast("Nadogradnja sačuvana");
    } catch (e) {
      console.error(e);
      showToast("Greška pri čuvanju firme (nadogradnje)", "error");
      throw e;
    }
  };
  const novaNadKampanja = async (verzija) => {
    try {
      const rec = await insertRow("nadogradnje_kampanje", {
        proizvod: "SOLIDWORKS", verzija, created_by: currentUser || "—", created_at: new Date().toISOString(),
        updated_by: currentUser || "—", updated_at: new Date().toISOString(),
      });
      setNadKampanje((prev) => [rec, ...prev]);
      showToast(`Otvorena kampanja SOLIDWORKS ${verzija}`);
    } catch (e) {
      console.error(e);
      showToast("Greška pri otvaranju kampanje", "error");
      throw e;
    }
  };

  // izmjena podsjetnika (odgoda, obavljeno + zapis u historiju, novi podsjetnik)
  const patchReminderRecord = async (tip, id, patch, poruka) => {
    try {
      const table = tip === "Potencijal" ? "potencijali" : "lidovi";
      const rec = await updateRow(table, id, { ...patch, updated_by: currentUser || "—", updated_at: new Date().toISOString() });
      if (table === "potencijali") setPotencijali((prev) => prev.map((p) => (p.id === id ? rec : p)));
      else setLidovi((prev) => prev.map((l) => (l.id === id ? rec : l)));
      showToast(poruka || "Podsjetnik sačuvan");
    } catch (e) {
      showToast("Greška pri ažuriranju podsjetnika", "error");
      throw e;
    }
  };

  if (checkingAuth || !session) {
    return <AppSkeleton />;
  }

  if (loadingData) {
    return <AppSkeleton />;
  }

  const ActiveIcon = TABS.find((t) => t.id === tab)?.icon || Home;

  // Brojači u lijevom meniju
  const tekuciMjesec = currentMonthStr();
  const navBadges = {
    podsjetnici: {
      count: getReminders(potencijali, lidovi).filter((r) => r.datum && daysDiff(r.datum) <= 0).length,
      tone: "alert", hint: "za danas / kasni",
    },
    kupci: {
      count: new Set(
        kupci.filter((k) => k.end_date && daysDiff(k.end_date) >= 0 && daysDiff(k.end_date) <= 30)
          .map((k) => (k.naziv_firme || "").trim().toLowerCase()).filter(Boolean)
      ).size,
      tone: "warn", hint: "firmi — licenca ističe ≤30 dana",
    },
    nadogradnje: {
      count: nadogradnjeBadge(nadModel),
      tone: "warn", hint: "firmi za nadogradnju — održavanje ističe ≤30 dana",
    },
    lidovi: {
      count: lidovi.filter((l) => l.status !== "Konvertovan" && l.status !== "Odbačen").length,
      tone: "muted", hint: "aktivnih lidova",
    },
    forecast: {
      count: forecast.filter((f) => f.mjesec === tekuciMjesec && !isForecastWon(f.status) && !isForecastLost(f.status)).length,
      tone: "muted", hint: "otvorenih stavki ovog mjeseca",
    },
  };

  return (
    <div className="w-full min-h-screen bg-slate-50 dark:bg-slate-950 flex text-slate-800 dark:text-slate-200 transition-colors duration-200">
      {/* Sidebar */}
      <Sidebar
        tabs={TABS}
        tab={tab}
        onSelectTab={(id) => { setTab(id); setNavOpen(false); }}
        navOpen={navOpen}
        isRestricted={(id) => isTehnicar && TECH_RESTRICTED_TABS.includes(id)}
        badges={navBadges}
        currentUser={currentUser}
        currentDept={getColleagueDept(currentUser)}
        onChooseUser={chooseUser}
        theme={theme}
        onToggleTheme={toggleTheme}
        onSignOut={signOut}
        collapsed={navCollapsed}
        onToggleCollapsed={toggleNavCollapsed}
      />

      {navOpen && <div className="fixed inset-0 bg-slate-900/40 z-30 md:hidden" onClick={() => setNavOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 transition-colors duration-200">
          <div className="flex items-center gap-3 min-w-0">
            <button className="md:hidden p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setNavOpen(true)}>
              <ActiveIcon size={18} />
            </button>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate hidden sm:block">{TABS.find((t) => t.id === tab)?.label}</h2>
          </div>
          <GlobalSearch
            potencijali={potencijali}
            lidovi={lidovi}
            kupci={kupci}
            podrska={podrska}
            forecast={forecast}
            isTehnicar={isTehnicar}
            onSelectCompany={setViewingCompany}
            onNavigateTab={setTab}
          />
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={toggleDensity}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors duration-150 hidden sm:inline-flex"
              title={density === "compact" ? "Prebaci na udoban prikaz" : "Prebaci na kompaktan prikaz"}
            >
              {density === "compact" ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            </button>
            <button
              onClick={toggleTheme}
              className="md:hidden p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors duration-150"
              title={theme === "dark" ? "Prebaci na svijetlu temu" : "Prebaci na tamnu temu"}
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline md:hidden">Ja sam:</span>
            <select
              className="md:hidden text-sm rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors duration-150"
              value={currentUser}
              onChange={(e) => chooseUser(e.target.value)}
            >
              <option value="">— odaberi se —</option>
              {COLLEAGUE_NAMES.map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
        </header>

        {!currentUser && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-900/40 px-6 py-2 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
            <AlertTriangle size={13} /> <span className="hidden md:inline">Odaberi svoje ime dolje lijevo u meniju da bi se ispravno bilježilo ko unosi/ažurira podatke.</span><span className="md:hidden">Odaberi svoje ime gore desno da bi se ispravno bilježilo ko unosi/ažurira podatke.</span>
          </div>
        )}

        <main className={"flex-1 overflow-y-auto p-4 sm:p-6 " + (density === "compact" ? "density-compact" : "")}>
          {isTehnicar && TECH_RESTRICTED_TABS.includes(tab) ? (
            <div className="flex flex-col items-center justify-center text-center py-24 px-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                <Lock size={22} className="text-slate-400 dark:text-slate-500" />
              </div>
              <p className="text-base font-semibold text-slate-700 dark:text-slate-300">Nemate odobrenje za pristup ovom tabu</p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 max-w-sm">
                Ova sekcija je dostupna samo kolegama iz prodaje i marketinga. Ako mislite da je ovo greška, javite se administratoru CRM-a.
              </p>
            </div>
          ) : (
            <div key={tab} className="tab-transition">
              {tab === "pregled" && (
                <PregledTab
                  potencijali={potencijali}
                  lidovi={lidovi}
                  kupci={kupci}
                  podrska={podrska}
                  forecast={forecast}
                  setTab={setTab}
                  theme={theme}
                  currentUser={currentUser}
                  onLicenseClick={(label) => { setChartFilter({ tab: "kupci", value: label }); setTab("kupci"); }}
                />
              )}
              {tab === "potencijali" && (
                <PotencijaliTab
                  data={potencijali}
                  kupci={kupci}
                  currentUser={currentUser}
                  onAdd={addPotencijal}
                  onUpdate={updatePotencijal}
                  onDelete={deletePotencijal}
                  onBulkImport={bulkImportPotencijali}
                  onBulkUpdate={bulkUpdatePotencijali}
                  onBulkDelete={bulkDeletePotencijali}
                  onViewCompany={setViewingCompany}
                  presetStatus={chartFilter && chartFilter.tab === "potencijali" ? chartFilter.value : null}
                  onPresetConsumed={() => setChartFilter(null)}
                />
              )}
              {tab === "lidovi" && (
                <LidoviTab
                  data={lidovi}
                  potencijali={potencijali}
                  currentUser={currentUser}
                  onAdd={addLead}
                  onUpdate={updateLead}
                  onDelete={deleteLead}
                  onBulkImport={bulkImportLidovi}
                  onConvert={convertLead}
                  onBulkUpdate={bulkUpdateLidovi}
                  onBulkDelete={bulkDeleteLidovi}
                  onViewCompany={setViewingCompany}
                />
              )}
              {tab === "kalkulator" && (
                <KalkulatorTab
                  cjenovnik={cjenovnik}
                  kalkulacije={kalkulacije}
                  potencijali={potencijali}
                  currentUser={currentUser}
                  nacrt={kalkNacrt}
                  setNacrt={setKalkNacrt}
                  onSave={saveKalkulacija}
                  onDelete={deleteKalkulacija}
                  onViewCompany={setViewingCompany}
                />
              )}
              {tab === "cjenovnik" && (
                <CjenovnikTab
                  data={cjenovnik}
                  currentUser={currentUser}
                  onAdd={addProizvod}
                  onUpdate={updateProizvod}
                  onDelete={deleteProizvod}
                  onBulkImport={bulkImportCjenovnik}
                />
              )}
              {tab === "kupci" && (
                <KupciTab
                  data={kupci}
                  potencijali={potencijali}
                  nadogradnjeInfo={nadSazetak}
                  currentUser={currentUser}
                  onAdd={addKupac}
                  onUpdate={updateKupac}
                  onDelete={deleteKupac}
                  onBulkImportKupci={bulkImportKupci}
                  onDeleteAll={deleteAllKupci}
                  canDelete={!isTehnicar}
                  onViewCompany={setViewingCompany}
                  presetLicenca={chartFilter && chartFilter.tab === "kupci" ? chartFilter.value : null}
                  onPresetConsumed={() => setChartFilter(null)}
                />
              )}
              {tab === "podrska" && (
                <PodrskaTab
                  data={podrska}
                  kupci={kupci}
                  currentUser={currentUser}
                  onAdd={addPodrska}
                  onUpdate={updatePodrska}
                  onDelete={deletePodrska}
                  onViewCompany={setViewingCompany}
                />
              )}
              {tab === "nadogradnje" && (
                <NadogradnjeTab
                  kupci={kupci}
                  kampanje={nadKampanje}
                  licRows={nadLicence}
                  firmRows={nadFirme}
                  potencijali={potencijali}
                  podrska={podrska}
                  currentUser={currentUser}
                  onSaveLicence={saveNadLicence}
                  onSaveFirma={saveNadFirma}
                  onNovaKampanja={novaNadKampanja}
                  onAddPodrska={addPodrska}
                  onViewCompany={setViewingCompany}
                  showToast={showToast}
                />
              )}
              {tab === "forecast" && (
                <ForecastTab
                  data={forecast}
                  potencijali={potencijali}
                  kupci={kupci}
                  currentUser={currentUser}
                  onAdd={addForecast}
                  onUpdate={updateForecast}
                  onDelete={deleteForecast}
                  onBulkAdd={bulkAddForecast}
                  onBulkImport={bulkAddForecast}
                  onBulkDelete={bulkDeleteForecast}
                  theme={theme}
                  onViewCompany={setViewingCompany}
                />
              )}
              {tab === "podsjetnici" && (
                <PodsjetniciTab
                  potencijali={potencijali}
                  lidovi={lidovi}
                  currentUser={currentUser}
                  onClear={clearReminder}
                  onPatch={patchReminderRecord}
                  onViewCompany={setViewingCompany}
                />
              )}
            </div>
          )}
        </main>
      </div>

      {viewingCompany && (
        <CompanyProfileModal
          name={viewingCompany}
          potencijali={potencijali}
          kupci={kupci}
          podrska={podrska}
          forecast={forecast}
          nadogradnjeInfo={nadSazetak}
          onClose={() => setViewingCompany(null)}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
