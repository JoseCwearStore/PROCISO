-- La app crea filas con INSERT ... RETURNING (supabase-js: insert().select()).
-- Para devolver la fila, Postgres también evalúa la política de SELECT: si esa
-- política busca la fila en la tabla, no la encuentra (todavía no es visible
-- en el snapshot de la sentencia) y el INSERT falla con 42501.

begin;
create extension if not exists pgtap with schema extensions;

select plan(4);

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

-- Sin `id`, como hace la app: desde L1 el INSERT de proyectos tiene permisos por columna
-- y el id sale del default.
select lives_ok(
  $$ insert into public.proyectos (consultoria_id, empresa_id, consultor_id, nombre)
     values ('f6f6f6f6-0000-0000-0000-000000000001',
             'f7f7f7f7-0000-0000-0000-000000000001', 'fcfcfcfc-0000-0000-0000-000000000002', 'Nuevo proyecto') returning id $$,
  'El admin puede crear un proyecto y recibirlo de vuelta (RETURNING)'
);
-- Se fija un id conocido (como postgres) para los chequeos que siguen.
reset role;
update public.proyectos set id = 'f8f8f8f8-0000-0000-0000-000000000001' where nombre = 'Nuevo proyecto';
select set_config('request.jwt.claims', '{"sub":"fcfcfcfc-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$ insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id)
     values ('f8f8f8f8-0000-0000-0000-000000000001', 'fcfcfcfc-0000-0000-0000-000000000002',
             'f6f6f6f6-0000-0000-0000-000000000001') returning proyecto_id $$,
  'El admin puede asignar al consultor y recibir la fila de vuelta (RETURNING)'
);
reset role;

-- El consultor asignado ve el proyecto nuevo.
select set_config('request.jwt.claims', '{"sub":"fcfcfcfc-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*) from public.proyectos where id = 'f8f8f8f8-0000-0000-0000-000000000001'),
  1::bigint,
  'El consultor asignado ve el proyecto recién creado'
);
reset role;

select * from finish();
rollback;
