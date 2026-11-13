-- Indicadores (reglas elegidas por el usuario el 2026-11-07):
--   · Ámbito "PROCISO" (gestión interna de la consultoría): lo ve todo el equipo,
--     lo crea y edita SOLO el admin de la consultoría.
--   · Ámbito "SGC" (de una empresa): lo editan el admin y los consultores que
--     trabajan con esa empresa; el CLIENTE de la empresa lo ve en LECTURA.
--   · Nadie de otra consultoría ve nada.

begin;
create extension if not exists pgtap with schema extensions;

select plan(21);

-- A admin C1 · K1 consultor de un proyecto de E1 · K2 consultor de C1 sin proyectos
-- U cliente de E1 · U2 cliente de E2 · AX admin de OTRA consultoría
insert into auth.users (id, email, aud, role) values
  ('a7a7a7a7-0000-0000-0000-000000000001', 'a@in.test',  'authenticated', 'authenticated'),
  ('a7a7a7a7-0000-0000-0000-000000000002', 'k1@in.test', 'authenticated', 'authenticated'),
  ('a7a7a7a7-0000-0000-0000-000000000003', 'k2@in.test', 'authenticated', 'authenticated'),
  ('a7a7a7a7-0000-0000-0000-000000000004', 'u@in.test',  'authenticated', 'authenticated'),
  ('a7a7a7a7-0000-0000-0000-000000000005', 'u2@in.test', 'authenticated', 'authenticated'),
  ('a7a7a7a7-0000-0000-0000-000000000006', 'ax@in.test', 'authenticated', 'authenticated');
insert into public.consultorias (id, nombre) values
  ('a8a8a8a8-0000-0000-0000-000000000001', 'Consultoría IN'),
  ('a8a8a8a8-0000-0000-0000-000000000002', 'Otra consultoría IN');
insert into public.empresas (id, consultoria_id, nombre) values
  ('a9a9a9a9-0000-0000-0000-000000000001', 'a8a8a8a8-0000-0000-0000-000000000001', 'Empresa IN'),
  ('a9a9a9a9-0000-0000-0000-000000000002', 'a8a8a8a8-0000-0000-0000-000000000001', 'Otra empresa IN');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('a7a7a7a7-0000-0000-0000-000000000001', 'A',  'a@in.test',  'admin_consultoria', 'a8a8a8a8-0000-0000-0000-000000000001', null),
  ('a7a7a7a7-0000-0000-0000-000000000002', 'K1', 'k1@in.test', 'consultor',         'a8a8a8a8-0000-0000-0000-000000000001', null),
  ('a7a7a7a7-0000-0000-0000-000000000003', 'K2', 'k2@in.test', 'consultor',         'a8a8a8a8-0000-0000-0000-000000000001', null),
  ('a7a7a7a7-0000-0000-0000-000000000004', 'U',  'u@in.test',  'usuario_cliente',   'a8a8a8a8-0000-0000-0000-000000000001', 'a9a9a9a9-0000-0000-0000-000000000001'),
  ('a7a7a7a7-0000-0000-0000-000000000005', 'U2', 'u2@in.test', 'usuario_cliente',   'a8a8a8a8-0000-0000-0000-000000000001', 'a9a9a9a9-0000-0000-0000-000000000002'),
  ('a7a7a7a7-0000-0000-0000-000000000006', 'AX', 'ax@in.test', 'admin_consultoria', 'a8a8a8a8-0000-0000-0000-000000000002', null);
insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('acacacac-0000-0000-0000-000000000001', 'a8a8a8a8-0000-0000-0000-000000000001', 'a9a9a9a9-0000-0000-0000-000000000001', 'Proyecto IN');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('acacacac-0000-0000-0000-000000000001', 'a7a7a7a7-0000-0000-0000-000000000002', 'a8a8a8a8-0000-0000-0000-000000000001');

