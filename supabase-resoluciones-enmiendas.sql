alter table public.votaciones
  add column if not exists tipo_mocion text,
  add column if not exists mocion_padre_id uuid,
  add column if not exists resolucion_raiz_id uuid,
  add column if not exists estado_parlamentario text;

alter table public.votaciones
  drop constraint if exists chk_votaciones_estado;

alter table public.votaciones
  add constraint chk_votaciones_estado
  check (estado in ('abierta', 'cerrada'));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'votaciones_tipo_mocion_check'
  ) then
    alter table public.votaciones
      add constraint votaciones_tipo_mocion_check
      check (
        tipo_mocion is null
        or tipo_mocion in (
          'resolucion_principal',
          'enmienda',
          'enmienda_a_enmienda'
        )
      )
      not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'votaciones_estado_parlamentario_check'
  ) then
    alter table public.votaciones
      add constraint votaciones_estado_parlamentario_check
      check (
        estado_parlamentario is null
        or estado_parlamentario in (
          'esperando_segundo',
          'secundada',
          'en_votacion',
          'aprobada',
          'rechazada',
          'incorporada'
        )
      )
      not valid;
  end if;
end $$;

update public.votaciones
set tipo_mocion = 'resolucion_principal',
    resolucion_raiz_id = id
where tipo_votacion = 'resolucion'
  and tipo_mocion is null;

update public.votaciones
set resolucion_raiz_id = id
where tipo_votacion = 'resolucion'
  and tipo_mocion = 'resolucion_principal'
  and resolucion_raiz_id is null;

update public.votaciones
set estado_parlamentario = case
  when resultado = 'aprobada' then 'aprobada'
  when resultado = 'rechazada' then 'rechazada'
  when estado = 'abierta' then 'en_votacion'
  else 'secundada'
end
where tipo_votacion = 'resolucion'
  and estado_parlamentario is null;

update public.votaciones
set estado = 'cerrada',
    estado_parlamentario = coalesce(estado_parlamentario, 'esperando_segundo')
where tipo_votacion = 'resolucion'
  and estado = 'presentada';

notify pgrst, 'reload schema';
