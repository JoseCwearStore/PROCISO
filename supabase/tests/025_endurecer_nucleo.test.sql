-- L1 · Endurecer el núcleo (AUD01-H1, H2, H3, M1, M6 · AUD02-M3).
-- Las reglas de negocio centrales ya no se pueden saltar por la API directa:
--   · evidencias: el cliente no se auto-aprueba y el estado solo cambia por revisar_evidencia;
--   · historial: solo lo escriben las RPC/triggers del servidor;
--   · documentos y sus hijos: solo por guardar_documento / decidir_documento;
--   · proyectos y empresas: permisos por columna;
--   · la suspensión llega a "ver empresas" y a trabaja_con_empresa.

begin;
create extension if not exists pgtap with schema extensions;

select plan(39);

-- Consultoría C1 (activa) y CS (suspendida).
-- k1 consultor miembro de P1 y consultor asignado de E3 · k2 consultor miembro solo de P2
-- ks consultor SUSPENDIDO (activo=false), asignado a E2 · a admin de C1 · u cliente de E1
-- kc consultor activo de la consultoría suspendida CS
insert into auth.users (id, email, aud, role) values
  ('f7f7f7f7-0001-0000-0000-000000000001', 'k1@nu.test', 'authenticated', 'authenticated'),
  ('f7f7f7f7-0001-0000-0000-000000000002', 'k2@nu.test', 'authenticated', 'authenticated'),
  ('f7f7f7f7-0001-0000-0000-000000000003', 'ks@nu.test', 'authenticated', 'authenticated'),
  ('f7f7f7f7-0001-0000-0000-000000000004', 'a@nu.test',  'authenticated', 'authenticated'),
  ('f7f7f7f7-0001-0000-0000-000000000005', 'u@nu.test',  'authenticated', 'authenticated'),
  ('f7f7f7f7-0001-0000-0000-000000000006', 'kc@nu.test', 'authenticated', 'authenticated');
insert into public.consultorias (id, nombre, activa) values
  ('f7f7f7f7-0002-0000-0000-000000000001', 'Consultoría NU', true),
  ('f7f7f7f7-0002-0000-0000-000000000002', 'Consultoría NU suspendida', false);
insert into public.empresas (id, consultoria_id, nombre) values
  ('f7f7f7f7-0003-0000-0000-000000000001', 'f7f7f7f7-0002-0000-0000-000000000001', 'E1'),
  ('f7f7f7f7-0003-0000-0000-000000000002', 'f7f7f7f7-0002-0000-0000-000000000001', 'E2'),
  ('f7f7f7f7-0003-0000-0000-000000000003', 'f7f7f7f7-0002-0000-0000-000000000001', 'E3'),
  ('f7f7f7f7-0003-0000-0000-000000000004', 'f7f7f7f7-0002-0000-0000-000000000002', 'ECS');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id, activo) values
  ('f7f7f7f7-0001-0000-0000-000000000001', 'K1', 'k1@nu.test', 'consultor',        'f7f7f7f7-0002-0000-0000-000000000001', null, true),
  ('f7f7f7f7-0001-0000-0000-000000000002', 'K2', 'k2@nu.test', 'consultor',        'f7f7f7f7-0002-0000-0000-000000000001', null, true),
  ('f7f7f7f7-0001-0000-0000-000000000003', 'KS', 'ks@nu.test', 'consultor',        'f7f7f7f7-0002-0000-0000-000000000001', null, false),
  ('f7f7f7f7-0001-0000-0000-000000000004', 'A',  'a@nu.test',  'admin_consultoria','f7f7f7f7-0002-0000-0000-000000000001', null, true),
  ('f7f7f7f7-0001-0000-0000-000000000005', 'U',  'u@nu.test',  'usuario_cliente',  'f7f7f7f7-0002-0000-0000-000000000001', 'f7f7f7f7-0003-0000-0000-000000000001', true),
  ('f7f7f7f7-0001-0000-0000-000000000006', 'KC', 'kc@nu.test', 'consultor',        'f7f7f7f7-0002-0000-0000-000000000002', null, true);
