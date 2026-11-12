-- L5a2 (AUD07-M2): soporte y reporte de errores de verdad (antes la pantalla descartaba el mensaje).
--   · Cualquier usuario con sesión activa envía un reporte; usuario y consultoría los pone la BD
--     (el cliente HTTP no puede enviarlo "a nombre de otro" ni en otra consultoría).
--   · Lo lee su autor, el Admin Consultoría de esa consultoría y el Admin PROCISO. Nadie más.
--   · Nadie edita ni borra un reporte; solo un admin lo marca "Atendido" con atender_reporte().
--   · Tope de 10 reportes por usuario en 24 horas.

begin;
create extension if not exists pgtap with schema extensions;

select plan(33);

-- K consultor C1 · A admin C1 · U cliente C1 · A2 admin C2 · AP admin PROCISO · UI cliente INACTIVO
insert into auth.users (id, email, aud, role)
select format('30303030-0000-0000-0000-%s', lpad(n::text, 12, '0'))::uuid, format('u%s@sop.test', n), 'authenticated', 'authenticated'
from unnest(array[1, 2, 3, 4, 5, 6]) as n;
insert into public.consultorias (id, nombre) values
  ('30303030-0000-0000-0001-000000000001', 'Consultoría C1'),
  ('30303030-0000-0000-0001-000000000002', 'Consultoría C2');
insert into public.empresas (id, consultoria_id, nombre) values
  ('30303030-0000-0000-0002-000000000001', '30303030-0000-0000-0001-000000000001', 'Empresa E1');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id, activo) values
  ('30303030-0000-0000-0000-000000000001', 'K',  'u1@sop.test', 'consultor',         '30303030-0000-0000-0001-000000000001', null, true),
  ('30303030-0000-0000-0000-000000000002', 'A',  'u2@sop.test', 'admin_consultoria', '30303030-0000-0000-0001-000000000001', null, true),
  ('30303030-0000-0000-0000-000000000003', 'U',  'u3@sop.test', 'usuario_cliente',   '30303030-0000-0000-0001-000000000001', '30303030-0000-0000-0002-000000000001', true),
  ('30303030-0000-0000-0000-000000000004', 'A2', 'u4@sop.test', 'admin_consultoria', '30303030-0000-0000-0001-000000000002', null, true),
  ('30303030-0000-0000-0000-000000000005', 'AP', 'u5@sop.test', 'admin_prociso',     null, null, true),
  ('30303030-0000-0000-0000-000000000006', 'UI', 'u6@sop.test', 'usuario_cliente',   '30303030-0000-0000-0001-000000000001', '30303030-0000-0000-0002-000000000001', false);

create function pg_temp.como(p_id text) returns void language sql as
  $$ select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', p_id), true) $$;
create function pg_temp.u(p_n int) returns text language sql as
  $$ select format('30303030-0000-0000-0000-%s', lpad(p_n::text, 12, '0')) $$;

-- ─── K (consultor) envía y no puede falsear nada ────────────────────────────
select pg_temp.como(pg_temp.u(1));
set local role authenticated;
select lives_ok(
  $$ insert into public.soporte_reportes (tipo, asunto, mensaje) values ('Error', 'R-K', 'No carga el tablero de tareas') $$,
  'Un consultor envía un reporte'
);
select is(
  (select row(usuario_id, consultoria_id, estado)::text from public.soporte_reportes where asunto = 'R-K'),
  '(30303030-0000-0000-0000-000000000001,30303030-0000-0000-0001-000000000001,Abierto)',
  'Nace Abierto, a su nombre y en su consultoría: lo decide la BD, no el cliente HTTP'
);
select throws_ok(
  $$ insert into public.soporte_reportes (tipo, asunto, mensaje, usuario_id) values ('Soporte', 'x', 'x', '30303030-0000-0000-0000-000000000003') $$,
  '42501', null, 'No puede enviar un reporte a nombre de otra persona'
);
select throws_ok(
  $$ insert into public.soporte_reportes (tipo, asunto, mensaje, consultoria_id) values ('Soporte', 'x', 'x', '30303030-0000-0000-0001-000000000002') $$,
  '42501', null, 'No puede fijar la consultoría del reporte'
);
select throws_ok(
  $$ insert into public.soporte_reportes (tipo, asunto, mensaje, estado) values ('Soporte', 'x', 'x', 'Atendido') $$,
  '42501', null, 'No puede crear un reporte ya Atendido'
);
select throws_ok(
  $$ update public.soporte_reportes set mensaje = 'editado' $$,
  '42501', null, 'Nadie edita un reporte después de enviarlo'
);
select throws_ok(
  $$ delete from public.soporte_reportes $$,
  '42501', null, 'Nadie borra un reporte'
);
reset role;

