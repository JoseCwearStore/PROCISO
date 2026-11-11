-- L3 · Visibilidad (D1, D3, D4 · AUD01-M3, M5).
--   · D1: el cliente ve solo las tareas asignadas a usuarios de SU empresa (y sus comentarios e historial);
--   · D3: los perfiles de cliente los ve solo quien trabaja con esa empresa; el cliente no lee las tablas
--     consultorias ni empresas (usa vistas mínimas: sin plan/RFC de la consultoría ni observaciones internas);
--   · D4: solo el Admin PROCISO borra empresas (el resto archiva).

begin;
create extension if not exists pgtap with schema extensions;

select plan(30);

-- ap admin PROCISO · ad admin de la consultoría · ka consultor miembro de P1 (empresa E1)
-- kc consultor asignado a E2 (sin ser miembro) · u1 y u1b clientes de E1 · u2 cliente de E2
insert into auth.users (id, email, aud, role) values
  ('e6e6e6e6-0000-0000-0000-000000000001', 'ap@vis.test',  'authenticated', 'authenticated'),
  ('e6e6e6e6-0000-0000-0000-000000000002', 'ad@vis.test',  'authenticated', 'authenticated'),
  ('e6e6e6e6-0000-0000-0000-000000000003', 'ka@vis.test',  'authenticated', 'authenticated'),
  ('e6e6e6e6-0000-0000-0000-000000000004', 'kc@vis.test',  'authenticated', 'authenticated'),
  ('e6e6e6e6-0000-0000-0000-000000000005', 'u1@vis.test',  'authenticated', 'authenticated'),
  ('e6e6e6e6-0000-0000-0000-000000000006', 'u1b@vis.test', 'authenticated', 'authenticated'),
  ('e6e6e6e6-0000-0000-0000-000000000007', 'u2@vis.test',  'authenticated', 'authenticated');
insert into public.consultorias (id, nombre, rfc, plan) values
  ('e6e6e6e6-0001-0000-0000-000000000001', 'Consultoría VIS', 'RFCSECRETO1', 'Premium');
insert into public.empresas (id, consultoria_id, nombre, observaciones) values
  ('e6e6e6e6-0002-0000-0000-000000000001', 'e6e6e6e6-0001-0000-0000-000000000001', 'E1', 'Nota interna del consultor'),
  ('e6e6e6e6-0002-0000-0000-000000000002', 'e6e6e6e6-0001-0000-0000-000000000001', 'E2', null),
  ('e6e6e6e6-0002-0000-0000-000000000003', 'e6e6e6e6-0001-0000-0000-000000000001', 'E3 vacía', null);
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('e6e6e6e6-0000-0000-0000-000000000001', 'AP',  'ap@vis.test',  'admin_prociso',     null,                                    null),
  ('e6e6e6e6-0000-0000-0000-000000000002', 'AD',  'ad@vis.test',  'admin_consultoria', 'e6e6e6e6-0001-0000-0000-000000000001', null),
  ('e6e6e6e6-0000-0000-0000-000000000003', 'KA',  'ka@vis.test',  'consultor',         'e6e6e6e6-0001-0000-0000-000000000001', null),
  ('e6e6e6e6-0000-0000-0000-000000000004', 'KC',  'kc@vis.test',  'consultor',         'e6e6e6e6-0001-0000-0000-000000000001', null),
  ('e6e6e6e6-0000-0000-0000-000000000005', 'U1',  'u1@vis.test',  'usuario_cliente',   'e6e6e6e6-0001-0000-0000-000000000001', 'e6e6e6e6-0002-0000-0000-000000000001'),
  ('e6e6e6e6-0000-0000-0000-000000000006', 'U1B', 'u1b@vis.test', 'usuario_cliente',   'e6e6e6e6-0001-0000-0000-000000000001', 'e6e6e6e6-0002-0000-0000-000000000001'),
  ('e6e6e6e6-0000-0000-0000-000000000007', 'U2',  'u2@vis.test',  'usuario_cliente',   'e6e6e6e6-0001-0000-0000-000000000001', 'e6e6e6e6-0002-0000-0000-000000000002');
update public.empresas set consultor_asignado_id = 'e6e6e6e6-0000-0000-0000-000000000004' where id = 'e6e6e6e6-0002-0000-0000-000000000002';
insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('e6e6e6e6-0003-0000-0000-000000000001', 'e6e6e6e6-0001-0000-0000-000000000001', 'e6e6e6e6-0002-0000-0000-000000000001', 'P1'),
  ('e6e6e6e6-0003-0000-0000-000000000002', 'e6e6e6e6-0001-0000-0000-000000000001', 'e6e6e6e6-0002-0000-0000-000000000002', 'P2');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('e6e6e6e6-0003-0000-0000-000000000001', 'e6e6e6e6-0000-0000-0000-000000000003', 'e6e6e6e6-0001-0000-0000-000000000001');

