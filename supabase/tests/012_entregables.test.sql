-- Entregables: el equipo los registra y los entrega; el CLIENTE de la empresa los
-- aprueba o rechaza (elegido por el usuario el 2026-11-07). Un entregable vinculado
-- a un documento solo se aprueba si el documento (o una versión posterior con el
-- mismo código) está Aprobado. Un proyecto no se finaliza con entregables sin aprobar.

begin;
create extension if not exists pgtap with schema extensions;

select plan(28);

-- A admin · K1 consultor del proyecto · K2 consultor de afuera · U cliente de la empresa · U2 cliente de OTRA empresa
insert into auth.users (id, email, aud, role) values
  ('a1a1a1a1-0000-0000-0000-000000000001', 'a@en.test',  'authenticated', 'authenticated'),
  ('a1a1a1a1-0000-0000-0000-000000000002', 'k1@en.test', 'authenticated', 'authenticated'),
  ('a1a1a1a1-0000-0000-0000-000000000003', 'k2@en.test', 'authenticated', 'authenticated'),
  ('a1a1a1a1-0000-0000-0000-000000000004', 'u@en.test',  'authenticated', 'authenticated'),
  ('a1a1a1a1-0000-0000-0000-000000000005', 'u2@en.test', 'authenticated', 'authenticated');
insert into public.consultorias (id, nombre) values ('a2a2a2a2-0000-0000-0000-000000000001', 'Consultoría EN');
insert into public.empresas (id, consultoria_id, nombre) values
  ('a3a3a3a3-0000-0000-0000-000000000001', 'a2a2a2a2-0000-0000-0000-000000000001', 'Empresa EN'),
  ('a3a3a3a3-0000-0000-0000-000000000002', 'a2a2a2a2-0000-0000-0000-000000000001', 'Otra empresa EN');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('a1a1a1a1-0000-0000-0000-000000000001', 'A',  'a@en.test',  'admin_consultoria', 'a2a2a2a2-0000-0000-0000-000000000001', null),
  ('a1a1a1a1-0000-0000-0000-000000000002', 'K1', 'k1@en.test', 'consultor',         'a2a2a2a2-0000-0000-0000-000000000001', null),
  ('a1a1a1a1-0000-0000-0000-000000000003', 'K2', 'k2@en.test', 'consultor',         'a2a2a2a2-0000-0000-0000-000000000001', null),
  ('a1a1a1a1-0000-0000-0000-000000000004', 'U',  'u@en.test',  'usuario_cliente',   'a2a2a2a2-0000-0000-0000-000000000001', 'a3a3a3a3-0000-0000-0000-000000000001'),
  ('a1a1a1a1-0000-0000-0000-000000000005', 'U2', 'u2@en.test', 'usuario_cliente',   'a2a2a2a2-0000-0000-0000-000000000001', 'a3a3a3a3-0000-0000-0000-000000000002');
insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('a4a4a4a4-0000-0000-0000-000000000001', 'a2a2a2a2-0000-0000-0000-000000000001', 'a3a3a3a3-0000-0000-0000-000000000001', 'Proyecto EN'),
  ('a4a4a4a4-0000-0000-0000-000000000002', 'a2a2a2a2-0000-0000-0000-000000000001', 'a3a3a3a3-0000-0000-0000-000000000001', 'Otro proyecto EN');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('a4a4a4a4-0000-0000-0000-000000000001', 'a1a1a1a1-0000-0000-0000-000000000002', 'a2a2a2a2-0000-0000-0000-000000000001');
-- D1: documento del proyecto, todavía en revisión · DX: documento de OTRO proyecto
insert into public.documentos (id, consultoria_id, proyecto_id, nombre, tipo, estado, version, codigo) values
  ('a5a5a5a5-0000-0000-0000-000000000001', 'a2a2a2a2-0000-0000-0000-000000000001', 'a4a4a4a4-0000-0000-0000-000000000001', 'Compras', 'Procedimiento', 'Pendiente de revisión', '1.0', 'PRO-1'),
  ('a5a5a5a5-0000-0000-0000-0000000000ff', 'a2a2a2a2-0000-0000-0000-000000000001', 'a4a4a4a4-0000-0000-0000-000000000002', 'Ajeno', 'Procedimiento', 'Aprobado', '1.0', 'PRO-X');

