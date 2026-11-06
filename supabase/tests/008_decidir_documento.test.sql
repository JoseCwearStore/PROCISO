-- decidir_documento: la revisión de un documento.
-- Regla del negocio: el EQUIPO revisa (pide corrección o rechaza) y el CLIENTE
-- de la empresa APRUEBA (o pide corrección). Al aprobar, la versión aprobada
-- anterior del mismo documento queda Obsoleta en la misma transacción.

begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

-- K1 consultor asignado · K2 consultor NO asignado · U cliente de la empresa · U2 cliente de OTRA empresa
insert into auth.users (id, email, aud, role) values
  ('c1c1c1c1-0000-0000-0000-000000000001', 'k1@dd.test', 'authenticated', 'authenticated'),
  ('c1c1c1c1-0000-0000-0000-000000000002', 'k2@dd.test', 'authenticated', 'authenticated'),
  ('c1c1c1c1-0000-0000-0000-000000000003', 'u@dd.test',  'authenticated', 'authenticated'),
  ('c1c1c1c1-0000-0000-0000-000000000004', 'u2@dd.test', 'authenticated', 'authenticated');
insert into public.consultorias (id, nombre) values ('c2c2c2c2-0000-0000-0000-000000000001', 'Consultoría DD');
insert into public.empresas (id, consultoria_id, nombre) values
  ('c3c3c3c3-0000-0000-0000-000000000001', 'c2c2c2c2-0000-0000-0000-000000000001', 'Empresa DD'),
  ('c3c3c3c3-0000-0000-0000-000000000002', 'c2c2c2c2-0000-0000-0000-000000000001', 'Otra empresa DD');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('c1c1c1c1-0000-0000-0000-000000000001', 'K1', 'k1@dd.test', 'consultor',       'c2c2c2c2-0000-0000-0000-000000000001', null),
  ('c1c1c1c1-0000-0000-0000-000000000002', 'K2', 'k2@dd.test', 'consultor',       'c2c2c2c2-0000-0000-0000-000000000001', null),
  ('c1c1c1c1-0000-0000-0000-000000000003', 'U',  'u@dd.test',  'usuario_cliente', 'c2c2c2c2-0000-0000-0000-000000000001', 'c3c3c3c3-0000-0000-0000-000000000001'),
  ('c1c1c1c1-0000-0000-0000-000000000004', 'U2', 'u2@dd.test', 'usuario_cliente', 'c2c2c2c2-0000-0000-0000-000000000001', 'c3c3c3c3-0000-0000-0000-000000000002');
insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('c4c4c4c4-0000-0000-0000-000000000001', 'c2c2c2c2-0000-0000-0000-000000000001', 'c3c3c3c3-0000-0000-0000-000000000001', 'Proyecto DD'),
  ('c4c4c4c4-0000-0000-0000-000000000002', 'c2c2c2c2-0000-0000-0000-000000000001', 'c3c3c3c3-0000-0000-0000-000000000001', 'Otro proyecto DD');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('c4c4c4c4-0000-0000-0000-000000000001', 'c1c1c1c1-0000-0000-0000-000000000001', 'c2c2c2c2-0000-0000-0000-000000000001');

-- V1 aprobada (vigente), V2 pendiente (mismo código), OTRO: aprobado con el mismo código pero en OTRO proyecto, B: borrador
insert into public.documentos (id, consultoria_id, proyecto_id, nombre, tipo, estado, version, codigo, bloqueado) values
  ('c5c5c5c5-0000-0000-0000-000000000001', 'c2c2c2c2-0000-0000-0000-000000000001', 'c4c4c4c4-0000-0000-0000-000000000001', 'Compras', 'Procedimiento', 'Aprobado', '1.0', 'PRO-1', true),
  ('c5c5c5c5-0000-0000-0000-000000000002', 'c2c2c2c2-0000-0000-0000-000000000001', 'c4c4c4c4-0000-0000-0000-000000000001', 'Compras', 'Procedimiento', 'Pendiente de revisión', '1.1', 'PRO-1', false),
  ('c5c5c5c5-0000-0000-0000-000000000003', 'c2c2c2c2-0000-0000-0000-000000000001', 'c4c4c4c4-0000-0000-0000-000000000002', 'Compras', 'Procedimiento', 'Aprobado', '3.0', 'PRO-1', true),
  ('c5c5c5c5-0000-0000-0000-000000000004', 'c2c2c2c2-0000-0000-0000-000000000001', 'c4c4c4c4-0000-0000-0000-000000000001', 'Política', 'Política', 'Borrador', '0.1', 'POL-1', false);
insert into public.documento_versiones (consultoria_id, proyecto_id, documento_id, version, estado) values
  ('c2c2c2c2-0000-0000-0000-000000000001', 'c4c4c4c4-0000-0000-0000-000000000001', 'c5c5c5c5-0000-0000-0000-000000000002', '1.1', 'Pendiente de revisión');

