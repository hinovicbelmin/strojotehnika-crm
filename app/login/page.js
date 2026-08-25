"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, AlertCircle } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { inputCls } from "../../lib/crm";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setError("Pogrešan email ili lozinka. Ako nemate nalog, javite se administratoru CRM-a.");
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 px-4 py-10 overflow-y-auto">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Firma CRM</h1>
          <p className="text-sm text-slate-500 mt-1">Prijavite se svojim nalogom</p>
        </div>
        <form onSubmit={submit}>
          <label className="block mb-4">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Email</span>
            <input
              type="email"
              required
              autoComplete="username"
              className={inputCls}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ime.prezime@firma.com"
            />
          </label>
          <label className="block mb-5">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Lozinka</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>
          {error && (
            <div className="flex items-start gap-2 bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2 mb-4">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="relative z-10 mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 active:bg-teal-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogIn size={16} /> {busy ? "Prijavljivanje..." : "Prijavi se"}
          </button>
        </form>
        <p className="text-xs text-slate-400 text-center mt-6">
          Nalozi se dodaju u Supabase → Authentication → Users. Nakon dodavanja, kolega dobije email da postavi lozinku.
        </p>
      </div>
    </div>
  );
}
