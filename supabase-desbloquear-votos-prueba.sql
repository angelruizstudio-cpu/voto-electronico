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

select
  'constraints' as tipo,
  conname as nombre,
  pg_get_constraintdef(oid) as definicion
from pg_constraint
where conrelid = 'public.votos'::regclass
  and conname ilike '%voto%unico%'

union all

select
  'indexes' as tipo,
  indexname as nombre,
  indexdef as definicion
from pg_indexes
where schemaname = 'public'
  and tablename = 'votos'
  and indexname ilike '%voto%unico%';
