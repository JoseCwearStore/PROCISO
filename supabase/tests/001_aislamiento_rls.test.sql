-- Aislamiento multi-tenant: cada consultoría ve solo lo suyo, y dentro de ella
-- cada rol ve solo lo que le corresponde.
--
-- Escenario:
--   COWIN (C1)          → Marketino (E1) → proyecto P1 → evidencia EV1
--                       → JAZA (E2)      → proyecto P2 → evidencia EV2
--   Consultoría 2 (C2)  → Norte (E3)     → proyecto P3 → evidencia EV3
--
--   AP  admin_prociso
--   A1  admin_consultoria de COWIN
--   K1  consultor de COWIN, asignado solo a P1
--   U1  usuario_cliente de Marketino
--   A2  admin_consultoria de Consultoría 2

-- Los IDs (prefijos f1…/fa…) no chocan con los del seed: el test no depende
-- de lo que haya cargado en la base.

begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

-- ─── Datos del escenario (como postgres, sin RLS) ───────────────────────────

insert into auth.users (id, email, aud, role) values
  ('fafafafa-0000-0000-0000-000000000001', 'ap@prociso.test', 'authenticated', 'authenticated'),
  ('fafafafa-0000-0000-0000-000000000002', 'a1@cowin.test',   'authenticated', 'authenticated'),
  ('fafafafa-0000-0000-0000-000000000003', 'k1@cowin.test',   'authenticated', 'authenticated'),
  ('fafafafa-0000-0000-0000-000000000004', 'u1@marketino.test','authenticated', 'authenticated'),
  ('fafafafa-0000-0000-0000-000000000005', 'a2@c2.test',      'authenticated', 'authenticated');

insert into public.consultorias (id, nombre) values
  ('f1f1f1f1-0000-0000-0000-000000000001', 'COWIN'),
  ('f1f1f1f1-0000-0000-0000-000000000002', 'Consultoría 2');

insert into public.empresas (id, consultoria_id, nombre) values
  ('f2f2f2f2-0000-0000-0000-000000000001', 'f1f1f1f1-0000-0000-0000-000000000001', 'Marketino'),
  ('f2f2f2f2-0000-0000-0000-000000000002', 'f1f1f1f1-0000-0000-0000-000000000001', 'JAZA'),
  ('f2f2f2f2-0000-0000-0000-000000000003', 'f1f1f1f1-0000-0000-0000-000000000002', 'Industrias Norte');

insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('fafafafa-0000-0000-0000-000000000001', 'Admin PROCISO', 'ap@prociso.test',    'admin_prociso',     null, null),
  ('fafafafa-0000-0000-0000-000000000002', 'Ana',           'a1@cowin.test',      'admin_consultoria', 'f1f1f1f1-0000-0000-0000-000000000001', null),
  ('fafafafa-0000-0000-0000-000000000003', 'Roberto',       'k1@cowin.test',      'consultor',         'f1f1f1f1-0000-0000-0000-000000000001', null),
  ('fafafafa-0000-0000-0000-000000000004', 'Carlos',        'u1@marketino.test',  'usuario_cliente',   'f1f1f1f1-0000-0000-0000-000000000001', 'f2f2f2f2-0000-0000-0000-000000000001'),
  ('fafafafa-0000-0000-0000-000000000005', 'Laura',         'a2@c2.test',         'admin_consultoria', 'f1f1f1f1-0000-0000-0000-000000000002', null);

insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('f3f3f3f3-0000-0000-0000-000000000001', 'f1f1f1f1-0000-0000-0000-000000000001', 'f2f2f2f2-0000-0000-0000-000000000001', 'SGC Marketino'),
  ('f3f3f3f3-0000-0000-0000-000000000002', 'f1f1f1f1-0000-0000-0000-000000000001', 'f2f2f2f2-0000-0000-0000-000000000002', 'SGC JAZA'),
  ('f3f3f3f3-0000-0000-0000-000000000003', 'f1f1f1f1-0000-0000-0000-000000000002', 'f2f2f2f2-0000-0000-0000-000000000003', 'SGC Norte');

insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('f3f3f3f3-0000-0000-0000-000000000001', 'fafafafa-0000-0000-0000-000000000003', 'f1f1f1f1-0000-0000-0000-000000000001');

insert into public.evidencias (id, consultoria_id, proyecto_id, nombre, tipo) values
  ('f4f4f4f4-0000-0000-0000-000000000001', 'f1f1f1f1-0000-0000-0000-000000000001', 'f3f3f3f3-0000-0000-0000-000000000001', 'Foto almacén', 'Foto'),
  ('f4f4f4f4-0000-0000-0000-000000000002', 'f1f1f1f1-0000-0000-0000-000000000001', 'f3f3f3f3-0000-0000-0000-000000000002', 'Acta JAZA',    'Documento'),
  ('f4f4f4f4-0000-0000-0000-000000000003', 'f1f1f1f1-0000-0000-0000-000000000002', 'f3f3f3f3-0000-0000-0000-000000000003', 'Video Norte',  'Video');

