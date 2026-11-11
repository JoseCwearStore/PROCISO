-- L2 · Reglas documentales (AUD02-H1, M1, M2 · AUD06-M1 en el servidor · AUD02-B1).
--   · un documento "Pendiente de revisión" queda congelado; se sale con retirar_documento_de_revision;
--   · la instantánea de una versión enviada no se pisa: reenviar exige una versión nueva;
--   · decidir_documento recibe la versión que el revisor vio y rechaza si cambió;
--   · aprobar solo vuelve Obsoleto lo que tiene el mismo código (proceso+tipo solo sin código);
--   · NC Cerrada, entregable Aprobado y tarea Completada no se editan, y las ediciones
--     relevantes (responsable, fechas) dejan historial.

begin;
create extension if not exists pgtap with schema extensions;

select plan(40);

-- k1 consultor miembro · k2 consultor NO miembro · u cliente de la empresa
insert into auth.users (id, email, aud, role) values
  ('e7e7e7e7-0000-0000-0000-000000000001', 'k1@rd.test', 'authenticated', 'authenticated'),
  ('e7e7e7e7-0000-0000-0000-000000000002', 'k2@rd.test', 'authenticated', 'authenticated'),
  ('e7e7e7e7-0000-0000-0000-000000000003', 'u@rd.test',  'authenticated', 'authenticated');
insert into public.consultorias (id, nombre) values ('e7e7e7e7-0001-0000-0000-000000000001', 'Consultoría RD');
insert into public.empresas (id, consultoria_id, nombre) values
  ('e7e7e7e7-0002-0000-0000-000000000001', 'e7e7e7e7-0001-0000-0000-000000000001', 'Empresa RD');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('e7e7e7e7-0000-0000-0000-000000000001', 'K1', 'k1@rd.test', 'consultor',       'e7e7e7e7-0001-0000-0000-000000000001', null),
  ('e7e7e7e7-0000-0000-0000-000000000002', 'K2', 'k2@rd.test', 'consultor',       'e7e7e7e7-0001-0000-0000-000000000001', null),
  ('e7e7e7e7-0000-0000-0000-000000000003', 'U',  'u@rd.test',  'usuario_cliente', 'e7e7e7e7-0001-0000-0000-000000000001', 'e7e7e7e7-0002-0000-0000-000000000001');
insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('e7e7e7e7-0003-0000-0000-000000000001', 'e7e7e7e7-0001-0000-0000-000000000001', 'e7e7e7e7-0002-0000-0000-000000000001', 'Proyecto RD');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('e7e7e7e7-0003-0000-0000-000000000001', 'e7e7e7e7-0000-0000-0000-000000000001', 'e7e7e7e7-0001-0000-0000-000000000001');
insert into public.procesos (id, consultoria_id, proyecto_id, nombre) values
  ('e7e7e7e7-0004-0000-0000-000000000001', 'e7e7e7e7-0001-0000-0000-000000000001', 'e7e7e7e7-0003-0000-0000-000000000001', 'Compras');

