do $$
declare
  r record;
begin
  alter table public.votos drop constraint if exists uq_voto_unico_resolucion;
  alter table public.votos drop constraint if exists uq_voto_unico_eleccion;
  alter table public.votos drop constraint if exists votos_votacion_token_unico;
  alter table public.votos drop constraint if exists votos_votacion_asambleista_unico;
  drop index if exists public.uq_voto_unico_resolucion;
  drop index if exists public.uq_voto_unico_eleccion;
  drop index if exists public.votos_votacion_token_unico;
  drop index if exists public.votos_votacion_asambleista_unico;

  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.votos'::regclass
      and contype = 'u'
      and (
        pg_get_constraintdef(oid) ilike '%token_id%'
        or pg_get_constraintdef(oid) ilike '%asambleista_id%'
      )
  loop
    execute format('alter table public.votos drop constraint %I', r.conname);
  end loop;

  for r in
    select indexname
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'votos'
      and indexdef ilike 'create unique index%'
      and (
        indexdef ilike '%token_id%'
        or indexdef ilike '%asambleista_id%'
      )
  loop
    execute format('drop index if exists public.%I', r.indexname);
  end loop;
end $$;

create or replace function public.registrar_voto(
  p_token text,
  p_votacion_id uuid,
  p_opcion text,
  p_candidato_id uuid,
  p_device_id text,
  p_ip text,
  p_user_agent text
)
returns text
language plpgsql
security definer
as $function$
declare
  v_token tokens_acceso%rowtype;
  v_votacion votaciones%rowtype;
  v_asambleista asambleistas%rowtype;
begin
  select *
  into v_token
  from tokens_acceso
  where token_hash = p_token
    and activo = true
    and bloqueado = false
    and expira_en > now()
  limit 1;

  if not found then
    return 'TOKEN_INVALIDO';
  end if;

  select *
  into v_votacion
  from votaciones
  where id = p_votacion_id
    and estado = 'abierta'
  limit 1;

  if not found then
    return 'VOTACION_CERRADA';
  end if;

  if v_token.asamblea_id <> v_votacion.asamblea_id then
    return 'TOKEN_INVALIDO';
  end if;

  select *
  into v_asambleista
  from asambleistas
  where id = v_token.asambleista_id
    and asamblea_id = v_votacion.asamblea_id
  limit 1;

  if not found then
    return 'ASAMBLEISTA_INVALIDO';
  end if;

  if coalesce(v_asambleista.habilitado, false) = false then
    return 'NO_HABILITADO';
  end if;

  if coalesce(v_asambleista.presente, false) = false then
    return 'NO_PRESENTE';
  end if;

  -- MODO PRUEBA:
  -- La validacion YA_VOTO esta desactivada temporalmente para simular rondas.

  if v_votacion.tipo_votacion = 'resolucion' then
    if p_opcion not in ('favor', 'contra', 'abstencion') then
      return 'OPCION_INVALIDA';
    end if;

    if p_candidato_id is not null then
      return 'CANDIDATO_NO_APLICA';
    end if;
  end if;

  if v_votacion.tipo_votacion = 'eleccion_lideres' then
    if p_candidato_id is null then
      return 'CANDIDATO_REQUERIDO';
    end if;

    if p_opcion is not null then
      return 'OPCION_NO_APLICA';
    end if;

    if not exists (
      select 1
      from candidatos
      where id = p_candidato_id
        and votacion_id = p_votacion_id
    ) then
      return 'CANDIDATO_INVALIDO';
    end if;
  end if;

  insert into votos (
    votacion_id,
    opcion,
    candidato_id,
    asamblea_id,
    asambleista_id,
    token_id,
    device_id,
    ip,
    user_agent
  )
  values (
    p_votacion_id,
    p_opcion,
    p_candidato_id,
    v_votacion.asamblea_id,
    v_token.asambleista_id,
    v_token.id,
    p_device_id,
    p_ip,
    p_user_agent
  );

  update tokens_acceso
  set usado_en = now()
  where id = v_token.id;

  return 'OK';
end;
$function$;
