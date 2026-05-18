-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ============================================================
-- customers
-- ============================================================
create table public.customers (
  id              uuid primary key default gen_random_uuid(),
  clerk_user_id   text unique not null,
  company_name    text not null,
  slug            text unique not null,
  created_at      timestamptz default now()
);

alter table public.customers enable row level security;

-- All access goes through service role key in server actions/route handlers.
-- RLS blocks direct client access; no anon/authenticated policies needed.

-- ============================================================
-- form_values
-- ============================================================
create table public.form_values (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid references public.customers(id) on delete cascade,
  field_key       text not null,
  field_value     text,
  updated_at      timestamptz default now(),
  unique (customer_id, field_key)
);

alter table public.form_values enable row level security;

-- ============================================================
-- template_versions
-- ============================================================
create table public.template_versions (
  id                  uuid primary key default gen_random_uuid(),
  version             int not null,
  html_content        text not null,
  docx_storage_path   text not null,
  is_active           boolean default false,
  uploaded_by         text,
  uploaded_at         timestamptz default now()
);

alter table public.template_versions enable row level security;

-- ============================================================
-- template_sections
-- ============================================================
create table public.template_sections (
  id                    uuid primary key default gen_random_uuid(),
  template_version_id   uuid references public.template_versions(id) on delete cascade,
  field_key             text not null,
  section_id            text not null,
  label                 text not null
);

alter table public.template_sections enable row level security;

-- ============================================================
-- Supabase Storage bucket for .docx template files
-- ============================================================
insert into storage.buckets (id, name, public)
values ('templates', 'templates', false)
on conflict do nothing;
