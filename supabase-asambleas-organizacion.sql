alter table public.asambleas
add column if not exists organizacion text;

update public.asambleas
set organizacion = coalesce(organizacion, 'Iglesia de Dios Pentecostal MI RMO')
where organizacion is null;

notify pgrst, 'reload schema';
