-- Tokens de acceso automatico para enlaces de asambleistas.
-- El QR de puerta sigue usando la credencial; estos tokens son solo para abrir /votar.

create table if not exists public.asambleista_access_links (
  id uuid primary key default gen_random_uuid(),
  asamblea_id uuid not null references public.asambleas(id) on delete cascade,
  asambleista_id uuid not null references public.asambleistas(id) on delete cascade,
  token_hash text not null unique,
  activo boolean not null default true,
  expira_en timestamptz,
  usado_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create unique index if not exists asambleista_access_links_asambleista_idx
  on public.asambleista_access_links (asamblea_id, asambleista_id);

create index if not exists asambleista_access_links_token_hash_idx
  on public.asambleista_access_links (token_hash)
  where activo = true;