-- ─── Validaciones de forma ──────────────────────────────────────────────────
select pg_temp.como(pg_temp.u(1));
set local role authenticated;
select throws_ok($$ insert into public.soporte_reportes (tipo, asunto, mensaje) values ('Soporte', '   ', 'algo') $$,
  '23514', null, 'El asunto no puede venir vacío (ni solo espacios)');
select throws_ok(format($$ insert into public.soporte_reportes (tipo, asunto, mensaje) values ('Soporte', %L, 'algo') $$, repeat('a', 121)),
  '23514', null, 'El asunto tiene un máximo de 120 caracteres');
select throws_ok(format($$ insert into public.soporte_reportes (tipo, asunto, mensaje) values ('Soporte', 'ok', %L) $$, repeat('a', 2001)),
  '23514', null, 'El mensaje tiene un máximo de 2000 caracteres');
select throws_ok($$ insert into public.soporte_reportes (tipo, asunto, mensaje) values ('Chisme', 'ok', 'algo') $$,
  '23514', null, 'El tipo solo puede ser Soporte o Error');
reset role;

-- ─── U (cliente) y AP (Admin PROCISO) también envían ────────────────────────
select pg_temp.como(pg_temp.u(3));
set local role authenticated;
select lives_ok($$ insert into public.soporte_reportes (tipo, asunto, mensaje) values ('Soporte', 'R-U', 'No encuentro mis documentos') $$,
  'Un cliente envía un reporte');
reset role;
select pg_temp.como(pg_temp.u(5));
set local role authenticated;
select lives_ok($$ insert into public.soporte_reportes (tipo, asunto, mensaje) values ('Error', 'R-AP', 'Prueba del admin') $$,
  'El Admin PROCISO también envía');
select is((select consultoria_id is null from public.soporte_reportes where asunto = 'R-AP'), true,
  'El del Admin PROCISO no tiene consultoría (no pertenece a ninguna)');
reset role;

-- ─── Quién lee qué ──────────────────────────────────────────────────────────
select pg_temp.como(pg_temp.u(1));
set local role authenticated;
select is((select array_agg(asunto order by asunto)::text from public.soporte_reportes), '{R-K}', 'El consultor solo ve el suyo');
reset role;
select pg_temp.como(pg_temp.u(3));
set local role authenticated;
select is((select array_agg(asunto order by asunto)::text from public.soporte_reportes), '{R-U}', 'El cliente solo ve el suyo (nunca el de un consultor)');
reset role;
select pg_temp.como(pg_temp.u(2));
set local role authenticated;
select is((select array_agg(asunto order by asunto)::text from public.soporte_reportes), '{R-K,R-U}',
  'El Admin Consultoría ve los de su consultoría, no el del Admin PROCISO');
reset role;
select pg_temp.como(pg_temp.u(4));
set local role authenticated;
select is((select count(*)::int from public.soporte_reportes), 0, 'El admin de OTRA consultoría no ve ninguno');
reset role;
select pg_temp.como(pg_temp.u(5));
set local role authenticated;
select is((select array_agg(asunto order by asunto)::text from public.soporte_reportes), '{R-AP,R-K,R-U}', 'El Admin PROCISO ve todos');
reset role;

-- ─── Atender: solo admins, solo de su consultoría ───────────────────────────
create temp table ids as select asunto, id from public.soporte_reportes;
grant select on pg_temp.ids to authenticated, anon;

