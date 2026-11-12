-- La app crea filas con INSERT ... RETURNING (supabase-js: insert().select()).
-- Para devolver la fila, Postgres también evalúa la política de SELECT: si esa
-- política busca la fila en la tabla, no la encuentra (todavía no es visible
-- en el snapshot de la sentencia) y el INSERT falla con 42501.

begin;
create extension if not exists pgtap with schema extensions;

select plan(4);   -- empresas RETURNING · crear_proyecto · consultor asignado · el consultor lo ve

insert into auth.users (id, email, aud, role) values
  ('fcfcfcfc-0000-0000-0000-000000000001', 'admin@ret.test', 'authenticated', 'authenticated'),
  ('fcfcfcfc-0000-0000-0000-000000000002', 'consultor@ret.test', 'authenticated', 'authenticated');

insert into public.consultorias (id, nombre) values ('f6f6f6f6-0000-0000-0000-000000000001', 'Consultoría Returning');
insert into public.empresas (id, consultoria_id, nombre) values
  ('f7f7f7f7-0000-0000-0000-000000000001', 'f6f6f6f6-0000-0000-0000-000000000001', 'Empresa Returning');
insert into public.perfiles (id, nombre, email, rol, consultoria_id) values
  ('fcfcfcfc-0000-0000-0000-000000000001', 'Admin', 'admin@ret.test', 'admin_consultoria', 'f6f6f6f6-0000-0000-0000-000000000001'),
  ('fcfcfcfc-0000-0000-0000-000000000002', 'Consultor', 'consultor@ret.test', 'consultor', 'f6f6f6f6-0000-0000-0000-000000000001');

select set_config('request.jwt.claims', '{"sub":"fcfcfcfc-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$ insert into public.empresas (consultoria_id, nombre)
     values ('f6f6f6f6-0000-0000-0000-000000000001', 'Nueva empresa') returning id $$,
  'El admin puede crear una empresa y recibirla de vuelta (RETURNING)'
);

-- Desde L5d los proyectos NO se insertan por la API: se crean con crear_proyecto(), que devuelve la
-- fila y asigna al consultor responsable en la MISMA transacción (el RETURNING ya no aplica).
select lives_ok(
  $$ select public.crear_proyecto(p_empresa_id => 'f7f7f7f7-0000-0000-0000-000000000001',
       p_consultor_id => 'fcfcfcfc-0000-0000-0000-000000000002', p_nombre => 'Nuevo proyecto') $$,
  'El admin crea un proyecto con crear_proyecto y recibe la fila de vuelta'
);
select is(
  (select count(*)::int from public.proyecto_miembros where usuario_id = 'fcfcfcfc-0000-0000-0000-000000000002'), 1,
  'El consultor responsable quedó asignado en la misma operación'
);
reset role;

-- El consultor asignado ve el proyecto nuevo.
select set_config('request.jwt.claims', '{"sub":"fcfcfcfc-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*) from public.proyectos where nombre = 'Nuevo proyecto'),
  1::bigint,
  'El consultor asignado ve el proyecto recién creado'
);
reset role;

select * from finish();
rollback;
