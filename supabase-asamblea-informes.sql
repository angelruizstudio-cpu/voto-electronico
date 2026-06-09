-- Informes oficiales de asamblea
-- Ejecutar en Supabase SQL Editor antes de usar la subida de informes.

create table if not exists public.asamblea_informes (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid null references public.organizaciones(id) on delete cascade,
  organizacion_slug text not null default 'kingdom-tech-group',
  asamblea_id uuid not null references public.asambleas(id) on delete cascade,
  tipo text not null check (tipo in ('presidente', 'secretario', 'tesorero', 'misiones', 'otros')),
  nombre_archivo text not null,
  storage_bucket text not null default 'informes-asamblea',
  storage_path text not null,
  mime_type text null,
  tamano_bytes bigint null,
  subido_por text null,
  creado_en timestamptz not null default now()
);

create index if not exists asamblea_informes_asamblea_idx
  on public.asamblea_informes(asamblea_id, creado_en desc);

create index if not exists asamblea_informes_org_idx
  on public.asamblea_informes(organizacion_id, organizacion_slug);

insert into storage.buckets (id, name, public)
values ('informes-asamblea', 'informes-asamblea', false)
on conflict (id) do nothing;
