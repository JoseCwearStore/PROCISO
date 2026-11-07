-- Criterios de evaluación de la IA (decidido con el usuario el 2026-11-06):
--   · UNA matriz global (catálogo de la plataforma), cargada desde el Excel del
--     usuario por una migración generada. El Excel es la única fuente.
--   · La leen todos los usuarios activos (equipo y clientes).
--   · Nadie la escribe desde la app, ni el Admin PROCISO.
--   · Clave natural (edicion, clausula): recargar el Excel actualiza, no duplica.

begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, email, aud, role) values
  ('0a0a0a0a-0000-0000-0000-000000000001', 'z@ce.test', 'authenticated', 'authenticated'),
  ('0a0a0a0a-0000-0000-0000-000000000002', 'u@ce.test', 'authenticated', 'authenticated');
insert into public.consultorias (id, nombre) values ('0a0a0a0a-0000-0000-0001-000000000001', 'Consultoría CE');
insert into public.empresas (id, consultoria_id, nombre) values
  ('0a0a0a0a-0000-0000-0002-000000000001', '0a0a0a0a-0000-0000-0001-000000000001', 'Empresa CE');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('0a0a0a0a-0000-0000-0000-000000000001', 'Z', 'z@ce.test', 'admin_prociso',   null, null),
  ('0a0a0a0a-0000-0000-0000-000000000002', 'U', 'u@ce.test', 'usuario_cliente', '0a0a0a0a-0000-0000-0001-000000000001', '0a0a0a0a-0000-0000-0002-000000000001');

-- ─── Carga ──────────────────────────────────────────────────────────────────
select has_table('public', 'criterios_evaluacion', 'Existe la tabla de criterios');
select is((select count(*)::int from public.criterios_evaluacion where edicion = 'ISO 9001:2026'), 62,
  'Están los 62 criterios del Excel (de la 4.1 a la 10.3)');
select is((select string_agg(clausula, ',' order by orden) from public.criterios_evaluacion where orden in (1, 62)), '4.1,10.3',
  'El orden va de la 4.1 a la 10.3');
select is((select count(*)::int from public.criterios_evaluacion where puede_no_aplicar), 8,
  'Ocho cláusulas pueden no aplicar con justificación (7.1.5.2, 8.3.x y 8.5.3)');
select ok((select '¿incluye el compromiso de mejora continua del sistema?' = any(preguntas)
             from public.criterios_evaluacion where clausula = '5.2.1'),
  'Las preguntas se guardan como lista y traen las correcciones de la revisión');
select throws_ok(
  $$ insert into public.criterios_evaluacion (edicion, clausula, titulo, intencion, orden) values ('ISO 9001:2026', '5.2.1', 'Duplicada', 'x', 999) $$,
  '23505', null, 'No puede haber dos criterios para la misma cláusula y edición'
);
select throws_ok(
  $$ insert into public.criterios_evaluacion (edicion, clausula, titulo, intencion, orden) values ('ISO 9001:2026', '11.1', 'Inventada', 'x', 999) $$,
  '23514', null, 'La cláusula tiene que estar entre la 4 y la 10'
);

-- ─── Lectura ────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"0a0a0a0a-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.criterios_evaluacion), 62, 'El cliente lee la matriz completa');
select throws_ok(
  $$ update public.criterios_evaluacion set titulo = 'Cambiado' where clausula = '4.1' $$,
  '42501', null, 'El cliente no modifica criterios'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"0a0a0a0a-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.criterios_evaluacion (edicion, clausula, titulo, intencion, orden) values ('ISO 9001:2026', '4.9', 'Desde la app', 'x', 999) $$,
  '42501', null, 'Ni el Admin PROCISO crea criterios desde la app (la fuente es el Excel)'
);
select throws_ok(
  $$ delete from public.criterios_evaluacion where clausula = '4.1' $$,
  '42501', null, 'Nadie borra criterios desde la app'
);
reset role;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok('select count(*) from public.criterios_evaluacion', '42501', null, 'Sin sesión no se leen los criterios');
reset role;

select * from finish();
rollback;
