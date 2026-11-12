-- AUD10-M1 (decisión del 12/11): ningún rol borra por la API documentos, versiones, evidencias ni proyectos.
--   · Antes un administrador (de consultoría o PROCISO) podía destruir una aprobación (y, al borrar un proyecto, su
--     historial por cascada) llamando a la API; la pantalla no tiene ningún botón para eso.
--   · Ahora esos DELETE están revocados para todos los roles de la API. Lo único que sigue borrando es la CASCADA
--     de D4 (solo el Admin PROCISO borra empresas), que corre con los privilegios del dueño de la tabla.

begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

-- A admin C1 · K consultor C1 · U cliente E1 · AP admin PROCISO
insert into auth.users (id, email, aud, role)
select format('37373737-0000-0000-0000-%s', lpad(n::text, 12, '0'))::uuid, format('u%s@borrado.test', n), 'authenticated', 'authenticated'
from unnest(array[1, 2, 3, 4]) as n;
insert into public.consultorias (id, nombre) values
  ('37373737-0000-0000-0001-000000000001', 'Consultoría C1'),
  ('37373737-0000-0000-0001-000000000002', 'Consultoría C2');
insert into public.empresas (id, consultoria_id, nombre) values
  ('37373737-0000-0000-0002-000000000001', '37373737-0000-0000-0001-000000000001', 'Empresa E1'),
  ('37373737-0000-0000-0002-000000000002', '37373737-0000-0000-0001-000000000002', 'Empresa E2');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('37373737-0000-0000-0000-000000000001', 'A',  'u1@borrado.test', 'admin_consultoria', '37373737-0000-0000-0001-000000000001', null),
  ('37373737-0000-0000-0000-000000000002', 'K',  'u2@borrado.test', 'consultor',         '37373737-0000-0000-0001-000000000001', null),
  ('37373737-0000-0000-0000-000000000003', 'U',  'u3@borrado.test', 'usuario_cliente',   '37373737-0000-0000-0001-000000000001', '37373737-0000-0000-0002-000000000001'),
  ('37373737-0000-0000-0000-000000000004', 'AP', 'u4@borrado.test', 'admin_prociso',     null, null);
insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('37373737-0000-0000-0003-000000000001', '37373737-0000-0000-0001-000000000001', '37373737-0000-0000-0002-000000000001', 'P1'),
  ('37373737-0000-0000-0003-000000000002', '37373737-0000-0000-0001-000000000002', '37373737-0000-0000-0002-000000000002', 'P2');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('37373737-0000-0000-0003-000000000001', '37373737-0000-0000-0000-000000000002', '37373737-0000-0000-0001-000000000001');
insert into public.documentos (id, consultoria_id, proyecto_id, nombre, tipo, estado) values
  ('37373737-0000-0000-0004-000000000001', '37373737-0000-0000-0001-000000000001', '37373737-0000-0000-0003-000000000001', 'Doc aprobado P1', 'Política', 'Aprobado'),
  ('37373737-0000-0000-0004-000000000002', '37373737-0000-0000-0001-000000000002', '37373737-0000-0000-0003-000000000002', 'Doc P2', 'Política', 'Borrador');
insert into public.documento_versiones (consultoria_id, proyecto_id, documento_id, version, autor_id, secciones, estado) values
  ('37373737-0000-0000-0001-000000000001', '37373737-0000-0000-0003-000000000001', '37373737-0000-0000-0004-000000000001', '1.0', '37373737-0000-0000-0000-000000000001', '[]', 'Aprobado'),
  ('37373737-0000-0000-0001-000000000002', '37373737-0000-0000-0003-000000000002', '37373737-0000-0000-0004-000000000002', '1.0', null, '[]', 'Borrador');
insert into public.evidencias (id, consultoria_id, proyecto_id, nombre, tipo, archivo_ruta, archivo_mime) values
  ('37373737-0000-0000-0005-000000000001', '37373737-0000-0000-0001-000000000001', '37373737-0000-0000-0003-000000000001', 'Ev P1', 'Documento', 'c1/e1/p1/a.pdf', 'application/pdf'),
  ('37373737-0000-0000-0005-000000000002', '37373737-0000-0000-0001-000000000002', '37373737-0000-0000-0003-000000000002', 'Ev P2', 'Documento', 'c2/e2/p2/a.pdf', 'application/pdf');

create function pg_temp.como(p_id text) returns void language sql as
  $$ select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', p_id), true) $$;

