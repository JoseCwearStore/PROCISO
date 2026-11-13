-- O35 · Un proyecto no puede terminar antes de empezar. El formulario de "Nuevo proyecto" dejaba crear uno con la fecha fin
-- estimada anterior a la de inicio, y la BD lo aceptaba. Ahora lo rechaza `crear_proyecto` (con un mensaje claro) y, como
-- última defensa, un CHECK de la tabla. Las fechas siguen siendo opcionales (null) y una fecha fin igual a la de inicio vale.

begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

insert into auth.users (id, email, aud, role) values
  ('50505050-0000-0000-0000-000000000001', 'a@fp.test', 'authenticated', 'authenticated'),
  ('50505050-0000-0000-0000-000000000002', 'k@fp.test', 'authenticated', 'authenticated');
insert into public.consultorias (id, nombre) values ('50505050-0000-0000-0001-000000000001', 'Consultoría FP');
insert into public.empresas (id, consultoria_id, nombre) values
  ('50505050-0000-0000-0002-000000000001', '50505050-0000-0000-0001-000000000001', 'Empresa FP');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('50505050-0000-0000-0000-000000000001', 'A', 'a@fp.test', 'admin_consultoria', '50505050-0000-0000-0001-000000000001', null),
  ('50505050-0000-0000-0000-000000000002', 'K', 'k@fp.test', 'consultor',         '50505050-0000-0000-0001-000000000001', null);

select set_config('request.jwt.claims', '{"sub":"50505050-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$ select public.crear_proyecto('50505050-0000-0000-0002-000000000001', '50505050-0000-0000-0000-000000000002', 'Con fechas bien',
       null, null, 'ISO 9001:2026', '2026-12-01', '2027-06-30') $$,
  'Un proyecto con la fecha fin posterior al inicio se crea');
select lives_ok(
  $$ select public.crear_proyecto('50505050-0000-0000-0002-000000000001', '50505050-0000-0000-0000-000000000002', 'Mismo día',
       null, null, 'ISO 9001:2026', '2026-12-01', '2026-12-01') $$,
  'Una fecha fin igual a la de inicio vale');
select lives_ok(
  $$ select public.crear_proyecto('50505050-0000-0000-0002-000000000001', '50505050-0000-0000-0000-000000000002', 'Sin fechas',
       null, null, 'ISO 9001:2026', null, null) $$,
  'Las fechas siguen siendo opcionales');
select lives_ok(
  $$ select public.crear_proyecto('50505050-0000-0000-0002-000000000001', '50505050-0000-0000-0000-000000000002', 'Solo inicio',
       null, null, 'ISO 9001:2026', '2026-12-01', null) $$,
  'Con solo una de las dos fechas no hay nada que comparar');
select throws_ok(
  $$ select public.crear_proyecto('50505050-0000-0000-0002-000000000001', '50505050-0000-0000-0000-000000000002', 'Al revés',
       null, null, 'ISO 9001:2026', '2026-12-01', '2026-11-01') $$,
  '22023', 'La fecha fin estimada no puede ser anterior a la de inicio.',
  'Con la fecha fin anterior al inicio se rechaza, con un mensaje que lo dice');
reset role;

select is(
  (select count(*)::int from public.proyectos where empresa_id = '50505050-0000-0000-0002-000000000001'),
  4, 'El rechazado no dejó ningún proyecto (quedan solo los cuatro válidos)');
-- Última defensa: aunque algo escribiera directo en la tabla, el CHECK lo frena.
select throws_ok(
  $$ insert into public.proyectos (consultoria_id, empresa_id, nombre, fecha_inicio, fecha_fin_estimada)
     values ('50505050-0000-0000-0001-000000000001', '50505050-0000-0000-0002-000000000001', 'Directo', '2026-12-01', '2026-11-01') $$,
  '23514', null, 'La tabla también rechaza una fecha fin anterior al inicio');

select * from finish();
rollback;
