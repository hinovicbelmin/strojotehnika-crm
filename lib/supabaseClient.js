import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Nedostaju NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY environment varijable. " +
      "Postavite ih u .env.local (lokalno) i u Vercel → Settings → Environment Variables (produkcija)."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