-- ─── K1: el equipo registra ─────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$ insert into public.entregables (id, consultoria_id, proyecto_id, nombre, tipo, fecha_entrega, documento_id)
     values ('a6a6a6a6-0000-0000-0000-000000000001', 'a2a2a2a2-0000-0000-0000-000000000001', 'a4a4a4a4-0000-0000-0000-000000000001',
             'Procedimiento de compras', 'Procedimiento', current_date + 10, 'a5a5a5a5-0000-0000-0000-000000000001')
     returning * $$,
  'El consultor registra un entregable vinculado a un documento (INSERT … RETURNING)'
);
select lives_ok(
  $$ insert into public.entregables (id, consultoria_id, proyecto_id, nombre, tipo, fecha_entrega) values
       ('a6a6a6a6-0000-0000-0000-000000000002', 'a2a2a2a2-0000-0000-0000-000000000001', 'a4a4a4a4-0000-0000-0000-000000000001', 'Informe de diagnóstico', 'Informe', current_date),
       ('a6a6a6a6-0000-0000-0000-000000000003', 'a2a2a2a2-0000-0000-0000-000000000001', 'a4a4a4a4-0000-0000-0000-000000000001', 'Plan de trabajo', 'Plan', current_date) $$,
  'Registra dos entregables más, sin documento'
);
select throws_ok(
  $$ insert into public.entregables (consultoria_id, proyecto_id, nombre, estado)
     values ('a2a2a2a2-0000-0000-0000-000000000001', 'a4a4a4a4-0000-0000-0000-000000000001', 'Atajo', 'Aprobado') $$,
  '42501', null, 'Nadie registra un entregable ya Aprobado: el estado no se escribe directo'
);
select throws_ok(
  $$ insert into public.entregables (consultoria_id, proyecto_id, nombre, documento_id)
     values ('a2a2a2a2-0000-0000-0000-000000000001', 'a4a4a4a4-0000-0000-0000-000000000001', 'Doc ajeno', 'a5a5a5a5-0000-0000-0000-0000000000ff') $$,
  '23503', null, 'No se vincula un documento de OTRO proyecto'
);
select throws_ok(
  $$ update public.entregables set estado = 'Aprobado' where id = 'a6a6a6a6-0000-0000-0000-000000000002' $$,
  '42501', null, 'El estado no se cambia con UPDATE directo'
);
select throws_ok(
  $$ select public.decidir_entregable('a6a6a6a6-0000-0000-0000-000000000002', 'Aprobado', null) $$,
  '42501', null, 'El equipo NO aprueba sus propios entregables'
);
select lives_ok(
  $$ select public.decidir_entregable('a6a6a6a6-0000-0000-0000-000000000002', 'En revisión', null) $$,
  'El equipo entrega (Pendiente → En revisión)'
);
select throws_ok(
  $$ select public.decidir_entregable('a6a6a6a6-0000-0000-0000-000000000002', 'En revisión', null) $$,
  '22023', null, 'No se entrega dos veces lo que ya está en revisión'
);
select is_empty(
  $$ delete from public.entregables where id = 'a6a6a6a6-0000-0000-0000-000000000003' returning id $$,
  'Un consultor no borra entregables (solo el admin)'
);
reset role;

-- ─── U: el cliente decide ───────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$ insert into public.entregables (consultoria_id, proyecto_id, nombre)
     values ('a2a2a2a2-0000-0000-0000-000000000001', 'a4a4a4a4-0000-0000-0000-000000000001', 'Del cliente') $$,
  '42501', null, 'El cliente no registra entregables'
);
select is(
  (select count(*)::int from public.entregables where proyecto_id = 'a4a4a4a4-0000-0000-0000-000000000001'),
  3, 'El cliente ve los entregables de su empresa'
);
select throws_ok(
  $$ select public.decidir_entregable('a6a6a6a6-0000-0000-0000-000000000003', 'En revisión', null) $$,
  '42501', null, 'El cliente no entrega (eso lo hace la consultoría)'
);
select throws_ok(
  $$ select public.decidir_entregable('a6a6a6a6-0000-0000-0000-000000000002', 'Rechazado', '  ') $$,
  '22023', null, 'Rechazar exige explicar el motivo'
);
select lives_ok(
  $$ select public.decidir_entregable('a6a6a6a6-0000-0000-0000-000000000002', 'Rechazado', 'Falta el análisis de brechas') $$,
  'El cliente rechaza con un comentario'
);
select throws_ok(
  $$ select public.decidir_entregable('a6a6a6a6-0000-0000-0000-000000000002', 'Aprobado', null) $$,
  '22023', null, 'Lo rechazado no se aprueba sin volver a entregarse'
);
reset role;

