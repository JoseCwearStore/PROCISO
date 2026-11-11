-- guardar_documento: guarda el documento, sus evidencias vinculadas, la
-- instantánea de versión y el evento del historial en una transacción, con
-- los permisos del usuario. Aplica las reglas del control de documentos.

begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

-- K1 consultor asignado · K2 consultor NO asignado · U cliente de la empresa
insert into auth.users (id, email, aud, role) values
  ('d1d1d1d1-0000-0000-0000-000000000001', 'k1@gd.test', 'authenticated', 'authenticated'),
  ('d1d1d1d1-0000-0000-0000-000000000002', 'k2@gd.test', 'authenticated', 'authenticated'),
  ('d1d1d1d1-0000-0000-0000-000000000003', 'u@gd.test',  'authenticated', 'authenticated');
insert into public.consultorias (id, nombre) values ('d2d2d2d2-0000-0000-0000-000000000001', 'Consultoría GD');
insert into public.empresas (id, consultoria_id, nombre) values
  ('d3d3d3d3-0000-0000-0000-000000000001', 'd2d2d2d2-0000-0000-0000-000000000001', 'Empresa GD');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('d1d1d1d1-0000-0000-0000-000000000001', 'K1', 'k1@gd.test', 'consultor',       'd2d2d2d2-0000-0000-0000-000000000001', null),
  ('d1d1d1d1-0000-0000-0000-000000000002', 'K2', 'k2@gd.test', 'consultor',       'd2d2d2d2-0000-0000-0000-000000000001', null),
  ('d1d1d1d1-0000-0000-0000-000000000003', 'U',  'u@gd.test',  'usuario_cliente', 'd2d2d2d2-0000-0000-0000-000000000001', 'd3d3d3d3-0000-0000-0000-000000000001');
insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('d4d4d4d4-0000-0000-0000-000000000001', 'd2d2d2d2-0000-0000-0000-000000000001', 'd3d3d3d3-0000-0000-0000-000000000001', 'Proyecto GD');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('d4d4d4d4-0000-0000-0000-000000000001', 'd1d1d1d1-0000-0000-0000-000000000001', 'd2d2d2d2-0000-0000-0000-000000000001');
insert into public.evidencias (id, consultoria_id, proyecto_id, nombre, tipo, subido_por) values
  ('d5d5d5d5-0000-0000-0000-000000000001', 'd2d2d2d2-0000-0000-0000-000000000001', 'd4d4d4d4-0000-0000-0000-000000000001',
   'Acta', 'Documento', 'd1d1d1d1-0000-0000-0000-000000000003');

-- ─── Anónimo ────────────────────────────────────────────────────────────────
set local role anon;
select throws_ok(
  $$ select public.guardar_documento('{}'::jsonb, null, null) $$,
  '42501', null, 'Un anónimo no puede guardar documentos'
);
reset role;

-- ─── K1: consultor asignado ─────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"d1d1d1d1-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$ select public.guardar_documento(
       '{"id":"d6d6d6d6-0000-0000-0000-000000000001","proyecto_id":"d4d4d4d4-0000-0000-0000-000000000001",
         "nombre":"Procedimiento de compras","tipo":"Procedimiento","estado":"Borrador","version":"0.1",
         "secciones":[{"id":"s1","titulo":"Objetivo","tipo":"texto","contenido":"Comprar bien"}],
         "evidencias":["d5d5d5d5-0000-0000-0000-000000000001"]}'::jsonb,
       null,
       '{"accion":"Documento creado","detalle":"Plantilla de procedimiento"}'::jsonb) $$,
  'El consultor asignado crea un documento con una evidencia vinculada'
);
reset role;

select is(
  (select array[consultoria_id::text, creado_por::text, secciones->0->>'titulo']
   from public.documentos where id = 'd6d6d6d6-0000-0000-0000-000000000001'),
  array['d2d2d2d2-0000-0000-0000-000000000001', 'd1d1d1d1-0000-0000-0000-000000000001', 'Objetivo'],
  'Toma la consultoría del proyecto, registra al autor y guarda las secciones'
);
select is(
  (select count(*) from public.documento_evidencias where documento_id = 'd6d6d6d6-0000-0000-0000-000000000001'),
  1::bigint, 'Quedó vinculada la evidencia'
);
select is(
  (select accion from public.historial where entidad_tipo = 'documento' and entidad_id = 'd6d6d6d6-0000-0000-0000-000000000001'),
  'Documento creado', 'El evento quedó en el historial'
);

