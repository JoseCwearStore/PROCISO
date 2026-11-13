-- AUD10-M2: las evidencias de un documento solo se vinculan y desvinculan por `guardar_documento`, que respeta el
-- congelado en revisión (D2) y deja historial. Antes la tabla `documento_evidencias` conservaba un DELETE directo
-- para el equipo: se podían desvincular las evidencias de un documento en revisión o APROBADO sin dejar rastro.

begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email, aud, role) values
  ('46464646-0000-0000-0000-000000000001', 'k@dev.test', 'authenticated', 'authenticated'),
  ('46464646-0000-0000-0000-000000000002', 'a@dev.test', 'authenticated', 'authenticated');
insert into public.consultorias (id, nombre) values ('46464646-0000-0000-0001-000000000001', 'Consultoría DV');
insert into public.empresas (id, consultoria_id, nombre) values
  ('46464646-0000-0000-0002-000000000001', '46464646-0000-0000-0001-000000000001', 'Empresa DV');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('46464646-0000-0000-0000-000000000001', 'K', 'k@dev.test', 'consultor',         '46464646-0000-0000-0001-000000000001', null),
  ('46464646-0000-0000-0000-000000000002', 'A', 'a@dev.test', 'admin_consultoria', '46464646-0000-0000-0001-000000000001', null);
insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('46464646-0000-0000-0003-000000000001', '46464646-0000-0000-0001-000000000001', '46464646-0000-0000-0002-000000000001', 'P DV');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('46464646-0000-0000-0003-000000000001', '46464646-0000-0000-0000-000000000001', '46464646-0000-0000-0001-000000000001');
insert into public.documentos (id, consultoria_id, proyecto_id, nombre, tipo, estado) values
  ('46464646-0000-0000-0004-000000000001', '46464646-0000-0000-0001-000000000001', '46464646-0000-0000-0003-000000000001', 'En revisión', 'Política', 'Pendiente de revisión'),
  ('46464646-0000-0000-0004-000000000002', '46464646-0000-0000-0001-000000000001', '46464646-0000-0000-0003-000000000001', 'Aprobado', 'Manual', 'Aprobado');
insert into public.evidencias (id, consultoria_id, proyecto_id, nombre, tipo, archivo_ruta, archivo_mime) values
  ('46464646-0000-0000-0005-000000000001', '46464646-0000-0000-0001-000000000001', '46464646-0000-0000-0003-000000000001', 'Ev', 'Documento', 'c/e/p/a.pdf', 'application/pdf');
insert into public.documento_evidencias (documento_id, evidencia_id, proyecto_id, consultoria_id) values
  ('46464646-0000-0000-0004-000000000001', '46464646-0000-0000-0005-000000000001', '46464646-0000-0000-0003-000000000001', '46464646-0000-0000-0001-000000000001'),
  ('46464646-0000-0000-0004-000000000002', '46464646-0000-0000-0005-000000000001', '46464646-0000-0000-0003-000000000001', '46464646-0000-0000-0001-000000000001');

-- El consultor del equipo.
select set_config('request.jwt.claims', '{"sub":"46464646-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ delete from public.documento_evidencias where documento_id = '46464646-0000-0000-0004-000000000001' $$,
  '42501', null, 'El consultor no desvincula evidencias de un documento en revisión'
);
select throws_ok(
  $$ delete from public.documento_evidencias where documento_id = '46464646-0000-0000-0004-000000000002' $$,
  '42501', null, 'El consultor no desvincula evidencias de un documento aprobado'
);
-- Sigue pudiendo leerlas.
select is(
  (select count(*) from public.documento_evidencias), 2::bigint, 'El equipo sigue viendo los vínculos'
);
reset role;

-- El administrador de la consultoría.
select set_config('request.jwt.claims', '{"sub":"46464646-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ delete from public.documento_evidencias where documento_id = '46464646-0000-0000-0004-000000000002' $$,
  '42501', null, 'Ni el administrador de la consultoría desvincula por la API'
);
reset role;

-- Un anónimo.
set local role anon;
select throws_ok(
  $$ delete from public.documento_evidencias $$,
  '42501', null, 'Un anónimo tampoco'
);
reset role;

select is(
  (select count(*) from public.documento_evidencias where proyecto_id = '46464646-0000-0000-0003-000000000001'), 2::bigint, 'Los vínculos siguen todos ahí'
);

select * from finish();
rollback;
