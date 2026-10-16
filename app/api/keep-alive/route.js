// Keep-alive: Vercel ga poziva jednom dnevno (vidi vercel.json → "crons"),
// tako da Supabase vidi aktivnost i ne pauzira bazu na besplatnom planu.
// Ne čita i ne mijenja nikakve podatke — samo pošalje jedan mali upit.
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return Response.json({ ok: false, greska: "Nedostaju Supabase environment varijable" }, { status: 500 });
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await supabase.from("potencijali").select("id", { count: "exact", head: true });
  if (error) {
    return Response.json({ ok: false, greska: error.message }, { status: 500 });
  }
  return Response.json({ ok: true, vrijeme: new Date().toISOString() });
}