update public.empresas set consultor_asignado_id = 'f7f7f7f7-0001-0000-0000-000000000003' where id = 'f7f7f7f7-0003-0000-0000-000000000002';
update public.empresas set consultor_asignado_id = 'f7f7f7f7-0001-0000-0000-000000000001' where id = 'f7f7f7f7-0003-0000-0000-000000000003';
insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('f7f7f7f7-0004-0000-0000-000000000001', 'f7f7f7f7-0002-0000-0000-000000000001', 'f7f7f7f7-0003-0000-0000-000000000001', 'P1'),
  ('f7f7f7f7-0004-0000-0000-000000000002', 'f7f7f7f7-0002-0000-0000-000000000001', 'f7f7f7f7-0003-0000-0000-000000000001', 'P2'),
  ('f7f7f7f7-0004-0000-0000-000000000003', 'f7f7f7f7-0002-0000-0000-000000000002', 'f7f7f7f7-0003-0000-0000-000000000004', 'PCS');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('f7f7f7f7-0004-0000-0000-000000000001', 'f7f7f7f7-0001-0000-0000-000000000001', 'f7f7f7f7-0002-0000-0000-000000000001'),
  ('f7f7f7f7-0004-0000-0000-000000000002', 'f7f7f7f7-0001-0000-0000-000000000002', 'f7f7f7f7-0002-0000-0000-000000000001'),
  ('f7f7f7f7-0004-0000-0000-000000000003', 'f7f7f7f7-0001-0000-0000-000000000006', 'f7f7f7f7-0002-0000-0000-000000000002');
insert into public.documentos (id, consultoria_id, proyecto_id, nombre, tipo, estado) values
  ('f7f7f7f7-0005-0000-0000-000000000001', 'f7f7f7f7-0002-0000-0000-000000000001', 'f7f7f7f7-0004-0000-0000-000000000001', 'Doc P1', 'Procedimiento', 'Pendiente de revisión');
insert into public.evidencias (id, consultoria_id, proyecto_id, nombre, tipo, estado, subido_por) values
  ('f7f7f7f7-0006-0000-0000-000000000001', 'f7f7f7f7-0002-0000-0000-000000000001', 'f7f7f7f7-0004-0000-0000-000000000001', 'Ev 1', 'Foto', 'Cargada', 'f7f7f7f7-0001-0000-0000-000000000005'),
  ('f7f7f7f7-0006-0000-0000-000000000002', 'f7f7f7f7-0002-0000-0000-000000000001', 'f7f7f7f7-0004-0000-0000-000000000001', 'Ev 2', 'Foto', 'Cargada', 'f7f7f7f7-0001-0000-0000-000000000005');

-- ═══ EVIDENCIAS (AUD01-H2) ══════════════════════════════════════════════════
-- El cliente sube una evidencia pidiendo "Aceptada": la BD la deja en "Cargada".
select set_config('request.jwt.claims', '{"sub":"f7f7f7f7-0001-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ insert into public.evidencias (id, consultoria_id, proyecto_id, nombre, tipo, estado)
     values ('f7f7f7f7-0006-0000-0000-000000000003', 'f7f7f7f7-0002-0000-0000-000000000001', 'f7f7f7f7-0004-0000-0000-000000000001', 'Auto-aceptada', 'Foto', 'Aceptada') $$,
  'El cliente puede subir una evidencia'
);
reset role;
select is(
  (select estado from public.evidencias where id = 'f7f7f7f7-0006-0000-0000-000000000003'),
  'Cargada', 'La BD fuerza estado=Cargada aunque el cliente pida Aceptada'
);

set local role authenticated;
select throws_ok(
  $$ insert into public.evidencias (consultoria_id, proyecto_id, nombre, tipo, estado, subido_por)
     values ('f7f7f7f7-0002-0000-0000-000000000001', 'f7f7f7f7-0004-0000-0000-000000000001', 'Falsa autoría', 'Foto', 'Cargada', 'f7f7f7f7-0001-0000-0000-000000000001') $$,
  '42501', null, 'El cliente no puede poner a otro como autor de la evidencia'
);
reset role;

-- El equipo no cambia estado ni autoría por PATCH directo.
select set_config('request.jwt.claims', '{"sub":"f7f7f7f7-0001-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ update public.evidencias set estado = 'Aceptada' where id = 'f7f7f7f7-0006-0000-0000-000000000001' $$,
  '42501', null, 'El consultor no cambia el estado de una evidencia por UPDATE directo'
);
select throws_ok(
  $$ update public.evidencias set subido_por = 'f7f7f7f7-0001-0000-0000-000000000002' where id = 'f7f7f7f7-0006-0000-0000-000000000001' $$,
  '42501', null, 'El consultor no falsea quién subió la evidencia'
);
select lives_ok(
  $$ select public.revisar_evidencia('f7f7f7f7-0006-0000-0000-000000000001', 'Aceptada', null) $$,
  'Por revisar_evidencia sí puede cambiar el estado'
);
reset role;