select set_config('request.jwt.claims', '{"sub":"d1d1d1d1-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
-- Enviar a revisión: queda UNA instantánea. Desde L2 reenviar la misma versión ya no se
-- acepta (el documento queda congelado en revisión y la instantánea no se pisa).
select lives_ok(
  $$ select public.guardar_documento(
       '{"id":"d6d6d6d6-0000-0000-0000-000000000001","proyecto_id":"d4d4d4d4-0000-0000-0000-000000000001",
         "nombre":"Procedimiento de compras","tipo":"Procedimiento","estado":"Pendiente de revisión","version":"0.1","evidencias":[]}'::jsonb,
       '{"version":"0.1","comentario":"Primer envío","motivo":"Creación"}'::jsonb, null) $$,
  'El consultor envía el documento a revisión (y desvincula la evidencia)'
);
select throws_ok(
  $$ select public.guardar_documento(
       '{"id":"d6d6d6d6-0000-0000-0000-000000000001","proyecto_id":"d4d4d4d4-0000-0000-0000-000000000001",
         "nombre":"Procedimiento de compras","tipo":"Procedimiento","estado":"Pendiente de revisión","version":"0.1","evidencias":[]}'::jsonb,
       '{"version":"0.1","comentario":"Segundo envío","motivo":"Ajustes"}'::jsonb, null) $$,
  '42501', null, 'Reenviar la misma versión ya no se acepta (en revisión está congelado)'
);
select throws_ok(
  $$ select public.guardar_documento(
       '{"id":"d6d6d6d6-0000-0000-0000-000000000001","proyecto_id":"d4d4d4d4-0000-0000-0000-000000000001",
         "nombre":"Procedimiento de compras","tipo":"Procedimiento","estado":"Aprobado","version":"0.1","evidencias":[]}'::jsonb,
       null, null) $$,
  '42501', null, 'Desde el editor no se puede aprobar un documento'
);
reset role;

select is(
  (select array[(select count(*)::text from public.documento_versiones where documento_id = 'd6d6d6d6-0000-0000-0000-000000000001'),
                (select comentario from public.documento_versiones where documento_id = 'd6d6d6d6-0000-0000-0000-000000000001'),
                (select count(*)::text from public.documento_evidencias where documento_id = 'd6d6d6d6-0000-0000-0000-000000000001')]),
  array['1', 'Primer envío', '0'],
  'Una sola instantánea por versión (la del primer envío, intacta) y la evidencia desvinculada'
);

-- Un documento aprobado queda congelado.
update public.documentos set estado = 'Aprobado', bloqueado = true where id = 'd6d6d6d6-0000-0000-0000-000000000001';

select set_config('request.jwt.claims', '{"sub":"d1d1d1d1-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.guardar_documento(
       '{"id":"d6d6d6d6-0000-0000-0000-000000000001","proyecto_id":"d4d4d4d4-0000-0000-0000-000000000001",
         "nombre":"Cambio después de aprobado","tipo":"Procedimiento","estado":"Borrador","version":"0.1","evidencias":[]}'::jsonb,
       null, null) $$,
  '42501', null, 'Un documento aprobado no se puede modificar (hay que crear una nueva versión)'
);
reset role;

-- ─── K2: consultor NO asignado ──────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"d1d1d1d1-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.guardar_documento(
       '{"id":"d6d6d6d6-0000-0000-0000-000000000002","proyecto_id":"d4d4d4d4-0000-0000-0000-000000000001",
         "nombre":"Intruso","tipo":"Política","estado":"Borrador","version":"0.1","evidencias":[]}'::jsonb, null, null) $$,
  '42501', null, 'Un consultor no asignado no puede crear documentos en el proyecto'
);
reset role;

-- ─── U: cliente ─────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"d1d1d1d1-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.guardar_documento(
       '{"id":"d6d6d6d6-0000-0000-0000-000000000003","proyecto_id":"d4d4d4d4-0000-0000-0000-000000000001",
         "nombre":"Del cliente","tipo":"Política","estado":"Borrador","version":"0.1","evidencias":[]}'::jsonb, null, null) $$,
  '42501', null, 'El cliente no redacta documentos (los aprueba en la revisión)'
);
reset role;

select * from finish();
rollback;