-- Tareas: una del equipo, dos de clientes de E1 (u1 y su colega u1b) y una de E2.
insert into public.tareas (id, consultoria_id, proyecto_id, titulo, asignado_a, asignado_por, fecha_vencimiento) values
  ('e6e6e6e6-0004-0000-0000-000000000001', 'e6e6e6e6-0001-0000-0000-000000000001', 'e6e6e6e6-0003-0000-0000-000000000001', 'T equipo',  'e6e6e6e6-0000-0000-0000-000000000003', 'e6e6e6e6-0000-0000-0000-000000000003', current_date + 5),
  ('e6e6e6e6-0004-0000-0000-000000000002', 'e6e6e6e6-0001-0000-0000-000000000001', 'e6e6e6e6-0003-0000-0000-000000000001', 'T cliente u1',  'e6e6e6e6-0000-0000-0000-000000000005', 'e6e6e6e6-0000-0000-0000-000000000003', current_date + 5),
  ('e6e6e6e6-0004-0000-0000-000000000003', 'e6e6e6e6-0001-0000-0000-000000000001', 'e6e6e6e6-0003-0000-0000-000000000001', 'T cliente u1b', 'e6e6e6e6-0000-0000-0000-000000000006', 'e6e6e6e6-0000-0000-0000-000000000003', current_date + 5),
  ('e6e6e6e6-0004-0000-0000-000000000004', 'e6e6e6e6-0001-0000-0000-000000000001', 'e6e6e6e6-0003-0000-0000-000000000002', 'T cliente u2',  'e6e6e6e6-0000-0000-0000-000000000007', 'e6e6e6e6-0000-0000-0000-000000000004', current_date + 5);
insert into public.comentarios (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, texto) values
  ('e6e6e6e6-0001-0000-0000-000000000001', 'e6e6e6e6-0003-0000-0000-000000000001', 'tarea', 'e6e6e6e6-0004-0000-0000-000000000001', 'e6e6e6e6-0000-0000-0000-000000000003', 'Comentario interno del equipo'),
  ('e6e6e6e6-0001-0000-0000-000000000001', 'e6e6e6e6-0003-0000-0000-000000000001', 'tarea', 'e6e6e6e6-0004-0000-0000-000000000002', 'e6e6e6e6-0000-0000-0000-000000000003', 'Comentario para el cliente');
insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, estado_nuevo) values
  ('e6e6e6e6-0001-0000-0000-000000000001', 'e6e6e6e6-0003-0000-0000-000000000001', 'tarea', 'e6e6e6e6-0004-0000-0000-000000000001', 'e6e6e6e6-0000-0000-0000-000000000003', 'Cambio de estado equipo', 'En proceso'),
  ('e6e6e6e6-0001-0000-0000-000000000001', 'e6e6e6e6-0003-0000-0000-000000000001', 'tarea', 'e6e6e6e6-0004-0000-0000-000000000002', 'e6e6e6e6-0000-0000-0000-000000000003', 'Cambio de estado cliente', 'En proceso');

-- ═══ D1: tareas del cliente ═════════════════════════════════════════════════
select set_config('request.jwt.claims', '{"sub":"e6e6e6e6-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select array_agg(titulo order by titulo) from public.tareas),
  array['T cliente u1', 'T cliente u1b'],
  'El cliente ve las tareas de su empresa (la suya y la de su colega) y NO las del equipo ni las de otra empresa'
);
select is(
  (select array_agg(texto) from public.comentarios where entidad_tipo = 'tarea'),
  array['Comentario para el cliente'],
  'Solo ve los comentarios de las tareas que puede ver'
);
select is(
  (select array_agg(accion) from public.historial where entidad_tipo = 'tarea'),
  array['Cambio de estado cliente'],
  'Solo ve el historial de las tareas que puede ver'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"e6e6e6e6-0000-0000-0000-000000000007","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select array_agg(titulo) from public.tareas),
  array['T cliente u2'], 'El cliente de otra empresa ve solo lo suyo'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"e6e6e6e6-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select array_agg(titulo order by titulo) from public.tareas),
  array['T cliente u1', 'T cliente u1b', 'T equipo'], 'Control: el consultor del proyecto sigue viendo todas las de su proyecto'
);
select lives_ok(
  $$ insert into public.tareas (consultoria_id, proyecto_id, titulo, asignado_a, fecha_vencimiento)
     values ('e6e6e6e6-0001-0000-0000-000000000001', 'e6e6e6e6-0003-0000-0000-000000000001', 'Nueva', 'e6e6e6e6-0000-0000-0000-000000000005', current_date + 3)
     returning * $$,
  'Control: el equipo sigue creando tareas (INSERT … RETURNING)'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"e6e6e6e6-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*) from public.tareas), 5::bigint, 'Control: el admin de la consultoría ve todas'
);
reset role;