-- ─── A: el admin gestiona los internos ──────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a7a7a7a7-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ insert into public.indicadores (id, consultoria_id, ambito, nombre, formula, unidad, frecuencia, responsable_id, meta, periodo)
     values ('adadadad-0000-0000-0000-000000000001', 'a8a8a8a8-0000-0000-0000-000000000001', 'PROCISO', 'Proyectos a tiempo',
             'Proyectos en fecha / total', '%', 'Mensual', 'a7a7a7a7-0000-0000-0000-000000000002', '≥ 90 %', 'Noviembre 2026')
     returning * $$,
  'El admin crea un indicador interno (INSERT … RETURNING)'
);
select throws_ok(
  $$ insert into public.indicadores (consultoria_id, ambito, nombre, formula, unidad, frecuencia, responsable_id, meta, periodo)
     values ('a8a8a8a8-0000-0000-0000-000000000001', 'SGC', 'Sin empresa', 'x', '%', 'Mensual', 'a7a7a7a7-0000-0000-0000-000000000002', '1', 'x') $$,
  '23514', null, 'Un indicador del SGC exige empresa'
);
select throws_ok(
  $$ insert into public.indicadores (consultoria_id, ambito, nombre, formula, unidad, frecuencia, responsable_id, meta, periodo)
     values ('a8a8a8a8-0000-0000-0000-000000000001', 'PROCISO', 'Interno con cliente', 'x', '%', 'Mensual', 'a7a7a7a7-0000-0000-0000-000000000004', '1', 'x') $$,
  '22023', null, 'Un cliente no es responsable de un indicador interno de la consultoría'
);
select throws_ok(
  $$ insert into public.indicadores (consultoria_id, ambito, nombre, formula, unidad, frecuencia, responsable_id, meta, periodo, creado_por)
     values ('a8a8a8a8-0000-0000-0000-000000000001', 'PROCISO', 'Suplantado', 'x', '%', 'Mensual', 'a7a7a7a7-0000-0000-0000-000000000002', '1', 'x',
             'a7a7a7a7-0000-0000-0000-000000000002') $$,
  '42501', null, 'Nadie crea a nombre de otro'
);
reset role;

-- ─── K1: consultor que trabaja con E1 ───────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a7a7a7a7-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.indicadores (consultoria_id, ambito, nombre, formula, unidad, frecuencia, responsable_id, meta, periodo)
     values ('a8a8a8a8-0000-0000-0000-000000000001', 'PROCISO', 'Mío', 'x', '%', 'Mensual', 'a7a7a7a7-0000-0000-0000-000000000002', '1', 'x') $$,
  '42501', null, 'Un consultor no crea indicadores internos (solo el admin)'
);
select lives_ok(
  $$ insert into public.indicadores (id, consultoria_id, ambito, empresa_id, nombre, formula, unidad, frecuencia, responsable_id, meta, periodo)
     values ('adadadad-0000-0000-0000-000000000002', 'a8a8a8a8-0000-0000-0000-000000000001', 'SGC', 'a9a9a9a9-0000-0000-0000-000000000001',
             'Quejas atendidas a tiempo', 'Atendidas en 48 h / total', '%', 'Mensual', 'a7a7a7a7-0000-0000-0000-000000000004', '≥ 95 %', 'Noviembre 2026') $$,
  'El consultor que trabaja con E1 crea un indicador de su SGC, con el cliente como responsable'
);
select throws_ok(
  $$ insert into public.indicadores (consultoria_id, ambito, empresa_id, nombre, formula, unidad, frecuencia, responsable_id, meta, periodo)
     values ('a8a8a8a8-0000-0000-0000-000000000001', 'SGC', 'a9a9a9a9-0000-0000-0000-000000000002', 'Ajeno', 'x', '%', 'Mensual',
             'a7a7a7a7-0000-0000-0000-000000000002', '1', 'x') $$,
  '42501', null, 'No crea indicadores de una empresa con la que no trabaja'
);
select throws_ok(
  $$ insert into public.indicadores (consultoria_id, ambito, empresa_id, nombre, formula, unidad, frecuencia, responsable_id, meta, periodo)
     values ('a8a8a8a8-0000-0000-0000-000000000001', 'SGC', 'a9a9a9a9-0000-0000-0000-000000000001', 'Responsable ajeno', 'x', '%', 'Mensual',
             'a7a7a7a7-0000-0000-0000-000000000005', '1', 'x') $$,
  '22023', null, 'El responsable no puede ser un cliente de OTRA empresa'
);
select isnt_empty(
  $$ update public.indicadores set valor = '97' where id = 'adadadad-0000-0000-0000-000000000002' returning id $$,
  'El consultor registra el valor del indicador del SGC'
);
select is_empty(
  $$ update public.indicadores set valor = '100' where id = 'adadadad-0000-0000-0000-000000000001' returning id $$,
  'El consultor no edita un indicador interno (RLS: 0 filas)'
);
select throws_ok(
  $$ update public.indicadores set consultoria_id = 'a8a8a8a8-0000-0000-0000-000000000002' where id = 'adadadad-0000-0000-0000-000000000002' $$,
  '42501', null, 'Un indicador no se muda de consultoría'
);
select is_empty(
  $$ delete from public.indicadores where id = 'adadadad-0000-0000-0000-000000000002' returning id $$,
  'Un consultor no borra indicadores'
);
reset role;

