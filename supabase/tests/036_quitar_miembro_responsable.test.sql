-- AUD10-M4 (decisión del 12/11): quitar a un miembro del proyecto se bloquea también si es responsable de un
-- proceso, de una actividad o de una no conformidad ABIERTA (como ya pasaba con las tareas abiertas).
--   · Antes se lo quitaba igual y esos registros quedaban a cargo de alguien que ya no ve el proyecto.
--   · Una NC cerrada no bloquea; la NC cuenta con `responsable_id` y con `responsable_accion_id`.

begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

-- A admin C1 · K1 consultor RESPONSABLE del proyecto · K2..K7 consultores miembros
insert into auth.users (id, email, aud, role)
select format('38383838-0000-0000-0000-%s', lpad(n::text, 12, '0'))::uuid, format('u%s@resp.test', n), 'authenticated', 'authenticated'
from unnest(array[1, 2, 3, 4, 5, 6, 7, 8]) as n;
insert into public.consultorias (id, nombre) values ('38383838-0000-0000-0001-000000000001', 'Consultoría C1');
insert into public.empresas (id, consultoria_id, nombre) values ('38383838-0000-0000-0002-000000000001', '38383838-0000-0000-0001-000000000001', 'Empresa E1');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id)
select format('38383838-0000-0000-0000-%s', lpad(n::text, 12, '0'))::uuid, format('K%s', n), format('u%s@resp.test', n),
       case when n = 1 then 'admin_consultoria' else 'consultor' end, '38383838-0000-0000-0001-000000000001', null
from unnest(array[1, 2, 3, 4, 5, 6, 7, 8]) as n;
-- (el usuario 1 es el admin; el consultor responsable del proyecto es el 2)
insert into public.proyectos (id, consultoria_id, empresa_id, nombre, consultor_id) values
  ('38383838-0000-0000-0003-000000000001', '38383838-0000-0000-0001-000000000001', '38383838-0000-0000-0002-000000000001', 'P1',
   '38383838-0000-0000-0000-000000000002');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id)
select '38383838-0000-0000-0003-000000000001', format('38383838-0000-0000-0000-%s', lpad(n::text, 12, '0'))::uuid, '38383838-0000-0000-0001-000000000001'
from unnest(array[2, 3, 4, 5, 6, 7, 8]) as n;

create function pg_temp.u(p_n int) returns uuid language sql as
  $$ select format('38383838-0000-0000-0000-%s', lpad(p_n::text, 12, '0'))::uuid $$;
create function pg_temp.como(p_id text) returns void language sql as
  $$ select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', p_id), true) $$;

-- Fixtures: U3 responsable de un proceso · U4 de una actividad · U5 de una NC abierta · U6 acciones de una NC abierta
-- U7 de una NC CERRADA · U8 de nada.
insert into public.procesos (id, consultoria_id, proyecto_id, nombre, responsable_id) values
  ('38383838-0000-0000-0004-000000000001', '38383838-0000-0000-0001-000000000001', '38383838-0000-0000-0003-000000000001', 'Proceso del U3', pg_temp.u(3)),
  ('38383838-0000-0000-0004-000000000002', '38383838-0000-0000-0001-000000000001', '38383838-0000-0000-0003-000000000001', 'Proceso de nadie', null);
insert into public.actividades (consultoria_id, proyecto_id, proceso_id, descripcion, orden, responsable_id) values
  ('38383838-0000-0000-0001-000000000001', '38383838-0000-0000-0003-000000000001', '38383838-0000-0000-0004-000000000002', 'Actividad del U4', 1, pg_temp.u(4));
