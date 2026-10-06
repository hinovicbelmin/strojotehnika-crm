"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Home, Target, TrendingUp, Building2, Wrench, Bell, AlertTriangle, LogOut, LineChart, Lock, Sun, Moon, Minimize2, Maximize2,
  Calculator, Tags, ArrowUpCircle, Megaphone,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import {
  COLLEAGUE_NAMES, fetchAllData, insertRow, updateRow, deleteRow, deleteAllRows, bulkInsert, upsertRows, bulkUpdateRows, bulkDeleteRows, todayStr, getColleagueDept, RENAMED_COLLEAGUES,
  getReminders, daysDiff, currentMonthStr, isForecastWon, isForecastLost, companyKey,
} from "../lib/crm";
import { idbGet, idbSet, idbRemove } from "../lib/idbCache";
import {
  PregledTab, LidoviTab, KupciTab, PodrskaTab, PodsjetniciTab,
} from "../components/tabs";
import { PotencijaliTab } from "../components/potencijali";
import { ForecastTab } from "../components/forecast";
import { KalkulatorTab, CjenovnikTab, praznaKalkulacija } from "../components/kalkulator";
import { AkcijeTab } from "../components/akcije";
import { NadogradnjeTab, izgradiNadogradnje, nadogradnjeBadge, nadogradnjeSazetak, aktuelnaKampanja } from "../components/nadogradnje";
import { CompanyProfileModal } from "../components/companyProfile";
import { GlobalSearch } from "../components/globalSearch";
import { Sidebar, ImeNalogaModal } from "../components/sidebar";
import { AppSkeleton } from "../components/skeleton";
import { ToastStack } from "../components/toast";

const TABS = [
  { id: "pregled", label: "Pregled", icon: Home },
  { id: "forecast", label: "Forecast", icon: LineChart },
  { id: "potencijali", label: "Baza potencijala", icon: Target },
  { id: "lidovi", label: "Lidovi", icon: TrendingUp },
  { id: "kalkulator", label: "Kalkulator zarade", icon: Calculator },
  { id: "cjenovnik", label: "Cjenovnik", icon: Tags },
  { id: "akcije", label: "Akcije", icon: Megaphone },
  { id: "kupci", label: "Kupci i licence", icon: Building2 },
  { id: "podrska", label: "Tehnička podrška", icon: Wrench },
  { id: "nadogradnje", label: "Nadogradnje", icon: ArrowUpCircle },
  { id: "podsjetnici", label: "Podsjetnici", icon: Bell },
];

