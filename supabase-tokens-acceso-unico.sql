-- Restricción única para tokens_acceso (asamblea_id, asambleista_id).
--
-- El check-in hace un upsert con onConflict "asamblea_id,asambleista_id", pero
-- ningún script del repo creaba esa restricción. Si no existe en la base, el
-- upsert no puede inferir el conflicto y cada re-check-in puede dejar filas
-- duplicadas (o fallar). Este script deja el índice único documentado en el repo
-- y limpia duplicados previos antes de crearlo.

-- Elimina duplicados dejando, por (asamblea_id, asambleista_id), la fila con el
-- token más reciente (mayor expira_en; se desempata por id para ser determinista).
delete from public.tokens_acceso t
using public.tokens_acceso otro
where t.asamblea_id = otro.asamblea_id
  and t.asambleista_id = otro.asambleista_id
  and t.id <> otro.id
  and (
    coalesce(t.expira_en, to_timestamp(0)) < coalesce(otro.expira_en, to_timestamp(0))
    or (
      coalesce(t.expira_en, to_timestamp(0)) = coalesce(otro.expira_en, to_timestamp(0))
      and t.id::text < otro.id::text
    )
  );

create unique index if not exists tokens_acceso_asamblea_asambleista_unico
  on public.tokens_acceso (asamblea_id, asambleista_id);

notify pgrst, 'reload schema';
