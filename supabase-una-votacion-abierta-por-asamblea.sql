do $$
begin
  if exists (
    select 1
    from public.votaciones
    where estado = 'abierta'
    group by asamblea_id
    having count(*) > 1
  ) then
    raise exception 'Hay asambleas con mas de una votacion abierta. Cierra las duplicadas antes de crear el indice.';
  end if;
end $$;

create unique index if not exists votaciones_una_abierta_por_asamblea
on public.votaciones (asamblea_id)
where estado = 'abierta';

notify pgrst, 'reload schema';