-- ═══ H1: congelar el contenido en revisión ══════════════════════════════════
select set_config('request.jwt.claims', '{"sub":"e7e7e7e7-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.guardar_documento(
       '{"id":"e7e7e7e7-0005-0000-0000-000000000001","proyecto_id":"e7e7e7e7-0003-0000-0000-000000000001","nombre":"Procedimiento",
         "tipo":"Procedimiento","estado":"Borrador","version":"0.1","codigo":"PRO-001",
         "secciones":[{"id":"s1","titulo":"Objetivo","tipo":"texto","contenido":"original"}]}'::jsonb, null, null) $$,
  'El consultor crea el documento'
);
select lives_ok(
  $$ select public.guardar_documento(
       '{"id":"e7e7e7e7-0005-0000-0000-000000000001","proyecto_id":"e7e7e7e7-0003-0000-0000-000000000001","nombre":"Procedimiento",
         "tipo":"Procedimiento","estado":"Pendiente de revisión","version":"0.1","codigo":"PRO-001",
         "secciones":[{"id":"s1","titulo":"Objetivo","tipo":"texto","contenido":"original"}]}'::jsonb,
       '{"version":"0.1","comentario":"Primer envío","motivo":"Creación"}'::jsonb, null) $$,
  'Lo envía a revisión (queda la instantánea 0.1)'
);
select throws_ok(
  $$ select public.guardar_documento(
       '{"id":"e7e7e7e7-0005-0000-0000-000000000001","proyecto_id":"e7e7e7e7-0003-0000-0000-000000000001","nombre":"Procedimiento",
         "tipo":"Procedimiento","estado":"Pendiente de revisión","version":"0.1","codigo":"PRO-001",
         "secciones":[{"id":"s1","titulo":"Objetivo","tipo":"texto","contenido":"CAMBIADO EN REVISIÓN"}]}'::jsonb, null, null) $$,
  '42501', null, 'En revisión el contenido está congelado: no se reescribe'
);
select throws_ok(
  $$ select public.guardar_documento(
       '{"id":"e7e7e7e7-0005-0000-0000-000000000001","proyecto_id":"e7e7e7e7-0003-0000-0000-000000000001","nombre":"Procedimiento",
         "tipo":"Procedimiento","estado":"Pendiente de revisión","version":"0.1","codigo":"PRO-001",
         "secciones":[{"id":"s1","titulo":"Objetivo","tipo":"texto","contenido":"original"}]}'::jsonb,
       '{"version":"0.1","comentario":"Segundo envío","motivo":"x"}'::jsonb, null) $$,
  '42501', null, 'Reenviar la misma versión ya no es posible'
);
select throws_ok(
  $$ select public.guardar_documento(
       '{"id":"e7e7e7e7-0005-0000-0000-000000000001","proyecto_id":"e7e7e7e7-0003-0000-0000-000000000001","nombre":"Procedimiento",
         "tipo":"Procedimiento","estado":"Borrador","version":"0.1","codigo":"PRO-001",
         "secciones":[{"id":"s1","titulo":"Objetivo","tipo":"texto","contenido":"colado"}]}'::jsonb, null, null) $$,
  '42501', null, 'Tampoco se sale de la revisión "guardando como borrador": hay que retirarlo'
);
reset role;
select is(
  (select secciones->0->>'contenido' from public.documentos where id = 'e7e7e7e7-0005-0000-0000-000000000001'),
  'original', 'El contenido en revisión quedó intacto'
);

-- ═══ Retirar de revisión ════════════════════════════════════════════════════
select set_config('request.jwt.claims', '{"sub":"e7e7e7e7-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.retirar_documento_de_revision('e7e7e7e7-0005-0000-0000-000000000001', 'x') $$,
  '42501', null, 'El cliente no retira documentos de la revisión'
);
reset role;
select set_config('request.jwt.claims', '{"sub":"e7e7e7e7-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.retirar_documento_de_revision('e7e7e7e7-0005-0000-0000-000000000001', 'x') $$,
  '42501', null, 'Un consultor que no es miembro del proyecto tampoco'
);
reset role;
set local role anon;
select throws_ok(
  $$ select public.retirar_documento_de_revision('e7e7e7e7-0005-0000-0000-000000000001', 'x') $$,
  '42501', null, 'Un anónimo tampoco'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"e7e7e7e7-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.retirar_documento_de_revision('e7e7e7e7-0005-0000-0000-000000000001', 'Me equivoqué de sección') $$,
  'El consultor del proyecto retira el documento de la revisión'
);
select throws_ok(
  $$ select public.retirar_documento_de_revision('e7e7e7e7-0005-0000-0000-000000000001', 'otra vez') $$,
  '22023', null, 'Si ya no está en revisión, no hay nada que retirar'
);
reset role;
select is(
  (select estado from public.documentos where id = 'e7e7e7e7-0005-0000-0000-000000000001'),
  'Borrador', 'Volvió a Borrador'
);
select is(
  (select count(*) from public.historial where entidad_id = 'e7e7e7e7-0005-0000-0000-000000000001' and accion = 'Documento retirado de revisión'),
  1::bigint, 'Quedó el evento en el historial'
);

