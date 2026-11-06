-- Administración de consultorías y usuarios (reglas elegidas el 2026-11-06):
--   · Consultorías: las crea y suspende SOLO el Admin PROCISO. Suspender una
--     consultoría BLOQUEA a su equipo y a sus clientes; reactivarla lo revierte.
--   · Usuarios: los administran el Admin PROCISO (todos) y el Admin Consultoría
--     (solo los suyos). Nadie se administra a sí mismo.
--   · Roles: solo dentro del equipo (consultor ↔ admin_consultoria). El cliente
--     sigue siendo cliente y nadie se vuelve Admin PROCISO desde la app.
--   · Todo deja historial.

begin;
create extension if not exists pgtap with schema extensions;

select plan(30);

-- Z admin PROCISO · A1 admin C1 · K1 y K3 consultores de C1 (K1 en P1) · U1 cliente E1
-- A2 admin C2
insert into auth.users (id, email, aud, role) values
  ('0c0c0c0c-0000-0000-0000-000000000001', 'z@ad.test',  'authenticated', 'authenticated'),
  ('0c0c0c0c-0000-0000-0000-000000000002', 'a1@ad.test', 'authenticated', 'authenticated'),
  ('0c0c0c0c-0000-0000-0000-000000000003', 'k1@ad.test', 'authenticated', 'authenticated'),
  ('0c0c0c0c-0000-0000-0000-000000000004', 'k3@ad.test', 'authenticated', 'authenticated'),
  ('0c0c0c0c-0000-0000-0000-000000000005', 'u1@ad.test', 'authenticated', 'authenticated'),
  ('0c0c0c0c-0000-0000-0000-000000000006', 'a2@ad.test', 'authenticated', 'authenticated');
insert into public.consultorias (id, nombre) values
  ('0c0c0c0c-0000-0000-0001-000000000001', 'Consultoría AD 1'),
  ('0c0c0c0c-0000-0000-0001-000000000002', 'Consultoría AD 2');
insert into public.empresas (id, consultoria_id, nombre) values
  ('0c0c0c0c-0000-0000-0002-000000000001', '0c0c0c0c-0000-0000-0001-000000000001', 'Empresa AD');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('0c0c0c0c-0000-0000-0000-000000000001', 'Z',  'z@ad.test',  'admin_prociso',     null, null),
  ('0c0c0c0c-0000-0000-0000-000000000002', 'A1', 'a1@ad.test', 'admin_consultoria', '0c0c0c0c-0000-0000-0001-000000000001', null),
  ('0c0c0c0c-0000-0000-0000-000000000003', 'K1', 'k1@ad.test', 'consultor',         '0c0c0c0c-0000-0000-0001-000000000001', null),
  ('0c0c0c0c-0000-0000-0000-000000000004', 'K3', 'k3@ad.test', 'consultor',         '0c0c0c0c-0000-0000-0001-000000000001', null),
  ('0c0c0c0c-0000-0000-0000-000000000005', 'U1', 'u1@ad.test', 'usuario_cliente',   '0c0c0c0c-0000-0000-0001-000000000001', '0c0c0c0c-0000-0000-0002-000000000001'),
  ('0c0c0c0c-0000-0000-0000-000000000006', 'A2', 'a2@ad.test', 'admin_consultoria', '0c0c0c0c-0000-0000-0001-000000000002', null);
insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('0c0c0c0c-0000-0000-0003-000000000001', '0c0c0c0c-0000-0000-0001-000000000001', '0c0c0c0c-0000-0000-0002-000000000001', 'P1 AD');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('0c0c0c0c-0000-0000-0003-000000000001', '0c0c0c0c-0000-0000-0000-000000000003', '0c0c0c0c-0000-0000-0001-000000000001');

-- Atajo para cambiar de usuario en sesión.
create function pg_temp.como(p_id text) returns void language sql as $$
  select set_config('request.jwt.claims', '{"sub":"' || p_id || '","role":"authenticated"}', true)
$$;

