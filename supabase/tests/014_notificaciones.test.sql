-- Notificaciones (diseño híbrido elegido por el usuario el 2026-11-06):
--   · PENDIENTES calculadas al vuelo desde el estado actual (desaparecen solas):
--       tarea mía sin completar (o vencida → también al consultor líder),
--       documento "Pendiente de revisión" → equipo (menos el autor) + cliente,
--       entregable "En revisión" → cliente de la empresa.
--   · HECHOS leídos de public.historial, últimos 15 días:
--       tarea devuelta → asignado · entregable aprobado/rechazado → equipo ·
--       documento aprobado/devuelto → autor + cliente · NC con tratamiento → equipo.
--   · Nunca te notifico de lo que hiciste vos. El Admin PROCISO no recibe operativas.
--   · Lo único que se guarda: public.notificaciones_leidas (cada uno, lo suyo).

begin;
create extension if not exists pgtap with schema extensions;

select plan(25);

-- A admin C1 · K1 consultor líder (y autor del documento) · K2 consultor miembro
-- U cliente de E1 · U2 cliente de E2 · AX admin de OTRA consultoría · Z admin PROCISO
insert into auth.users (id, email, aud, role) values
  ('0e0e0e0e-0000-0000-0000-000000000001', 'a@nt.test',  'authenticated', 'authenticated'),
  ('0e0e0e0e-0000-0000-0000-000000000002', 'k1@nt.test', 'authenticated', 'authenticated'),
  ('0e0e0e0e-0000-0000-0000-000000000003', 'k2@nt.test', 'authenticated', 'authenticated'),
  ('0e0e0e0e-0000-0000-0000-000000000004', 'u@nt.test',  'authenticated', 'authenticated'),
  ('0e0e0e0e-0000-0000-0000-000000000005', 'u2@nt.test', 'authenticated', 'authenticated'),
  ('0e0e0e0e-0000-0000-0000-000000000006', 'ax@nt.test', 'authenticated', 'authenticated'),
  ('0e0e0e0e-0000-0000-0000-000000000007', 'z@nt.test',  'authenticated', 'authenticated');
insert into public.consultorias (id, nombre) values
  ('0e0e0e0e-0000-0000-0001-000000000001', 'Consultoría NT'),
  ('0e0e0e0e-0000-0000-0001-000000000002', 'Otra consultoría NT');
insert into public.empresas (id, consultoria_id, nombre) values
  ('0e0e0e0e-0000-0000-0002-000000000001', '0e0e0e0e-0000-0000-0001-000000000001', 'Empresa NT'),
  ('0e0e0e0e-0000-0000-0002-000000000002', '0e0e0e0e-0000-0000-0001-000000000001', 'Otra empresa NT');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('0e0e0e0e-0000-0000-0000-000000000001', 'A',  'a@nt.test',  'admin_consultoria', '0e0e0e0e-0000-0000-0001-000000000001', null),
  ('0e0e0e0e-0000-0000-0000-000000000002', 'K1', 'k1@nt.test', 'consultor',         '0e0e0e0e-0000-0000-0001-000000000001', null),
  ('0e0e0e0e-0000-0000-0000-000000000003', 'K2', 'k2@nt.test', 'consultor',         '0e0e0e0e-0000-0000-0001-000000000001', null),
  ('0e0e0e0e-0000-0000-0000-000000000004', 'U',  'u@nt.test',  'usuario_cliente',   '0e0e0e0e-0000-0000-0001-000000000001', '0e0e0e0e-0000-0000-0002-000000000001'),
  ('0e0e0e0e-0000-0000-0000-000000000005', 'U2', 'u2@nt.test', 'usuario_cliente',   '0e0e0e0e-0000-0000-0001-000000000001', '0e0e0e0e-0000-0000-0002-000000000002'),
  ('0e0e0e0e-0000-0000-0000-000000000006', 'AX', 'ax@nt.test', 'admin_consultoria', '0e0e0e0e-0000-0000-0001-000000000002', null),
  ('0e0e0e0e-0000-0000-0000-000000000007', 'Z',  'z@nt.test',  'admin_prociso',     null, null);