-- ═══ D3: perfiles ═══════════════════════════════════════════════════════════
select set_config('request.jwt.claims', '{"sub":"e6e6e6e6-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select array_agg(nombre order by nombre) from public.perfiles where rol = 'usuario_cliente'),
  array['U1', 'U1B'], 'El consultor ve los clientes de las empresas donde trabaja, no los de otras'
);
select is(
  (select count(*) from public.perfiles where rol <> 'usuario_cliente'), 3::bigint, 'Y sigue viendo al equipo de su consultoría (AD, KA y KC)'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"e6e6e6e6-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select array_agg(nombre) from public.perfiles where rol = 'usuario_cliente'),
  array['U2'], 'El consultor asignado a E2 (sin ser miembro) ve a los clientes de E2'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"e6e6e6e6-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*) from public.perfiles where rol = 'usuario_cliente'), 3::bigint, 'El admin de la consultoría ve a todos los clientes'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"e6e6e6e6-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select array_agg(nombre order by nombre) from public.perfiles where rol = 'usuario_cliente'),
  array['U1', 'U1B'], 'El cliente ve a sus colegas de empresa y no a los clientes de otra'
);
select is(
  (select count(*) from public.perfiles where rol in ('consultor', 'admin_consultoria')), 3::bigint, 'El cliente sigue viendo al equipo de su consultoría'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"e6e6e6e6-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*) from public.perfiles where id::text like 'e6e6e6e6-%'), 7::bigint, 'Control: el Admin PROCISO ve todos'
);
reset role;

-- ═══ D3: consultorías y empresas para el cliente ════════════════════════════
select set_config('request.jwt.claims', '{"sub":"e6e6e6e6-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.consultorias), 0::bigint, 'El cliente no lee la tabla consultorias (plan, RFC, cuotas)');
select is(
  (select array[nombre, coalesce(rfc, 'NULO'), coalesce(plan, 'NULO')] from public.mi_consultoria),
  array['Consultoría VIS', 'NULO', ''], 'Su vista mínima de la consultoría solo trae el nombre (sin RFC ni plan)'
);
select is((select count(*) from public.empresas), 0::bigint, 'El cliente no lee la tabla empresas');
select is(
  (select array[nombre, coalesce(observaciones, 'NULO')] from public.mi_empresa),
  array['E1', 'NULO'], 'Su vista de empresa trae sus datos pero NO las observaciones internas'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"e6e6e6e6-0000-0000-0000-000000000007","role":"authenticated"}', true);
set local role authenticated;
select is((select array_agg(nombre) from public.mi_empresa), array['E2'], 'Cada cliente ve únicamente SU empresa en la vista');
-- Una vista simple es actualizable y corre con los permisos de su dueño: tiene que ser solo lectura.
select throws_ok($$ update public.mi_empresa set nombre = 'Hackeada' $$, '42501', null, 'La vista de empresa es de solo lectura (no se escribe a través de ella)');
select throws_ok($$ delete from public.mi_consultoria $$, '42501', null, 'La vista de consultoría tampoco admite escrituras');
reset role;

set local role anon;
select throws_ok($$ select * from public.mi_empresa $$, '42501', null, 'Un anónimo no lee la vista de empresa');
select throws_ok($$ select * from public.mi_consultoria $$, '42501', null, 'Ni la de consultoría');
reset role;
-- Lo anterior también fallaría por otra razón (anon no entra al esquema private): se verifica el privilegio mismo.
select is(has_table_privilege('anon', 'public.mi_empresa', 'select'), false, 'anon no tiene privilegio de lectura sobre la vista de empresa');
select is(has_table_privilege('anon', 'public.mi_consultoria', 'select'), false, 'ni sobre la vista de consultoría');

select set_config('request.jwt.claims', '{"sub":"e6e6e6e6-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select observaciones from public.empresas where id = 'e6e6e6e6-0002-0000-0000-000000000001'),
  'Nota interna del consultor', 'Control: el equipo sí lee las observaciones'
);
select is((select count(*) from public.consultorias), 1::bigint, 'Control: el equipo sí lee su consultoría');
reset role;

-- ═══ D4: borrar empresas ════════════════════════════════════════════════════
select set_config('request.jwt.claims', '{"sub":"e6e6e6e6-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
delete from public.empresas where id = 'e6e6e6e6-0002-0000-0000-000000000003';
select lives_ok(
  $$ update public.empresas set activa = false where id = 'e6e6e6e6-0002-0000-0000-000000000003' $$,
  'Control: el admin de la consultoría sí archiva (activa=false)'
);
reset role;
select is(
  (select count(*) from public.empresas where id = 'e6e6e6e6-0002-0000-0000-000000000003'),
  1::bigint, 'El admin de la consultoría NO borra empresas (solo archiva)'
);
select set_config('request.jwt.claims', '{"sub":"e6e6e6e6-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
delete from public.empresas where id = 'e6e6e6e6-0002-0000-0000-000000000003';
reset role;
select is(
  (select count(*) from public.empresas where id = 'e6e6e6e6-0002-0000-0000-000000000003'),
  0::bigint, 'El Admin PROCISO sí puede borrarla'
);

select * from finish();
rollback;
