alter table public.asambleistas
add column if not exists telefono text,
add column if not exists credencial_sms_enviado_en timestamptz,
add column if not exists credencial_sms_error text;

create index if not exists idx_asambleistas_telefono
on public.asambleistas (telefono)
where telefono is not null;

notify pgrst, 'reload schema';