// Tabovi kojima tehničari nemaju pristup (vidljivi, ali "zaleđeni")
const TECH_RESTRICTED_TABS = ["forecast", "potencijali", "lidovi", "kalkulator", "cjenovnik", "akcije"];

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
  const [accountEmail, setAccountEmail] = useState("");
  const [needsName, setNeedsName] = useState(false); // nalog još nije povezan s imenom kolege
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
  const [akcije, setAkcije] = useState([]);
  const [akcijeFirme, setAkcijeFirme] = useState([]);

  // Ime kolege je vezano za prijavljeni nalog (Supabase user_metadata.ime), ne za računar/browser
  const primijeniKorisnika = (user) => {
    if (!user) return;
    try { localStorage.removeItem("crm_trenutni_korisnik"); } catch (e) { /* stari način pamćenja imena */ }
    setAccountEmail(user.email || "");
    let ime = (user.user_metadata && user.user_metadata.ime) || "";
    if (RENAMED_COLLEAGUES[ime]) ime = RENAMED_COLLEAGUES[ime];
    if (ime && COLLEAGUE_NAMES.includes(ime)) {
      setCurrentUser(ime);
      setNeedsName(false);
    } else {
      setCurrentUser("");
      setNeedsName(true);
    }
  };

  // Auth guard
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push("/login");
      } else {
        setSession(data.session);
        primijeniKorisnika(data.session.user);
        // osvježi podatke naloga sa servera (npr. ako je administrator ispravio ime)
        supabase.auth.getUser().then(({ data: u }) => { if (u && u.user) primijeniKorisnika(u.user); });
      }
      setCheckingAuth(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (!sess) {
        setCurrentUser("");
        setAccountEmail("");
        router.push("/login");
      } else {
        primijeniKorisnika(sess.user);
      }
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
        setAkcije(cached.akcije || []);
        setAkcijeFirme(cached.akcijeFirme || []);
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
      setAkcije(all.akcije || []);
      setAkcijeFirme(all.akcijeFirme || []);
      setLoadingData(false);
      setDataReady(true);
    })();
  }, [session]);

  // Automatski ažuriraj lokalni keš pri svakoj promjeni podataka (dodavanje/izmjena/brisanje/uvoz)
  useEffect(() => {
    if (!dataReady) return;
    idbSet(CACHE_KEY, { potencijali, lidovi, kupci, podrska, forecast, cjenovnik, kalkulacije, nadKampanje, nadLicence, nadFirme, akcije, akcijeFirme });
  }, [dataReady, potencijali, lidovi, kupci, podrska, forecast, cjenovnik, kalkulacije, nadKampanje, nadLicence, nadFirme, akcije, akcijeFirme]);

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

  // Jednokratno povezivanje naloga s imenom (sprema se uz nalog u Supabase, vrijedi na svakom računaru)
  const poveziIme = async (name) => {
    const { error } = await supabase.auth.updateUser({ data: { ime: name } });
    if (error) throw error;
    setCurrentUser(name);
    setNeedsName(false);
  };

  const isTehnicar = getColleagueDept(currentUser) === "Tehnička podrška";

  const signOut = async () => {
    setCurrentUser("");
    try { localStorage.removeItem("crm_trenutni_korisnik"); } catch (e) { /* */ }
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
      return rec;
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
    if (item.tip === "Akcija") {
      await updateAkcijaFirma(item.id, { podsjetnik_datum: null, podsjetnik_opis: null }, "Podsjetnik označen kao obavljen");
      return;
    }
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

  /* ---------------- Akcije ---------------- */
  const akcijaRedovi = (a, firme) => {
    const ts = new Date().toISOString();
    return firme.map((k) => ({
      akcija_id: a.id, firma: k.firma, firma_key: k.key || companyKey(k.firma), drzava: k.drzava || null,
      prodavac: k.prodavac || null, status: "Nije kontaktirana", licence: k.licence || null,
      broj_licenci: k.broj_licenci != null ? k.broj_licenci : null, odrzavanje_do: k.odrzavanje_do || null, historija: [],
      created_by: currentUser || "—", created_at: ts, updated_by: currentUser || "—", updated_at: ts,
    })).filter((r) => r.firma_key);
  };
  const saveAkcija = async (id, payload, firme) => {
    const ts = new Date().toISOString();
    try {
      if (id) {
        const rec = await updateRow("akcije", id, { ...payload, updated_by: currentUser || "—", updated_at: ts });
        setAkcije((prev) => prev.map((a) => (a.id === id ? rec : a)));
        showToast("zavrsena" in payload ? (payload.zavrsena ? "Akcija završena" : "Akcija vraćena u aktivne") : "Akcija sačuvana");
        return rec;
      }
      const rec = await insertRow("akcije", { ...payload, created_by: currentUser || "—", created_at: ts, updated_by: currentUser || "—", updated_at: ts });
      setAkcije((prev) => [rec, ...prev]);
      let n = 0;
      if (firme && firme.length) {
        try {
          const ins = await upsertRows("akcije_firme", akcijaRedovi(rec, firme), "akcija_id,firma_key", { ignoreDuplicates: true });
          setAkcijeFirme((prev) => [...ins, ...prev]);
          n = ins.length;
        } catch (e) {
          showToast("Akcija je napravljena, ali firme nisu upisane — pokušaj „Dodaj firme“", "error");
          return rec;
        }
      }
      showToast(`Akcija napravljena · ${n} firmi`);
      return rec;
    } catch (e) {
      console.error(e);
      showToast("Greška pri čuvanju akcije", "error");
      return null;
    }
  };
  const deleteAkcija = (id) => {
    const item = akcije.find((a) => a.id === id);
    if (!item) return;
    const firme = akcijeFirme.filter((r) => r.akcija_id === id);
    setAkcije((prev) => prev.filter((a) => a.id !== id));
    setAkcijeFirme((prev) => prev.filter((r) => r.akcija_id !== id));
    scheduleUndoDelete(
      item.naziv || "akcija",
      () => { setAkcije((prev) => [item, ...prev]); setAkcijeFirme((prev) => [...firme, ...prev]); },
      () => deleteRow("akcije", id)
    );
  };
  const addAkcijeFirme = async (a, firme) => {
    try {
      const ins = await upsertRows("akcije_firme", akcijaRedovi(a, firme), "akcija_id,firma_key", { ignoreDuplicates: true });
      setAkcijeFirme((prev) => [...ins, ...prev]);
      showToast(`Dodano ${ins.length} firmi u akciju`);
    } catch (e) {
      console.error(e);
      showToast("Greška pri dodavanju firmi u akciju", "error");
      throw e;
    }
  };
  // izmjena firme u akciji; zapis = { datum, kolega, opis } ide u historiju akcije i (ako firma postoji) u Bazu potencijala
  const updateAkcijaFirma = async (id, patch, poruka, { zapis } = {}) => {
    const row = akcijeFirme.find((r) => r.id === id);
    if (!row) return null;
    const ts = new Date().toISOString();
    const p = { ...patch, updated_by: currentUser || "—", updated_at: ts };
    const novaH = [];
    if (zapis && zapis.opis) novaH.push({ datum: zapis.datum || todayStr(), kolega: zapis.kolega || currentUser || "", opis: zapis.opis });
    if (patch.status && patch.status !== row.status) novaH.push({ datum: todayStr(), kolega: currentUser || "", status: patch.status });
    if (novaH.length) {
      const h = [...novaH, ...(row.historija || [])];
      p.historija = h;
      p.zadnji_kontakt = h.filter((x) => x.opis).reduce((m, x) => (x.datum && (!m || x.datum > m) ? x.datum : m), null);
    }
    if (zapis && zapis.opis && (patch.status === undefined) && row.status === "Nije kontaktirana") {
      p.status = "Kontaktirana";
      p.historija = [{ datum: todayStr(), kolega: currentUser || "", status: "Kontaktirana" }, ...(p.historija || [])];
    }
    try {
      const rec = await updateRow("akcije_firme", id, p);
      setAkcijeFirme((prev) => prev.map((r) => (r.id === id ? rec : r)));
      if (zapis && zapis.opis) {
        const akc = akcije.find((a) => a.id === row.akcija_id);
        const pots = potencijali.filter((x) => companyKey(x.naziv_firme) === row.firma_key);
        const pot = pots.find((x) => x.kolega && x.kolega !== "Nedodijeljeno") || pots[0];
        if (pot) {
          try {
            const hz = { datum: zapis.datum || todayStr(), kolega: zapis.kolega || currentUser || "", kontakt: "", opis: zapis.opis, akcija: akc ? akc.naziv : "Akcija", akcija_id: row.akcija_id };
            const nova = [hz, ...(pot.historija || [])];
            const zk = nova.reduce((m, x) => (x.datum && (!m || x.datum > m) ? x.datum : m), null);
            const recP = await updateRow("potencijali", pot.id, { historija: nova, zadnji_kontakt: zk, updated_by: currentUser || "—", updated_at: ts });
            setPotencijali((prev) => prev.map((x) => (x.id === pot.id ? recP : x)));
          } catch (e) {
            console.error(e);
            showToast("Zapis je u akciji, ali nije upisan u Bazu potencijala", "error");
            return rec;
          }
        }
      }
      showToast(poruka || "Sačuvano");
      return rec;
    } catch (e) {
      console.error(e);
      showToast("Greška pri čuvanju firme u akciji", "error");
      throw e;
    }
  };
  const removeAkcijaFirma = (r) => {
    const item = akcijeFirme.find((x) => x.id === r.id);
    if (!item) return;
    setAkcijeFirme((prev) => prev.filter((x) => x.id !== r.id));
    scheduleUndoDelete(
      `${item.firma} (iz akcije)`,
      () => setAkcijeFirme((prev) => [item, ...prev]),
      () => deleteRow("akcije_firme", r.id)
    );
  };
  const akcijaUForecast = async (r, payload, vrijednost) => {
    const ts = new Date().toISOString();
    const rec = await addForecast({ ...payload, created_by: currentUser || "—", created_at: ts, updated_by: currentUser || "—", updated_at: ts });
    const patch = { forecast_id: rec.id };
    if (vrijednost != null) patch.vrijednost = vrijednost;
    if (r.status === "Nije kontaktirana" || r.status === "Kontaktirana") patch.status = "Zainteresovana";
    await updateAkcijaFirma(r.id, patch, "Prebačeno u forecast");
  };
  const otvoriKalkulator = (r, a) => {
    if (kalkNacrt && kalkNacrt._izmjena && !window.confirm("Otvorena kalkulacija ima nespremljene izmjene. Otvoriti novu za ovu firmu?")) return;
    const pot = potencijali.find((x) => companyKey(x.naziv_firme) === r.firma_key);
    setKalkNacrt({ ...praznaKalkulacija(currentUser), firma: pot ? pot.naziv_firme : r.firma, naziv: `${a.naziv} — ${r.firma}`, napomena: a.ponuda || "" });
    setTab("kalkulator");
  };

  // izmjena podsjetnika (odgoda, obavljeno + zapis u historiju, novi podsjetnik)
  const patchReminderRecord = async (tip, id, patch, poruka) => {
    if (tip === "Akcija") {
      const { _zapis, ...ostalo } = patch;
      await updateAkcijaFirma(id, ostalo, poruka || "Podsjetnik sačuvan", _zapis ? { zapis: _zapis } : {});
      return;
    }
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
      count: getReminders(potencijali, lidovi).filter((r) => r.datum && daysDiff(r.datum) <= 0).length
        + akcijeFirme.filter((r) => r.podsjetnik_datum && daysDiff(String(r.podsjetnik_datum).slice(0, 10)) <= 0).length,
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
    akcije: {
      count: (() => {
        const aktivne = new Set(akcije.filter((a) => !a.zavrsena && (!a.kraj || daysDiff(String(a.kraj).slice(0, 10)) >= 0)).map((a) => a.id));
        return akcijeFirme.filter((r) => aktivne.has(r.akcija_id) && r.prodavac === currentUser && (r.status || "Nije kontaktirana") === "Nije kontaktirana").length;
      })(),
      tone: "muted", hint: "tvojih firmi čeka kontakt u aktivnim akcijama",
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
        accountEmail={accountEmail}
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
            {currentUser && (
              <span className="md:hidden inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300" title={accountEmail}>
                <Lock size={13} className="text-slate-400" /> <span className="max-w-[120px] truncate">{currentUser}</span>
              </span>
            )}
          </div>
        </header>

        {needsName && (
          <ImeNalogaModal accountEmail={accountEmail} onConfirm={poveziIme} onSignOut={signOut} />
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
              {tab === "akcije" && (
                <AkcijeTab
                  akcije={akcije}
                  akcijeFirme={akcijeFirme}
                  kupci={kupci}
                  potencijali={potencijali}
                  forecast={forecast}
                  kalkulacije={kalkulacije}
                  currentUser={currentUser}
                  onSaveAkcija={saveAkcija}
                  onDeleteAkcija={deleteAkcija}
                  onAddFirme={addAkcijeFirme}
                  onUpdateFirma={(r, patch, poruka) => updateAkcijaFirma(r.id, patch, poruka || (patch.status ? `Status: ${patch.status}` : "Sačuvano")).catch(() => null)}
                  onZapis={(r, zapis) => updateAkcijaFirma(r.id, {}, "Zapis dodan", { zapis })}
                  onForecast={akcijaUForecast}
                  onRemoveFirma={removeAkcijaFirma}
                  onKalkulator={otvoriKalkulator}
                  onViewCompany={setViewingCompany}
                  showToast={showToast}
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
                  akcije={akcije}
                  akcijeFirme={akcijeFirme}
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
