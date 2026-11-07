-- Criterios de evaluación para la IA (decidido con el usuario el 2026-11-06).
--
-- UNA matriz global de la plataforma. La fuente única es el Excel del usuario:
-- los DATOS los carga una migración generada por
-- D:\PROCISO\herramientas\generar_migracion_criterios.mjs (ver la siguiente).
--
-- Proyecto escolar: los criterios son redacción propia del usuario sobre una base
-- ISO 9001:2015 y se presentan como ISO 9001:2026 con un aviso visible.
--
-- id para que otras tablas (los análisis de la IA) apunten al criterio;
-- (edicion, clausula) como clave natural: recargar el Excel actualiza, no duplica.

create table public.criterios_evaluacion (
  id                   uuid primary key default gen_random_uuid(),
  edicion              text not null default 'ISO 9001:2026' check (edicion in ('ISO 9001:2026', 'ISO 9001:2015')),
  clausula             text not null check (clausula ~ '^(4|5|6|7|8|9|10)(\.[0-9]+){1,3}$'),
  titulo               text not null check (length(trim(titulo)) > 0),
  intencion            text not null check (length(trim(intencion)) > 0),
  evidencia_esperada   text[] not null default '{}',
  preguntas            text[] not null default '{}',
  senales_de_hueco     text[] not null default '{}',
  -- Cláusulas que una organización puede justificar como no aplicables (p. ej. 8.3 si no diseña).
  puede_no_aplicar     boolean not null default false,
  condicion_no_aplica  text,
  orden                integer not null,
  fuente               text not null default 'Matriz propia del proyecto (base ISO 9001:2015)',
  unique (edicion, clausula),
  check (puede_no_aplicar or condicion_no_aplica is null)
);

alter table public.criterios_evaluacion enable row level security;

-- La leen todos los usuarios activos (equipo y clientes): el cliente sabe contra
-- qué se evalúan sus documentos. mi_rol() es null para inactivos y suspendidos.
create policy "ver criterios" on public.criterios_evaluacion for select to authenticated
  using ((select private.mi_rol()) is not null);

-- Nadie la escribe desde la app (ni el Admin PROCISO): solo las migraciones.
revoke insert, update, delete, truncate on public.criterios_evaluacion from anon, authenticated;
revoke all on public.criterios_evaluacion from anon;
grant select on public.criterios_evaluacion to authenticated;