-- ─── Anónimo ────────────────────────────────────────────────────────────────
set local role anon;
select throws_ok(
  $$ select public.decidir_documento('c5c5c5c5-0000-0000-0000-000000000002', 'Aprobado', null, null) $$,
  '42501', null, 'Un anónimo no puede decidir'
);
reset role;

-- ─── K1: consultor asignado (revisa, NO aprueba) ────────────────────────────
select set_config('request.jwt.claims', '{"sub":"c1c1c1c1-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.decidir_documento('c5c5c5c5-0000-0000-0000-000000000002', 'Aprobado', null, null) $$,
  '42501', null, 'El consultor no puede aprobar (aprueba el cliente)'
);
select throws_ok(
  $$ select public.decidir_documento('c5c5c5c5-0000-0000-0000-000000000002', 'En corrección', null, '  ') $$,
  '22023', null, 'Pedir corrección exige sección y comentario'
);
select lives_ok(
  $$ select public.decidir_documento('c5c5c5c5-0000-0000-0000-000000000002', 'En corrección', 's1', 'Falta el alcance') $$,
  'El consultor pide una corrección anclada a una sección'
);
reset role;

select is(
  (select array[estado, revisado_por::text] from public.documentos where id = 'c5c5c5c5-0000-0000-0000-000000000002'),
  array['En corrección', 'c1c1c1c1-0000-0000-0000-000000000001'],
  'El documento queda En corrección y el consultor figura como revisor'
);
select is(
  (select array[seccion_id, texto, autor_id::text] from public.comentarios where entidad_id = 'c5c5c5c5-0000-0000-0000-000000000002'),
  array['s1', 'Falta el alcance', 'c1c1c1c1-0000-0000-0000-000000000001'],
  'El comentario quedó guardado en su sección'
);

-- Se corrige y se vuelve a enviar.
update public.documentos set estado = 'Pendiente de revisión' where id = 'c5c5c5c5-0000-0000-0000-000000000002';

-- ─── K2: consultor NO asignado ──────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"c1c1c1c1-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.decidir_documento('c5c5c5c5-0000-0000-0000-000000000002', 'Rechazado', 's1', 'No') $$,
  '42501', null, 'Un consultor no asignado no puede revisar'
);
reset role;

-- ─── U2: cliente de OTRA empresa ────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"c1c1c1c1-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.decidir_documento('c5c5c5c5-0000-0000-0000-000000000002', 'Aprobado', null, null) $$,
  '42501', null, 'Un cliente de otra empresa no puede aprobar'
);
reset role;

-- ─── U: cliente de la empresa (aprueba, NO rechaza) ─────────────────────────
select set_config('request.jwt.claims', '{"sub":"c1c1c1c1-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.decidir_documento('c5c5c5c5-0000-0000-0000-000000000002', 'Rechazado', 's1', 'No me gusta') $$,
  '42501', null, 'El cliente no rechaza (pide corrección o aprueba)'
);
select throws_ok(
  $$ select public.decidir_documento('c5c5c5c5-0000-0000-0000-000000000004', 'Aprobado', null, null) $$,
  '22023', null, 'Solo se decide sobre documentos pendientes de revisión'
);
select lives_ok(
  $$ select public.decidir_documento('c5c5c5c5-0000-0000-0000-000000000002', 'Aprobado', null, null) $$,
  'El cliente aprueba la versión 1.1'
);
reset role;

select is(
  (select array[estado, bloqueado::text, aprobado_por::text] from public.documentos where id = 'c5c5c5c5-0000-0000-0000-000000000002'),
  array['Aprobado', 'true', 'c1c1c1c1-0000-0000-0000-000000000003'],
  'La 1.1 queda Aprobada, bloqueada y con el cliente como aprobador'
);
select is(
  (select array[estado, bloqueado::text] from public.documentos where id = 'c5c5c5c5-0000-0000-0000-000000000001'),
  array['Obsoleto', 'true'],
  'La 1.0 (aprobada anterior, mismo código) queda Obsoleta en la misma operación'
);
select is(
  (select estado from public.documentos where id = 'c5c5c5c5-0000-0000-0000-000000000003'),
  'Aprobado',
  'Un documento con el mismo código pero de OTRO proyecto no se toca'
);
select is(
  (select estado from public.documento_versiones where documento_id = 'c5c5c5c5-0000-0000-0000-000000000002' and version = '1.1'),
  'Aprobado', 'La instantánea de la versión 1.1 refleja la aprobación'
);
select is(
  (select array_agg(accion order by accion) from public.historial
   where entidad_tipo = 'documento' and entidad_id in ('c5c5c5c5-0000-0000-0000-000000000001', 'c5c5c5c5-0000-0000-0000-000000000002')),
  array['Corrección solicitada', 'Documento aprobado', 'Documento reemplazado'],
  'El historial registra la corrección, la aprobación y el reemplazo'
);

select * from finish();
rollback;