-- El cliente repitiendo el estado actual ya no obtiene un "OK" silencioso (AUD01-B5).
select set_config('request.jwt.claims', '{"sub":"f7f7f7f7-0001-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.revisar_evidencia('f7f7f7f7-0006-0000-0000-000000000002', 'Cargada', null) $$,
  '42501', null, 'El cliente recibe 42501 aunque pida el mismo estado'
);
reset role;

-- ═══ HISTORIAL (AUD01-H3) ═══════════════════════════════════════════════════
select set_config('request.jwt.claims', '{"sub":"f7f7f7f7-0001-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, accion, estado_nuevo)
     values ('f7f7f7f7-0002-0000-0000-000000000001', 'f7f7f7f7-0004-0000-0000-000000000001', 'documento', 'f7f7f7f7-0005-0000-0000-000000000001', 'Documento aprobado', 'Aprobado') $$,
  '42501', null, 'El cliente no fabrica eventos en el historial'
);
reset role;
select set_config('request.jwt.claims', '{"sub":"f7f7f7f7-0001-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, accion)
     values ('f7f7f7f7-0002-0000-0000-000000000001', 'f7f7f7f7-0004-0000-0000-000000000001', 'documento', 'f7f7f7f7-0005-0000-0000-000000000001', 'Algo') $$,
  '42501', null, 'Ni el consultor escribe en el historial directamente'
);
select throws_ok(
  $$ update public.historial set accion = 'Editado' $$,
  '42501', null, 'El historial no se edita'
);
reset role;

-- ═══ DOCUMENTOS (AUD01-H1, M1) ══════════════════════════════════════════════
set local role authenticated;
select throws_ok(
  $$ update public.documentos set estado = 'Aprobado', bloqueado = true where id = 'f7f7f7f7-0005-0000-0000-000000000001' $$,
  '42501', null, 'El consultor no aprueba un documento por UPDATE directo'
);
select throws_ok(
  $$ insert into public.documentos (consultoria_id, proyecto_id, nombre, tipo, estado)
     values ('f7f7f7f7-0002-0000-0000-000000000001', 'f7f7f7f7-0004-0000-0000-000000000001', 'Directo', 'Procedimiento', 'Aprobado') $$,
  '42501', null, 'El consultor no crea documentos por INSERT directo'
);
select throws_ok(
  $$ update public.documento_versiones set estado = 'Aprobado' $$,
  '42501', null, 'Las versiones de un documento son instantáneas: no se editan'
);
select throws_ok(
  $$ insert into public.documento_versiones (consultoria_id, proyecto_id, documento_id, version, estado)
     values ('f7f7f7f7-0002-0000-0000-000000000001', 'f7f7f7f7-0004-0000-0000-000000000001', 'f7f7f7f7-0005-0000-0000-000000000001', '9.9', 'Aprobado') $$,
  '42501', null, 'Tampoco se insertan versiones a mano'
);
select throws_ok(
  $$ insert into public.documento_evidencias (documento_id, evidencia_id, proyecto_id, consultoria_id)
     values ('f7f7f7f7-0005-0000-0000-000000000001', 'f7f7f7f7-0006-0000-0000-000000000001', 'f7f7f7f7-0004-0000-0000-000000000001', 'f7f7f7f7-0002-0000-0000-000000000001') $$,
  '42501', null, 'Los vínculos documento-evidencia solo los arma guardar_documento'
);
reset role;

-- guardar_documento (ahora con permisos propios: DEFINER + chequeos).
select set_config('request.jwt.claims', '{"sub":"f7f7f7f7-0001-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.guardar_documento(
       '{"id":"f7f7f7f7-0005-0000-0000-000000000002","proyecto_id":"f7f7f7f7-0004-0000-0000-000000000001","nombre":"Nuevo","tipo":"Procedimiento","estado":"Borrador","version":"1.0"}'::jsonb,
       null,
       '{"accion":"Documento guardado","detalle":"Primer guardado"}'::jsonb) $$,
  'El consultor miembro guarda un documento nuevo por la RPC'
);
reset role;
select is(
  (select count(*) from public.historial where entidad_id = 'f7f7f7f7-0005-0000-0000-000000000002'),
  1::bigint, 'guardar_documento dejó el evento en el historial (ahora escribe como servidor)'
);

