alter table public.votaciones
  add column if not exists cerrada_en timestamptz;

create index if not exists idx_votaciones_asamblea_cerrada_en
  on public.votaciones(asamblea_id, cerrada_en desc)
  where estado = 'cerrada' and cerrada_en is not null;

notify pgrst, 'reload schema';
