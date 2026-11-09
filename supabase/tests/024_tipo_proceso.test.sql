-- Tipo de proceso (B4, 2026-11-09): Estratégico, Operativo o Apoyo. Sirve para clasificar
-- el Mapa de procesos. Es OPCIONAL (los procesos ya levantados no lo tienen) y lo guarda
-- guardar_proceso, que sigue siendo SECURITY INVOKER: el RLS decide quién escribe.

begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

-- K consultor asignado · U cliente de la empresa
insert into auth.users (id, email, aud, role) values
  ('24242424-0000-0000-0000-000000000001', 'k@tp.test', 'authenticated', 'authenticated'),
  ('24242424-0000-0000-0000-000000000003', 'u@tp.test', 'authenticated', 'authenticated');
insert into public.consultorias (id, nombre) values ('24242424-0000-0000-0001-000000000001', 'Consultoría TP');
insert into public.empresas (id, consultoria_id, nombre) values
  ('24242424-0000-0000-0002-000000000001', '24242424-0000-0000-0001-000000000001', 'Empresa TP');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('24242424-0000-0000-0000-000000000001', 'K', 'k@tp.test', 'consultor',       '24242424-0000-0000-0001-000000000001', null),
  ('24242424-0000-0000-0000-000000000003', 'U', 'u@tp.test', 'usuario_cliente', '24242424-0000-0000-0001-000000000001', '24242424-0000-0000-0002-000000000001');
insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('24242424-0000-0000-0003-000000000001', '24242424-0000-0000-0001-000000000001', '24242424-0000-0000-0002-000000000001', 'P TP');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('24242424-0000-0000-0003-000000000001', '24242424-0000-0000-0000-000000000001', '24242424-0000-0000-0001-000000000001');

select set_config('request.jwt.claims', '{"sub":"24242424-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$ select public.guardar_proceso(
       '{"id":"24242424-0000-0000-0004-000000000001","proyecto_id":"24242424-0000-0000-0003-000000000001","nombre":"Compras","estado":"Pendiente","tipo":"Operativo"}'::jsonb,
       '[]'::jsonb) $$,
  'El consultor guarda un proceso con tipo Operativo'
);
reset role;
select is((select tipo from public.procesos where id = '24242424-0000-0000-0004-000000000001'), 'Operativo', 'Queda guardado el tipo');

select set_config('request.jwt.claims', '{"sub":"24242424-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.guardar_proceso(
       '{"id":"24242424-0000-0000-0004-000000000001","proyecto_id":"24242424-0000-0000-0003-000000000001","nombre":"Compras","estado":"Pendiente","tipo":"Apoyo"}'::jsonb,
       '[]'::jsonb) $$,
  'Al volver a guardar se puede cambiar el tipo'
);
reset role;
select is((select tipo from public.procesos where id = '24242424-0000-0000-0004-000000000001'), 'Apoyo', 'El tipo se actualizó');

select set_config('request.jwt.claims', '{"sub":"24242424-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.guardar_proceso(
       '{"id":"24242424-0000-0000-0004-000000000001","proyecto_id":"24242424-0000-0000-0003-000000000001","nombre":"Compras","estado":"Pendiente","tipo":""}'::jsonb,
       '[]'::jsonb) $$,
  'Un tipo vacío se acepta (el tipo es opcional)'
);
reset role;
select is((select tipo from public.procesos where id = '24242424-0000-0000-0004-000000000001'), null, 'El tipo vacío queda sin definir (NULL)');

select set_config('request.jwt.claims', '{"sub":"24242424-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.guardar_proceso(
       '{"id":"24242424-0000-0000-0004-000000000002","proyecto_id":"24242424-0000-0000-0003-000000000001","nombre":"Sin tipo","estado":"Pendiente"}'::jsonb,
       '[]'::jsonb) $$,
  'Un proceso sin la clave tipo (como los de antes) se sigue guardando'
);
select throws_ok(
  $$ select public.guardar_proceso(
       '{"id":"24242424-0000-0000-0004-000000000003","proyecto_id":"24242424-0000-0000-0003-000000000001","nombre":"X","estado":"Pendiente","tipo":"Inventado"}'::jsonb,
       '[]'::jsonb) $$,
  '23514', null, 'Un tipo inventado se rechaza'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"24242424-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.guardar_proceso(
       '{"id":"24242424-0000-0000-0004-000000000004","proyecto_id":"24242424-0000-0000-0003-000000000001","nombre":"Y","estado":"Pendiente","tipo":"Operativo"}'::jsonb,
       '[]'::jsonb) $$,
  '42501', null, 'El cliente no puede guardar procesos'
);
reset role;

select * from finish();
rollback;