insert into public.proyectos (id, consultoria_id, empresa_id, consultor_id, nombre) values
  ('0e0e0e0e-0000-0000-0003-000000000001', '0e0e0e0e-0000-0000-0001-000000000001', '0e0e0e0e-0000-0000-0002-000000000001',
   '0e0e0e0e-0000-0000-0000-000000000002', 'Proyecto NT');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('0e0e0e0e-0000-0000-0003-000000000001', '0e0e0e0e-0000-0000-0000-000000000002', '0e0e0e0e-0000-0000-0001-000000000001'),
  ('0e0e0e0e-0000-0000-0003-000000000001', '0e0e0e0e-0000-0000-0000-000000000003', '0e0e0e0e-0000-0000-0001-000000000001');

-- T1 vencida de K2 · T2 de K2 al día · T3 vencida pero completada (no avisa)
insert into public.tareas (id, consultoria_id, proyecto_id, titulo, asignado_a, asignado_por, estado, fecha_vencimiento) values
  ('0e0e0e0e-0000-0000-0004-000000000001', '0e0e0e0e-0000-0000-0001-000000000001', '0e0e0e0e-0000-0000-0003-000000000001',
   'Tarea vencida NT', '0e0e0e0e-0000-0000-0000-000000000003', '0e0e0e0e-0000-0000-0000-000000000001', 'Pendiente', current_date - 1),
  ('0e0e0e0e-0000-0000-0004-000000000002', '0e0e0e0e-0000-0000-0001-000000000001', '0e0e0e0e-0000-0000-0003-000000000001',
   'Tarea al día NT', '0e0e0e0e-0000-0000-0000-000000000003', '0e0e0e0e-0000-0000-0000-000000000001', 'En proceso', current_date + 10),
  ('0e0e0e0e-0000-0000-0004-000000000003', '0e0e0e0e-0000-0000-0001-000000000001', '0e0e0e0e-0000-0000-0003-000000000001',
   'Tarea completada NT', '0e0e0e0e-0000-0000-0000-000000000003', '0e0e0e0e-0000-0000-0000-000000000001', 'Completada', current_date - 5);

insert into public.documentos (id, consultoria_id, proyecto_id, nombre, tipo, estado, version, creado_por) values
  ('0e0e0e0e-0000-0000-0005-000000000001', '0e0e0e0e-0000-0000-0001-000000000001', '0e0e0e0e-0000-0000-0003-000000000001',
   'Procedimiento NT', 'Procedimiento', 'Pendiente de revisión', '0.1', '0e0e0e0e-0000-0000-0000-000000000002'),
  -- D2 lo redactó el Admin PROCISO: prueba que su guarda no depende de los datos.
  ('0e0e0e0e-0000-0000-0005-000000000002', '0e0e0e0e-0000-0000-0001-000000000001', '0e0e0e0e-0000-0000-0003-000000000001',
   'Política NT', 'Política', 'En corrección', '0.1', '0e0e0e0e-0000-0000-0000-000000000007');

insert into public.entregables (id, consultoria_id, proyecto_id, nombre, estado) values
  ('0e0e0e0e-0000-0000-0006-000000000001', '0e0e0e0e-0000-0000-0001-000000000001', '0e0e0e0e-0000-0000-0003-000000000001',
   'Manual NT', 'En revisión'),
  ('0e0e0e0e-0000-0000-0006-000000000002', '0e0e0e0e-0000-0000-0001-000000000001', '0e0e0e0e-0000-0000-0003-000000000001',
   'Diagnóstico NT', 'Aprobado');

insert into public.no_conformidades (id, consultoria_id, proyecto_id, folio, titulo, descripcion, fecha_deteccion, responsable_id, registrada_por) values
  ('0e0e0e0e-0000-0000-0007-000000000001', '0e0e0e0e-0000-0000-0001-000000000001', '0e0e0e0e-0000-0000-0003-000000000001',
   'x', 'Registros incompletos', 'Faltan firmas', current_date, '0e0e0e0e-0000-0000-0000-000000000004', '0e0e0e0e-0000-0000-0000-000000000001');

