-- O31 · No se agregan tareas a un proyecto Finalizado: cambiarían su avance y su historia. Una tarea ya existente
-- se sigue pudiendo editar (la regla es solo al crear).

begin;
create extension if not exists pgtap with schema extensions;

select plan(5);

insert into auth.users (id, email, aud, role) values
  ('f5f5f5f5-0000-0000-0000-000000000001', 'k@pf.test', 'authenticated', 'authenticated');
insert into public.consultorias (id, nombre) values ('f6f6f6f6-0000-0000-0000-000000000001', 'Consultoría PF');
insert into public.empresas (id, consultoria_id, nombre) values
  ('f7f7f7f7-0000-0000-0000-000000000001', 'f6f6f6f6-0000-0000-0000-000000000001', 'Empresa PF');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('f5f5f5f5-0000-0000-0000-000000000001', 'K', 'k@pf.test', 'consultor', 'f6f6f6f6-0000-0000-0000-000000000001', null);
insert into public.proyectos (id, consultoria_id, empresa_id, nombre, estado) values
  ('f8f8f8f8-0000-0000-0000-000000000001', 'f6f6f6f6-0000-0000-0000-000000000001', 'f7f7f7f7-0000-0000-0000-000000000001', 'Activo PF', 'Planificación'),
  ('f8f8f8f8-0000-0000-0000-000000000002', 'f6f6f6f6-0000-0000-0000-000000000001', 'f7f7f7f7-0000-0000-0000-000000000001', 'Cerrado PF', 'Planificación');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('f8f8f8f8-0000-0000-0000-000000000001', 'f5f5f5f5-0000-0000-0000-000000000001', 'f6f6f6f6-0000-0000-0000-000000000001'),
  ('f8f8f8f8-0000-0000-0000-000000000002', 'f5f5f5f5-0000-0000-0000-000000000001', 'f6f6f6f6-0000-0000-0000-000000000001');
-- Una tarea que ya estaba en el proyecto cuando se cerró.
insert into public.tareas (id, consultoria_id, proyecto_id, titulo, descripcion, asignado_a, asignado_por, estado, prioridad, fecha_vencimiento) values
  ('f9f9f9f9-0000-0000-0000-000000000001', 'f6f6f6f6-0000-0000-0000-000000000001', 'f8f8f8f8-0000-0000-0000-000000000002',
   'Vieja', '', 'f5f5f5f5-0000-0000-0000-000000000001', 'f5f5f5f5-0000-0000-0000-000000000001', 'Pendiente', 'Media', current_date);

-- Se cierra DESPUÉS de tener su tarea (insertarla en un proyecto ya cerrado es justo lo que la regla impide).
update public.proyectos set estado = 'Finalizado' where id = 'f8f8f8f8-0000-0000-0000-000000000002';

select set_config('request.jwt.claims', '{"sub":"f5f5f5f5-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$ insert into public.tareas (consultoria_id, proyecto_id, titulo, descripcion, asignado_a, prioridad, fecha_vencimiento)
     values ('f6f6f6f6-0000-0000-0000-000000000001', 'f8f8f8f8-0000-0000-0000-000000000001', 'Nueva en activo', '', 'f5f5f5f5-0000-0000-0000-000000000001', 'Media', current_date) $$,
  'Se agrega una tarea a un proyecto en curso'
);
select throws_ok(
  $$ insert into public.tareas (consultoria_id, proyecto_id, titulo, descripcion, asignado_a, prioridad, fecha_vencimiento)
     values ('f6f6f6f6-0000-0000-0000-000000000001', 'f8f8f8f8-0000-0000-0000-000000000002', 'Nueva en cerrado', '', 'f5f5f5f5-0000-0000-0000-000000000001', 'Media', current_date) $$,
  '22023', 'El proyecto está finalizado: no se le agregan tareas', 'No se agrega una tarea a un proyecto Finalizado'
);
select lives_ok(
  $$ update public.tareas set descripcion = 'Corregida' where id = 'f9f9f9f9-0000-0000-0000-000000000001' $$,
  'Una tarea que ya estaba en el proyecto cerrado se sigue pudiendo editar'
);
reset role;

select is(
  (select count(*) from public.tareas where proyecto_id = 'f8f8f8f8-0000-0000-0000-000000000002'),
  1::bigint, 'El proyecto Finalizado sigue con su única tarea'
);
select is(
  (select descripcion from public.tareas where id = 'f9f9f9f9-0000-0000-0000-000000000001'),
  'Corregida', 'La edición quedó guardada'
);

select * from finish();
rollback;
