-- Listas de verificación: el equipo las arma, el cliente las ve en lectura, y
-- guardar_lista crea las tareas de seguimiento de los hallazgos EN LA MISMA
-- transacción (una tarea por pregunta, nunca dos).

begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

-- A admin · K1 consultor del proyecto · K2 consultor de afuera · U cliente de la empresa · U2 cliente de OTRA empresa
insert into auth.users (id, email, aud, role) values
  ('e5e5e5e5-0000-0000-0000-000000000001', 'a@lv.test',  'authenticated', 'authenticated'),
  ('e5e5e5e5-0000-0000-0000-000000000002', 'k1@lv.test', 'authenticated', 'authenticated'),
  ('e5e5e5e5-0000-0000-0000-000000000003', 'k2@lv.test', 'authenticated', 'authenticated'),
  ('e5e5e5e5-0000-0000-0000-000000000004', 'u@lv.test',  'authenticated', 'authenticated'),
  ('e5e5e5e5-0000-0000-0000-000000000005', 'u2@lv.test', 'authenticated', 'authenticated');
insert into public.consultorias (id, nombre) values ('e6e6e6e6-0000-0000-0000-000000000001', 'Consultoría LV');
insert into public.empresas (id, consultoria_id, nombre) values
  ('e7e7e7e7-0000-0000-0000-000000000001', 'e6e6e6e6-0000-0000-0000-000000000001', 'Empresa LV'),
  ('e7e7e7e7-0000-0000-0000-000000000002', 'e6e6e6e6-0000-0000-0000-000000000001', 'Otra empresa LV');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('e5e5e5e5-0000-0000-0000-000000000001', 'A',  'a@lv.test',  'admin_consultoria', 'e6e6e6e6-0000-0000-0000-000000000001', null),
  ('e5e5e5e5-0000-0000-0000-000000000002', 'K1', 'k1@lv.test', 'consultor',         'e6e6e6e6-0000-0000-0000-000000000001', null),
  ('e5e5e5e5-0000-0000-0000-000000000003', 'K2', 'k2@lv.test', 'consultor',         'e6e6e6e6-0000-0000-0000-000000000001', null),
  ('e5e5e5e5-0000-0000-0000-000000000004', 'U',  'u@lv.test',  'usuario_cliente',   'e6e6e6e6-0000-0000-0000-000000000001', 'e7e7e7e7-0000-0000-0000-000000000001'),
  ('e5e5e5e5-0000-0000-0000-000000000005', 'U2', 'u2@lv.test', 'usuario_cliente',   'e6e6e6e6-0000-0000-0000-000000000001', 'e7e7e7e7-0000-0000-0000-000000000002');
-- P1 es el proyecto de la lista; P2 (misma empresa) tiene una evidencia que NO se puede vincular a P1.
insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('e8e8e8e8-0000-0000-0000-000000000001', 'e6e6e6e6-0000-0000-0000-000000000001', 'e7e7e7e7-0000-0000-0000-000000000001', 'Proyecto LV'),
  ('e8e8e8e8-0000-0000-0000-000000000002', 'e6e6e6e6-0000-0000-0000-000000000001', 'e7e7e7e7-0000-0000-0000-000000000001', 'Otro proyecto LV');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('e8e8e8e8-0000-0000-0000-000000000001', 'e5e5e5e5-0000-0000-0000-000000000002', 'e6e6e6e6-0000-0000-0000-000000000001');
insert into public.evidencias (id, consultoria_id, proyecto_id, subido_por, nombre, tipo) values
  ('eaeaeaea-0000-0000-0000-000000000002', 'e6e6e6e6-0000-0000-0000-000000000001', 'e8e8e8e8-0000-0000-0000-000000000002',
   'e5e5e5e5-0000-0000-0000-000000000004', 'Foto de otro proyecto', 'Foto');

-- Cuerpo base de la lista (lo reusan varios tests).
create temp table lv (lista jsonb);
insert into lv values (jsonb_build_object(
  'id', 'e9e9e9e9-0000-0000-0000-000000000001', 'proyecto_id', 'e8e8e8e8-0000-0000-0000-000000000001',
  'nombre', 'Revisión de compras', 'area', 'Compras', 'responsable_id', 'e5e5e5e5-0000-0000-0000-000000000004',
  'fecha', (current_date + 7)::text, 'edicion_norma', 'ISO 9001:2026'));
