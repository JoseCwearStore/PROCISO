-- AUD10-M3: lo que `guardar_documento` escribe en el historial. Antes el texto de la acción lo ponía quien llamaba
-- (`p_evento->>'accion'`, sin lista ni CHECK): un editor podía fabricar "Documento aprobado" aunque el estado real no
-- cambiara. Ahora solo acepta las acciones propias de redactar y enviar; las de decisión (aprobar, rechazar, pedir
-- corrección, reemplazar, visto bueno, retirar) las escribe cada RPC que hace el cambio de verdad.

begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, email, aud, role) values ('47474747-0000-0000-0000-000000000001', 'k@hc.test', 'authenticated', 'authenticated');
insert into public.consultorias (id, nombre) values ('47474747-0000-0000-0001-000000000001', 'Consultoría HC');
insert into public.empresas (id, consultoria_id, nombre) values ('47474747-0000-0000-0002-000000000001', '47474747-0000-0000-0001-000000000001', 'Empresa HC');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('47474747-0000-0000-0000-000000000001', 'K', 'k@hc.test', 'consultor', '47474747-0000-0000-0001-000000000001', null);
insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('47474747-0000-0000-0003-000000000001', '47474747-0000-0000-0001-000000000001', '47474747-0000-0000-0002-000000000001', 'P HC');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('47474747-0000-0000-0003-000000000001', '47474747-0000-0000-0000-000000000001', '47474747-0000-0000-0001-000000000001');

create function pg_temp.doc(p_id text, p_estado text) returns jsonb language sql as
  $$ select jsonb_build_object('id', p_id, 'proyecto_id', '47474747-0000-0000-0003-000000000001', 'nombre', 'Doc ' || p_id,
       'tipo', 'Política', 'estado', p_estado, 'version', '0.1', 'secciones', '[]'::jsonb) $$;

select set_config('request.jwt.claims', '{"sub":"47474747-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$ select public.guardar_documento(pg_temp.doc('47474747-0000-0000-0004-000000000001', 'Borrador'), null,
       '{"accion":"Borrador guardado","detalle":"Cambios guardados."}'::jsonb) $$,
  'Guardar un borrador con su evento propio funciona'
);
select throws_ok(
  $$ select public.guardar_documento(pg_temp.doc('47474747-0000-0000-0004-000000000002', 'Borrador'), null,
       '{"accion":"Documento aprobado","detalle":"Versión 0.1."}'::jsonb) $$,
  '22023', null, 'No se fabrica el evento "Documento aprobado"'
);
select throws_ok(
  $$ select public.guardar_documento(pg_temp.doc('47474747-0000-0000-0004-000000000002', 'Borrador'), null,
       '{"accion":"Visto bueno del equipo","detalle":"x"}'::jsonb) $$,
  '22023', null, 'Ni el del visto bueno'
);
select throws_ok(
  $$ select public.guardar_documento(pg_temp.doc('47474747-0000-0000-0004-000000000002', 'Borrador'), null,
       '{"detalle":"sin acción"}'::jsonb) $$,
  '22023', null, 'Un evento sin acción se rechaza'
);
select throws_ok(
  $$ select public.guardar_documento(pg_temp.doc('47474747-0000-0000-0004-000000000002', 'Borrador'), null,
       '{"accion":"Enviado a revisión","detalle":"Versión 0.1."}'::jsonb) $$,
  '22023', null, '"Enviado a revisión" solo vale si el documento queda pendiente de revisión'
);
select lives_ok(
  $$ select public.guardar_documento(pg_temp.doc('47474747-0000-0000-0004-000000000003', 'Pendiente de revisión'),
       '{"version":"0.1","comentario":"Primera versión"}'::jsonb,
       '{"accion":"Enviado a revisión","detalle":"Versión 0.1."}'::jsonb) $$,
  'Enviar a revisión con su evento funciona'
);
select lives_ok(
  $$ select public.guardar_documento(pg_temp.doc('47474747-0000-0000-0004-000000000004', 'Borrador'), null,
       jsonb_build_object('accion', 'Borrador generado', 'detalle', repeat('x', 900))) $$,
  'Un detalle larguísimo no rompe el guardado'
);
reset role;

select is(
  (select count(*) from public.historial where proyecto_id = '47474747-0000-0000-0003-000000000001'
     and accion in ('Documento aprobado', 'Visto bueno del equipo')),
  0::bigint, 'No quedó ningún evento fabricado en el historial'
);
select is(
  (select array_agg(accion order by accion) from public.historial where proyecto_id = '47474747-0000-0000-0003-000000000001'),
  array['Borrador generado', 'Borrador guardado', 'Enviado a revisión'],
  'Solo quedaron los tres eventos legítimos'
);
select is(
  (select length(descripcion) from public.historial where accion = 'Borrador generado' and proyecto_id = '47474747-0000-0000-0003-000000000001'),
  500, 'El detalle se recorta a 500 caracteres'
);

select * from finish();
rollback;
