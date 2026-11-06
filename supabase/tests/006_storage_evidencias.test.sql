-- RLS sobre los ARCHIVOS del bucket "evidencias".
-- Ruta: {consultoria_id}/{empresa_id}/{proyecto_id}/{archivo}
-- Nadie lee, sube ni borra archivos de un proyecto que no le corresponde,
-- aunque adivine o arme la ruta a mano.

begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

-- C1 (COWIN de prueba) con su proyecto P1 · C2 otra consultoría
-- K1 consultor asignado a P1 · K2 consultor de C1 NO asignado · U cliente de E1 · A2 admin de C2
insert into auth.users (id, email, aud, role) values
  ('e1e1e1e1-0000-0000-0000-000000000001', 'k1@st.test', 'authenticated', 'authenticated'),
  ('e1e1e1e1-0000-0000-0000-000000000002', 'k2@st.test', 'authenticated', 'authenticated'),
  ('e1e1e1e1-0000-0000-0000-000000000003', 'u@st.test',  'authenticated', 'authenticated'),
  ('e1e1e1e1-0000-0000-0000-000000000004', 'a2@st.test', 'authenticated', 'authenticated');
insert into public.consultorias (id, nombre) values
  ('e2e2e2e2-0000-0000-0000-000000000001', 'Consultoría ST 1'),
  ('e2e2e2e2-0000-0000-0000-000000000002', 'Consultoría ST 2');
insert into public.empresas (id, consultoria_id, nombre) values
  ('e3e3e3e3-0000-0000-0000-000000000001', 'e2e2e2e2-0000-0000-0000-000000000001', 'Empresa ST');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('e1e1e1e1-0000-0000-0000-000000000001', 'K1', 'k1@st.test', 'consultor',         'e2e2e2e2-0000-0000-0000-000000000001', null),
  ('e1e1e1e1-0000-0000-0000-000000000002', 'K2', 'k2@st.test', 'consultor',         'e2e2e2e2-0000-0000-0000-000000000001', null),
  ('e1e1e1e1-0000-0000-0000-000000000003', 'U',  'u@st.test',  'usuario_cliente',   'e2e2e2e2-0000-0000-0000-000000000001', 'e3e3e3e3-0000-0000-0000-000000000001'),
  ('e1e1e1e1-0000-0000-0000-000000000004', 'A2', 'a2@st.test', 'admin_consultoria', 'e2e2e2e2-0000-0000-0000-000000000002', null);
insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('e4e4e4e4-0000-0000-0000-000000000001', 'e2e2e2e2-0000-0000-0000-000000000001', 'e3e3e3e3-0000-0000-0000-000000000001', 'Proyecto ST');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('e4e4e4e4-0000-0000-0000-000000000001', 'e1e1e1e1-0000-0000-0000-000000000001', 'e2e2e2e2-0000-0000-0000-000000000001');

select ok(
  (select not public from storage.buckets where id = 'evidencias'),
  'El bucket "evidencias" existe y es privado'
);

-- ─── K1: consultor asignado ─────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"e1e1e1e1-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('evidencias',
     'e2e2e2e2-0000-0000-0000-000000000001/e3e3e3e3-0000-0000-0000-000000000001/e4e4e4e4-0000-0000-0000-000000000001/foto-k1.jpg') $$,
  'El consultor asignado sube un archivo a su proyecto'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('evidencias',
     'e2e2e2e2-0000-0000-0000-000000000002/e3e3e3e3-0000-0000-0000-000000000001/e4e4e4e4-0000-0000-0000-000000000001/trucha.jpg') $$,
  '42501', null,
  'Una ruta con una consultoría que no es la del proyecto se rechaza (ruta armada a mano)'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('evidencias', 'cualquier/cosa.jpg') $$,
  '42501', null,
  'Una ruta mal formada se rechaza como falta de permiso, sin romper'
);
reset role;

-- ─── U: cliente de la empresa ───────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"e1e1e1e1-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('evidencias',
     'e2e2e2e2-0000-0000-0000-000000000001/e3e3e3e3-0000-0000-0000-000000000001/e4e4e4e4-0000-0000-0000-000000000001/foto-cliente.jpg') $$,
  'El cliente sube evidencias a un proyecto de su empresa'
);
select is(
  (select count(*) from storage.objects where bucket_id = 'evidencias' and name like 'e2e2e2e2-0000-0000-0000-000000000001/%'),
  2::bigint, 'El cliente ve los archivos de su proyecto'
);
-- Supabase bloquea el DELETE directo con un trigger salvo que la API de Storage
-- active este flag. Lo activamos igual que la API, para probar NUESTRA política.
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects where bucket_id = 'evidencias' and name like '%foto-k1.jpg';
reset role;

select is(
  (select count(*) from storage.objects where name like '%foto-k1.jpg'),
  1::bigint, 'El cliente no puede borrar archivos (el borrado no afectó nada)'
);

-- ─── K2: consultor de la misma consultoría, NO asignado ─────────────────────
select set_config('request.jwt.claims', '{"sub":"e1e1e1e1-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from storage.objects where bucket_id = 'evidencias' and name like 'e2e2e2e2-0000-0000-0000-000000000001/%'),
  0::bigint, 'Un consultor no asignado no ve los archivos del proyecto'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('evidencias',
     'e2e2e2e2-0000-0000-0000-000000000001/e3e3e3e3-0000-0000-0000-000000000001/e4e4e4e4-0000-0000-0000-000000000001/k2.jpg') $$,
  '42501', null, 'Un consultor no asignado no puede subir archivos al proyecto'
);
reset role;

-- ─── A2: admin de otra consultoría ──────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"e1e1e1e1-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*) from storage.objects where bucket_id = 'evidencias' and name like 'e2e2e2e2-0000-0000-0000-000000000001/%'),
  0::bigint, 'El admin de otra consultoría no ve los archivos'
);
reset role;

-- ─── Anónimo ────────────────────────────────────────────────────────────────
set local role anon;
select is(
  (select count(*) from storage.objects where bucket_id = 'evidencias'),
  0::bigint, 'Un anónimo no ve ningún archivo'
);
reset role;

select * from finish();
rollback;