-- ─── Integridad: las FK compuestas impiden mezclar consultorías ─────────────

select throws_ok(
  $$ insert into public.proyectos (consultoria_id, empresa_id, nombre)
     values ('f1f1f1f1-0000-0000-0000-000000000001', 'f2f2f2f2-0000-0000-0000-000000000003', 'Cruzado') $$,
  '23503', null,
  'Un proyecto de COWIN no puede apuntar a una empresa de Consultoría 2'
);

-- ─── Anónimo ────────────────────────────────────────────────────────────────

set local role anon;
select is((select count(*) from public.proyectos), 0::bigint, 'Un anónimo no ve ningún proyecto');
reset role;

-- ─── A1: admin de COWIN ─────────────────────────────────────────────────────

select set_config('request.jwt.claims', '{"sub":"fafafafa-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.empresas), 2::bigint, 'Admin de COWIN ve sus 2 empresas');
select is((select count(*) from public.proyectos), 2::bigint, 'Admin de COWIN ve sus 2 proyectos');
select is((select count(*) from public.consultorias), 1::bigint, 'Admin de COWIN solo ve su propia consultoría');
select throws_ok(
  $$ insert into public.evidencias (consultoria_id, proyecto_id, nombre, tipo)
     values ('f1f1f1f1-0000-0000-0000-000000000002', 'f3f3f3f3-0000-0000-0000-000000000003', 'Intrusa', 'Foto') $$,
  '42501', null,
  'Admin de COWIN no puede cargar evidencias en un proyecto de Consultoría 2'
);
reset role;

-- ─── A2: admin de Consultoría 2 ─────────────────────────────────────────────

select set_config('request.jwt.claims', '{"sub":"fafafafa-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.proyectos), 1::bigint, 'Admin de Consultoría 2 ve solo su proyecto');
select is(
  (select count(*) from public.evidencias where consultoria_id = 'f1f1f1f1-0000-0000-0000-000000000001'),
  0::bigint,
  'Admin de Consultoría 2 no ve evidencias de COWIN'
);
reset role;

-- ─── K1: consultor de COWIN asignado solo a P1 ──────────────────────────────

select set_config('request.jwt.claims', '{"sub":"fafafafa-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.proyectos), 1::bigint, 'El consultor ve solo el proyecto asignado');
select is(
  (select count(*) from public.evidencias where proyecto_id = 'f3f3f3f3-0000-0000-0000-000000000002'),
  0::bigint,
  'El consultor no ve evidencias de un proyecto no asignado de su misma consultoría'
);
select lives_ok(
  $$ insert into public.evidencias (consultoria_id, proyecto_id, nombre, tipo)
     values ('f1f1f1f1-0000-0000-0000-000000000001', 'f3f3f3f3-0000-0000-0000-000000000001', 'Nueva foto', 'Foto') $$,
  'El consultor puede cargar evidencias en su proyecto asignado'
);
reset role;

-- ─── U1: cliente de Marketino ───────────────────────────────────────────────

select set_config('request.jwt.claims', '{"sub":"fafafafa-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.proyectos), 1::bigint, 'El cliente ve solo los proyectos de su empresa');
select is(
  (select count(*) from public.evidencias where proyecto_id = 'f3f3f3f3-0000-0000-0000-000000000002'),
  0::bigint,
  'El cliente de Marketino no ve evidencias de JAZA'
);
select throws_ok(
  $$ insert into public.documentos (consultoria_id, proyecto_id, nombre, tipo)
     values ('f1f1f1f1-0000-0000-0000-000000000001', 'f3f3f3f3-0000-0000-0000-000000000001', 'Política', 'Política') $$,
  '42501', null,
  'El cliente no puede crear documentos'
);
select throws_ok(
  $$ update public.perfiles set rol = 'admin_prociso'
     where id = 'fafafafa-0000-0000-0000-000000000004' $$,
  '42501', null,
  'Nadie puede cambiarse su propio rol'
);
reset role;

-- ─── AP: admin de la plataforma ─────────────────────────────────────────────

select set_config('request.jwt.claims', '{"sub":"fafafafa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.proyectos
   where consultoria_id in ('f1f1f1f1-0000-0000-0000-000000000001', 'f1f1f1f1-0000-0000-0000-000000000002')),
  3::bigint,
  'Admin PROCISO ve los proyectos de todas las consultorías'
);
reset role;

select * from finish();
rollback;
