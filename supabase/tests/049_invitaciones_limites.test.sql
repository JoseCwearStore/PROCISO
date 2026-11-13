-- AUD10-M7: invitar usuarios.
--   · Había que mirar el límite de usuarios de la consultoría (`limite_usuarios`, que ninguna regla aplicaba) y poner un
--     tope diario de invitaciones por administrador (el correo de invitación es un gasto y un riesgo de spam).
--   · Una invitación que moría entre `inviteUserByEmail` y `registrar_invitado` dejaba un usuario HUÉRFANO en Auth y el
--     reintento se rechazaba con "ese email ya tiene un usuario": se arreglaba a mano. Ahora un usuario de Auth sin perfil,
--     sin confirmar, sin haber entrado nunca y de hace más de 5 minutos se reconoce como huérfano y se puede re-invitar.

begin;
create extension if not exists pgtap with schema extensions;

select plan(23);

-- A1 admin de C1 (límite 4) · A2 admin de C2 (sin límite) · A3 admin de C3 (límite 50) · Z admin PROCISO
insert into auth.users (id, email, aud, role) values
  ('49494949-0000-0000-0000-000000000001', 'a1@lim.test', 'authenticated', 'authenticated'),
  ('49494949-0000-0000-0000-000000000002', 'a2@lim.test', 'authenticated', 'authenticated'),
  ('49494949-0000-0000-0000-000000000003', 'a3@lim.test', 'authenticated', 'authenticated'),
  ('49494949-0000-0000-0000-000000000004', 'z@lim.test',  'authenticated', 'authenticated'),
  ('49494949-0000-0000-0000-0000000000c1', 'c1@lim.test', 'authenticated', 'authenticated'),
  ('49494949-0000-0000-0000-0000000000c2', 'c2@lim.test', 'authenticated', 'authenticated'),
  ('49494949-0000-0000-0000-0000000000c3', 'c3@lim.test', 'authenticated', 'authenticated');
insert into public.consultorias (id, nombre, limite_usuarios) values
  ('49494949-0000-0000-0001-000000000001', 'Consultoría L1', 4),
  ('49494949-0000-0000-0001-000000000002', 'Consultoría L2', null),
  ('49494949-0000-0000-0001-000000000003', 'Consultoría L3', 50);
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id, activo) values
  ('49494949-0000-0000-0000-000000000001', 'A1', 'a1@lim.test', 'admin_consultoria', '49494949-0000-0000-0001-000000000001', null, true),
  ('49494949-0000-0000-0000-000000000002', 'A2', 'a2@lim.test', 'admin_consultoria', '49494949-0000-0000-0001-000000000002', null, true),
  ('49494949-0000-0000-0000-000000000003', 'A3', 'a3@lim.test', 'admin_consultoria', '49494949-0000-0000-0001-000000000003', null, true),
  ('49494949-0000-0000-0000-000000000004', 'Z',  'z@lim.test',  'admin_prociso',     null, null, true),
  ('49494949-0000-0000-0000-0000000000c1', 'C1', 'c1@lim.test', 'consultor', '49494949-0000-0000-0001-000000000001', null, true),
  ('49494949-0000-0000-0000-0000000000c2', 'C2', 'c2@lim.test', 'consultor', '49494949-0000-0000-0001-000000000001', null, true),
  -- Un perfil SUSPENDIDO no ocupa lugar del límite.
  ('49494949-0000-0000-0000-0000000000c3', 'C3', 'c3@lim.test', 'consultor', '49494949-0000-0000-0001-000000000001', null, false);

create function pg_temp.como(p_id text) returns void language sql as $$
  select set_config('request.jwt.claims', '{"sub":"' || p_id || '","role":"authenticated"}', true)
$$;

-- ─── Límite de usuarios de la consultoría (A1: 3 activos de 4) ──────────────
select pg_temp.como('49494949-0000-0000-0000-000000000001'); set local role authenticated;
select lives_ok(
  $$ select public.autorizar_invitacion('uno@lim.test', 'consultor', '49494949-0000-0000-0001-000000000001', null) $$,
  'Con 3 usuarios activos de 4 todavía se puede invitar a uno más (el suspendido no cuenta)');
