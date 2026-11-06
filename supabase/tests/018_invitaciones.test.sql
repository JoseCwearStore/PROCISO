-- Invitaciones (bloque B, 2026-11-06). La Edge Function invitar-usuario es
-- delgada: pide permiso a la BD EN NOMBRE del admin (autorizar_invitacion) y,
-- con la clave secreta, invita y registra el perfil (registrar_invitado, que
-- SOLO puede ejecutar service_role). Las reglas viven acá y se prueban acá.

begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

-- Z admin PROCISO · A1 admin C1 · K1 consultor C1 · A2 admin C2
insert into auth.users (id, email, aud, role) values
  ('0b0b0b0b-0000-0000-0000-000000000001', 'z@iv.test',  'authenticated', 'authenticated'),
  ('0b0b0b0b-0000-0000-0000-000000000002', 'a1@iv.test', 'authenticated', 'authenticated'),
  ('0b0b0b0b-0000-0000-0000-000000000003', 'k1@iv.test', 'authenticated', 'authenticated'),
  ('0b0b0b0b-0000-0000-0000-000000000004', 'a2@iv.test', 'authenticated', 'authenticated');
insert into public.consultorias (id, nombre, activa) values
  ('0b0b0b0b-0000-0000-0001-000000000001', 'Consultoría IV 1', true),
  ('0b0b0b0b-0000-0000-0001-000000000002', 'Consultoría IV 2', true),
  ('0b0b0b0b-0000-0000-0001-000000000003', 'Consultoría IV suspendida', false);
insert into public.empresas (id, consultoria_id, nombre) values
  ('0b0b0b0b-0000-0000-0002-000000000001', '0b0b0b0b-0000-0000-0001-000000000001', 'Empresa IV 1'),
  ('0b0b0b0b-0000-0000-0002-000000000002', '0b0b0b0b-0000-0000-0001-000000000002', 'Empresa IV 2');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('0b0b0b0b-0000-0000-0000-000000000001', 'Z',  'z@iv.test',  'admin_prociso',     null, null),
  ('0b0b0b0b-0000-0000-0000-000000000002', 'A1', 'a1@iv.test', 'admin_consultoria', '0b0b0b0b-0000-0000-0001-000000000001', null),
  ('0b0b0b0b-0000-0000-0000-000000000003', 'K1', 'k1@iv.test', 'consultor',         '0b0b0b0b-0000-0000-0001-000000000001', null),
  ('0b0b0b0b-0000-0000-0000-000000000004', 'A2', 'a2@iv.test', 'admin_consultoria', '0b0b0b0b-0000-0000-0001-000000000002', null);

create function pg_temp.como(p_id text) returns void language sql as $$
  select set_config('request.jwt.claims', '{"sub":"' || p_id || '","role":"authenticated"}', true)
$$;

-- ─── autorizar_invitacion (la llama la Edge Function con el token del admin) ─
select pg_temp.como('0b0b0b0b-0000-0000-0000-000000000002');
set local role authenticated;
select is(
  public.autorizar_invitacion('Nuevo@IV.test ', 'consultor', '0b0b0b0b-0000-0000-0001-000000000001', null),
  '0b0b0b0b-0000-0000-0001-000000000001'::uuid,
  'El admin autoriza a un consultor para su consultoría (y devuelve la consultoría)'
);
select lives_ok(
  $$ select public.autorizar_invitacion('cliente@iv.test', 'usuario_cliente', '0b0b0b0b-0000-0000-0001-000000000001', '0b0b0b0b-0000-0000-0002-000000000001') $$,
  'El admin autoriza a un cliente de una empresa suya'
);
select throws_ok(
  $$ select public.autorizar_invitacion('x@iv.test', 'consultor', '0b0b0b0b-0000-0000-0001-000000000002', null) $$,
  '42501', null, 'Un admin no invita a otra consultoría'
);
select throws_ok(
  $$ select public.autorizar_invitacion('x@iv.test', 'usuario_cliente', '0b0b0b0b-0000-0000-0001-000000000001', '0b0b0b0b-0000-0000-0002-000000000002') $$,
  '22023', null, 'El cliente tiene que ser de una empresa de esa consultoría'
);
select throws_ok(
  $$ select public.autorizar_invitacion('x@iv.test', 'usuario_cliente', '0b0b0b0b-0000-0000-0001-000000000001', null) $$,
  '22023', null, 'Un cliente sin empresa no se invita'
);
select throws_ok(
  $$ select public.autorizar_invitacion('x@iv.test', 'admin_prociso', null, null) $$,
  '22023', null, 'Nadie invita a un Admin PROCISO desde la app'
);
select throws_ok(
  $$ select public.autorizar_invitacion('K1@iv.test', 'consultor', '0b0b0b0b-0000-0000-0001-000000000001', null) $$,
  '22023', null, 'No se invita un email que ya tiene usuario (sin importar mayúsculas)'
);
select throws_ok(
  $$ select public.autorizar_invitacion('sin-arroba', 'consultor', '0b0b0b0b-0000-0000-0001-000000000001', null) $$,
  '22023', null, 'El email tiene que tener forma de email'
);
reset role;

