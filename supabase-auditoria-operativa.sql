create table if not exists public.auditoria_operativa (
  id uuid primary key default gen_random_uuid(),
  asamblea_id uuid null references public.asambleas(id) on delete set null,
  asambleista_id uuid null references public.asambleistas(id) on delete set null,
  usuario_id text null,
  usuario_nombre text not null default 'Usuario',
  accion text not null,
  detalle text null,
  creado_en timestamptz not null default now()
);

create index if not exists idx_auditoria_operativa_asamblea
  on public.auditoria_operativa(asamblea_id, creado_en desc);

create index if not exists idx_auditoria_operativa_asambleista
  on public.auditoria_operativa(asambleista_id, creado_en desc);

create index if not exists idx_auditoria_operativa_accion
  on public.auditoria_operativa(accion, creado_en desc);
