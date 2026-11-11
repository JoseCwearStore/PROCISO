-- Tareas: quién crea, quién avanza y quién cierra.
-- Regla del negocio: el EQUIPO del proyecto crea, asigna, cierra (Completada) y
-- devuelve (Requiere corrección). El ASIGNADO (también el cliente) avanza
-- Pendiente → En proceso → En revisión. Quien hace el trabajo no lo da por bueno.
-- El estado SOLO cambia por cambiar_estado_tarea (deja historial).

begin;
create extension if not exists pgtap with schema extensions;

select plan(30);

-- A admin de la consultoría · K1 consultor asignado · K2 consultor NO asignado
-- U cliente de la empresa del proyecto · U2 cliente de OTRA empresa
insert into auth.users (id, email, aud, role) values
  ('b1b1b1b1-0000-0000-0000-000000000001', 'a@ta.test',  'authenticated', 'authenticated'),
  ('b1b1b1b1-0000-0000-0000-000000000002', 'k1@ta.test', 'authenticated', 'authenticated'),
  ('b1b1b1b1-0000-0000-0000-000000000003', 'k2@ta.test', 'authenticated', 'authenticated'),
  ('b1b1b1b1-0000-0000-0000-000000000004', 'u@ta.test',  'authenticated', 'authenticated'),
  ('b1b1b1b1-0000-0000-0000-000000000005', 'u2@ta.test', 'authenticated', 'authenticated');
insert into public.consultorias (id, nombre) values ('b2b2b2b2-0000-0000-0000-000000000001', 'Consultoría TA');
insert into public.empresas (id, consultoria_id, nombre) values
  ('b3b3b3b3-0000-0000-0000-000000000001', 'b2b2b2b2-0000-0000-0000-000000000001', 'Empresa TA'),
  ('b3b3b3b3-0000-0000-0000-000000000002', 'b2b2b2b2-0000-0000-0000-000000000001', 'Otra empresa TA');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('b1b1b1b1-0000-0000-0000-000000000001', 'A',  'a@ta.test',  'admin_consultoria', 'b2b2b2b2-0000-0000-0000-000000000001', null),
  ('b1b1b1b1-0000-0000-0000-000000000002', 'K1', 'k1@ta.test', 'consultor',         'b2b2b2b2-0000-0000-0000-000000000001', null),
  ('b1b1b1b1-0000-0000-0000-000000000003', 'K2', 'k2@ta.test', 'consultor',         'b2b2b2b2-0000-0000-0000-000000000001', null),
  ('b1b1b1b1-0000-0000-0000-000000000004', 'U',  'u@ta.test',  'usuario_cliente',   'b2b2b2b2-0000-0000-0000-000000000001', 'b3b3b3b3-0000-0000-0000-000000000001'),
  ('b1b1b1b1-0000-0000-0000-000000000005', 'U2', 'u2@ta.test', 'usuario_cliente',   'b2b2b2b2-0000-0000-0000-000000000001', 'b3b3b3b3-0000-0000-0000-000000000002');
insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('b4b4b4b4-0000-0000-0000-000000000001', 'b2b2b2b2-0000-0000-0000-000000000001', 'b3b3b3b3-0000-0000-0000-000000000001', 'Proyecto TA');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('b4b4b4b4-0000-0000-0000-000000000001', 'b1b1b1b1-0000-0000-0000-000000000002', 'b2b2b2b2-0000-0000-0000-000000000001');

-- T2 ya existe, asignada a K1 (para probar que U no toca tareas ajenas).
insert into public.tareas (id, consultoria_id, proyecto_id, titulo, asignado_a, asignado_por, fecha_vencimiento) values
  ('b5b5b5b5-0000-0000-0000-000000000002', 'b2b2b2b2-0000-0000-0000-000000000001', 'b4b4b4b4-0000-0000-0000-000000000001',
   'Tarea de K1', 'b1b1b1b1-0000-0000-0000-000000000002', 'b1b1b1b1-0000-0000-0000-000000000001', current_date + 3);

