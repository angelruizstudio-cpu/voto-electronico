-- Evita que un mismo tenant tenga mas de una asamblea abierta o en receso.
-- Ejecutar en Supabase SQL Editor.

create unique index if not exists asambleas_una_activa_por_organizacion_id
on public.asambleas (organizacion_id)
where estado in ('abierta', 'receso')
  and organizacion_id is not null;

create unique index if not exists asambleas_una_activa_por_organizacion_slug
on public.asambleas (organizacion_slug)
where estado in ('abierta', 'receso')
  and organizacion_id is null
  and organizacion_slug is not null;
