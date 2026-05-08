alter table public.votaciones
  drop constraint if exists chk_votaciones_estado;

alter table public.votaciones
  add constraint chk_votaciones_estado
  check (estado in ('abierta', 'cerrada'));

update public.votaciones
set estado = 'cerrada',
    estado_parlamentario = coalesce(estado_parlamentario, 'esperando_segundo')
where tipo_votacion = 'resolucion'
  and estado = 'presentada';

update public.votaciones
set estado_parlamentario = 'esperando_segundo'
where tipo_votacion = 'resolucion'
  and resultado is null
  and estado_parlamentario is null;

notify pgrst, 'reload schema';