select is(
  (select array[e.estado, c.texto, c.autor_id::text] from public.entregables e
   join public.comentarios c on c.entidad_tipo = 'entregable' and c.entidad_id = e.id
   where e.id = 'a6a6a6a6-0000-0000-0000-000000000002'),
  array['Rechazado', 'Falta el análisis de brechas', 'a1a1a1a1-0000-0000-0000-000000000004'],
  'Queda Rechazado con el comentario del cliente'
);

-- ─── De afuera ──────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.entregables), 0, 'Un cliente de otra empresa no ve los entregables');
reset role;

select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.decidir_entregable('a6a6a6a6-0000-0000-0000-000000000002', 'En revisión', null) $$,
  '42501', null, 'Un consultor que no es del proyecto no entrega'
);
reset role;

-- ─── Se vuelve a entregar y el cliente aprueba ──────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.decidir_entregable('a6a6a6a6-0000-0000-0000-000000000002', 'En revisión', null) $$,
  'El equipo vuelve a entregar lo rechazado'
);
select lives_ok(
  $$ select public.decidir_entregable('a6a6a6a6-0000-0000-0000-000000000001', 'En revisión', null) $$,
  'El equipo entrega el entregable vinculado al documento'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.decidir_entregable('a6a6a6a6-0000-0000-0000-000000000002', 'Aprobado', null) $$,
  'El cliente aprueba'
);
select throws_ok(
  $$ select public.decidir_entregable('a6a6a6a6-0000-0000-0000-000000000001', 'Aprobado', null) $$,
  '22023', null, 'Un entregable vinculado no se aprueba si su documento no está aprobado'
);
reset role;

select is(
  (select array[estado, aprobado_por::text, (fecha_aprobacion = current_date)::text] from public.entregables where id = 'a6a6a6a6-0000-0000-0000-000000000002'),
  array['Aprobado', 'a1a1a1a1-0000-0000-0000-000000000004', 'true'],
  'Queda Aprobado por el cliente, con fecha de hoy'
);

-- El documento se reemplaza por una versión 1.1 aprobada (mismo código).
update public.documentos set estado = 'Obsoleto' where id = 'a5a5a5a5-0000-0000-0000-000000000001';
insert into public.documentos (id, consultoria_id, proyecto_id, nombre, tipo, estado, version, codigo) values
  ('a5a5a5a5-0000-0000-0000-000000000002', 'a2a2a2a2-0000-0000-0000-000000000001', 'a4a4a4a4-0000-0000-0000-000000000001', 'Compras', 'Procedimiento', 'Aprobado', '1.1', 'PRO-1');

select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.decidir_entregable('a6a6a6a6-0000-0000-0000-000000000001', 'Aprobado', null) $$,
  'Con una versión posterior aprobada (mismo código), el vinculado ya se aprueba'
);
reset role;

-- ─── Finalizar el proyecto ──────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ update public.proyectos set estado = 'Finalizado' where id = 'a4a4a4a4-0000-0000-0000-000000000001' $$,
  '22023', null, 'No se finaliza un proyecto con entregables sin aprobar (aunque se intente por API)'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select isnt_empty(
  $$ delete from public.entregables where id = 'a6a6a6a6-0000-0000-0000-000000000003' returning id $$,
  'El admin borra el entregable que quedaba pendiente'
);
select lives_ok(
  $$ update public.proyectos set estado = 'Finalizado' where id = 'a4a4a4a4-0000-0000-0000-000000000001' $$,
  'Con todo aprobado, el proyecto se finaliza'
);
reset role;

select is(
  (select array_agg(h.estado_nuevo || ':' || p.nombre order by h.id)
   from public.historial h join public.perfiles p on p.id = h.autor_id
   where h.entidad_tipo = 'entregable' and h.entidad_id = 'a6a6a6a6-0000-0000-0000-000000000002'),
  array['En revisión:K1', 'Rechazado:U', 'En revisión:K1', 'Aprobado:U'],
  'El historial registra cada paso con su autor real'
);

select * from finish();
rollback;