-- ═══ Cada reenvío crea versión nueva ════════════════════════════════════════
select set_config('request.jwt.claims', '{"sub":"e7e7e7e7-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.guardar_documento(
       '{"id":"e7e7e7e7-0005-0000-0000-000000000001","proyecto_id":"e7e7e7e7-0003-0000-0000-000000000001","nombre":"Procedimiento",
         "tipo":"Procedimiento","estado":"Borrador","version":"0.1","codigo":"PRO-001",
         "secciones":[{"id":"s1","titulo":"Objetivo","tipo":"texto","contenido":"editado tras retirar"}]}'::jsonb, null, null) $$,
  'Retirado, el equipo puede volver a editar'
);
select throws_ok(
  $$ select public.guardar_documento(
       '{"id":"e7e7e7e7-0005-0000-0000-000000000001","proyecto_id":"e7e7e7e7-0003-0000-0000-000000000001","nombre":"Procedimiento",
         "tipo":"Procedimiento","estado":"Pendiente de revisión","version":"0.1","codigo":"PRO-001",
         "secciones":[{"id":"s1","titulo":"Objetivo","tipo":"texto","contenido":"editado tras retirar"}]}'::jsonb,
       '{"version":"0.1","comentario":"Reenvío","motivo":"x"}'::jsonb, null) $$,
  '42501', null, 'La versión 0.1 ya se envió: reenviar exige 0.2'
);
select lives_ok(
  $$ select public.guardar_documento(
       '{"id":"e7e7e7e7-0005-0000-0000-000000000001","proyecto_id":"e7e7e7e7-0003-0000-0000-000000000001","nombre":"Procedimiento",
         "tipo":"Procedimiento","estado":"Pendiente de revisión","version":"0.2","codigo":"PRO-001",
         "secciones":[{"id":"s1","titulo":"Objetivo","tipo":"texto","contenido":"editado tras retirar"}]}'::jsonb,
       '{"version":"0.2","comentario":"Reenvío","motivo":"Corrección"}'::jsonb, null) $$,
  'Con la versión 0.2 el reenvío se acepta'
);
select throws_ok(
  $$ select public.guardar_documento(
       '{"id":"e7e7e7e7-0005-0000-0000-000000000002","proyecto_id":"e7e7e7e7-0003-0000-0000-000000000001","nombre":"Otro",
         "tipo":"Procedimiento","estado":"Pendiente de revisión","version":"0.1","codigo":"PRO-009",
         "secciones":[]}'::jsonb,
       '{"version":"0.2","comentario":"x","motivo":"x"}'::jsonb, null) $$,
  '22023', null, 'La versión de la instantánea debe coincidir con la del documento'
);
reset role;
select is(
  (select array[count(*)::text, (select secciones->0->>'contenido' from public.documento_versiones
                                  where documento_id = 'e7e7e7e7-0005-0000-0000-000000000001' and version = '0.1')]
   from public.documento_versiones where documento_id = 'e7e7e7e7-0005-0000-0000-000000000001'),
  array['2', 'original'], 'Hay 2 instantáneas y la 0.1 conserva el contenido que se envió'
);

-- ═══ decidir_documento con la versión que el revisor vio ═══════════════════
select set_config('request.jwt.claims', '{"sub":"e7e7e7e7-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.decidir_documento('e7e7e7e7-0005-0000-0000-000000000001', 'Aprobado', null, null, '0.1') $$,
  '22023', null, 'El cliente vio la 0.1 pero el documento ya es la 0.2: no se aprueba a ciegas'
);
select throws_ok(
  $$ select public.decidir_documento('e7e7e7e7-0005-0000-0000-000000000001', 'Aprobado', null, null, null) $$,
  '22023', null, 'Sin indicar la versión vista, no se decide'
);
reset role;
select is(
  (select estado from public.documentos where id = 'e7e7e7e7-0005-0000-0000-000000000001'),
  'Pendiente de revisión', 'Las decisiones rechazadas no cambiaron nada'
);
set local role authenticated;
select lives_ok(
  $$ select public.decidir_documento('e7e7e7e7-0005-0000-0000-000000000001', 'Aprobado', null, null, '0.2') $$,
  'Con la versión correcta, el cliente aprueba'
);
reset role;
select is(
  (select estado from public.documentos where id = 'e7e7e7e7-0005-0000-0000-000000000001'),
  'Aprobado', 'Quedó Aprobado'
);

