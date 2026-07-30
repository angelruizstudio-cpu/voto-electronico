-- Indices para las consultas criticas de navegacion, registro y votacion.
create index if not exists idx_votaciones_asamblea_estado_creada
  on public.votaciones (asamblea_id, estado, creada_en desc);

create index if not exists idx_tokens_acceso_hash_activo
  on public.tokens_acceso (token_hash)
  where activo = true;

create index if not exists idx_asambleistas_asamblea_credencial
  on public.asambleistas (asamblea_id, credencial);

create index if not exists idx_asambleistas_asamblea_presente
  on public.asambleistas (asamblea_id, presente);

create index if not exists idx_candidatos_votacion_nombre
  on public.candidatos (votacion_id, nombre);

create index if not exists idx_usuarios_sistema_organizacion_username
  on public.usuarios_sistema (organizacion_id, username);
