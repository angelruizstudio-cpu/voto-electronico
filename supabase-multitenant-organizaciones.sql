create extension if not exists pgcrypto;

create table if not exists public.organizaciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  slug text not null unique,
  codigo_acceso text unique,
  activa boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

alter table public.organizaciones
  add column if not exists codigo_acceso text;

insert into public.organizaciones (nombre, slug, codigo_acceso)
values ('Kingdom Tech Group', 'kingdom-tech-group', 'KTG')
on conflict (slug) do update
set nombre = excluded.nombre,
    codigo_acceso = coalesce(public.organizaciones.codigo_acceso, excluded.codigo_acceso),
    activa = true,
    actualizado_en = now();

update public.organizaciones
set codigo_acceso = case
  when slug = 'kingdom-tech-group' then 'KTG'
  else upper(left(regexp_replace(slug, '[^a-zA-Z0-9]', '', 'g'), 5))
end
where codigo_acceso is null or btrim(codigo_acceso) = '';

alter table public.organizaciones
  alter column codigo_acceso set not null;

create unique index if not exists organizaciones_codigo_acceso_key
  on public.organizaciones (codigo_acceso);

alter table public.asambleas
  add column if not exists organizacion_id uuid references public.organizaciones(id),
  add column if not exists organizacion_slug text;

alter table public.usuarios_sistema
  add column if not exists organizacion_id uuid references public.organizaciones(id);

update public.asambleas
set organizacion_id = (select id from public.organizaciones where slug = 'kingdom-tech-group'),
    organizacion_slug = 'kingdom-tech-group'
where organizacion_id is null;

update public.usuarios_sistema
set organizacion_id = (select id from public.organizaciones where slug = 'kingdom-tech-group')
where organizacion_id is null;

alter table public.asambleas
  alter column organizacion_slug set not null;

alter table public.usuarios_sistema
  alter column organizacion_id set not null;

create index if not exists idx_asambleas_organizacion_estado
  on public.asambleas (organizacion_id, estado);

create index if not exists idx_asambleas_organizacion_slug_estado
  on public.asambleas (organizacion_slug, estado);

create index if not exists idx_usuarios_sistema_organizacion
  on public.usuarios_sistema (organizacion_id);

create or replace function public.crear_usuario_organizacion(
  p_organizacion_nombre text,
  p_organizacion_slug text,
  p_nombre text,
  p_username text,
  p_password text,
  p_roles text[] default array['admin']::text[]
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_organizacion_id uuid;
  v_usuario_id uuid;
  v_salt text;
begin
  if p_organizacion_nombre is null or btrim(p_organizacion_nombre) = '' then
    raise exception 'Organizacion requerida';
  end if;

  if p_organizacion_slug is null or btrim(p_organizacion_slug) = '' then
    raise exception 'Slug requerido';
  end if;

  if p_nombre is null or btrim(p_nombre) = '' then
    raise exception 'Nombre requerido';
  end if;

  if p_username is null or btrim(p_username) = '' then
    raise exception 'Username requerido';
  end if;

  if p_password is null or length(p_password) < 8 then
    raise exception 'Password debe tener al menos 8 caracteres';
  end if;

  if not (p_roles <@ array['admin', 'moderador', 'oficina', 'puerta']::text[]) then
    raise exception 'Roles invalidos';
  end if;

  insert into public.organizaciones (nombre, slug)
  values (btrim(p_organizacion_nombre), lower(btrim(p_organizacion_slug)))
  on conflict (slug) do update
  set nombre = excluded.nombre,
      activa = true,
      actualizado_en = now()
  returning id into v_organizacion_id;

  v_salt := encode(gen_random_bytes(16), 'hex');

  insert into public.usuarios_sistema (
    nombre,
    username,
    password_salt,
    password_hash,
    roles,
    activo,
    organizacion_id
  )
  values (
    btrim(p_nombre),
    lower(btrim(p_username)),
    v_salt,
    encode(digest(v_salt || ':' || p_password, 'sha256'), 'hex'),
    p_roles,
    true,
    v_organizacion_id
  )
  returning id into v_usuario_id;

  return v_usuario_id;
end;
$$;

notify pgrst, 'reload schema';