-- ─── Consultorías ───────────────────────────────────────────────────────────
select pg_temp.como('0c0c0c0c-0000-0000-0000-000000000002');
set local role authenticated;
select throws_ok(
  $$ insert into public.consultorias (nombre) values ('Por mi cuenta') $$,
  '42501', null, 'Un admin de consultoría no crea consultorías'
);
select throws_ok(
  $$ select public.cambiar_estado_consultoria('0c0c0c0c-0000-0000-0001-000000000001', false) $$,
  '42501', null, 'Un admin de consultoría no suspende consultorías (ni la suya)'
);
select throws_ok(
  $$ update public.consultorias set activa = false where id = '0c0c0c0c-0000-0000-0001-000000000001' $$,
  '42501', null, 'El estado no se cambia con un UPDATE directo (saltearía el historial)'
);
select throws_ok(
  $$ update public.consultorias set plan = 'Enterprise', limite_usuarios = 999 where id = '0c0c0c0c-0000-0000-0001-000000000001' $$,
  '42501', null, 'Un admin de consultoría no se sube el plan ni los límites'
);
select lives_ok(
  $$ update public.consultorias set contacto = 'Nueva persona', email = 'contacto@ad.test' where id = '0c0c0c0c-0000-0000-0001-000000000001' $$,
  'El admin sí actualiza los datos de contacto de su consultoría'
);
reset role;

select pg_temp.como('0c0c0c0c-0000-0000-0000-000000000001');
set local role authenticated;
select lives_ok(
  $$ insert into public.consultorias (id, nombre) values ('0c0c0c0c-0000-0000-0001-000000000099', 'Nueva AD') returning * $$,
  'El Admin PROCISO crea una consultoría (INSERT … RETURNING)'
);
select lives_ok(
  $$ select public.cambiar_estado_consultoria('0c0c0c0c-0000-0000-0001-000000000001', false) $$,
  'El Admin PROCISO suspende una consultoría'
);
select is((select count(*)::int from public.proyectos where consultoria_id = '0c0c0c0c-0000-0000-0001-000000000001'), 1,
  'El Admin PROCISO sigue viendo la consultoría suspendida');
reset role;

select pg_temp.como('0c0c0c0c-0000-0000-0000-000000000003');
set local role authenticated;
select is((select count(*)::int from public.proyectos), 0, 'Con la consultoría suspendida, su consultor no ve sus proyectos');
reset role;

select pg_temp.como('0c0c0c0c-0000-0000-0000-000000000005');
set local role authenticated;
select is((select count(*)::int from public.proyectos), 0, 'Con la consultoría suspendida, su cliente tampoco');
reset role;

select pg_temp.como('0c0c0c0c-0000-0000-0000-000000000002');
set local role authenticated;
select throws_ok(
  $$ insert into public.empresas (consultoria_id, nombre) values ('0c0c0c0c-0000-0000-0001-000000000001', 'Durante la suspensión') $$,
  '42501', null, 'Con la consultoría suspendida, su admin no escribe'
);
reset role;

select pg_temp.como('0c0c0c0c-0000-0000-0000-000000000001');
set local role authenticated;
select lives_ok(
  $$ select public.cambiar_estado_consultoria('0c0c0c0c-0000-0000-0001-000000000001', true) $$,
  'El Admin PROCISO reactiva la consultoría'
);
reset role;

select pg_temp.como('0c0c0c0c-0000-0000-0000-000000000003');
set local role authenticated;
select is((select count(*)::int from public.proyectos), 1, 'Al reactivarla, su consultor vuelve a ver sus proyectos');
reset role;

select is(
  (select array_agg(estado_nuevo order by id) from public.historial
    where entidad_tipo = 'consultoria' and entidad_id = '0c0c0c0c-0000-0000-0001-000000000001'),
  array['Suspendida', 'Activa'], 'La suspensión y la reactivación quedan en el historial');

