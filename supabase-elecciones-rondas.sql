alter table public.votaciones
  add column if not exists ronda_numero integer,
  add column if not exists eleccion_grupo_id uuid,
  add column if not exists votacion_anterior_id uuid,
  add column if not exists resultado text,
  add column if not exists ganador_id uuid;

alter table public.candidatos
  add column if not exists visible_asambleistas boolean not null default true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'votaciones_ronda_numero_check'
  ) then
    alter table public.votaciones
      add constraint votaciones_ronda_numero_check
      check (ronda_numero is null or ronda_numero >= 1)
      not valid;
  end if;
end $$;

update public.votaciones
set ronda_numero = 1
where tipo_votacion = 'eleccion_lideres'
  and ronda_numero is null;

update public.votaciones
set eleccion_grupo_id = id
where tipo_votacion = 'eleccion_lideres'
  and eleccion_grupo_id is null;