-- ─── K2: consultor de la consultoría que NO trabaja con E1 ──────────────────
select set_config('request.jwt.claims', '{"sub":"a7a7a7a7-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select array[(select count(*) from public.indicadores where ambito = 'PROCISO')::int, (select count(*) from public.indicadores where ambito = 'SGC')::int]),
  array[1, 0], 'K2 ve los internos de su consultoría, pero no el SGC de una empresa con la que no trabaja'
);
select throws_ok(
  $$ insert into public.indicadores (consultoria_id, ambito, empresa_id, nombre, formula, unidad, frecuencia, responsable_id, meta, periodo)
     values ('a8a8a8a8-0000-0000-0000-000000000001', 'SGC', 'a9a9a9a9-0000-0000-0000-000000000001', 'x', 'x', '%', 'Mensual',
             'a7a7a7a7-0000-0000-0000-000000000003', '1', 'x') $$,
  '42501', null, 'K2 no crea indicadores del SGC de E1'
);
reset role;

-- ─── U: el cliente lee el SGC de su empresa ─────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a7a7a7a7-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select array_agg(nombre || ':' || valor) from public.indicadores),
  array['Quejas atendidas a tiempo:97'],
  'El cliente ve SOLO el indicador del SGC de su empresa (nunca los internos)'
);
select is_empty(
  $$ update public.indicadores set valor = '100' returning id $$,
  'El cliente no edita indicadores (RLS: 0 filas)'
);
select throws_ok(
  $$ insert into public.indicadores (consultoria_id, ambito, empresa_id, nombre, formula, unidad, frecuencia, responsable_id, meta, periodo)
     values ('a8a8a8a8-0000-0000-0000-000000000001', 'SGC', 'a9a9a9a9-0000-0000-0000-000000000001', 'x', 'x', '%', 'Mensual',
             'a7a7a7a7-0000-0000-0000-000000000004', '1', 'x') $$,
  '42501', null, 'El cliente no crea indicadores'
);
reset role;

-- ─── De afuera ──────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a7a7a7a7-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.indicadores), 0, 'Un cliente de otra empresa no ve nada');
reset role;

select set_config('request.jwt.claims', '{"sub":"a7a7a7a7-0000-0000-0000-000000000006","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.indicadores), 0, 'El admin de OTRA consultoría no ve nada');
select is_empty(
  $$ update public.indicadores set valor = '12345' returning id $$,
  'El admin de otra consultoría no edita nada'
);
reset role;

-- ─── A: el admin borra ──────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a7a7a7a7-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select isnt_empty(
  $$ delete from public.indicadores where id = 'adadadad-0000-0000-0000-000000000002' returning id $$,
  'El admin de la consultoría borra un indicador'
);
reset role;

select * from finish();
rollback;
