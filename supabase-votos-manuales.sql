alter table public.asambleistas
  add column if not exists metodo_voto text not null default 'electronico';

alter table public.asambleistas
  drop constraint if exists chk_asambleistas_metodo_voto;

alter table public.asambleistas
  add constraint chk_asambleistas_metodo_voto
  check (metodo_voto in ('electronico', 'manual'));

update public.asambleistas
set metodo_voto = 'electronico'
where metodo_voto is null;

create table if not exists public.votos_manuales (
  id uuid primary key default gen_random_uuid(),
  votacion_id uuid not null references public.votaciones(id) on delete cascade,
  opcion text check (opcion in ('favor', 'contra', 'abstencion', 'nula', 'danada')),
  candidato_id uuid references public.candidatos(id) on delete cascade,
  cantidad integer not null check (cantidad >= 0),
  registrado_por text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check (
    (opcion is not null and candidato_id is null)
    or (opcion is null and candidato_id is not null)
  )
);

create index if not exists idx_votos_manuales_votacion
  on public.votos_manuales(votacion_id);