-- ─── K1: el equipo crea y asigna ────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"b1b1b1b1-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$ insert into public.tareas (id, consultoria_id, proyecto_id, titulo, descripcion, asignado_a, prioridad, fecha_vencimiento)
     values ('b5b5b5b5-0000-0000-0000-000000000001', 'b2b2b2b2-0000-0000-0000-000000000001', 'b4b4b4b4-0000-0000-0000-000000000001',
             'Cargar evidencias', 'Fotos del almacén', 'b1b1b1b1-0000-0000-0000-000000000004', 'Alta', current_date + 7)
     returning * $$,
  'El consultor asignado crea una tarea para el cliente (INSERT … RETURNING, como supabase-js)'
);
select throws_ok(
  $$ insert into public.tareas (consultoria_id, proyecto_id, titulo, asignado_a, fecha_vencimiento, estado)
     values ('b2b2b2b2-0000-0000-0000-000000000001', 'b4b4b4b4-0000-0000-0000-000000000001', 'Atajo',
             'b1b1b1b1-0000-0000-0000-000000000004', current_date, 'Completada') $$,
  '42501', null, 'Nadie crea una tarea ya Completada: el estado no se escribe directo'
);
select throws_ok(
  $$ insert into public.tareas (consultoria_id, proyecto_id, titulo, asignado_a, fecha_vencimiento, asignado_por)
     values ('b2b2b2b2-0000-0000-0000-000000000001', 'b4b4b4b4-0000-0000-0000-000000000001', 'Suplantación',
             'b1b1b1b1-0000-0000-0000-000000000004', current_date, 'b1b1b1b1-0000-0000-0000-000000000001') $$,
  '42501', null, 'Nadie asigna a nombre de otro: asignado_por lo pone el servidor'
);
select throws_ok(
  $$ insert into public.tareas (consultoria_id, proyecto_id, titulo, asignado_a, fecha_vencimiento)
     values ('b2b2b2b2-0000-0000-0000-000000000001', 'b4b4b4b4-0000-0000-0000-000000000001', 'Para otra empresa',
             'b1b1b1b1-0000-0000-0000-000000000005', current_date) $$,
  '22023', null, 'No se asigna a un cliente de OTRA empresa'
);
select throws_ok(
  $$ insert into public.tareas (consultoria_id, proyecto_id, titulo, asignado_a, fecha_vencimiento)
     values ('b2b2b2b2-0000-0000-0000-000000000001', 'b4b4b4b4-0000-0000-0000-000000000001', 'Para alguien de afuera',
             'b1b1b1b1-0000-0000-0000-000000000003', current_date) $$,
  '22023', null, 'No se asigna a un consultor que no es del proyecto'
);
select throws_ok(
  $$ update public.tareas set estado = 'Completada' where id = 'b5b5b5b5-0000-0000-0000-000000000001' $$,
  '42501', null, 'El estado no se cambia con UPDATE directo (solo por la RPC, que deja historial)'
);
select lives_ok(
  $$ update public.tareas set prioridad = 'Baja', fecha_vencimiento = current_date + 10 where id = 'b5b5b5b5-0000-0000-0000-000000000001' $$,
  'El equipo edita prioridad y fecha'
);
select throws_ok(
  $$ update public.tareas set asignado_a = 'b1b1b1b1-0000-0000-0000-000000000005' where id = 'b5b5b5b5-0000-0000-0000-000000000001' $$,
  '22023', null, 'Reasignar también valida al asignado'
);
reset role;

select is(
  (select array[asignado_por::text, estado, prioridad, (fecha_vencimiento - current_date)::text] from public.tareas where id = 'b5b5b5b5-0000-0000-0000-000000000001'),
  array['b1b1b1b1-0000-0000-0000-000000000002', 'Pendiente', 'Baja', '10'],
  'La tarea nace Pendiente, asignada por K1, con la edición aplicada'
);

-- ─── U: el cliente asignado avanza, pero no cierra ──────────────────────────
select set_config('request.jwt.claims', '{"sub":"b1b1b1b1-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$ insert into public.tareas (consultoria_id, proyecto_id, titulo, asignado_a, fecha_vencimiento)
     values ('b2b2b2b2-0000-0000-0000-000000000001', 'b4b4b4b4-0000-0000-0000-000000000001', 'Me la asigno',
             'b1b1b1b1-0000-0000-0000-000000000004', current_date) $$,
  '42501', null, 'El cliente no crea tareas'
);
select is(
  (select count(*)::int from public.tareas where proyecto_id = 'b4b4b4b4-0000-0000-0000-000000000001'),
  2, 'El cliente ve las tareas de su proyecto'
);
select lives_ok(
  $$ select public.cambiar_estado_tarea('b5b5b5b5-0000-0000-0000-000000000001', 'En proceso', null) $$,
  'El cliente asignado pasa su tarea a En proceso'
);
select lives_ok(
  $$ select public.cambiar_estado_tarea('b5b5b5b5-0000-0000-0000-000000000001', 'En revisión', 'Ya subí las fotos') $$,
  'El cliente asignado la manda a revisión (con comentario)'
);
select throws_ok(
  $$ select public.cambiar_estado_tarea('b5b5b5b5-0000-0000-0000-000000000001', 'Completada', null) $$,
  '42501', null, 'El cliente NO completa su propia tarea (el avance del proyecto depende de esto)'
);
select throws_ok(
  $$ select public.cambiar_estado_tarea('b5b5b5b5-0000-0000-0000-000000000002', 'En proceso', null) $$,
  '42501', null, 'El cliente no avanza una tarea que no es suya'
);
select is_empty(
  $$ update public.tareas set titulo = 'Hackeada' where id = 'b5b5b5b5-0000-0000-0000-000000000001' returning id $$,
  'El cliente no edita los datos de la tarea (RLS: 0 filas)'
);
reset role;

