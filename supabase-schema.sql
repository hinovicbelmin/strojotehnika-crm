-- CRM baza podataka — pokrenuti u Supabase SQL Editoru (Project → SQL Editor → New query → Run)

create extension if not exists "pgcrypto";

-- 1) BAZA POTENCIJALA
create table if not exists potencijali (
  id uuid primary key default gen_random_uuid(),
  naziv_firme text not null,
  grad text,
  drzava text,
  kontakt_osoba text,
  telefon text,
  email text,
  kolega text,
  status text default 'Novi kontakt',
  napomena text,
  podsjetnik_datum date,
  podsjetnik_opis text,
  created_by text,
  created_at timestamptz default now(),
  updated_by text,
  updated_at timestamptz default now()
);

-- 2) GENERISANI LIDOVI
create table if not exists lidovi (
  id uuid primary key default gen_random_uuid(),
  naziv_firme text not null,
  grad text,
  drzava text,
  kontakt_osoba text,
  telefon text,
  email text,
  izvor text,
  kolega text,
  status text default 'Novi',
  napomena text,
  podsjetnik_datum date,
  podsjetnik_opis text,
  created_by text,
  created_at timestamptz default now(),
  updated_by text,
  updated_at timestamptz default now()
);

-- 3) KUPCI I LICENCE
create table if not exists kupci (
  id uuid primary key default gen_random_uuid(),
  naziv_firme text not null,
  grad text,
  drzava text,
  serijski_broj text,
  broj_licenci integer,
  naziv_proizvoda text,
  start_date date,
  end_date date,
  napomena text,
  created_by text,
  created_at timestamptz default now(),
  updated_by text,
  updated_at timestamptz default now()
);

-- 4) TEHNIČKA PODRŠKA (historija po firmi)
create table if not exists podrska (
  id uuid primary key default gen_random_uuid(),
  firma text not null,
  tehnicar text not null,
  datum date not null,
  opis text,
  napomena text,
  created_by text,
  created_at timestamptz default now(),
  updated_by text,
  updated_at timestamptz default now()
);

-- Row Level Security: samo prijavljeni (naši) korisnici mogu čitati/pisati
alter table potencijali enable row level security;
alter table lidovi enable row level security;
alter table kupci enable row level security;
alter table podrska enable row level security;

create policy "Prijavljeni korisnici imaju pun pristup" on potencijali
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Prijavljeni korisnici imaju pun pristup" on lidovi
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Prijavljeni korisnici imaju pun pristup" on kupci
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Prijavljeni korisnici imaju pun pristup" on podrska
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Indeksi za brže pretraživanje
create index if not exists idx_kupci_end_date on kupci (end_date);
create index if not exists idx_podrska_firma on podrska (firma);
create index if not exists idx_potencijali_podsjetnik on potencijali (podsjetnik_datum);
create index if not exists idx_lidovi_podsjetnik on lidovi (podsjetnik_datum);