-- ─── Usuarios ───────────────────────────────────────────────────────────────
select pg_temp.como('0c0c0c0c-0000-0000-0000-000000000002');
set local role authenticated;
select lives_ok(
  $$ select public.administrar_usuario('0c0c0c0c-0000-0000-0000-000000000003', null, false) $$,
  'El admin de la consultoría suspende a su consultor'
);
reset role;

select pg_temp.como('0c0c0c0c-0000-0000-0000-000000000003');
set local role authenticated;
select is((select count(*)::int from public.proyectos), 0, 'Un usuario suspendido no ve nada');
reset role;

select pg_temp.como('0c0c0c0c-0000-0000-0000-000000000002');
set local role authenticated;
select lives_ok(
  $$ select public.administrar_usuario('0c0c0c0c-0000-0000-0000-000000000003', null, true) $$,
  'El admin le restablece el acceso'
);
select lives_ok(
  $$ select public.administrar_usuario('0c0c0c0c-0000-0000-0000-000000000003', 'admin_consultoria', null) $$,
  'El admin asciende a su consultor a admin de la consultoría'
);
select throws_ok(
  $$ select public.administrar_usuario('0c0c0c0c-0000-0000-0000-000000000005', 'consultor', null) $$,
  '22023', null, 'Un cliente no pasa a ser del equipo (está atado a una empresa)'
);
select throws_ok(
  $$ select public.administrar_usuario('0c0c0c0c-0000-0000-0000-000000000004', 'admin_prociso', null) $$,
  '22023', null, 'Nadie se vuelve Admin PROCISO desde la app'
);
select throws_ok(
  $$ select public.administrar_usuario('0c0c0c0c-0000-0000-0000-000000000006', null, false) $$,
  '42501', null, 'Un admin no administra usuarios de otra consultoría'
);
select throws_ok(
  $$ select public.administrar_usuario('0c0c0c0c-0000-0000-0000-000000000002', null, false) $$,
  '22023', null, 'Nadie se suspende ni se cambia el rol a sí mismo'
);
select throws_ok(
  $$ select public.administrar_usuario('0c0c0c0c-0000-0000-0000-000000000004', null, null) $$,
  '22023', null, 'Hay que pedir algún cambio'
);
select throws_ok(
  $$ update public.perfiles set rol = 'admin_consultoria' where id = '0c0c0c0c-0000-0000-0000-000000000004' $$,
  '42501', null, 'El rol no se cambia con un UPDATE directo'
);
reset role;

select is((select rol from public.perfiles where id = '0c0c0c0c-0000-0000-0000-000000000003'), 'admin_consultoria',
  'El ascenso quedó guardado');
select is((select count(*)::int from public.historial where entidad_tipo = 'usuario' and entidad_id = '0c0c0c0c-0000-0000-0000-000000000003'), 3,
  'Suspender, restablecer y cambiar el rol quedan en el historial');

-- K3 (consultor) no administra a nadie
select pg_temp.como('0c0c0c0c-0000-0000-0000-000000000004');
set local role authenticated;
select throws_ok(
  $$ select public.administrar_usuario('0c0c0c0c-0000-0000-0000-000000000005', null, false) $$,
  '42501', null, 'Un consultor no administra usuarios'
);
reset role;

-- El Admin PROCISO administra en cualquier consultoría
select pg_temp.como('0c0c0c0c-0000-0000-0000-000000000001');
set local role authenticated;
select lives_ok(
  $$ select public.administrar_usuario('0c0c0c0c-0000-0000-0000-000000000006', null, false) $$,
  'El Admin PROCISO suspende a un admin de otra consultoría'
);
reset role;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok(
  $$ select public.administrar_usuario('0c0c0c0c-0000-0000-0000-000000000004', null, false) $$,
  '42501', null, 'Sin sesión no se administra nada'
);
select throws_ok(
  $$ select public.cambiar_estado_consultoria('0c0c0c0c-0000-0000-0001-000000000001', false) $$,
  '42501', null, 'Sin sesión no se suspende nada'
);
reset role;

select * from finish();
rollback;
