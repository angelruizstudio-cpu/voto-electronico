create table if not exists public.usuarios_sistema (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  username text not null unique,
  password_salt text not null,
  password_hash text not null,
  roles text[] not null default '{}',
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

alter table public.usuarios_sistema
  drop constraint if exists usuarios_sistema_roles_validos;

alter table public.usuarios_sistema
  add constraint usuarios_sistema_roles_validos
  check (
    roles <@ array['admin', 'moderador', 'escrutinio', 'oficina', 'puerta']::text[]
  );

create index if not exists idx_usuarios_sistema_username
  on public.usuarios_sistema (username);

notify pgrst, 'reload schema';