select pg_temp.como('0b0b0b0b-0000-0000-0000-000000000003');
set local role authenticated;
select throws_ok(
  $$ select public.autorizar_invitacion('x@iv.test', 'consultor', '0b0b0b0b-0000-0000-0001-000000000001', null) $$,
  '42501', null, 'Un consultor no invita'
);
reset role;

select pg_temp.como('0b0b0b0b-0000-0000-0000-000000000001');
set local role authenticated;
select lives_ok(
  $$ select public.autorizar_invitacion('x@iv.test', 'admin_consultoria', '0b0b0b0b-0000-0000-0001-000000000002', null) $$,
  'El Admin PROCISO invita en cualquier consultoría'
);
select throws_ok(
  $$ select public.autorizar_invitacion('x@iv.test', 'consultor', '0b0b0b0b-0000-0000-0001-000000000003', null) $$,
  '22023', null, 'No se invita gente a una consultoría suspendida'
);
-- registrar_invitado NO se ejecuta desde el navegador, ni siendo Admin PROCISO.
select throws_ok(
  $$ select public.registrar_invitado('0b0b0b0b-0000-0000-0000-000000000009', 'Nuevo', 'nuevo@iv.test', null, 'consultor',
       '0b0b0b0b-0000-0000-0001-000000000001', null, '0b0b0b0b-0000-0000-0000-000000000001') $$,
  '42501', null, 'registrar_invitado no se ejecuta con un token de usuario'
);
reset role;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok(
  $$ select public.autorizar_invitacion('x@iv.test', 'consultor', '0b0b0b0b-0000-0000-0001-000000000001', null) $$,
  '42501', null, 'Sin sesión no se autoriza nada'
);
reset role;

-- ─── registrar_invitado (la llama la Edge Function con la clave secreta) ────
-- Lo que hace inviteUserByEmail: el usuario de Auth existe recién DESPUÉS de autorizar.
insert into auth.users (id, email, aud, role) values
  ('0b0b0b0b-0000-0000-0000-000000000009', 'nuevo@iv.test', 'authenticated', 'authenticated');
select pg_temp.como('0b0b0b0b-0000-0000-0000-000000000002');
set local role authenticated;
select throws_ok(
  $$ select public.autorizar_invitacion('nuevo@iv.test', 'consultor', '0b0b0b0b-0000-0000-0001-000000000001', null) $$,
  '22023', null, 'Un email ya invitado (con usuario de Auth, aunque sin perfil) no se invita dos veces'
);
reset role;
set local role service_role;
select lives_ok(
  $$ select public.registrar_invitado('0b0b0b0b-0000-0000-0000-000000000009', ' Nuevo Consultor ', 'Nuevo@IV.test', 'Auditor', 'consultor',
       '0b0b0b0b-0000-0000-0001-000000000001', null, '0b0b0b0b-0000-0000-0000-000000000002') $$,
  'Con la clave secreta se registra el perfil del invitado'
);
reset role;

select is(
  (select row(nombre, email, rol, consultoria_id, password_temporal)::text from public.perfiles where id = '0b0b0b0b-0000-0000-0000-000000000009'),
  row('Nuevo Consultor', 'nuevo@iv.test', 'consultor', '0b0b0b0b-0000-0000-0001-000000000001'::uuid, true)::text,
  'El perfil queda normalizado y con contraseña por definir'
);
select is(
  (select row(accion, autor_id)::text from public.historial where entidad_tipo = 'usuario' and entidad_id = '0b0b0b0b-0000-0000-0000-000000000009'),
  row('Usuario invitado', '0b0b0b0b-0000-0000-0000-000000000002'::uuid)::text,
  'La invitación queda en el historial a nombre del admin que invitó'
);

-- Dos capas: aunque la función fuera ejecutable, el INSERT en perfiles está
-- revocado para usuarios. Este test fija la PRIMERA capa por sí sola.
select ok(
  not has_function_privilege('authenticated', 'public.registrar_invitado(uuid, text, text, text, text, uuid, uuid, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.registrar_invitado(uuid, text, text, text, text, uuid, uuid, uuid)', 'execute'),
  'registrar_invitado no es ejecutable por usuarios ni por anon (solo service_role)'
);

select * from finish();
rollback;