grant select on lv to authenticated;

-- ─── K1: el equipo arma la lista ────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"e5e5e5e5-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select jsonb_array_length(public.guardar_lista((select lista from lv), '[
     {"id":"e9e9e9e9-0000-0000-0000-0000000000a1","orden":1,"pregunta":"¿Hay proveedores aprobados?","estado":"Cumple según la evidencia revisada"},
     {"id":"e9e9e9e9-0000-0000-0000-0000000000a2","orden":2,"pregunta":"¿Se evalúa a los proveedores?","estado":"No cumple según la evidencia revisada"},
     {"id":"e9e9e9e9-0000-0000-0000-0000000000a3","orden":3,"pregunta":"¿Se registran las compras?","estado":"Parcialmente atendido"}
   ]'::jsonb))),
  2, 'Guardar la lista crea UNA tarea por hallazgo y las devuelve'
);
reset role;

select is(
  (select array[nombre, creada_por::text] from public.listas_verificacion where id = 'e9e9e9e9-0000-0000-0000-000000000001'),
  array['Revisión de compras', 'e5e5e5e5-0000-0000-0000-000000000002'],
  'La lista queda guardada y creada por K1'
);
select is(
  (select array_agg(pregunta order by orden) from public.lista_preguntas where lista_id = 'e9e9e9e9-0000-0000-0000-000000000001'),
  array['¿Hay proveedores aprobados?', '¿Se evalúa a los proveedores?', '¿Se registran las compras?'],
  'Las preguntas quedan en orden'
);
select is(
  (select array_agg(t.prioridad || ':' || t.estado || ':' || (t.asignado_a = 'e5e5e5e5-0000-0000-0000-000000000004') || ':' || (t.fecha_vencimiento = current_date + 7)
          order by t.prioridad)
   from public.tareas t where t.pregunta_id in ('e9e9e9e9-0000-0000-0000-0000000000a2', 'e9e9e9e9-0000-0000-0000-0000000000a3')),
  array['Alta:Pendiente:true:true', 'Media:Pendiente:true:true'],
  '"No cumple" → Alta, "Parcial" → Media; asignadas al responsable, vencen en la fecha de la lista'
);

