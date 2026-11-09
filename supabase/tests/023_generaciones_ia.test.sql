-- Generación de borradores con IA (B3, 2026-11-09).
-- Cada pedido a la Edge Function generar-documento se registra primero en
-- generaciones_ia: ese INSERT es la AUTORIZACIÓN (solo el equipo del proyecto, igual
-- que analizar-ia: consume la clave de IA de la consultoría) y deja auditoría.
--   · Solo el servidor (service_role) cambia el estado.
--   · El cliente no ve ni pide generaciones.

begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

-- K consultor miembro de P1 · KX consultor NO miembro · U cliente de E1 · A admin de la consultoría · AP admin PROCISO
insert into auth.users (id, email, aud, role) values
  ('23232323-0000-0000-0000-000000000001', 'k@gi.test',  'authenticated', 'authenticated'),
  ('23232323-0000-0000-0000-000000000002', 'kx@gi.test', 'authenticated', 'authenticated'),
  ('23232323-0000-0000-0000-000000000003', 'u@gi.test',  'authenticated', 'authenticated'),
  ('23232323-0000-0000-0000-000000000004', 'a@gi.test',  'authenticated', 'authenticated'),
  ('23232323-0000-0000-0000-000000000005', 'ap@gi.test', 'authenticated', 'authenticated');
insert into public.consultorias (id, nombre) values ('23232323-0000-0000-0001-000000000001', 'Consultoría GI');
insert into public.empresas (id, consultoria_id, nombre) values
  ('23232323-0000-0000-0002-000000000001', '23232323-0000-0000-0001-000000000001', 'Empresa GI');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('23232323-0000-0000-0000-000000000001', 'K',  'k@gi.test',  'consultor',         '23232323-0000-0000-0001-000000000001', null),
  ('23232323-0000-0000-0000-000000000002', 'KX', 'kx@gi.test', 'consultor',         '23232323-0000-0000-0001-000000000001', null),
  ('23232323-0000-0000-0000-000000000003', 'U',  'u@gi.test',  'usuario_cliente',   '23232323-0000-0000-0001-000000000001', '23232323-0000-0000-0002-000000000001'),
  ('23232323-0000-0000-0000-000000000004', 'A',  'a@gi.test',  'admin_consultoria', '23232323-0000-0000-0001-000000000001', null),
  ('23232323-0000-0000-0000-000000000005', 'AP', 'ap@gi.test', 'admin_prociso',     null, null);
insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('23232323-0000-0000-0003-000000000001', '23232323-0000-0000-0001-000000000001', '23232323-0000-0000-0002-000000000001', 'P GI');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('23232323-0000-0000-0003-000000000001', '23232323-0000-0000-0000-000000000001', '23232323-0000-0000-0001-000000000001');

create function pg_temp.como(p_id text) returns void language sql as
  $$ select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', p_id), true) $$;

-- ─── Anónimo ────────────────────────────────────────────────────────────────
set local role anon;
select throws_ok(
  $$ insert into public.generaciones_ia (consultoria_id, proyecto_id, plantilla)
     values ('23232323-0000-0000-0001-000000000001', '23232323-0000-0000-0003-000000000001', 'politica') $$,
  '42501', null, 'Un anónimo no puede pedir una generación'
);
reset role;

-- ─── K: consultor miembro ───────────────────────────────────────────────────
select pg_temp.como('23232323-0000-0000-0000-000000000001');
set local role authenticated;
select lives_ok(
  $$ insert into public.generaciones_ia (consultoria_id, proyecto_id, plantilla)
     values ('23232323-0000-0000-0001-000000000001', '23232323-0000-0000-0003-000000000001', 'politica') returning id $$,
  'El consultor del proyecto pide una generación (INSERT ... RETURNING)'
);
select is(
  (select row(estado, solicitado_por)::text from public.generaciones_ia),
  '(Pendiente,23232323-0000-0000-0000-000000000001)',
  'Nace Pendiente y a nombre de quien la pide'
);
select throws_ok(
  $$ insert into public.generaciones_ia (consultoria_id, proyecto_id, plantilla, estado)
     values ('23232323-0000-0000-0001-000000000001', '23232323-0000-0000-0003-000000000001', 'politica', 'Completado') $$,
  '42501', null, 'El usuario no puede fijar el estado'
);
select throws_ok(
  $$ update public.generaciones_ia set estado = 'Completado' $$,
  '42501', null, 'El usuario no puede cambiar el estado después'
);
select throws_ok(
  $$ insert into public.generaciones_ia (consultoria_id, proyecto_id, plantilla)
     values ('23232323-0000-0000-0001-000000000001', '23232323-0000-0000-0003-000000000001', '') $$,
  '23514', null, 'La plantilla no puede venir vacía'
);
select throws_ok(
  $$ insert into public.generaciones_ia (consultoria_id, proyecto_id, plantilla)
     values ('23232323-0000-0000-0001-000000000099', '23232323-0000-0000-0003-000000000001', 'politica') $$,
  '23503', null, 'La consultoría tiene que ser la del proyecto'
);
reset role;

-- ─── A: admin de la consultoría (equipo) ────────────────────────────────────
select pg_temp.como('23232323-0000-0000-0000-000000000004');
set local role authenticated;
select lives_ok(
  $$ insert into public.generaciones_ia (consultoria_id, proyecto_id, plantilla)
     values ('23232323-0000-0000-0001-000000000001', '23232323-0000-0000-0003-000000000001', 'alcance') $$,
  'El admin de la consultoría también pide'
);
reset role;

-- ─── Quienes NO pueden ──────────────────────────────────────────────────────
select pg_temp.como('23232323-0000-0000-0000-000000000003');
set local role authenticated;
select throws_ok(
  $$ insert into public.generaciones_ia (consultoria_id, proyecto_id, plantilla)
     values ('23232323-0000-0000-0001-000000000001', '23232323-0000-0000-0003-000000000001', 'politica') $$,
  '42501', null, 'El cliente no puede pedir una generación'
);
select is((select count(*)::int from public.generaciones_ia), 0, 'El cliente no ve las generaciones');
reset role;

select pg_temp.como('23232323-0000-0000-0000-000000000002');
set local role authenticated;
select throws_ok(
  $$ insert into public.generaciones_ia (consultoria_id, proyecto_id, plantilla)
     values ('23232323-0000-0000-0001-000000000001', '23232323-0000-0000-0003-000000000001', 'politica') $$,
  '42501', null, 'Un consultor que no es del proyecto no puede pedir'
);
reset role;

select pg_temp.como('23232323-0000-0000-0000-000000000005');
set local role authenticated;
select throws_ok(
  $$ insert into public.generaciones_ia (consultoria_id, proyecto_id, plantilla)
     values ('23232323-0000-0000-0001-000000000001', '23232323-0000-0000-0003-000000000001', 'politica') $$,
  '42501', null, 'El Admin PROCISO no gasta la clave de IA de una consultoría'
);
reset role;

-- ─── El servidor sí registra el resultado ───────────────────────────────────
set local role service_role;
select lives_ok(
  $$ update public.generaciones_ia set estado = 'Completado', proveedor = 'openai-compatible', modelo = 'm', completado_en = now() $$,
  'El servidor (service_role) registra el resultado'
);
reset role;

select * from finish();
rollback;
