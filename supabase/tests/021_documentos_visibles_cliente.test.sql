-- Visibilidad de documentos para el CLIENTE (decidido con el usuario el 2026-11-09).
-- El cliente ve Pendiente de revisión, En corrección, Aprobado, Rechazado y Obsoleto.
-- NO ve Borrador ni En elaboración (trabajo interno del consultor), ni nada que
-- cuelgue de ellos: versiones, evidencias vinculadas, comentarios, historial y
-- análisis de IA. El equipo y el admin siguen viendo todo.

begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

-- K consultor miembro · U cliente de la empresa · U2 cliente de OTRA empresa · A admin de la consultoría
insert into auth.users (id, email, aud, role) values
  ('21212121-0000-0000-0000-000000000001', 'k@dv.test',  'authenticated', 'authenticated'),
  ('21212121-0000-0000-0000-000000000003', 'u@dv.test',  'authenticated', 'authenticated'),
  ('21212121-0000-0000-0000-000000000004', 'u2@dv.test', 'authenticated', 'authenticated'),
  ('21212121-0000-0000-0000-000000000005', 'a@dv.test',  'authenticated', 'authenticated');
insert into public.consultorias (id, nombre) values ('21212121-0000-0000-0001-000000000001', 'Consultoría DV');
insert into public.empresas (id, consultoria_id, nombre) values
  ('21212121-0000-0000-0002-000000000001', '21212121-0000-0000-0001-000000000001', 'Empresa DV'),
  ('21212121-0000-0000-0002-000000000002', '21212121-0000-0000-0001-000000000001', 'Otra empresa DV');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('21212121-0000-0000-0000-000000000001', 'K',  'k@dv.test',  'consultor',        '21212121-0000-0000-0001-000000000001', null),
  ('21212121-0000-0000-0000-000000000003', 'U',  'u@dv.test',  'usuario_cliente',  '21212121-0000-0000-0001-000000000001', '21212121-0000-0000-0002-000000000001'),
  ('21212121-0000-0000-0000-000000000004', 'U2', 'u2@dv.test', 'usuario_cliente',  '21212121-0000-0000-0001-000000000001', '21212121-0000-0000-0002-000000000002'),
  ('21212121-0000-0000-0000-000000000005', 'A',  'a@dv.test',  'admin_consultoria', '21212121-0000-0000-0001-000000000001', null);
insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('21212121-0000-0000-0003-000000000001', '21212121-0000-0000-0001-000000000001', '21212121-0000-0000-0002-000000000001', 'P DV');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('21212121-0000-0000-0003-000000000001', '21212121-0000-0000-0000-000000000001', '21212121-0000-0000-0001-000000000001');

-- Un documento por estado: ...01 Borrador · 02 En elaboración · 03 Pendiente · 04 En corrección · 05 Aprobado · 06 Rechazado · 07 Obsoleto
insert into public.documentos (id, consultoria_id, proyecto_id, nombre, tipo, estado) values
  ('21212121-0000-0000-0004-000000000001', '21212121-0000-0000-0001-000000000001', '21212121-0000-0000-0003-000000000001', 'D1', 'Procedimiento', 'Borrador'),
  ('21212121-0000-0000-0004-000000000002', '21212121-0000-0000-0001-000000000001', '21212121-0000-0000-0003-000000000001', 'D2', 'Procedimiento', 'En elaboración'),
  ('21212121-0000-0000-0004-000000000003', '21212121-0000-0000-0001-000000000001', '21212121-0000-0000-0003-000000000001', 'D3', 'Procedimiento', 'Pendiente de revisión'),
  ('21212121-0000-0000-0004-000000000004', '21212121-0000-0000-0001-000000000001', '21212121-0000-0000-0003-000000000001', 'D4', 'Procedimiento', 'En corrección'),
  ('21212121-0000-0000-0004-000000000005', '21212121-0000-0000-0001-000000000001', '21212121-0000-0000-0003-000000000001', 'D5', 'Procedimiento', 'Aprobado'),
  ('21212121-0000-0000-0004-000000000006', '21212121-0000-0000-0001-000000000001', '21212121-0000-0000-0003-000000000001', 'D6', 'Procedimiento', 'Rechazado'),
  ('21212121-0000-0000-0004-000000000007', '21212121-0000-0000-0001-000000000001', '21212121-0000-0000-0003-000000000001', 'D7', 'Procedimiento', 'Obsoleto');

-- Lo que cuelga del borrador (D1) y de un documento visible (D3)
insert into public.documento_versiones (consultoria_id, proyecto_id, documento_id, version, estado) values
  ('21212121-0000-0000-0001-000000000001', '21212121-0000-0000-0003-000000000001', '21212121-0000-0000-0004-000000000001', '0.1', 'Borrador'),
  ('21212121-0000-0000-0001-000000000001', '21212121-0000-0000-0003-000000000001', '21212121-0000-0000-0004-000000000003', '1.0', 'Pendiente de revisión');