set local role authenticated;
select is(
  (select jsonb_array_length(public.guardar_lista((select lista from lv), '[
     {"id":"e9e9e9e9-0000-0000-0000-0000000000a1","orden":1,"pregunta":"¿Hay proveedores aprobados?","estado":"Cumple según la evidencia revisada"},
     {"id":"e9e9e9e9-0000-0000-0000-0000000000a2","orden":2,"pregunta":"¿Se evalúa a los proveedores?","estado":"No cumple según la evidencia revisada"},
     {"id":"e9e9e9e9-0000-0000-0000-0000000000a3","orden":3,"pregunta":"¿Se registran las compras?","estado":"Parcialmente atendido"}
   ]'::jsonb))),
  0, 'Volver a guardar no duplica tareas'
);
-- Se corrige el texto de un hallazgo, se quita una pregunta y se agrega otro hallazgo.
select is(
  (select jsonb_array_length(public.guardar_lista((select lista from lv), '[
     {"id":"e9e9e9e9-0000-0000-0000-0000000000a2","orden":1,"pregunta":"¿Se evalúa periódicamente a los proveedores?","estado":"No cumple según la evidencia revisada"},
     {"id":"e9e9e9e9-0000-0000-0000-0000000000a3","orden":2,"pregunta":"¿Se registran las compras?","estado":"Parcialmente atendido"},
     {"id":"e9e9e9e9-0000-0000-0000-0000000000a4","orden":3,"pregunta":"¿Hay inspección de recepción?","estado":"No cumple según la evidencia revisada"}
   ]'::jsonb))),
  1, 'Cambiar el texto de un hallazgo no lo duplica (se deduplica por pregunta, no por título); el nuevo sí genera tarea'
);
reset role;

select is(
  (select array[(select count(*) from public.lista_preguntas where lista_id = 'e9e9e9e9-0000-0000-0000-000000000001')::int,
                (select count(*) from public.tareas where pregunta_id is not null and proyecto_id = 'e8e8e8e8-0000-0000-0000-000000000001')::int]),
  array[3, 3],
  'Quedan 3 preguntas (la quitada se borró) y 3 tareas de seguimiento'
);

set local role authenticated;
select throws_ok(
  $$ select public.guardar_lista((select lista from lv), '[{"id":"e9e9e9e9-0000-0000-0000-0000000000b1","orden":1,"pregunta":"¿Aplica?","estado":"No aplica"}]'::jsonb) $$,
  '23514', null, '"No aplica" sin justificación lo rechaza la BD'
);
select throws_ok(
  $$ select public.guardar_lista((select lista || '{"responsable_id":"e5e5e5e5-0000-0000-0000-000000000005"}' from lv), '[]'::jsonb) $$,
  '22023', null, 'El responsable no puede ser un cliente de OTRA empresa'
);
select throws_ok(
  $$ select public.guardar_lista((select lista from lv),
       '[{"id":"e9e9e9e9-0000-0000-0000-0000000000b2","orden":1,"pregunta":"¿Evidencia?","estado":"Cumple según la evidencia revisada","evidencia_id":"eaeaeaea-0000-0000-0000-000000000002"}]'::jsonb) $$,
  '23503', null, 'No se vincula una evidencia de OTRO proyecto'
);
select is_empty(
  $$ delete from public.listas_verificacion where id = 'e9e9e9e9-0000-0000-0000-000000000001' returning id $$,
  'Un consultor no borra listas (solo el admin)'
);
reset role;

-- ─── U: el cliente ve en lectura ────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"e5e5e5e5-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select array[(select count(*) from public.listas_verificacion)::int, (select count(*) from public.lista_preguntas)::int]),
  array[1, 3], 'El cliente ve la lista de su empresa con sus preguntas'
);
select throws_ok(
  $$ select public.guardar_lista((select lista from lv), '[]'::jsonb) $$,
  '42501', null, 'El cliente no guarda listas'
);
select is_empty(
  $$ update public.listas_verificacion set nombre = 'Cambiada' returning id $$,
  'El cliente no edita la lista (RLS: 0 filas)'
);
select is_empty(
  $$ update public.lista_preguntas set estado = 'Cumple según la evidencia revisada' returning id $$,
  'El cliente no cambia las respuestas (RLS: 0 filas)'
);
reset role;

-- ─── De afuera ──────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"e5e5e5e5-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select array[(select count(*) from public.listas_verificacion)::int, (select count(*) from public.lista_preguntas)::int]),
  array[0, 0], 'Un cliente de otra empresa no ve la lista ni sus preguntas'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"e5e5e5e5-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.guardar_lista((select lista from lv), '[]'::jsonb) $$,
  '42501', null, 'Un consultor que no es del proyecto no guarda la lista'
);
reset role;

-- ─── Una pregunta = una tarea, aunque se intente por fuera de la RPC ────────
select throws_ok(
  $$ insert into public.tareas (consultoria_id, proyecto_id, titulo, asignado_a, asignado_por, fecha_vencimiento, pregunta_id)
     values ('e6e6e6e6-0000-0000-0000-000000000001', 'e8e8e8e8-0000-0000-0000-000000000001', 'Duplicada',
             'e5e5e5e5-0000-0000-0000-000000000004', 'e5e5e5e5-0000-0000-0000-000000000002', current_date,
             'e9e9e9e9-0000-0000-0000-0000000000a2') $$,
  '23505', null, 'La BD impide dos tareas para la misma pregunta'
);

-- ─── A: el admin borra ──────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"e5e5e5e5-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select isnt_empty(
  $$ delete from public.listas_verificacion where id = 'e9e9e9e9-0000-0000-0000-000000000001' returning id $$,
  'El admin de la consultoría borra la lista'
);
reset role;

select is(
  (select count(*)::int from public.lista_preguntas where lista_id = 'e9e9e9e9-0000-0000-0000-000000000001'),
  0, 'Las preguntas se borran con la lista'
);
select is(
  (select count(*)::int from public.tareas where proyecto_id = 'e8e8e8e8-0000-0000-0000-000000000001' and titulo like 'Seguimiento de hallazgo:%'),
  3, 'Las tareas de seguimiento sobreviven al borrado de la lista (el trabajo no se pierde)'
);
select is(
  (select count(*)::int from public.tareas where proyecto_id = 'e8e8e8e8-0000-0000-0000-000000000001' and pregunta_id is not null),
  0, '…y quedan sin vínculo a la pregunta borrada'
);

select * from finish();
rollback;
