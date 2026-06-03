alter table public.votos_manuales
  drop constraint if exists votos_manuales_opcion_check;

alter table public.votos_manuales
  add constraint votos_manuales_opcion_check
  check (opcion in ('favor', 'contra', 'abstencion', 'nula', 'danada'));

alter table public.votos_manuales
  drop constraint if exists votos_manuales_check;

alter table public.votos_manuales
  add constraint votos_manuales_check
  check (
    (opcion is not null and candidato_id is null)
    or (opcion is null and candidato_id is not null)
  );

notify pgrst, 'reload schema';