reset role;
-- El invitado ya tiene su usuario y su perfil: la consultoría llega al límite.
insert into auth.users (id, email, aud, role) values
  ('49494949-0000-0000-0000-0000000000d1', 'uno@lim.test', 'authenticated', 'authenticated');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('49494949-0000-0000-0000-0000000000d1', 'Uno', 'uno@lim.test', 'consultor', '49494949-0000-0000-0001-000000000001', null);
select pg_temp.como('49494949-0000-0000-0000-000000000001'); set local role authenticated;
select throws_ok(
  $$ select public.autorizar_invitacion('dos@lim.test', 'consultor', '49494949-0000-0000-0001-000000000001', null) $$,
  'IV409', 'La consultoría alcanzó su límite de usuarios (4). Pide ampliarlo antes de invitar a más personas.',
  'Con el límite alcanzado no se invita a nadie más, y el mensaje dice cuánto es');
reset role;
select pg_temp.como('49494949-0000-0000-0000-000000000004'); set local role authenticated;
select throws_ok(
  $$ select public.autorizar_invitacion('dos@lim.test', 'consultor', '49494949-0000-0000-0001-000000000001', null) $$,
  'IV409', null, 'El límite también vale para el Admin PROCISO');
reset role;
select pg_temp.como('49494949-0000-0000-0000-000000000002'); set local role authenticated;
select lives_ok(
  $$ select public.autorizar_invitacion('tres@lim.test', 'consultor', '49494949-0000-0000-0001-000000000002', null) $$,
  'Una consultoría sin límite (null) invita sin tope de usuarios');
reset role;

-- ─── Tope diario de invitaciones por administrador ──────────────────────────
select is(private.tope_invitaciones(), 20, 'El tope diario es de 20 invitaciones por administrador');
select is(
  (select count(*)::int from private.pedidos_invitacion where admin_id = '49494949-0000-0000-0000-000000000001'),
  1, 'La invitación autorizada de A1 dejó UN pedido contado (la rechazada por el límite, ninguno)');
-- A3: 5 pedidos viejos (de hace más de 24 h, no cuentan) + (tope - 1) recientes.
insert into private.pedidos_invitacion (admin_id, creado_en)
select '49494949-0000-0000-0000-000000000003', case when n <= 5 then now() - interval '25 hours' else now() - interval '1 hour' end
from generate_series(1, 5 + private.tope_invitaciones() - 1) as n;
select pg_temp.como('49494949-0000-0000-0000-000000000003'); set local role authenticated;
select lives_ok(
  $$ select public.autorizar_invitacion('cuatro@lim.test', 'consultor', '49494949-0000-0000-0001-000000000003', null) $$,
  'Con (tope - 1) invitaciones de hoy todavía puede hacer la última (las de hace más de 24 h no cuentan)');
select throws_ok(
  $$ select public.autorizar_invitacion('cinco@lim.test', 'consultor', '49494949-0000-0000-0001-000000000003', null) $$,
  'IV429', 'Alcanzaste el tope diario de invitaciones (20). Inténtalo mañana.', 'Al llegar al tope del día se rechaza, y el mensaje dice cuánto es');
reset role;
select is(
  (select count(*)::int from private.pedidos_invitacion where admin_id = '49494949-0000-0000-0000-000000000003' and creado_en > now() - interval '24 hours'),
  private.tope_invitaciones(), 'La invitación rechazada por el tope no se cuenta');
select pg_temp.como('49494949-0000-0000-0000-000000000002'); set local role authenticated;
select lives_ok(
  $$ select public.autorizar_invitacion('seis@lim.test', 'consultor', '49494949-0000-0000-0001-000000000002', null) $$,
  'El tope es por administrador: A2 no invitó casi nada hoy y puede');
reset role;

-- Una invitación que la BD rechaza por otra regla (email repetido, rol) no gasta del tope.
select pg_temp.como('49494949-0000-0000-0000-000000000002'); set local role authenticated;
select throws_ok(
  $$ select public.autorizar_invitacion('A1@lim.test', 'consultor', '49494949-0000-0000-0001-000000000002', null) $$,
  '22023', null, 'Un email que ya tiene perfil se rechaza');
reset role;
select is(
  (select count(*)::int from private.pedidos_invitacion where admin_id = '49494949-0000-0000-0000-000000000002'),
  2, 'Los rechazos por otra regla no dejaron pedidos (A2 sigue con los 2 aceptados)');

