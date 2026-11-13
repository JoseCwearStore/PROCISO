-- E9 · Un código documental no se repite en un proyecto para la misma versión.
--   · "Crear nueva versión" crea una fila nueva con el MISMO código y otra versión (decidir_documento reemplaza por
--     código), así que lo único es (proyecto, código, versión), sin importar mayúsculas ni espacios;
--   · otro proyecto puede usar el mismo código y versión;
--   · un documento sin código (nulo o en blanco) no choca con otro sin código;
--   · también vale al EDITAR el código de un documento existente.

begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

insert into auth.users (id, email, aud, role) values
  ('c9c9c9c9-0000-0000-0000-000000000001', 'k1@cu.test', 'authenticated', 'authenticated');
insert into public.consultorias (id, nombre) values ('c9c9c9c9-0001-0000-0000-000000000001', 'Consultoría CU');
insert into public.empresas (id, consultoria_id, nombre) values
  ('c9c9c9c9-0002-0000-0000-000000000001', 'c9c9c9c9-0001-0000-0000-000000000001', 'Empresa CU');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('c9c9c9c9-0000-0000-0000-000000000001', 'K1', 'k1@cu.test', 'consultor', 'c9c9c9c9-0001-0000-0000-000000000001', null);
insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('c9c9c9c9-0003-0000-0000-000000000001', 'c9c9c9c9-0001-0000-0000-000000000001', 'c9c9c9c9-0002-0000-0000-000000000001', 'Proyecto CU 1'),
  ('c9c9c9c9-0003-0000-0000-000000000002', 'c9c9c9c9-0001-0000-0000-000000000001', 'c9c9c9c9-0002-0000-0000-000000000001', 'Proyecto CU 2');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('c9c9c9c9-0003-0000-0000-000000000001', 'c9c9c9c9-0000-0000-0000-000000000001', 'c9c9c9c9-0001-0000-0000-000000000001'),
  ('c9c9c9c9-0003-0000-0000-000000000002', 'c9c9c9c9-0000-0000-0000-000000000001', 'c9c9c9c9-0001-0000-0000-000000000001');

select set_config('request.jwt.claims', '{"sub":"c9c9c9c9-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$ select public.guardar_documento(
       '{"id":"c9c9c9c9-0005-0000-0000-000000000001","proyecto_id":"c9c9c9c9-0003-0000-0000-000000000001","nombre":"Objetivos",
         "tipo":"Plan","estado":"Borrador","version":"0.1","codigo":"COD-001","secciones":[]}'::jsonb, null, null) $$,
  'Se crea el documento COD-001 versión 0.1'
);

select throws_ok(
  $$ select public.guardar_documento(
       '{"id":"c9c9c9c9-0005-0000-0000-000000000002","proyecto_id":"c9c9c9c9-0003-0000-0000-000000000001","nombre":"Otro",
         "tipo":"Plan","estado":"Borrador","version":"0.1","codigo":"COD-001","secciones":[]}'::jsonb, null, null) $$,
  '23505', null, 'El mismo código y versión en el mismo proyecto se rechaza'
);

select throws_ok(
  $$ select public.guardar_documento(
       '{"id":"c9c9c9c9-0005-0000-0000-000000000003","proyecto_id":"c9c9c9c9-0003-0000-0000-000000000001","nombre":"Variante",
         "tipo":"Plan","estado":"Borrador","version":"0.1","codigo":"  cod-001 ","secciones":[]}'::jsonb, null, null) $$,
  '23505', null, 'No importan mayúsculas ni espacios alrededor'
);

select lives_ok(
  $$ select public.guardar_documento(
       '{"id":"c9c9c9c9-0005-0000-0000-000000000004","proyecto_id":"c9c9c9c9-0003-0000-0000-000000000001","nombre":"Objetivos",
         "tipo":"Plan","estado":"Borrador","version":"0.2","codigo":"COD-001","secciones":[]}'::jsonb, null, null) $$,
  'El mismo código con OTRA versión sí se puede (así funciona "Crear nueva versión")'
);

select lives_ok(
  $$ select public.guardar_documento(
       '{"id":"c9c9c9c9-0005-0000-0000-000000000005","proyecto_id":"c9c9c9c9-0003-0000-0000-000000000002","nombre":"Objetivos",
         "tipo":"Plan","estado":"Borrador","version":"0.1","codigo":"COD-001","secciones":[]}'::jsonb, null, null) $$,
  'Otro proyecto puede usar el mismo código y versión'
);

select lives_ok(
  $$ select public.guardar_documento(
       '{"id":"c9c9c9c9-0005-0000-0000-000000000006","proyecto_id":"c9c9c9c9-0003-0000-0000-000000000001","nombre":"Sin código 1",
         "tipo":"Plan","estado":"Borrador","version":"0.1","secciones":[]}'::jsonb, null, null) $$,
  'Un documento sin código se crea'
);
select lives_ok(
  $$ select public.guardar_documento(
       '{"id":"c9c9c9c9-0005-0000-0000-000000000007","proyecto_id":"c9c9c9c9-0003-0000-0000-000000000001","nombre":"Sin código 2",
         "tipo":"Plan","estado":"Borrador","version":"0.1","codigo":"   ","secciones":[]}'::jsonb, null, null) $$,
  'Otro sin código (o con el código en blanco) no choca con el anterior'
);
select lives_ok(
  $$ select public.guardar_documento(
       '{"id":"c9c9c9c9-0005-0000-0000-000000000009","proyecto_id":"c9c9c9c9-0003-0000-0000-000000000001","nombre":"Sin código 3",
         "tipo":"Plan","estado":"Borrador","version":"0.1","codigo":" ","secciones":[]}'::jsonb, null, null) $$,
  'Dos documentos con el código en blanco (espacios) tampoco chocan entre sí'
);

-- Editar el código de un documento existente hacia uno ocupado también se rechaza.
select lives_ok(
  $$ select public.guardar_documento(
       '{"id":"c9c9c9c9-0005-0000-0000-000000000008","proyecto_id":"c9c9c9c9-0003-0000-0000-000000000001","nombre":"Otro doc",
         "tipo":"Plan","estado":"Borrador","version":"0.1","codigo":"COD-002","secciones":[]}'::jsonb, null, null) $$,
  'Se crea COD-002 versión 0.1'
);
select throws_ok(
  $$ select public.guardar_documento(
       '{"id":"c9c9c9c9-0005-0000-0000-000000000008","proyecto_id":"c9c9c9c9-0003-0000-0000-000000000001","nombre":"Otro doc",
         "tipo":"Plan","estado":"Borrador","version":"0.1","codigo":"COD-001","secciones":[]}'::jsonb, null, null) $$,
  '23505', null, 'Cambiarle el código a uno ocupado se rechaza'
);

reset role;
select is(
  (select count(*)::int from public.documentos
    where proyecto_id = 'c9c9c9c9-0003-0000-0000-000000000001' and lower(btrim(codigo)) = 'cod-001' and version = '0.1'),
  1, 'Quedó un solo documento con COD-001 versión 0.1 en el proyecto'
);

select * from finish();
rollback;