-- ─── U2: cliente de otra empresa ────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"b1b1b1b1-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*)::int from public.tareas where proyecto_id = 'b4b4b4b4-0000-0000-0000-000000000001'),
  0, 'Un cliente de otra empresa no ve las tareas'
);
select throws_ok(
  $$ select public.cambiar_estado_tarea('b5b5b5b5-0000-0000-0000-000000000001', 'En proceso', null) $$,
  '42501', null, 'Un cliente de otra empresa no cambia el estado'
);
reset role;

-- ─── K2: consultor NO asignado al proyecto ──────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"b1b1b1b1-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.cambiar_estado_tarea('b5b5b5b5-0000-0000-0000-000000000001', 'Completada', null) $$,
  '42501', null, 'Un consultor que no es del proyecto no la cierra'
);
reset role;

-- ─── K1: el equipo devuelve y después cierra ────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"b1b1b1b1-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.cambiar_estado_tarea('b5b5b5b5-0000-0000-0000-000000000001', 'Vencida', null) $$,
  '22023', null, '"Vencida" no es un estado: se calcula con la fecha'
);
select throws_ok(
  $$ select public.cambiar_estado_tarea('b5b5b5b5-0000-0000-0000-000000000001', 'En revisión', null) $$,
  '22023', null, 'Pasar al mismo estado es un error'
);
select lives_ok(
  $$ select public.cambiar_estado_tarea('b5b5b5b5-0000-0000-0000-000000000001', 'Requiere corrección', 'Faltan las del patio') $$,
  'El equipo la devuelve con un comentario'
);
reset role;

-- El cliente retoma el trabajo y la vuelve a mandar.
select set_config('request.jwt.claims', '{"sub":"b1b1b1b1-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.cambiar_estado_tarea('b5b5b5b5-0000-0000-0000-000000000001', 'En proceso', null) $$,
  'Una tarea devuelta vuelve a En proceso de mano del asignado'
);
select lives_ok(
  $$ select public.cambiar_estado_tarea('b5b5b5b5-0000-0000-0000-000000000001', 'En revisión', null) $$,
  'Y otra vez a revisión'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"b1b1b1b1-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.cambiar_estado_tarea('b5b5b5b5-0000-0000-0000-000000000001', 'Completada', null) $$,
  'El equipo la da por completada'
);
select is_empty(
  $$ delete from public.tareas where id = 'b5b5b5b5-0000-0000-0000-000000000002' returning id $$,
  'Un consultor no borra tareas (solo el admin de la consultoría)'
);
reset role;

select is(
  (select array[estado, (fecha_completada = current_date)::text] from public.tareas where id = 'b5b5b5b5-0000-0000-0000-000000000001'),
  array['Completada', 'true'],
  'Queda Completada con la fecha de hoy (la pone el servidor)'
);
select is(
  (select array_agg(estado_nuevo || ':' || n.nombre order by h.id)
   from public.historial h join public.perfiles n on n.id = h.autor_id
   -- Solo los cambios de estado: desde L2 las reasignaciones y cambios de fecha también dejan evento.
   where h.entidad_tipo = 'tarea' and h.entidad_id = 'b5b5b5b5-0000-0000-0000-000000000001' and h.estado_nuevo is not null),
  array['En proceso:U', 'En revisión:U', 'Requiere corrección:K1', 'En proceso:U', 'En revisión:U', 'Completada:K1'],
  'El historial registra cada cambio con su autor real'
);
select is(
  -- Ordenado por texto: en una transacción now() es constante y el orden por fecha empata.
  (select array_agg(texto order by texto) from public.comentarios
   where entidad_tipo = 'tarea' and entidad_id = 'b5b5b5b5-0000-0000-0000-000000000001'),
  array['Faltan las del patio', 'Ya subí las fotos'],
  'Los comentarios de cada cambio quedan en la tabla de comentarios'
);

-- ─── A: admin de la consultoría borra ───────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"b1b1b1b1-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select isnt_empty(
  $$ delete from public.tareas where id = 'b5b5b5b5-0000-0000-0000-000000000002' returning id $$,
  'El admin de la consultoría borra una tarea'
);
reset role;

select * from finish();
rollback;
