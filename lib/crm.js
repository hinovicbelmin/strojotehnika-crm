import { supabase } from "./supabaseClient";

/* ------------------------------------------------------------------ */
/*  KONSTANTE                                                          */
/* ------------------------------------------------------------------ */

export const COLLEAGUES = [
  { name: "Marijan Marković", dept: "Prodaja" },
  { name: "Nikola Grden", dept: "Prodaja" },
  { name: "Vedran Kovačić", dept: "Prodaja" },
  { name: "Marija Puškarić", dept: "Prodaja" },
  { name: "Belmin Hinović", dept: "Prodaja" },
  { name: "Kristian Gazdek", dept: "Tehnička podrška" },
  { name: "Marin Šepac", dept: "Tehnička podrška" },
  { name: "Dino Pečenjev", dept: "Tehnička podrška" },
  { name: "Davor Volarić", dept: "Tehnička podrška" },
  { name: "Ahmed Mujkanović", dept: "Tehnička podrška" },
  { name: "Miroslav Jakovljević", dept: "Marketing" },
];
export const COLLEAGUE_NAMES = COLLEAGUES.map((c) => c.name);
export const TECH_NAMES = COLLEAGUES.filter((c) => c.dept === "Tehnička podrška").map((c) => c.name);
export const SORTED_FOR_TECH = [...TECH_NAMES, ...COLLEAGUE_NAMES.filter((n) => !TECH_NAMES.includes(n))];

export const POTENCIJAL_STATUSI = ["Novi kontakt", "U pregovorima", "Ponuda poslana", "Na čekanju", "Dobijen", "Izgubljen"];
export const LEAD_STATUSI = ["Novi", "Kontaktiran", "Kvalifikovan", "Konvertovan", "Odbačen"];

export const STATUS_BOJE = {
  "Novi kontakt": "bg-slate-100 text-slate-700",
  "U pregovorima": "bg-blue-100 text-blue-700",
  "Ponuda poslana": "bg-violet-100 text-violet-700",
  "Na čekanju": "bg-amber-100 text-amber-700",
  Dobijen: "bg-green-100 text-green-700",
  Izgubljen: "bg-red-100 text-red-700",
  Novi: "bg-slate-100 text-slate-700",
  Kontaktiran: "bg-blue-100 text-blue-700",
  Kvalifikovan: "bg-violet-100 text-violet-700",
  Konvertovan: "bg-green-100 text-green-700",
  Odbačen: "bg-red-100 text-red-700",
};

export const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white";
export const btnPrimary =
  "inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
export const btnSecondary =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors";
export const btnGhostIcon =
  "inline-flex items-center justify-center rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors";

/* ------------------------------------------------------------------ */
/*  DATUMI / STATUSI                                                   */
/* ------------------------------------------------------------------ */

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
export function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("bs-BA", { day: "2-digit", month: "2-digit", year: "numeric" });
}
export function daysDiff(dateStr) {
  const end = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((end - today) / (1000 * 60 * 60 * 24));
}
export function licenseStatus(endDate) {
  if (!endDate) return { label: "Nepoznato", cls: "bg-slate-100 text-slate-500", diff: null };
  const diff = daysDiff(endDate);
  if (diff < 0) return { label: "Isteklo", cls: "bg-red-100 text-red-700", diff };
  if (diff <= 30) return { label: "Ističe uskoro", cls: "bg-amber-100 text-amber-700", diff };
  return { label: "Aktivno", cls: "bg-green-100 text-green-700", diff };
}
export function reminderUrgency(dateStr) {
  const diff = daysDiff(dateStr);
  if (diff < 0) return { label: "Kasni", cls: "bg-red-100 text-red-700", dotCls: "bg-red-500" };
  if (diff === 0) return { label: "Danas", cls: "bg-amber-100 text-amber-700", dotCls: "bg-amber-500" };
  if (diff <= 3) return { label: "Uskoro", cls: "bg-blue-100 text-blue-700", dotCls: "bg-blue-500" };
  return { label: "Zakazano", cls: "bg-slate-100 text-slate-600", dotCls: "bg-slate-400" };
}
// Pretvara razne formate datuma iz Excel exporta (DD.MM.YYYY, MM/DD/YYYY, YYYY-MM-DD) u YYYY-MM-DD
export function parseDateFlexible(str) {
  if (!str) return null;
  const s = String(str).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})\.?$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = "20" + y;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    // Pretpostavka: MM/DD/YYYY (uobičajeno u exportima iz američkih SaaS alata)
    let [, mo, d, y] = m;
    if (y.length === 2) y = "20" + y;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

export function getReminders(potencijali, lidovi) {
  const items = [];
  potencijali.forEach((p) => {
    if (p.podsjetnik_datum)
      items.push({ id: p.id, tip: "Potencijal", firma: p.naziv_firme, kolega: p.kolega, datum: p.podsjetnik_datum, opis: p.podsjetnik_opis });
  });
  lidovi.forEach((l) => {
    if (l.podsjetnik_datum)
      items.push({ id: l.id, tip: "Lead", firma: l.naziv_firme, kolega: l.kolega, datum: l.podsjetnik_datum, opis: l.podsjetnik_opis });
  });
  items.sort((a, b) => new Date(a.datum) - new Date(b.datum));
  return items;
}

/* ------------------------------------------------------------------ */
/*  DATA API — čitanje / pisanje u Supabase                            */
/* ------------------------------------------------------------------ */

export async function fetchTable(table) {
  const PAGE_SIZE = 1000;
  let from = 0;
  let all = [];
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error(`Greška pri čitanju tabele ${table}:`, error);
      break;
    }
    all = all.concat(data || []);
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

export async function fetchAllData() {
  const [potencijali, lidovi, kupci, podrska] = await Promise.all([
    fetchTable("potencijali"),
    fetchTable("lidovi"),
    fetchTable("kupci"),
    fetchTable("podrska"),
  ]);
  return { potencijali, lidovi, kupci, podrska };
}

export async function insertRow(table, row) {
  const { data, error } = await supabase.from(table).insert([row]).select();
  if (error) {
    console.error(`Greška pri dodavanju u ${table}:`, error);
    throw error;
  }
  return data[0];
}

export async function bulkInsert(table, rows) {
  if (rows.length === 0) return [];
  const CHUNK = 500;
  const all = [];
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { data, error } = await supabase.from(table).insert(chunk).select();
    if (error) {
      console.error(`Greška pri uvozu u ${table}:`, error);
      throw error;
    }
    all.push(...data);
  }
  return all;
}

export async function updateRow(table, id, patch) {
  const { data, error } = await supabase.from(table).update(patch).eq("id", id).select();
  if (error) {
    console.error(`Greška pri izmjeni u ${table}:`, error);
    throw error;
  }
  return data[0];
}

export async function deleteRow(table, id) {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) {
    console.error(`Greška pri brisanju iz ${table}:`, error);
    throw error;
  }
}
