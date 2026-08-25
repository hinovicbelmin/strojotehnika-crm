# Firma CRM

Interni CRM za praćenje potencijala, lidova, kupaca/licenci i tehničke podrške.
Next.js + Supabase (baza podataka, autentifikacija) + Vercel (hosting).

## 1. Supabase (baza podataka + login)

1. Idite na https://supabase.com → kreirajte besplatan nalog → **New project**.
2. Sačekajte da se projekat pokrene (1-2 minute).
3. Otvorite **SQL Editor** → **New query**, zalijepite sadržaj fajla `supabase-schema.sql` iz ovog projekta, i kliknite **Run**. Ovo pravi 4 tabele: `potencijali`, `lidovi`, `kupci`, `podrska`.
4. Idite na **Authentication → Users → Add user** i dodajte email za svakog od 11 kolega. Supabase može poslati pozivnicu da sami postave lozinku (opcija "Send invite email" ili slično, zavisno od verzije dashboarda).
5. Idite na **Settings → API** i zapamtite:
   - **Project URL**
   - **anon public** ključ

## 2. Lokalno pokretanje (opciono, za testiranje)

```bash
npm install
cp .env.local.example .env.local
# u .env.local upišite Project URL i anon key iz koraka 1
npm run dev
```

Otvorite http://localhost:3000 — trebalo bi da vas prebaci na `/login`.

## 3. Deploy na Vercel

1. Napravite besplatan nalog na https://vercel.com (najlakše preko GitHub naloga).
2. Otpremite ovaj folder na GitHub kao novi repozitorij (npr. `firma-crm`).
   ```bash
   git init
   git add .
   git commit -m "Prvi CRM"
   git branch -M main
   git remote add origin https://github.com/VAS-NALOG/firma-crm.git
   git push -u origin main
   ```
3. U Vercel: **Add New → Project**, izaberite taj repozitorij. Vercel automatski prepozna Next.js.
4. Prije deploya, pod **Environment Variables** dodajte:
   - `NEXT_PUBLIC_SUPABASE_URL` = vaš Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = vaš anon key
5. Kliknite **Deploy**. Za par minuta dobijate link tipa `firma-crm.vercel.app`.
6. Taj link pošaljite svih 11 kolega — svako se loguje svojim emailom i lozinkom.

## 4. Nakon deploya

- Svaki kolega se prijavi, pa u gornjem desnom uglu izabere svoje ime ("Ja sam: ...") — to ime se automatski bilježi kao kreator/zadnja izmjena na svakom zapisu.
- Podaci su zajednički — svi vide iste potencijale, lidove, kupce i podršku, u realnom vremenu (osvježi stranicu da vidiš tuđe izmjene).
- Uvoz postojeće Excel baze: u svakoj sekciji dugme "Uvezi" prima redove zalijepljene direktno iz Excela.
- Kupci: mjesečno ažuriranje radi tako što uvoz prepoznaje postojeći zapis po serijskom broju + proizvodu i ažurira ga (umjesto da pravi duplikat).

## 5. Kasnije nadogradnje (opciono)

- Vlastita domena umjesto `.vercel.app` (Vercel → Settings → Domains).
- Email podsjetnici (Supabase Edge Functions + cron).
- Detaljnija kontrola pristupa (npr. da tehničari ne mogu brisati potencijale) — trenutno svih 11 ima pun pristup svemu, što odgovara internom timu ove veličine.
