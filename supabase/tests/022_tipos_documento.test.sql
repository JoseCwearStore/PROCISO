-- Tipos de documento de las plantillas del usuario (2026-11-09): Alcance, Objetivos
-- y Mapa de procesos se suman a los que ya había. Un tipo inventado sigue
-- rechazado por el CHECK, y crear con INSERT ... RETURNING funciona para el equipo.

begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

insert into auth.users (id, email, aud, role) values
  ('22222222-0000-0000-0000-000000000001', 'k@td.test', 'authenticated', 'authenticated');
insert into public.consultorias (id, nombre) values ('22222222-0000-0000-0001-000000000001', 'Consultoría TD');
insert into public.empresas (id, consultoria_id, nombre) values
  ('22222222-0000-0000-0002-000000000001', '22222222-0000-0000-0001-000000000001', 'Empresa TD');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('22222222-0000-0000-0000-000000000001', 'K', 'k@td.test', 'consultor', '22222222-0000-0000-0001-000000000001', null);
insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('22222222-0000-0000-0003-000000000001', '22222222-0000-0000-0001-000000000001', '22222222-0000-0000-0002-000000000001', 'P TD');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('22222222-0000-0000-0003-000000000001', '22222222-0000-0000-0000-000000000001', '22222222-0000-0000-0001-000000000001');

select set_config('request.jwt.claims', '{"sub":"22222222-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$ insert into public.documentos (consultoria_id, proyecto_id, nombre, tipo)
     values ('22222222-0000-0000-0001-000000000001', '22222222-0000-0000-0003-000000000001', 'Alcance', 'Alcance') returning id $$,
  'El equipo crea un documento de tipo Alcance'
);
select lives_ok(
  $$ insert into public.documentos (consultoria_id, proyecto_id, nombre, tipo)
     values ('22222222-0000-0000-0001-000000000001', '22222222-0000-0000-0003-000000000001', 'Objetivos', 'Objetivos') returning id $$,
  'El equipo crea un documento de tipo Objetivos'
);
select lives_ok(
  $$ insert into public.documentos (consultoria_id, proyecto_id, nombre, tipo)
     values ('22222222-0000-0000-0001-000000000001', '22222222-0000-0000-0003-000000000001', 'Mapa', 'Mapa de procesos') returning id $$,
  'El equipo crea un documento de tipo Mapa de procesos'
);
select lives_ok(
  $$ insert into public.documentos (consultoria_id, proyecto_id, nombre, tipo)
     values ('22222222-0000-0000-0001-000000000001', '22222222-0000-0000-0003-000000000001', 'Política', 'Política') returning id $$,
  'Los tipos que ya existían siguen valiendo'
);
select throws_ok(
  $$ insert into public.documentos (consultoria_id, proyecto_id, nombre, tipo)
     values ('22222222-0000-0000-0001-000000000001', '22222222-0000-0000-0003-000000000001', 'X', 'Inventado') $$,
  '23514', null, 'Un tipo inventado sigue rechazado'
);
select is((select count(*)::int from public.documentos), 4, 'Se crearon los 4 documentos válidos');
select is((select count(distinct tipo)::int from public.documentos), 4, 'Cada uno con su tipo');

select * from finish();
rollback;
