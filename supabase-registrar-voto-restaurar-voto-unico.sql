alter table if exists public.votos
  drop constraint if exists uq_voto_unico_resolucion cascade;

alter table if exists public.votos
  drop constraint if exists uq_voto_unico_eleccion cascade;

alter table if exists public.votos
  drop constraint if exists votos_votacion_token_unico cascade;

alter table if exists public.votos
  drop constraint if exists votos_votacion_asambleista_unico cascade;

drop index if exists public.uq_voto_unico_resolucion cascade;
drop index if exists public.uq_voto_unico_eleccion cascade;
drop index if exists public.votos_votacion_token_unico cascade;
drop index if exists public.votos_votacion_asambleista_unico cascade;

delete from public.votos v
using public.votos previo
where v.votacion_id = previo.votacion_id
  and v.asambleista_id = previo.asambleista_id
  and v.id > previo.id;

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

  if exists (
    select 1
    from votos
    where votacion_id = p_votacion_id
      and asambleista_id = v_token.asambleista_id
  ) then
    return 'YA_VOTO';
  end if;

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

create unique index if not exists votos_votacion_asambleista_unico
on public.votos (votacion_id, asambleista_id);
