alter table public.asambleas
  drop constraint if exists chk_asambleas_estado;

alter table public.asambleas
  drop constraint if exists asambleas_estado_check;

alter table public.asambleas
  add constraint chk_asambleas_estado
  check (estado in ('preparacion', 'abierta', 'receso', 'cerrada'));
