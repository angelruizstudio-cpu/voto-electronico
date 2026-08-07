-- Versión canónica de registrar_voto.
--
-- Reemplaza y unifica las tres versiones divergentes que existían en el repo:
--   * supabase-registrar-voto-restaurar-voto-unico.sql (voto único, SIN chequeo
--     de dispositivo en la RPC)
--   * supabase-dispositivos-autorizados.sql (voto único + chequeo de dispositivo)
--   * supabase-registrar-voto-modo-prueba-multiple.sql (PERMITE votos múltiples,
--     peligroso en producción)
--
-- Esta es la única que debe quedar instalada para una elección real: un voto por
-- asambleísta y validación de dispositivo autorizado.
--
-- Sobre el hasheo de tokens (#11): la API pasa como p_token el valor ya
-- almacenado en tokens_acceso.token_hash (SHA-256 para nuevos, o el valor legacy
-- en claro para tokens previos), por lo que aquí basta comparar por igualdad y no
-- se necesita pgcrypto.

-- Garantiza un único voto por asambleísta y votación.
create unique index if not exists votos_votacion_asambleista_unico
  on public.votos (votacion_id, asambleista_id);

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

  if v_asambleista.dispositivo_alerta_en is not null then
    return 'DISPOSITIVO_REVALIDACION_REQUERIDA';
  end if;

  if v_asambleista.dispositivo_autorizado_id is not null
    and v_asambleista.dispositivo_autorizado_id <> p_device_id then
    return 'DISPOSITIVO_REVALIDACION_REQUERIDA';
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

notify pgrst, 'reload schema';
