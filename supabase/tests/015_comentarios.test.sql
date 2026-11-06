-- Comentarios transversales (decidido con el usuario el 2026-11-06):
--   · Se comenta sobre tarea, proceso, documento, evidencia o no conformidad.
--   · Comenta quien ve el proyecto (también el cliente), siempre a su nombre.
--   · Son inmutables: no se editan ni se borran.
--   · INTEGRIDAD: el comentario apunta a una entidad que existe, es del tipo
--     declarado y pertenece al MISMO proyecto (antes no se validaba).

begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

-- K consultor miembro de P1 · KX consultor sin proyectos · U cliente de E1 · U2 cliente de E2
insert into auth.users (id, email, aud, role) values
  ('0d0d0d0d-0000-0000-0000-000000000001', 'k@cm.test',  'authenticated', 'authenticated'),
  ('0d0d0d0d-0000-0000-0000-000000000002', 'kx@cm.test', 'authenticated', 'authenticated'),
  ('0d0d0d0d-0000-0000-0000-000000000003', 'u@cm.test',  'authenticated', 'authenticated'),
  ('0d0d0d0d-0000-0000-0000-000000000004', 'u2@cm.test', 'authenticated', 'authenticated');
insert into public.consultorias (id, nombre) values ('0d0d0d0d-0000-0000-0001-000000000001', 'Consultoría CM');
insert into public.empresas (id, consultoria_id, nombre) values
  ('0d0d0d0d-0000-0000-0002-000000000001', '0d0d0d0d-0000-0000-0001-000000000001', 'Empresa CM'),
  ('0d0d0d0d-0000-0000-0002-000000000002', '0d0d0d0d-0000-0000-0001-000000000001', 'Otra empresa CM');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('0d0d0d0d-0000-0000-0000-000000000001', 'K',  'k@cm.test',  'consultor',       '0d0d0d0d-0000-0000-0001-000000000001', null),
  ('0d0d0d0d-0000-0000-0000-000000000002', 'KX', 'kx@cm.test', 'consultor',       '0d0d0d0d-0000-0000-0001-000000000001', null),
  ('0d0d0d0d-0000-0000-0000-000000000003', 'U',  'u@cm.test',  'usuario_cliente', '0d0d0d0d-0000-0000-0001-000000000001', '0d0d0d0d-0000-0000-0002-000000000001'),
  ('0d0d0d0d-0000-0000-0000-000000000004', 'U2', 'u2@cm.test', 'usuario_cliente', '0d0d0d0d-0000-0000-0001-000000000001', '0d0d0d0d-0000-0000-0002-000000000002');
insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('0d0d0d0d-0000-0000-0003-000000000001', '0d0d0d0d-0000-0000-0001-000000000001', '0d0d0d0d-0000-0000-0002-000000000001', 'P1 CM'),
  ('0d0d0d0d-0000-0000-0003-000000000002', '0d0d0d0d-0000-0000-0001-000000000001', '0d0d0d0d-0000-0000-0002-000000000002', 'P2 CM');
-- K trabaja en P1 y en P2: ve las dos entidades, así que solo la regla de
-- "mismo proyecto" impide cruzarlas (con un usuario que ve uno solo, el RLS
-- ya ocultaba la entidad ajena y la regla no se ejercitaba).
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('0d0d0d0d-0000-0000-0003-000000000001', '0d0d0d0d-0000-0000-0000-000000000001', '0d0d0d0d-0000-0000-0001-000000000001'),
  ('0d0d0d0d-0000-0000-0003-000000000002', '0d0d0d0d-0000-0000-0000-000000000001', '0d0d0d0d-0000-0000-0001-000000000001');

-- PR1, EV1, NC1 en P1 · PR2 en P2
insert into public.procesos (id, consultoria_id, proyecto_id, nombre) values
  ('0d0d0d0d-0000-0000-0004-000000000001', '0d0d0d0d-0000-0000-0001-000000000001', '0d0d0d0d-0000-0000-0003-000000000001', 'Compras'),
  ('0d0d0d0d-0000-0000-0004-000000000002', '0d0d0d0d-0000-0000-0001-000000000001', '0d0d0d0d-0000-0000-0003-000000000002', 'Ventas');
insert into public.evidencias (id, consultoria_id, proyecto_id, nombre, tipo) values
  ('0d0d0d0d-0000-0000-0005-000000000001', '0d0d0d0d-0000-0000-0001-000000000001', '0d0d0d0d-0000-0000-0003-000000000001', 'Foto almacén', 'Foto');
insert into public.no_conformidades (id, consultoria_id, proyecto_id, folio, descripcion, fecha_deteccion, responsable_id, registrada_por) values
  ('0d0d0d0d-0000-0000-0006-000000000001', '0d0d0d0d-0000-0000-0001-000000000001', '0d0d0d0d-0000-0000-0003-000000000001',
   'x', 'Faltan firmas', current_date, '0d0d0d0d-0000-0000-0000-000000000003', '0d0d0d0d-0000-0000-0000-000000000001');