-- ─── El Admin de la consultoría ya no borra nada de esto ────────────────────
select pg_temp.como('37373737-0000-0000-0000-000000000001');
set local role authenticated;
select throws_ok($$ delete from public.documentos where id = '37373737-0000-0000-0004-000000000001' $$,
  '42501', null, 'El Admin Consultoría no borra un documento APROBADO');
select throws_ok($$ delete from public.documento_versiones where documento_id = '37373737-0000-0000-0004-000000000001' $$,
  '42501', null, 'El Admin Consultoría no borra la instantánea de una versión');
select throws_ok($$ delete from public.evidencias where id = '37373737-0000-0000-0005-000000000001' $$,
  '42501', null, 'El Admin Consultoría no borra una evidencia');
select throws_ok($$ delete from public.proyectos where id = '37373737-0000-0000-0003-000000000001' $$,
  '42501', null, 'El Admin Consultoría no borra un proyecto (y con él su historial)');
reset role;

-- ─── Ni el Admin PROCISO por la API ─────────────────────────────────────────
select pg_temp.como('37373737-0000-0000-0000-000000000004');
set local role authenticated;
select throws_ok($$ delete from public.documentos where id = '37373737-0000-0000-0004-000000000002' $$,
  '42501', null, 'El Admin PROCISO no borra un documento por la API');
select throws_ok($$ delete from public.documento_versiones where documento_id = '37373737-0000-0000-0004-000000000002' $$,
  '42501', null, 'El Admin PROCISO no borra una versión por la API');
select throws_ok($$ delete from public.evidencias where id = '37373737-0000-0000-0005-000000000002' $$,
  '42501', null, 'El Admin PROCISO no borra una evidencia por la API');
select throws_ok($$ delete from public.proyectos where id = '37373737-0000-0000-0003-000000000002' $$,
  '42501', null, 'El Admin PROCISO no borra un proyecto por la API');
reset role;

-- ─── Y los demás roles tampoco (ya no tenían política: ahora ni siquiera el privilegio) ───
select pg_temp.como('37373737-0000-0000-0000-000000000002');
set local role authenticated;
select throws_ok($$ delete from public.documentos where id = '37373737-0000-0000-0004-000000000001' $$,
  '42501', null, 'Un consultor no borra documentos');
reset role;
select pg_temp.como('37373737-0000-0000-0000-000000000003');
set local role authenticated;
select throws_ok($$ delete from public.evidencias where id = '37373737-0000-0000-0005-000000000001' $$,
  '42501', null, 'Un cliente no borra evidencias');
reset role;

-- ─── Nada se borró, y el privilegio está revocado en las cuatro tablas ──────
select is(
  (select row((select count(*) from public.documentos where proyecto_id::text like '37373737-%'),
              (select count(*) from public.documento_versiones where proyecto_id::text like '37373737-%'),
              (select count(*) from public.evidencias where proyecto_id::text like '37373737-%'),
              (select count(*) from public.proyectos where id::text like '37373737-%'))::text),
  '(2,2,2,2)', 'Siguen los 2 documentos, 2 versiones, 2 evidencias y 2 proyectos');
select is(
  (select array_agg(has_table_privilege('authenticated', 'public.' || t, 'DELETE') order by t)
   from unnest(array['documentos', 'documento_versiones', 'evidencias', 'proyectos']) as t),
  array[false, false, false, false], 'authenticated no tiene el privilegio DELETE sobre las cuatro tablas');

-- ─── Control positivo: la regla D4 sigue andando (solo el Admin PROCISO borra empresas) y la cascada también ───
select pg_temp.como('37373737-0000-0000-0000-000000000004');
set local role authenticated;
select lives_ok($$ delete from public.empresas where id = '37373737-0000-0000-0002-000000000002' $$,
  'El Admin PROCISO sigue borrando una empresa');
reset role;
select is(
  (select row((select count(*) from public.proyectos where empresa_id = '37373737-0000-0000-0002-000000000002'),
              (select count(*) from public.documentos where proyecto_id = '37373737-0000-0000-0003-000000000002'),
              (select count(*) from public.evidencias where proyecto_id = '37373737-0000-0000-0003-000000000002'))::text),
  '(0,0,0)', 'La cascada de borrar la empresa arrastra sus proyectos, documentos y evidencias (corre con privilegios del dueño)');

select * from finish();
rollback;