insert into public.evidencias (id, consultoria_id, proyecto_id, nombre, tipo, subido_por) values
  ('21212121-0000-0000-0005-000000000001', '21212121-0000-0000-0001-000000000001', '21212121-0000-0000-0003-000000000001', 'Foto', 'Foto', '21212121-0000-0000-0000-000000000003');
insert into public.documento_evidencias (documento_id, evidencia_id, proyecto_id, consultoria_id) values
  ('21212121-0000-0000-0004-000000000001', '21212121-0000-0000-0005-000000000001', '21212121-0000-0000-0003-000000000001', '21212121-0000-0000-0001-000000000001'),
  ('21212121-0000-0000-0004-000000000003', '21212121-0000-0000-0005-000000000001', '21212121-0000-0000-0003-000000000001', '21212121-0000-0000-0001-000000000001');
insert into public.comentarios (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, texto) values
  ('21212121-0000-0000-0001-000000000001', '21212121-0000-0000-0003-000000000001', 'documento', '21212121-0000-0000-0004-000000000001', '21212121-0000-0000-0000-000000000001', 'nota interna'),
  ('21212121-0000-0000-0001-000000000001', '21212121-0000-0000-0003-000000000001', 'documento', '21212121-0000-0000-0004-000000000003', '21212121-0000-0000-0000-000000000001', 'nota visible');
insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion) values
  ('21212121-0000-0000-0001-000000000001', '21212121-0000-0000-0003-000000000001', 'documento', '21212121-0000-0000-0004-000000000001', '21212121-0000-0000-0000-000000000001', 'Documento creado'),
  ('21212121-0000-0000-0001-000000000001', '21212121-0000-0000-0003-000000000001', 'documento', '21212121-0000-0000-0004-000000000003', '21212121-0000-0000-0000-000000000001', 'Enviado a revisión');
insert into public.analisis_ia (consultoria_id, proyecto_id, fuente_tipo, documento_id, criterio_ids, solicitado_por) values
  ('21212121-0000-0000-0001-000000000001', '21212121-0000-0000-0003-000000000001', 'documento', '21212121-0000-0000-0004-000000000001',
   array[(select id from public.criterios_evaluacion limit 1)], '21212121-0000-0000-0000-000000000001'),
  ('21212121-0000-0000-0001-000000000001', '21212121-0000-0000-0003-000000000001', 'documento', '21212121-0000-0000-0004-000000000003',
   array[(select id from public.criterios_evaluacion limit 1)], '21212121-0000-0000-0000-000000000001');

-- ─── U: cliente de la empresa ───────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"21212121-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;

select results_eq(
  $$ select nombre from public.documentos order by nombre $$,
  $$ values ('D3'), ('D4'), ('D5'), ('D6'), ('D7') $$,
  'El cliente ve 5 de 7: ni Borrador ni En elaboración'
);
select is((select count(*)::int from public.documentos where nombre in ('D1', 'D2')), 0,
  'El cliente no ve los borradores ni consultando por nombre');
select results_eq(
  $$ select documento_id from public.documento_versiones $$,
  $$ values ('21212121-0000-0000-0004-000000000003'::uuid) $$,
  'El cliente no ve las versiones de un borrador'
);
select results_eq(
  $$ select documento_id from public.documento_evidencias $$,
  $$ values ('21212121-0000-0000-0004-000000000003'::uuid) $$,
  'El cliente no ve las evidencias vinculadas a un borrador'
);
select results_eq(
  $$ select texto from public.comentarios where entidad_tipo = 'documento' $$,
  $$ values ('nota visible') $$,
  'El cliente no ve los comentarios internos de un borrador'
);
select results_eq(
  $$ select accion from public.historial where entidad_tipo = 'documento' $$,
  $$ values ('Enviado a revisión') $$,
  'El cliente no ve el historial de un borrador'
);
select results_eq(
  $$ select documento_id from public.analisis_ia $$,
  $$ values ('21212121-0000-0000-0004-000000000003'::uuid) $$,
  'El cliente no ve los análisis de IA de un borrador'
);
reset role;

-- ─── U2: cliente de otra empresa (el aislamiento sigue igual) ───────────────
select set_config('request.jwt.claims', '{"sub":"21212121-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.documentos), 0, 'El cliente de otra empresa no ve ningún documento');
reset role;

-- ─── K: consultor asignado (equipo) ─────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"21212121-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.documentos), 7, 'El consultor asignado ve los 7 documentos');
select is((select count(*)::int from public.documento_versiones), 2, 'El consultor ve las 2 versiones');
select is((select count(*)::int from public.comentarios where entidad_tipo = 'documento'), 2, 'El consultor ve los 2 comentarios');
select is((select count(*)::int from public.analisis_ia), 2, 'El consultor ve los 2 análisis');
reset role;

-- ─── A: admin de la consultoría ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"21212121-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.documentos), 7, 'El admin de la consultoría ve los 7 documentos');
reset role;

select * from finish();
rollback;
