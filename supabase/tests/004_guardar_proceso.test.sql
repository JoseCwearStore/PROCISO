-- guardar_proceso: guarda el proceso y sus actividades en una sola transacción,
-- con los permisos del usuario (SECURITY INVOKER: el RLS aplica).

begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

-- C: consultoría · E: empresa · P: proyecto · K1 consultor asignado · K2 consultor NO asignado · U cliente
insert into auth.users (id, email, aud, role) values
  ('fdfdfdfd-0000-0000-0000-000000000001', 'k1@gp.test', 'authenticated', 'authenticated'),
  ('fdfdfdfd-0000-0000-0000-000000000002', 'k2@gp.test', 'authenticated', 'authenticated'),
  ('fdfdfdfd-0000-0000-0000-000000000003', 'u@gp.test',  'authenticated', 'authenticated');
insert into public.consultorias (id, nombre) values ('f9f9f9f9-0000-0000-0000-000000000001', 'Consultoría GP');
insert into public.empresas (id, consultoria_id, nombre) values
  ('fafafafa-1111-0000-0000-000000000001', 'f9f9f9f9-0000-0000-0000-000000000001', 'Empresa GP');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('fdfdfdfd-0000-0000-0000-000000000001', 'K1', 'k1@gp.test', 'consultor',       'f9f9f9f9-0000-0000-0000-000000000001', null),
  ('fdfdfdfd-0000-0000-0000-000000000002', 'K2', 'k2@gp.test', 'consultor',       'f9f9f9f9-0000-0000-0000-000000000001', null),
  ('fdfdfdfd-0000-0000-0000-000000000003', 'U',  'u@gp.test',  'usuario_cliente', 'f9f9f9f9-0000-0000-0000-000000000001', 'fafafafa-1111-0000-0000-000000000001');
insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('fbfbfbfb-1111-0000-0000-000000000001', 'f9f9f9f9-0000-0000-0000-000000000001', 'fafafafa-1111-0000-0000-000000000001', 'Proyecto GP');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('fbfbfbfb-1111-0000-0000-000000000001', 'fdfdfdfd-0000-0000-0000-000000000001', 'f9f9f9f9-0000-0000-0000-000000000001');

-- ─── Anónimo ────────────────────────────────────────────────────────────────
set local role anon;
select throws_ok(
  $$ select public.guardar_proceso('{}'::jsonb, '[]'::jsonb) $$,
  '42501', null, 'Un anónimo no puede ejecutar guardar_proceso'
);
reset role;

-- ─── K1: consultor asignado ─────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"fdfdfdfd-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$ select public.guardar_proceso(
       '{"id":"fcfcfcfc-1111-0000-0000-000000000001","proyecto_id":"fbfbfbfb-1111-0000-0000-000000000001",
         "nombre":"Compras","estado":"En levantamiento","entradas":["Requisición"],"salidas":[]}'::jsonb,
       '[{"id":"fefefefe-0000-0000-0000-000000000001","tipo":"Inicio","descripcion":"Recibir requisición","entradas":"","recursos":"","controles":"","resultado":"","orden":1},
         {"id":"fefefefe-0000-0000-0000-000000000002","tipo":"Fin","descripcion":"Emitir orden","entradas":"","recursos":"","controles":"","resultado":"","orden":2}]'::jsonb) $$,
  'El consultor asignado guarda un proceso nuevo con sus actividades'
);
reset role;

select is(
  (select array[nombre, consultoria_id::text, entradas[1]] from public.procesos where id = 'fcfcfcfc-1111-0000-0000-000000000001'),
  array['Compras', 'f9f9f9f9-0000-0000-0000-000000000001', 'Requisición'],
  'El proceso toma la consultoría de su proyecto y guarda las listas'
);
select is(
  (select count(*) from public.actividades where proceso_id = 'fcfcfcfc-1111-0000-0000-000000000001'),
  2::bigint, 'Se guardaron las 2 actividades'
);

-- Evidencia vinculada a la actividad 1: tiene que seguir vinculada después de volver a guardar.
insert into public.evidencias (id, consultoria_id, proyecto_id, proceso_id, actividad_id, nombre, tipo, subido_por) values
  ('ffffffff-1111-0000-0000-000000000001', 'f9f9f9f9-0000-0000-0000-000000000001', 'fbfbfbfb-1111-0000-0000-000000000001',
   'fcfcfcfc-1111-0000-0000-000000000001', 'fefefefe-0000-0000-0000-000000000001', 'Foto requisición', 'Foto', 'fdfdfdfd-0000-0000-0000-000000000001');

select set_config('request.jwt.claims', '{"sub":"fdfdfdfd-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.guardar_proceso(
       '{"id":"fcfcfcfc-1111-0000-0000-000000000001","proyecto_id":"fbfbfbfb-1111-0000-0000-000000000001",
         "nombre":"Compras y proveedores","estado":"Documentado","entradas":["Requisición"],"salidas":["Orden"]}'::jsonb,
       '[{"id":"fefefefe-0000-0000-0000-000000000001","tipo":"Inicio","descripcion":"Recibir y validar requisición","entradas":"","recursos":"","controles":"","resultado":"","orden":1}]'::jsonb) $$,
  'El consultor asignado vuelve a guardar el proceso (quita una actividad y edita otra)'
);
reset role;

select is(
  (select array_agg(descripcion) from public.actividades where proceso_id = 'fcfcfcfc-1111-0000-0000-000000000001'),
  array['Recibir y validar requisición'],
  'Queda solo la actividad que sigue, con su descripción actualizada'
);
select is(
  (select actividad_id from public.evidencias where id = 'ffffffff-1111-0000-0000-000000000001'),
  'fefefefe-0000-0000-0000-000000000001'::uuid,
  'La evidencia sigue vinculada a su actividad (las actividades se conservan por ID)'
);

-- ─── K2: consultor NO asignado ──────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"fdfdfdfd-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.guardar_proceso(
       '{"id":"fcfcfcfc-1111-0000-0000-000000000002","proyecto_id":"fbfbfbfb-1111-0000-0000-000000000001","nombre":"Intruso","estado":"Pendiente"}'::jsonb,
       '[]'::jsonb) $$,
  '42501', null, 'Un consultor no asignado no puede guardar procesos en ese proyecto'
);
reset role;

-- ─── U: cliente (solo lee) ──────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"fdfdfdfd-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.guardar_proceso(
       '{"id":"fcfcfcfc-1111-0000-0000-000000000001","proyecto_id":"fbfbfbfb-1111-0000-0000-000000000001","nombre":"Cambio del cliente","estado":"Aprobado"}'::jsonb,
       '[]'::jsonb) $$,
  '42501', null, 'El cliente no puede modificar procesos'
);
reset role;

select * from finish();
rollback;