-- ═══ M1: obsolescencia solo por código ══════════════════════════════════════
insert into public.documentos (id, consultoria_id, proyecto_id, proceso_id, nombre, tipo, estado, version, codigo, bloqueado) values
  ('e7e7e7e7-0005-0000-0000-000000000011', 'e7e7e7e7-0001-0000-0000-000000000001', 'e7e7e7e7-0003-0000-0000-000000000001', 'e7e7e7e7-0004-0000-0000-000000000001', 'Proc A', 'Procedimiento', 'Aprobado', '1.0', 'PRO-A', true),
  ('e7e7e7e7-0005-0000-0000-000000000012', 'e7e7e7e7-0001-0000-0000-000000000001', 'e7e7e7e7-0003-0000-0000-000000000001', 'e7e7e7e7-0004-0000-0000-000000000001', 'Proc B', 'Procedimiento', 'Aprobado', '1.0', 'PRO-B', true),
  ('e7e7e7e7-0005-0000-0000-000000000013', 'e7e7e7e7-0001-0000-0000-000000000001', 'e7e7e7e7-0003-0000-0000-000000000001', 'e7e7e7e7-0004-0000-0000-000000000001', 'Proc C', 'Procedimiento', 'Pendiente de revisión', '1.0', 'PRO-C', false),
  ('e7e7e7e7-0005-0000-0000-000000000014', 'e7e7e7e7-0001-0000-0000-000000000001', 'e7e7e7e7-0003-0000-0000-000000000001', 'e7e7e7e7-0004-0000-0000-000000000001', 'Proc A v2', 'Procedimiento', 'Pendiente de revisión', '2.0', 'PRO-A', false),
  ('e7e7e7e7-0005-0000-0000-000000000015', 'e7e7e7e7-0001-0000-0000-000000000001', 'e7e7e7e7-0003-0000-0000-000000000001', 'e7e7e7e7-0004-0000-0000-000000000001', 'Reg X', 'Registro', 'Aprobado', '1.0', null, true),
  ('e7e7e7e7-0005-0000-0000-000000000016', 'e7e7e7e7-0001-0000-0000-000000000001', 'e7e7e7e7-0003-0000-0000-000000000001', 'e7e7e7e7-0004-0000-0000-000000000001', 'Reg Y', 'Registro', 'Pendiente de revisión', '1.0', null, false);

select set_config('request.jwt.claims', '{"sub":"e7e7e7e7-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.decidir_documento('e7e7e7e7-0005-0000-0000-000000000013', 'Aprobado', null, null, '1.0') $$,
  'El cliente aprueba un procedimiento con código propio (PRO-C)'
);
reset role;
select is(
  (select array_agg(estado order by codigo) from public.documentos where id in ('e7e7e7e7-0005-0000-0000-000000000011', 'e7e7e7e7-0005-0000-0000-000000000012')),
  array['Aprobado', 'Aprobado'], 'Otros procedimientos del mismo proceso con OTRO código siguen vigentes'
);
set local role authenticated;
select lives_ok(
  $$ select public.decidir_documento('e7e7e7e7-0005-0000-0000-000000000014', 'Aprobado', null, null, '2.0') $$,
  'Aprueba la versión 2.0 de PRO-A (mismo código)'
);
reset role;
select is(
  (select array[(select estado from public.documentos where id = 'e7e7e7e7-0005-0000-0000-000000000011'),
                (select estado from public.documentos where id = 'e7e7e7e7-0005-0000-0000-000000000012')]),
  array['Obsoleto', 'Aprobado'], 'Solo la versión anterior de PRO-A pasó a Obsoleto'
);
set local role authenticated;
select lives_ok(
  $$ select public.decidir_documento('e7e7e7e7-0005-0000-0000-000000000016', 'Aprobado', null, null, '1.0') $$,
  'Aprueba un documento sin código'
);
reset role;
select is(
  (select estado from public.documentos where id = 'e7e7e7e7-0005-0000-0000-000000000015'),
  'Obsoleto', 'Sin código en ninguno, rige proceso + tipo: el anterior queda Obsoleto'
);

-- ═══ M2: los registros cerrados no se editan ════════════════════════════════
insert into public.tareas (id, consultoria_id, proyecto_id, titulo, asignado_a, asignado_por, fecha_vencimiento, estado) values
  ('e7e7e7e7-0006-0000-0000-000000000001', 'e7e7e7e7-0001-0000-0000-000000000001', 'e7e7e7e7-0003-0000-0000-000000000001', 'Tarea cerrada', 'e7e7e7e7-0000-0000-0000-000000000001', 'e7e7e7e7-0000-0000-0000-000000000001', current_date, 'Completada'),
  ('e7e7e7e7-0006-0000-0000-000000000002', 'e7e7e7e7-0001-0000-0000-000000000001', 'e7e7e7e7-0003-0000-0000-000000000001', 'Tarea abierta', 'e7e7e7e7-0000-0000-0000-000000000001', 'e7e7e7e7-0000-0000-0000-000000000001', current_date, 'Pendiente');