-- H1 A devuelve T2 · H2 U aprueba Ent2 · H3 K2 pide corrección de D1
-- H4 U carga tratamiento de la NC · H5 U rechazó Ent2 hace 20 días (fuera de la ventana)
insert into public.historial (id, consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, estado_anterior, estado_nuevo, creado_en)
overriding system value values
  (990001, '0e0e0e0e-0000-0000-0001-000000000001', '0e0e0e0e-0000-0000-0003-000000000001', 'tarea', '0e0e0e0e-0000-0000-0004-000000000002',
   '0e0e0e0e-0000-0000-0000-000000000001', 'Cambio de estado', 'En revisión', 'Requiere corrección', now()),
  (990002, '0e0e0e0e-0000-0000-0001-000000000001', '0e0e0e0e-0000-0000-0003-000000000001', 'entregable', '0e0e0e0e-0000-0000-0006-000000000002',
   '0e0e0e0e-0000-0000-0000-000000000004', 'Entregable aprobado', 'En revisión', 'Aprobado', now()),
  (990003, '0e0e0e0e-0000-0000-0001-000000000001', '0e0e0e0e-0000-0000-0003-000000000001', 'documento', '0e0e0e0e-0000-0000-0005-000000000001',
   '0e0e0e0e-0000-0000-0000-000000000003', 'Corrección solicitada', 'Pendiente de revisión', 'En corrección', now()),
  (990004, '0e0e0e0e-0000-0000-0001-000000000001', '0e0e0e0e-0000-0000-0003-000000000001', 'no_conformidad', '0e0e0e0e-0000-0000-0007-000000000001',
   '0e0e0e0e-0000-0000-0000-000000000004', 'Tratamiento actualizado', null, null, now()),
  (990005, '0e0e0e0e-0000-0000-0001-000000000001', '0e0e0e0e-0000-0000-0003-000000000001', 'entregable', '0e0e0e0e-0000-0000-0006-000000000002',
   '0e0e0e0e-0000-0000-0000-000000000004', 'Entregable rechazado', 'En revisión', 'Rechazado', now() - interval '20 days'),
  (990006, '0e0e0e0e-0000-0000-0001-000000000001', '0e0e0e0e-0000-0000-0003-000000000001', 'documento', '0e0e0e0e-0000-0000-0005-000000000002',
   '0e0e0e0e-0000-0000-0000-000000000003', 'Corrección solicitada', 'Pendiente de revisión', 'En corrección', now()),
  -- H7: K2 (equipo) carga el tratamiento: le llega al resto del equipo, NUNCA a K2.
  (990007, '0e0e0e0e-0000-0000-0001-000000000001', '0e0e0e0e-0000-0000-0003-000000000001', 'no_conformidad', '0e0e0e0e-0000-0000-0007-000000000001',
   '0e0e0e0e-0000-0000-0000-000000000003', 'Tratamiento actualizado', null, null, now());

select has_table('public', 'notificaciones_leidas', 'Existe la tabla de notificaciones leídas');
select has_function('public', 'mis_notificaciones', 'Existe mis_notificaciones()');

-- ─── K2: consultor miembro, asignado de T1 y T2 ─────────────────────────────
select set_config('request.jwt.claims', '{"sub":"0e0e0e0e-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select set_eq(
  'select clave from public.mis_notificaciones()',
  array['tarea_vencida:0e0e0e0e-0000-0000-0004-000000000001',
        'tarea_asignada:0e0e0e0e-0000-0000-0004-000000000002',
        'doc_revision:0e0e0e0e-0000-0000-0005-000000000001:0.1',
        'h:990001', 'h:990002', 'h:990004'],
  'K2 ve sus tareas, el documento a revisar y los hechos del equipo, pero no su propia acción ni lo viejo'
);
select is((select tipo from public.mis_notificaciones() where clave = 'tarea_vencida:0e0e0e0e-0000-0000-0004-000000000001'),
  'error', 'Una tarea vencida es de tipo error');
select is((select tipo from public.mis_notificaciones() where clave = 'tarea_asignada:0e0e0e0e-0000-0000-0004-000000000002'),
  'info', 'Una tarea asignada al día es de tipo info');
select is((select tipo from public.mis_notificaciones() where clave = 'h:990001'),
  'warning', 'Una tarea devuelta es de tipo warning');
select is((select tipo from public.mis_notificaciones() where clave = 'h:990002'),
  'success', 'Un entregable aprobado es de tipo success');
select is((select pagina from public.mis_notificaciones() where clave = 'doc_revision:0e0e0e0e-0000-0000-0005-000000000001:0.1'),
  'revisiones', 'Un documento por revisar lleva a Revisiones');