-- k2 es miembro de P2 pero NO de P1.
select set_config('request.jwt.claims', '{"sub":"f7f7f7f7-0001-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.guardar_documento(
       '{"id":"f7f7f7f7-0005-0000-0000-000000000009","proyecto_id":"f7f7f7f7-0004-0000-0000-000000000001","nombre":"Intruso","tipo":"Procedimiento","estado":"Borrador","version":"1.0"}'::jsonb,
       null, null) $$,
  '42501', null, 'Un consultor que no es miembro del proyecto no guarda documentos en él'
);
select throws_ok(
  $$ select public.guardar_documento(
       '{"id":"f7f7f7f7-0005-0000-0000-000000000001","proyecto_id":"f7f7f7f7-0004-0000-0000-000000000002","nombre":"Robo","tipo":"Procedimiento","estado":"Borrador","version":"1.0"}'::jsonb,
       null, null) $$,
  '42501', null, 'No se pisa el documento de OTRO proyecto reusando su id desde un proyecto propio'
);
reset role;
select is(
  (select nombre from public.documentos where id = 'f7f7f7f7-0005-0000-0000-000000000001'),
  'Doc P1', 'El documento ajeno quedó intacto'
);

select set_config('request.jwt.claims', '{"sub":"f7f7f7f7-0001-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.guardar_documento(
       '{"id":"f7f7f7f7-0005-0000-0000-000000000008","proyecto_id":"f7f7f7f7-0004-0000-0000-000000000001","nombre":"Del cliente","tipo":"Procedimiento","estado":"Borrador","version":"1.0"}'::jsonb,
       null, null) $$,
  '42501', null, 'El cliente no guarda documentos'
);
reset role;
set local role anon;
select throws_ok(
  $$ select public.guardar_documento('{"id":"f7f7f7f7-0005-0000-0000-000000000007","proyecto_id":"f7f7f7f7-0004-0000-0000-000000000001"}'::jsonb, null, null) $$,
  '42501', null, 'Un anónimo no ejecuta guardar_documento'
);
reset role;

-- ═══ PROYECTOS (AUD01-M1) ═══════════════════════════════════════════════════
select set_config('request.jwt.claims', '{"sub":"f7f7f7f7-0001-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ update public.proyectos set avance = 90 where id = 'f7f7f7f7-0004-0000-0000-000000000001' $$,
  '42501', null, 'El avance del proyecto no se escribe a mano'
);
select throws_ok(
  $$ update public.proyectos set consultor_id = 'f7f7f7f7-0001-0000-0000-000000000002' where id = 'f7f7f7f7-0004-0000-0000-000000000001' $$,
  '42501', null, 'El consultor no se reasigna el proyecto por UPDATE directo'
);
select lives_ok(
  $$ update public.proyectos set estado = 'Diagnóstico' where id = 'f7f7f7f7-0004-0000-0000-000000000001' $$,
  'El estado del proyecto sí se puede cambiar (lo hace la app)'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"f7f7f7f7-0001-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.crear_proyecto(p_empresa_id => 'f7f7f7f7-0003-0000-0000-000000000001', p_consultor_id => null,
       p_nombre => 'Nuevo proyecto', p_objetivo => 'Objetivo') $$,
  'El admin crea un proyecto con las columnas que usa la app (por crear_proyecto, desde L5d)'
);
select throws_ok(
  $$ insert into public.proyectos (consultoria_id, empresa_id, nombre, avance)
     values ('f7f7f7f7-0002-0000-0000-000000000001', 'f7f7f7f7-0003-0000-0000-000000000001', 'Con avance', 90) $$,
  '42501', null, 'No se crea un proyecto con avance inventado'
);
select throws_ok(
  $$ insert into public.proyectos (consultoria_id, empresa_id, nombre, estado)
     values ('f7f7f7f7-0002-0000-0000-000000000001', 'f7f7f7f7-0003-0000-0000-000000000001', 'Ya finalizado', 'Finalizado') $$,
  '42501', null, 'No se crea un proyecto ya en un estado avanzado'
);

-- ═══ EMPRESAS (AUD01-M1) ════════════════════════════════════════════════════
select lives_ok(
  $$ insert into public.empresas (consultoria_id, nombre, rfc) values ('f7f7f7f7-0002-0000-0000-000000000001', 'Empresa nueva', 'RFC010101') $$,
  'El admin crea una empresa con las columnas que usa la app'
);
select lives_ok(
  $$ update public.empresas set activa = false where id = 'f7f7f7f7-0003-0000-0000-000000000001' $$,
  'El admin archiva una empresa (activa=false)'
);
select throws_ok(
  $$ update public.empresas set nombre = 'Renombrada' where id = 'f7f7f7f7-0003-0000-0000-000000000001' $$,
  '42501', null, 'Fuera de "activa", la empresa no se edita por UPDATE directo'
);
select throws_ok(
  $$ update public.empresas set consultoria_id = 'f7f7f7f7-0002-0000-0000-000000000002' where id = 'f7f7f7f7-0003-0000-0000-000000000001' $$,
  '42501', null, 'Una empresa no cambia de consultoría'
);
reset role;

