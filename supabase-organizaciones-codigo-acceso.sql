alter table public.organizaciones
  add column if not exists codigo_acceso text;

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

notify pgrst, 'reload schema';