select pg_temp.como(pg_temp.u(1));
set local role authenticated;
select throws_ok($$ select public.atender_reporte((select id from pg_temp.ids where asunto = 'R-K')) $$, '42501', null, 'Un consultor no atiende reportes');
reset role;
select pg_temp.como(pg_temp.u(3));
set local role authenticated;
select throws_ok($$ select public.atender_reporte((select id from pg_temp.ids where asunto = 'R-K')) $$, '42501', null, 'Un cliente no atiende reportes');
reset role;
select pg_temp.como(pg_temp.u(4));
set local role authenticated;
select throws_ok($$ select public.atender_reporte((select id from pg_temp.ids where asunto = 'R-K')) $$, '22023', null,
  'El admin de otra consultoría recibe "no encontrado" (no se entera de que existe)');
reset role;
select pg_temp.como(pg_temp.u(2));
set local role authenticated;
select lives_ok($$ select public.atender_reporte((select id from pg_temp.ids where asunto = 'R-K')) $$, 'El Admin Consultoría atiende uno de su consultoría');
select is(
  (select row(estado, atendido_por, atendido_en is not null)::text from public.soporte_reportes where asunto = 'R-K'),
  '(Atendido,30303030-0000-0000-0000-000000000002,t)', 'Queda Atendido, con quién y cuándo'
);
select throws_ok($$ select public.atender_reporte((select id from pg_temp.ids where asunto = 'R-K')) $$, '22023', null, 'No se atiende dos veces');
select throws_ok($$ select public.atender_reporte('30303030-0000-0000-0009-000000000000') $$, '22023', null, 'Un id que no existe da "no encontrado"');
reset role;
select pg_temp.como(pg_temp.u(5));
set local role authenticated;
select lives_ok($$ select public.atender_reporte((select id from pg_temp.ids where asunto = 'R-U')) $$, 'El Admin PROCISO atiende cualquiera');
reset role;

-- ─── Tope: 10 por usuario en 24 horas ───────────────────────────────────────
insert into public.soporte_reportes (usuario_id, consultoria_id, tipo, asunto, mensaje)
select '30303030-0000-0000-0000-000000000001', '30303030-0000-0000-0001-000000000001', 'Soporte', 'relleno ' || n, 'x' from generate_series(1, 9) n;   -- K llega a 10
insert into public.soporte_reportes (usuario_id, consultoria_id, tipo, asunto, mensaje, creado_en)
select '30303030-0000-0000-0000-000000000003', '30303030-0000-0000-0001-000000000001', 'Soporte', 'ayer ' || n, 'x', now() - interval '25 hours' from generate_series(1, 20) n;   -- U: 20 de AYER

select pg_temp.como(pg_temp.u(1));
set local role authenticated;
select throws_ok(
  $$ insert into public.soporte_reportes (tipo, asunto, mensaje) values ('Soporte', 'uno más', 'x') $$,
  'LM429', 'Alcanzaste el máximo de 10 reportes de soporte por día. Inténtalo mañana.',
  'El reporte 11 de K en 24 horas se rechaza (el 10 sí pasó)'
);
reset role;
select pg_temp.como(pg_temp.u(3));
set local role authenticated;
select lives_ok($$ insert into public.soporte_reportes (tipo, asunto, mensaje) values ('Soporte', 'otro de U', 'x') $$,
  'Los reportes de hace más de 24 h no cuentan (y el tope de K no es el de U)');
reset role;

-- ─── anon y usuario inactivo ────────────────────────────────────────────────
set local role anon;
select throws_ok($$ insert into public.soporte_reportes (tipo, asunto, mensaje) values ('Soporte', 'x', 'x') $$, '42501', null, 'Un anónimo no envía');
select throws_ok($$ select count(*) from public.soporte_reportes $$, '42501', null, 'Un anónimo no lee');
reset role;
select pg_temp.como(pg_temp.u(6));
set local role authenticated;
select throws_ok($$ insert into public.soporte_reportes (tipo, asunto, mensaje) values ('Soporte', 'x', 'x') $$, '42501', null, 'Un usuario suspendido no envía');
reset role;

-- ─── Permisos de ejecución ──────────────────────────────────────────────────
select is(
  (select array[has_function_privilege('anon', 'public.atender_reporte(uuid)', 'execute'), has_function_privilege('authenticated', 'public.atender_reporte(uuid)', 'execute')]::text),
  '{f,t}', 'Solo un usuario con sesión puede ejecutar atender_reporte() (y adentro decide si es admin)'
);

select * from finish();
rollback;