-- ═══ LO QUE LA APP REALMENTE MANDA (no romper las pantallas) ═══════════════
-- Mismo conjunto de columnas que src/lib/escrituras.ts, con RETURNING * como hace supabase-js.
select set_config('request.jwt.claims', '{"sub":"f7f7f7f7-0001-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ insert into public.evidencias (id, consultoria_id, proyecto_id, proceso_id, actividad_id, nombre, tipo, estado,
       descripcion, categoria, archivo_ruta, archivo_nombre, archivo_mime, archivo_tamano)
     values ('f7f7f7f7-0006-0000-0000-000000000004', 'f7f7f7f7-0002-0000-0000-000000000001', 'f7f7f7f7-0004-0000-0000-000000000001',
             null, null, 'Subida completa', 'Documento', 'Cargada', 'desc', 'Registro', 'c/e/p/x.pdf', 'x.pdf', 'application/pdf', 1234)
     returning * $$,
  'La subida de evidencia con TODAS las columnas de la app funciona'
);
reset role;
-- (una prueba anterior archivó esta empresa y crear_proyecto rechaza las archivadas: se reactiva)
update public.empresas set activa = true where id = 'f7f7f7f7-0003-0000-0000-000000000001';
select set_config('request.jwt.claims', '{"sub":"f7f7f7f7-0001-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.crear_proyecto(p_empresa_id => 'f7f7f7f7-0003-0000-0000-000000000001', p_consultor_id => 'f7f7f7f7-0001-0000-0000-000000000001',
       p_nombre => 'Proyecto completo', p_objetivo => 'obj', p_alcance => 'alc', p_edicion_norma => 'ISO 9001:2026',
       p_fecha_inicio => '2026-01-01', p_fecha_fin_estimada => '2026-12-31') $$,
  'Crear proyecto con TODAS las columnas de la app funciona (por crear_proyecto, desde L5d)'
);
select lives_ok(
  $$ insert into public.empresas (consultoria_id, nombre, nombre_comercial, rfc, sector, tamano, trabajadores, ciudad,
       entidad_federativa, direccion, contacto_principal, cargo_contacto, email_contacto, telefono_contacto,
       procesos_principales, alcance_inicial, norma_interes, consultor_asignado_id, observaciones)
     values ('f7f7f7f7-0002-0000-0000-000000000001', 'Empresa completa', 'Comercial', 'RFC020202', 'Servicios', 'Mediana', '50', 'CDMX',
             'CDMX', 'Calle 1', 'Contacto', 'Gerente', 'c@x.test', '555', 'Ventas', 'Alcance', 'ISO 9001:2026',
             'f7f7f7f7-0001-0000-0000-000000000001', 'obs')
     returning * $$,
  'Crear empresa con TODAS las columnas de la app funciona'
);
reset role;

-- ═══ SUSPENSIÓN (AUD01-M6, AUD02-M3) ════════════════════════════════════════
-- E2 la tiene asignada ks (suspendido) y ks NO es miembro de ningún proyecto: solo la rama "asignado".
select set_config('request.jwt.claims', '{"sub":"f7f7f7f7-0001-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*) from public.empresas where id = 'f7f7f7f7-0003-0000-0000-000000000002'),
  0::bigint, 'Un consultor suspendido no ve la empresa que tiene asignada'
);
reset role;
-- Control: k1 (activo) es el asignado de E3 sin ser miembro de sus proyectos: sí la ve.
select set_config('request.jwt.claims', '{"sub":"f7f7f7f7-0001-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*) from public.empresas where id = 'f7f7f7f7-0003-0000-0000-000000000003'),
  1::bigint, 'Control: el consultor activo sí ve la empresa que tiene asignada'
);
reset role;

-- kc es consultor de una consultoría suspendida: trabaja_con_empresa debe dar false.
select set_config('request.jwt.claims', '{"sub":"f7f7f7f7-0001-0000-0000-000000000006","role":"authenticated"}', true);
set local role authenticated;
select is(
  private.trabaja_con_empresa('f7f7f7f7-0003-0000-0000-000000000004'),
  false, 'Un consultor de una consultoría suspendida no "trabaja con" la empresa'
);
reset role;
select set_config('request.jwt.claims', '{"sub":"f7f7f7f7-0001-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is(
  private.trabaja_con_empresa('f7f7f7f7-0003-0000-0000-000000000001'),
  true, 'Control: el consultor activo de una consultoría activa sí trabaja con la empresa'
);
reset role;

select * from finish();
rollback;
