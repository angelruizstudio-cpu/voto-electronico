alter table public.asambleas
  drop constraint if exists chk_asambleas_estado;

alter table public.asambleas
  drop constraint if exists asambleas_estado_check;

alter table public.asambleas
  add constraint chk_asambleas_estado
  check (estado in ('abierta', 'receso', 'cerrada'));

create table if not exists public.asamblea_eventos (
  id uuid primary key default gen_random_uuid(),
  asamblea_id uuid not null references public.asambleas(id) on delete cascade,
  tipo text not null check (
    tipo in ('receso_iniciado', 'trabajos_reanudados')
  ),
  descripcion text,
  creado_en timestamptz not null default now()
);

create index if not exists idx_asamblea_eventos_asamblea_fecha
  on public.asamblea_eventos(asamblea_id, creado_en);