insert into public.no_conformidades (consultoria_id, proyecto_id, folio, descripcion, fecha_deteccion, responsable_id, responsable_accion_id, estado) values
  ('38383838-0000-0000-0001-000000000001', '38383838-0000-0000-0003-000000000001', 'NC-1', 'NC abierta del U5', current_date, pg_temp.u(5), null, 'Abierta'),
  ('38383838-0000-0000-0001-000000000001', '38383838-0000-0000-0003-000000000001', 'NC-2', 'NC con acciones del U6', current_date, pg_temp.u(2), pg_temp.u(6), 'En corrección'),
  ('38383838-0000-0000-0001-000000000001', '38383838-0000-0000-0003-000000000001', 'NC-3', 'NC cerrada del U7', current_date, pg_temp.u(7), null, 'Cerrada');

-- ─── Responsable de un proceso, de una actividad o de una NC abierta: no se lo quita ────────────
select pg_temp.como(pg_temp.u(1)::text);
set local role authenticated;
select throws_ok(
  $$ select public.quitar_miembro_proyecto('38383838-0000-0000-0003-000000000001', '38383838-0000-0000-0000-000000000003') $$,
  '22023', 'Es responsable de procesos, actividades o no conformidades abiertas de este proyecto: reasígnalos antes de quitarlo.',
  'No se quita a quien es responsable de un proceso');
select throws_ok(
  $$ select public.quitar_miembro_proyecto('38383838-0000-0000-0003-000000000001', '38383838-0000-0000-0000-000000000004') $$,
  '22023', 'Es responsable de procesos, actividades o no conformidades abiertas de este proyecto: reasígnalos antes de quitarlo.',
  'No se quita a quien es responsable de una actividad');
select throws_ok(
  $$ select public.quitar_miembro_proyecto('38383838-0000-0000-0003-000000000001', '38383838-0000-0000-0000-000000000005') $$,
  '22023', 'Es responsable de procesos, actividades o no conformidades abiertas de este proyecto: reasígnalos antes de quitarlo.',
  'No se quita a quien es responsable de una NC abierta');
select throws_ok(
  $$ select public.quitar_miembro_proyecto('38383838-0000-0000-0003-000000000001', '38383838-0000-0000-0000-000000000006') $$,
  '22023', 'Es responsable de procesos, actividades o no conformidades abiertas de este proyecto: reasígnalos antes de quitarlo.',
  'No se quita a quien es responsable de las acciones de una NC abierta (responsable_accion_id)');
reset role;
select is(
  (select count(*)::int from public.proyecto_miembros where proyecto_id = '38383838-0000-0000-0003-000000000001' and usuario_id in (pg_temp.u(3), pg_temp.u(4), pg_temp.u(5), pg_temp.u(6))),
  4, 'Los cuatro bloqueados siguen siendo del equipo');

-- ─── Lo que NO bloquea ──────────────────────────────────────────────────────
select pg_temp.como(pg_temp.u(1)::text);
set local role authenticated;
select lives_ok(
  $$ select public.quitar_miembro_proyecto('38383838-0000-0000-0003-000000000001', '38383838-0000-0000-0000-000000000007') $$,
  'Una NC CERRADA no bloquea: se quita a quien solo fue responsable de una NC cerrada');
select lives_ok(
  $$ select public.quitar_miembro_proyecto('38383838-0000-0000-0003-000000000001', '38383838-0000-0000-0000-000000000008') $$,
  'Quien no es responsable de nada se quita sin problema');
reset role;

-- ─── Reasignar destraba ─────────────────────────────────────────────────────
update public.procesos set responsable_id = pg_temp.u(2) where id = '38383838-0000-0000-0004-000000000001';
select pg_temp.como(pg_temp.u(1)::text);
set local role authenticated;
select lives_ok(
  $$ select public.quitar_miembro_proyecto('38383838-0000-0000-0003-000000000001', '38383838-0000-0000-0000-000000000003') $$,
  'Reasignado el proceso, ya se lo puede quitar');
reset role;
select is(
  (select count(*)::int from public.proyecto_miembros where proyecto_id = '38383838-0000-0000-0003-000000000001' and usuario_id in (pg_temp.u(7), pg_temp.u(8), pg_temp.u(3))),
  0, 'Los tres quitados ya no son del equipo');

select * from finish();
rollback;