-- Leídas: cada uno marca lo suyo
select lives_ok(
  $$ insert into public.notificaciones_leidas (clave) values ('tarea_vencida:0e0e0e0e-0000-0000-0004-000000000001') returning * $$,
  'K2 marca una notificación como leída (INSERT … RETURNING)'
);
select lives_ok(
  $$ insert into public.notificaciones_leidas (clave) values ('tarea_vencida:0e0e0e0e-0000-0000-0004-000000000001') on conflict do nothing $$,
  'Marcarla otra vez no falla (marcar todas es idempotente)'
);
select ok((select leida from public.mis_notificaciones() where clave = 'tarea_vencida:0e0e0e0e-0000-0000-0004-000000000001'),
  'La notificación marcada vuelve como leída');
select is((select count(*)::int from public.mis_notificaciones() where not leida), 5, 'Las otras cinco siguen sin leer');
select throws_ok(
  $$ insert into public.notificaciones_leidas (usuario_id, clave) values ('0e0e0e0e-0000-0000-0000-000000000002', 'h:990002') $$,
  '42501', null, 'Nadie marca como leída una notificación de otro'
);
select throws_ok(
  $$ update public.notificaciones_leidas set clave = 'h:990002' $$,
  '42501', null, 'Las leídas no se editan'
);
select lives_ok(
  $$ select public.marcar_notificaciones_leidas(array['tarea_vencida:0e0e0e0e-0000-0000-0004-000000000001', 'h:990001']) $$,
  'Marcar varias de una vez, aunque alguna ya estuviera leída'
);
select is((select count(*)::int from public.mis_notificaciones() where not leida), 4, 'Queda una menos sin leer');
reset role;

-- ─── K1: consultor líder y autor del documento ──────────────────────────────
select set_config('request.jwt.claims', '{"sub":"0e0e0e0e-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select set_eq(
  'select clave from public.mis_notificaciones()',
  array['tarea_vencida:0e0e0e0e-0000-0000-0004-000000000001', 'h:990002', 'h:990003', 'h:990004', 'h:990007'],
  'K1 ve la vencida como líder y la corrección de su documento, pero no su propio documento por revisar'
);
reset role;

-- ─── A: admin de la consultoría ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"0e0e0e0e-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select set_eq(
  'select clave from public.mis_notificaciones()',
  array['doc_revision:0e0e0e0e-0000-0000-0005-000000000001:0.1', 'h:990002', 'h:990004', 'h:990007'],
  'El admin ve lo del equipo, no las tareas ajenas ni su propia devolución'
);
reset role;

-- ─── U: cliente de la empresa ───────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"0e0e0e0e-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select set_eq(
  'select clave from public.mis_notificaciones()',
  array['doc_revision:0e0e0e0e-0000-0000-0005-000000000001:0.1',
        'entregable_revision:0e0e0e0e-0000-0000-0006-000000000001', 'h:990003', 'h:990006'],
  'El cliente ve lo que tiene que aprobar y la corrección del documento, no sus propias acciones'
);
select is((select count(*)::int from public.notificaciones_leidas), 0, 'El cliente no ve las leídas de otros');
reset role;

-- ─── Sin nada que ver ───────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"0e0e0e0e-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select is_empty('select clave from public.mis_notificaciones()', 'El cliente de otra empresa no recibe nada');
reset role;

select set_config('request.jwt.claims', '{"sub":"0e0e0e0e-0000-0000-0000-000000000006","role":"authenticated"}', true);
set local role authenticated;
select is_empty('select clave from public.mis_notificaciones()', 'El admin de otra consultoría no recibe nada');
reset role;

select set_config('request.jwt.claims', '{"sub":"0e0e0e0e-0000-0000-0000-000000000007","role":"authenticated"}', true);
set local role authenticated;
select is_empty('select clave from public.mis_notificaciones()', 'El Admin PROCISO no recibe notificaciones operativas (ni de su propio documento)');
reset role;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok('select * from public.mis_notificaciones()', '42501', null, 'Sin sesión no hay notificaciones');
select throws_ok($$ select public.marcar_notificaciones_leidas(array['h:990001']) $$, '42501', null, 'Sin sesión no se marca nada');
reset role;

select * from finish();
rollback;
