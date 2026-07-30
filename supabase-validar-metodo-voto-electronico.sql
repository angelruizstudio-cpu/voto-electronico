create or replace function public.validar_metodo_voto_electronico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.asambleistas
    where id = new.asambleista_id
      and metodo_voto = 'manual'
  ) then
    raise exception 'VOTO_MANUAL';
  end if;

  return new;
end;
$$;

drop trigger if exists validar_metodo_voto_electronico on public.votos;

create trigger validar_metodo_voto_electronico
before insert on public.votos
for each row
execute function public.validar_metodo_voto_electronico();