insert into public.no_conformidades (id, consultoria_id, proyecto_id, titulo, descripcion, tipo, fecha_deteccion, responsable_id, estado) values
  ('e7e7e7e7-0007-0000-0000-000000000001', 'e7e7e7e7-0001-0000-0000-000000000001', 'e7e7e7e7-0003-0000-0000-000000000001', 'NC cerrada', 'x', 'Menor', current_date, 'e7e7e7e7-0000-0000-0000-000000000001', 'Cerrada'),
  ('e7e7e7e7-0007-0000-0000-000000000002', 'e7e7e7e7-0001-0000-0000-000000000001', 'e7e7e7e7-0003-0000-0000-000000000001', 'NC abierta', 'x', 'Menor', current_date, 'e7e7e7e7-0000-0000-0000-000000000001', 'Abierta');
insert into public.entregables (id, consultoria_id, proyecto_id, nombre, tipo, fecha_entrega, estado) values
  ('e7e7e7e7-0008-0000-0000-000000000001', 'e7e7e7e7-0001-0000-0000-000000000001', 'e7e7e7e7-0003-0000-0000-000000000001', 'Entregable aprobado', 'Informe', current_date, 'Aprobado'),
  ('e7e7e7e7-0008-0000-0000-000000000002', 'e7e7e7e7-0001-0000-0000-000000000001', 'e7e7e7e7-0003-0000-0000-000000000001', 'Entregable pendiente', 'Informe', current_date, 'Pendiente');

select set_config('request.jwt.claims', '{"sub":"e7e7e7e7-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ update public.no_conformidades set titulo = 'Reescrita' where id = 'e7e7e7e7-0007-0000-0000-000000000001' $$,
  '42501', null, 'Una NC cerrada no se reescribe'
);
select throws_ok(
  $$ update public.entregables set nombre = 'Renombrado' where id = 'e7e7e7e7-0008-0000-0000-000000000001' $$,
  '42501', null, 'Un entregable aprobado por el cliente no se renombra'
);
select throws_ok(
  $$ update public.tareas set titulo = 'Cambiada' where id = 'e7e7e7e7-0006-0000-0000-000000000001' $$,
  '42501', null, 'Una tarea completada no se edita'
);
select lives_ok(
  $$ update public.no_conformidades set titulo = 'NC editable' where id = 'e7e7e7e7-0007-0000-0000-000000000002' $$,
  'Control: la NC abierta sí se edita'
);
select lives_ok(
  $$ update public.entregables set nombre = 'Pendiente editable' where id = 'e7e7e7e7-0008-0000-0000-000000000002' $$,
  'Control: el entregable pendiente sí se edita'
);
select lives_ok(
  $$ update public.tareas set titulo = 'Tarea editable' where id = 'e7e7e7e7-0006-0000-0000-000000000002' $$,
  'Control: la tarea abierta sí se edita'
);
reset role;
select is(
  (select count(*) from public.historial where entidad_id in ('e7e7e7e7-0006-0000-0000-000000000002', 'e7e7e7e7-0007-0000-0000-000000000002', 'e7e7e7e7-0008-0000-0000-000000000002')),
  0::bigint, 'Cambiar solo el título no ensucia el historial'
);

-- Las ediciones relevantes sí dejan rastro.
set local role authenticated;
update public.tareas set asignado_a = 'e7e7e7e7-0000-0000-0000-000000000003', fecha_vencimiento = current_date + 5 where id = 'e7e7e7e7-0006-0000-0000-000000000002';
update public.no_conformidades set fecha_limite = current_date + 9 where id = 'e7e7e7e7-0007-0000-0000-000000000002';
update public.entregables set fecha_entrega = current_date + 3 where id = 'e7e7e7e7-0008-0000-0000-000000000002';
reset role;
select is(
  (select array_agg(accion order by accion) from public.historial where entidad_id = 'e7e7e7e7-0006-0000-0000-000000000002'),
  array['Fecha de vencimiento cambiada', 'Tarea reasignada'], 'Reasignar y cambiar la fecha de una tarea queda en el historial'
);
select is(
  (select array_agg(accion) from public.historial where entidad_id = 'e7e7e7e7-0007-0000-0000-000000000002'),
  array['Fecha límite cambiada'], 'Cambiar la fecha límite de una NC queda en el historial'
);
select is(
  (select array_agg(accion) from public.historial where entidad_id = 'e7e7e7e7-0008-0000-0000-000000000002'),
  array['Fecha de entrega cambiada'], 'Cambiar la fecha de entrega queda en el historial'
);
select is(
  (select autor_id::text from public.historial where entidad_id = 'e7e7e7e7-0008-0000-0000-000000000002'),
  'e7e7e7e7-0000-0000-0000-000000000001', 'El autor es quien editó (no el servidor)'
);

select * from finish();
rollback;