-- ─── Usuario huérfano de Auth ───────────────────────────────────────────────
-- Un usuario de Auth que murió a medias: sin perfil, sin confirmar, sin entrar nunca, de hace 10 minutos.
insert into auth.users (id, email, aud, role, created_at) values
  ('49494949-0000-0000-0000-0000000000e1', 'huerfano@lim.test', 'authenticated', 'authenticated', now() - interval '10 minutes'),
  ('49494949-0000-0000-0000-0000000000e2', 'reciente@lim.test', 'authenticated', 'authenticated', now()),
  ('49494949-0000-0000-0000-0000000000e3', 'confirmado@lim.test', 'authenticated', 'authenticated', now() - interval '10 minutes');
update auth.users set email_confirmed_at = now() where id = '49494949-0000-0000-0000-0000000000e3';

select pg_temp.como('49494949-0000-0000-0000-000000000002'); set local role authenticated;
select lives_ok(
  $$ select public.autorizar_invitacion('huerfano@lim.test', 'consultor', '49494949-0000-0000-0001-000000000002', null) $$,
  'Un usuario de Auth huérfano (sin perfil, sin confirmar, de hace más de 5 minutos) se puede re-invitar');
select throws_ok(
  $$ select public.autorizar_invitacion('reciente@lim.test', 'consultor', '49494949-0000-0000-0001-000000000002', null) $$,
  '22023', null, 'Uno recién creado NO es huérfano: puede ser otra invitación en curso');
select throws_ok(
  $$ select public.autorizar_invitacion('confirmado@lim.test', 'consultor', '49494949-0000-0000-0001-000000000002', null) $$,
  '22023', null, 'Uno ya confirmado no es huérfano aunque no tenga perfil');
reset role;
set local role service_role;
select is(public.huerfano_de_invitacion(' Huerfano@LIM.test '), '49494949-0000-0000-0000-0000000000e1'::uuid,
  'La clave secreta encuentra al huérfano por su email (sin importar mayúsculas)');
select is(public.huerfano_de_invitacion('reciente@lim.test'), null, 'No devuelve al recién creado');
select is(public.huerfano_de_invitacion('confirmado@lim.test'), null, 'No devuelve al confirmado');
select is(public.huerfano_de_invitacion('a1@lim.test'), null, 'No devuelve a alguien que tiene perfil');
reset role;
select ok(
  not has_function_privilege('authenticated', 'public.huerfano_de_invitacion(text)', 'execute')
  and not has_function_privilege('anon', 'public.huerfano_de_invitacion(text)', 'execute'),
  'Solo la clave secreta ejecuta huerfano_de_invitacion (ningún usuario de la app)');
select ok(not has_table_privilege('authenticated', 'private.pedidos_invitacion', 'select, insert, update, delete'),
  'Un usuario autenticado no toca la tabla de pedidos de invitación');

-- M7 también cuenta con bloqueo: dos invitaciones a la vez no se ven entre sí (la prueba con dos conexiones es
-- herramientas/probar_concurrencia_topes.mjs). Aquí se fija que el bloqueo esté puesto y vaya ANTES de contar.
select ok(
  strpos(pg_get_functiondef('public.autorizar_invitacion(text,text,uuid,uuid)'::regprocedure), 'hashtextextended(''invitacion:consultoria:''') > 0
  and strpos(pg_get_functiondef('public.autorizar_invitacion(text,text,uuid,uuid)'::regprocedure), 'hashtextextended(''invitacion:consultoria:''')
    < strpos(pg_get_functiondef('public.autorizar_invitacion(text,text,uuid,uuid)'::regprocedure), 'limite_usuarios'),
  'El límite de usuarios se mira con bloqueo por consultoría, tomado antes de contar');
select ok(
  strpos(pg_get_functiondef('public.autorizar_invitacion(text,text,uuid,uuid)'::regprocedure), 'hashtextextended(''invitacion:admin:''') > 0
  and strpos(pg_get_functiondef('public.autorizar_invitacion(text,text,uuid,uuid)'::regprocedure), 'hashtextextended(''invitacion:admin:''')
    < strpos(pg_get_functiondef('public.autorizar_invitacion(text,text,uuid,uuid)'::regprocedure), 'from private.pedidos_invitacion'),
  'El tope diario por administrador se mira con bloqueo, tomado antes de contar');

select * from finish();
rollback;
