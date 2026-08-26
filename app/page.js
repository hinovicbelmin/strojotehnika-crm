"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Home, Target, TrendingUp, Building2, Wrench, Bell, AlertTriangle, LogOut,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import {
  COLLEAGUE_NAMES, fetchAllData, insertRow, updateRow, deleteRow, deleteAllRows, bulkInsert, todayStr,
} from "../lib/crm";
import { idbGet, idbSet, idbRemove } from "../lib/idbCache";
import {
  PregledTab, PotencijaliTab, LidoviTab, KupciTab, PodrskaTab, PodsjetniciTab,
} from "../components/tabs";

const TABS = [
  { id: "pregled", label: "Pregled", icon: Home },
  { id: "potencijali", label: "Baza potencijala", icon: Target },
  { id: "lidovi", label: "Lidovi", icon: TrendingUp },
  { id: "kupci", label: "Kupci i licence", icon: Building2 },
  { id: "podrska", label: "Tehnička podrška", icon: Wrench },
  { id: "podsjetnici", label: "Podsjetnici", icon: Bell },
];

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

  const [potencijali, setPotencijali] = useState([]);
  const [lidovi, setLidovi] = useState([]);
  const [kupci, setKupci] = useState([]);
  const [podrska, setPodrska] = useState([]);

  // Auth guard
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push("/login");
      } else {
        setSession(data.session);
        setCurrentUser(localStorage.getItem("crm_trenutni_korisnik") || "");
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
      setLoadingData(false);
      setDataReady(true);
    })();
  }, [session]);

  // Automatski ažuriraj lokalni keš pri svakoj promjeni podataka (dodavanje/izmjena/brisanje/uvoz)
  useEffect(() => {
    if (!dataReady) return;
    idbSet(CACHE_KEY, { potencijali, lidovi, kupci, podrska });
  }, [dataReady, potencijali, lidovi, kupci, podrska]);

  const chooseUser = (name) => {
    setCurrentUser(name);
    localStorage.setItem("crm_trenutni_korisnik", name);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    await idbRemove(CACHE_KEY);
    router.push("/login");
  };

  /* ---------------- Potencijali handlers ---------------- */
  const addPotencijal = async (payload) => {
    const rec = await insertRow("potencijali", payload);
    setPotencijali((prev) => [rec, ...prev]);
  };
  const updatePotencijal = async (id, patch) => {
    const rec = await updateRow("potencijali", id, patch);
    setPotencijali((prev) => prev.map((p) => (p.id === id ? rec : p)));
  };
  const deletePotencijal = async (id) => {
    await deleteRow("potencijali", id);
    setPotencijali((prev) => prev.filter((p) => p.id !== id));
  };
  const bulkImportPotencijali = async (rows) => {
    const inserted = await bulkInsert("potencijali", rows);
    setPotencijali((prev) => [...inserted, ...prev]);
  };

  /* ---------------- Lidovi handlers ---------------- */
  const addLead = async (payload) => {
    const rec = await insertRow("lidovi", payload);
    setLidovi((prev) => [rec, ...prev]);
  };
  const updateLead = async (id, patch) => {
    const rec = await updateRow("lidovi", id, patch);
    setLidovi((prev) => prev.map((l) => (l.id === id ? rec : l)));
  };
  const deleteLead = async (id) => {
    await deleteRow("lidovi", id);
    setLidovi((prev) => prev.filter((l) => l.id !== id));
  };
  const bulkImportLidovi = async (rows) => {
    const inserted = await bulkInsert("lidovi", rows);
    setLidovi((prev) => [...inserted, ...prev]);
  };
  const convertLead = async (lead) => {
    const novi = {
      naziv_firme: lead.naziv_firme, grad: lead.grad, drzava: lead.drzava,
      kontakt_osoba: lead.kontakt_osoba, telefon: lead.telefon, email: lead.email,
      kolega: lead.kolega, status: "Novi kontakt",
      napomena: (lead.napomena ? lead.napomena + " " : "") + `(konvertovano iz leada, izvor: ${lead.izvor || "n/a"})`,
      podsjetnik_datum: null, podsjetnik_opis: "",
      created_by: currentUser || lead.kolega, created_at: new Date().toISOString(),
      updated_by: currentUser || lead.kolega, updated_at: new Date().toISOString(),
    };
    const recPot = await insertRow("potencijali", novi);
    setPotencijali((prev) => [recPot, ...prev]);
    const recLead = await updateRow("lidovi", lead.id, {
      status: "Konvertovan", updated_by: currentUser || lead.kolega, updated_at: new Date().toISOString(),
    });
    setLidovi((prev) => prev.map((l) => (l.id === lead.id ? recLead : l)));
  };

  /* ---------------- Kupci handlers ---------------- */
  const addKupac = async (payload) => {
    const rec = await insertRow("kupci", payload);
    setKupci((prev) => [rec, ...prev]);
  };
  const updateKupac = async (id, patch) => {
    const rec = await updateRow("kupci", id, patch);
    setKupci((prev) => prev.map((k) => (k.id === id ? rec : k)));
  };
  const deleteKupac = async (id) => {
    await deleteRow("kupci", id);
    setKupci((prev) => prev.filter((k) => k.id !== id));
  };
  const deleteAllKupci = async () => {
    await deleteAllRows("kupci");
    setKupci([]);
  };
  // Svaki red iz fajla je UVIJEK poseban zapis (bez spajanja/upsert-a po serijskom broju).
  // Napomena: ako se isti fajl uveze ponovo (npr. mjesečno), stariji zapisi ostaju —
  // za čist mjesečni presjek, prije uvoza obrišite stare zapise (Supabase → SQL Editor → DELETE FROM kupci;)
  const bulkImportKupci = async (rows) => {
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
  };

  /* ---------------- Podrška handlers ---------------- */
  const addPodrska = async (payload) => {
    const rec = await insertRow("podrska", payload);
    setPodrska((prev) => [rec, ...prev]);
  };
  const updatePodrska = async (id, patch) => {
    const rec = await updateRow("podrska", id, patch);
    setPodrska((prev) => prev.map((s) => (s.id === id ? rec : s)));
  };
  const deletePodrska = async (id) => {
    await deleteRow("podrska", id);
    setPodrska((prev) => prev.filter((s) => s.id !== id));
  };

  /* ---------------- Podsjetnici handler ---------------- */
  const clearReminder = async (item) => {
    const table = item.tip === "Potencijal" ? "potencijali" : "lidovi";
    const rec = await updateRow(table, item.id, {
      podsjetnik_datum: null, podsjetnik_opis: "",
      updated_by: currentUser || item.kolega, updated_at: new Date().toISOString(),
    });
    if (table === "potencijali") setPotencijali((prev) => prev.map((p) => (p.id === item.id ? rec : p)));
    else setLidovi((prev) => prev.map((l) => (l.id === item.id ? rec : l)));
  };

  if (checkingAuth || !session) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Provjera prijave...</p>
        </div>
      </div>
    );
  }

  if (loadingData) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Učitavanje CRM podataka...</p>
        </div>
      </div>
    );
  }

  const ActiveIcon = TABS.find((t) => t.id === tab)?.icon || Home;

  return (
    <div className="w-full min-h-screen bg-slate-50 flex text-slate-800">
      {/* Sidebar */}
      <aside className={"bg-slate-900 text-slate-300 w-60 shrink-0 flex-col " + (navOpen ? "flex fixed inset-y-0 left-0 z-40" : "hidden md:flex")}>
        <div className="px-5 py-5 border-b border-slate-800">
          <p className="text-white font-bold text-lg tracking-tight">CRM</p>
          <p className="text-xs text-slate-400 mt-0.5">Prodaja · Podrška · Marketing</p>
        </div>
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setNavOpen(false); }}
                className={
                  "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors " +
                  (active ? "bg-slate-800 text-white border-l-2 border-teal-400 pl-2.5" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200")
                }
              >
                <Icon size={16} />
                {t.label}
              </button>
            );
          })}
        </nav>
        <div className="px-2 pb-3">
          <button onClick={signOut} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 transition-colors">
            <LogOut size={16} /> Odjava
          </button>
        </div>
        <div className="px-4 py-4 border-t border-slate-800 text-xs text-slate-500">11 kolega · Zenica &amp; Zagreb</div>
      </aside>

      {navOpen && <div className="fixed inset-0 bg-slate-900/40 z-30 md:hidden" onClick={() => setNavOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button className="md:hidden p-1.5 rounded-md hover:bg-slate-100" onClick={() => setNavOpen(true)}>
              <ActiveIcon size={18} />
            </button>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight truncate">{TABS.find((t) => t.id === tab)?.label}</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-400 hidden sm:inline">Ja sam:</span>
            <select
              className="text-sm rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={currentUser}
              onChange={(e) => chooseUser(e.target.value)}
            >
              <option value="">— odaberi se —</option>
              {COLLEAGUE_NAMES.map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
        </header>

        {!currentUser && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 text-xs text-amber-800 flex items-center gap-1.5">
            <AlertTriangle size={13} /> Odaberi svoje ime gore desno da bi se ispravno bilježilo ko unosi/ažurira podatke.
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {tab === "pregled" && (
            <PregledTab potencijali={potencijali} lidovi={lidovi} kupci={kupci} podrska={podrska} setTab={setTab} />
          )}
          {tab === "potencijali" && (
            <PotencijaliTab
              data={potencijali}
              currentUser={currentUser}
              onAdd={addPotencijal}
              onUpdate={updatePotencijal}
              onDelete={deletePotencijal}
              onBulkImport={bulkImportPotencijali}
            />
          )}
          {tab === "lidovi" && (
            <LidoviTab
              data={lidovi}
              currentUser={currentUser}
              onAdd={addLead}
              onUpdate={updateLead}
              onDelete={deleteLead}
              onBulkImport={bulkImportLidovi}
              onConvert={convertLead}
            />
          )}
          {tab === "kupci" && (
            <KupciTab
              data={kupci}
              currentUser={currentUser}
              onAdd={addKupac}
              onUpdate={updateKupac}
              onDelete={deleteKupac}
              onBulkImportKupci={bulkImportKupci}
              onDeleteAll={deleteAllKupci}
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
            />
          )}
          {tab === "podsjetnici" && (
            <PodsjetniciTab potencijali={potencijali} lidovi={lidovi} onClear={clearReminder} />
          )}
        </main>
      </div>
    </div>
  );
}
