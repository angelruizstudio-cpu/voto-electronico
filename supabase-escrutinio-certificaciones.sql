create table if not exists public.resultados_escrutinio (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid null references public.organizaciones(id) on delete set null,
  organizacion_slug text null,
  asamblea_id uuid not null references public.asambleas(id) on delete cascade,
  votacion_id uuid not null references public.votaciones(id) on delete cascade,
  resultado jsonb not null,
  certificado_por text not null,
  certificado_en timestamptz not null default now(),
  estado text not null default 'certificado',
  visto_moderador_en timestamptz null,
  constraint resultados_escrutinio_estado_check
    check (estado in ('certificado', 'recibido'))
);

create unique index if not exists resultados_escrutinio_votacion_unique
  on public.resultados_escrutinio(votacion_id);

create index if not exists resultados_escrutinio_asamblea_idx
  on public.resultados_escrutinio(asamblea_id, certificado_en desc);

create index if not exists resultados_escrutinio_organizacion_idx
  on public.resultados_escrutinio(organizacion_id, organizacion_slug);
