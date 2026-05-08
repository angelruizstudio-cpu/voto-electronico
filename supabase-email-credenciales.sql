alter table public.asambleistas
add column if not exists email text,
add column if not exists credencial_email_enviado_en timestamptz,
add column if not exists credencial_email_error text;

create index if not exists idx_asambleistas_email
on public.asambleistas (email)
where email is not null;

notify pgrst, 'reload schema';