-- ─── U: cliente de E1 ───────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"0d0d0d0d-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ insert into public.comentarios (id, consultoria_id, proyecto_id, entidad_tipo, entidad_id, texto)
     values ('0d0d0d0d-0000-0000-0007-000000000001', '0d0d0d0d-0000-0000-0001-000000000001', '0d0d0d0d-0000-0000-0003-000000000001',
             'proceso', '0d0d0d0d-0000-0000-0004-000000000001', 'Falta el responsable') returning * $$,
  'El cliente comenta un proceso de su proyecto (INSERT … RETURNING)'
);
select lives_ok(
  $$ insert into public.comentarios (consultoria_id, proyecto_id, entidad_tipo, entidad_id, texto)
     values ('0d0d0d0d-0000-0000-0001-000000000001', '0d0d0d0d-0000-0000-0003-000000000001',
             'no_conformidad', '0d0d0d0d-0000-0000-0006-000000000001', 'Ya conseguimos las firmas') $$,
  'El cliente comenta una no conformidad de su proyecto'
);
select throws_ok(
  $$ insert into public.comentarios (consultoria_id, proyecto_id, entidad_tipo, entidad_id, texto)
     values ('0d0d0d0d-0000-0000-0001-000000000001', '0d0d0d0d-0000-0000-0003-000000000002',
             'proceso', '0d0d0d0d-0000-0000-0004-000000000002', 'Intruso') $$,
  '42501', null, 'Nadie comenta en un proyecto que no ve'
);
select throws_ok(
  $$ insert into public.comentarios (consultoria_id, proyecto_id, entidad_tipo, entidad_id, texto, autor_id)
     values ('0d0d0d0d-0000-0000-0001-000000000001', '0d0d0d0d-0000-0000-0003-000000000001',
             'proceso', '0d0d0d0d-0000-0000-0004-000000000001', 'Suplantado', '0d0d0d0d-0000-0000-0000-000000000001') $$,
  '42501', null, 'Nadie comenta a nombre de otro'
);
-- Integridad
select throws_ok(
  $$ insert into public.comentarios (consultoria_id, proyecto_id, entidad_tipo, entidad_id, texto)
     values ('0d0d0d0d-0000-0000-0001-000000000001', '0d0d0d0d-0000-0000-0003-000000000001',
             'proceso', '0d0d0d0d-0000-0000-0004-000000000002', 'Apunta a otro proyecto') $$,
  '22023', null, 'El comentario no puede apuntar a una entidad de otro proyecto'
);
select throws_ok(
  $$ insert into public.comentarios (consultoria_id, proyecto_id, entidad_tipo, entidad_id, texto)
     values ('0d0d0d0d-0000-0000-0001-000000000001', '0d0d0d0d-0000-0000-0003-000000000001',
             'evidencia', '0d0d0d0d-0000-0000-0009-000000000099', 'No existe') $$,
  '22023', null, 'El comentario no puede apuntar a una entidad que no existe'
);
select throws_ok(
  $$ insert into public.comentarios (consultoria_id, proyecto_id, entidad_tipo, entidad_id, texto)
     values ('0d0d0d0d-0000-0000-0001-000000000001', '0d0d0d0d-0000-0000-0003-000000000001',
             'tarea', '0d0d0d0d-0000-0000-0004-000000000001', 'Tipo equivocado') $$,
  '22023', null, 'El tipo declarado tiene que coincidir con la entidad'
);
-- Inmutables
select throws_ok(
  $$ update public.comentarios set texto = 'Editado' where id = '0d0d0d0d-0000-0000-0007-000000000001' $$,
  '42501', null, 'Los comentarios no se editan'
);
select throws_ok(
  $$ delete from public.comentarios where id = '0d0d0d0d-0000-0000-0007-000000000001' $$,
  '42501', null, 'Los comentarios no se borran'
);
select is((select count(*)::int from public.comentarios where proyecto_id = '0d0d0d0d-0000-0000-0003-000000000001'), 2,
  'El cliente ve los comentarios de su proyecto');
reset role;

-- ─── K: consultor miembro ───────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"0d0d0d0d-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ insert into public.comentarios (consultoria_id, proyecto_id, entidad_tipo, entidad_id, texto)
     values ('0d0d0d0d-0000-0000-0001-000000000001', '0d0d0d0d-0000-0000-0003-000000000001',
             'evidencia', '0d0d0d0d-0000-0000-0005-000000000001', 'Se ve bien') $$,
  'El consultor del proyecto comenta una evidencia'
);
select throws_ok(
  $$ insert into public.comentarios (consultoria_id, proyecto_id, entidad_tipo, entidad_id, texto)
     values ('0d0d0d0d-0000-0000-0001-000000000001', '0d0d0d0d-0000-0000-0003-000000000001',
             'proceso', '0d0d0d0d-0000-0000-0004-000000000002', 'Cruzado entre mis proyectos') $$,
  '22023', null, 'Aunque vea los dos proyectos, no cuelga en P1 un comentario de un proceso de P2'
);
reset role;

-- ─── KX: consultor sin el proyecto · U2: cliente de otra empresa ────────────
select set_config('request.jwt.claims', '{"sub":"0d0d0d0d-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.comentarios (consultoria_id, proyecto_id, entidad_tipo, entidad_id, texto)
     values ('0d0d0d0d-0000-0000-0001-000000000001', '0d0d0d0d-0000-0000-0003-000000000001',
             'proceso', '0d0d0d0d-0000-0000-0004-000000000001', 'No soy del equipo') $$,
  '42501', null, 'Un consultor que no es del proyecto no comenta'
);
select is((select count(*)::int from public.comentarios), 0, 'Un consultor que no es del proyecto no ve sus comentarios');
reset role;

select set_config('request.jwt.claims', '{"sub":"0d0d0d0d-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.comentarios), 0, 'El cliente de otra empresa no ve los comentarios ajenos');
reset role;

select * from finish();
rollback;
