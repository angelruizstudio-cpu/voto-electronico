alter table public.candidatos
  add column if not exists visible_asambleistas boolean not null default true;

update public.candidatos
set visible_asambleistas = true
where visible_asambleistas is null;

notify pgrst, 'reload schema';
