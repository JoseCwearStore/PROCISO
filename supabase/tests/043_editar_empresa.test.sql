-- O2 · Editar una empresa. Antes solo se podía archivar/reactivar (`grant update (activa)`); ahora el admin de SU
-- consultoría (y el Admin PROCISO) edita los mismos datos que se cargan al crearla. Siguen fuera: la consultoría
-- (una empresa no cambia de dueño), el id y la fecha de alta. Un consultor y el admin de otra consultoría no editan.

begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

-- adminA admin de la consultoría A · consultorA consultor A (MIEMBRO de un proyecto de la empresa: la ve) ·
-- adminB admin de B · adminP admin PROCISO
insert into auth.users (id, email, aud, role) values
  ('d3d3d3d3-0000-0000-0000-000000000001', 'adminA@ee.test', 'authenticated', 'authenticated'),
  ('d3d3d3d3-0000-0000-0000-000000000002', 'consultorA@ee.test', 'authenticated', 'authenticated'),
  ('d3d3d3d3-0000-0000-0000-000000000003', 'adminB@ee.test', 'authenticated', 'authenticated'),
  ('d3d3d3d3-0000-0000-0000-000000000004', 'adminP@ee.test', 'authenticated', 'authenticated'),
  ('d3d3d3d3-0000-0000-0000-000000000005', 'consultorB@ee.test', 'authenticated', 'authenticated');
insert into public.consultorias (id, nombre) values
  ('d3d3d3d3-0001-0000-0000-000000000001', 'Consultoría A'),
  ('d3d3d3d3-0001-0000-0000-000000000002', 'Consultoría B');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('d3d3d3d3-0000-0000-0000-000000000001', 'Admin A', 'adminA@ee.test', 'admin_consultoria', 'd3d3d3d3-0001-0000-0000-000000000001', null),
  ('d3d3d3d3-0000-0000-0000-000000000002', 'Consultor A', 'consultorA@ee.test', 'consultor', 'd3d3d3d3-0001-0000-0000-000000000001', null),
  ('d3d3d3d3-0000-0000-0000-000000000003', 'Admin B', 'adminB@ee.test', 'admin_consultoria', 'd3d3d3d3-0001-0000-0000-000000000002', null),
  ('d3d3d3d3-0000-0000-0000-000000000004', 'Admin PROCISO', 'adminP@ee.test', 'admin_prociso', null, null),
  ('d3d3d3d3-0000-0000-0000-000000000005', 'Consultor B', 'consultorB@ee.test', 'consultor', 'd3d3d3d3-0001-0000-0000-000000000002', null);
insert into public.empresas (id, consultoria_id, nombre, ciudad) values
  ('d3d3d3d3-0002-0000-0000-000000000001', 'd3d3d3d3-0001-0000-0000-000000000001', 'Empresa original', 'Lima');
insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('d3d3d3d3-0003-0000-0000-000000000001', 'd3d3d3d3-0001-0000-0000-000000000001', 'd3d3d3d3-0002-0000-0000-000000000001', 'Proyecto EE');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('d3d3d3d3-0003-0000-0000-000000000001', 'd3d3d3d3-0000-0000-0000-000000000002', 'd3d3d3d3-0001-0000-0000-000000000001');

-- ═══ Quien NO edita ════════════════════════════════════════════════════════════
-- Anónimo
set local role anon;
select lives_ok(
  $$ update public.empresas set nombre = 'Anónimo' where id = 'd3d3d3d3-0002-0000-0000-000000000001' $$,
  'Un anónimo intenta renombrarla (la RLS no le deja ver ninguna fila)'
);
reset role;
select is(
  (select nombre from public.empresas where id = 'd3d3d3d3-0002-0000-0000-000000000001'),
  'Empresa original', 'Sigue con su nombre: el anónimo no edita'
);

-- El consultor A SÍ ve la empresa: lo único que le impide editarla es la política de edición.
select set_config('request.jwt.claims', '{"sub":"d3d3d3d3-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ update public.empresas set nombre = 'Del consultor' where id = 'd3d3d3d3-0002-0000-0000-000000000001' $$,
  'Un consultor que ve la empresa intenta renombrarla'
);
reset role;
select is(
  (select nombre from public.empresas where id = 'd3d3d3d3-0002-0000-0000-000000000001'),
  'Empresa original', 'Sigue con su nombre: el consultor no edita'
);

-- El admin de OTRA consultoría
select set_config('request.jwt.claims', '{"sub":"d3d3d3d3-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ update public.empresas set nombre = 'De otra consultoría' where id = 'd3d3d3d3-0002-0000-0000-000000000001' $$,
  'El admin de otra consultoría intenta renombrarla'
);
reset role;
select is(
  (select nombre from public.empresas where id = 'd3d3d3d3-0002-0000-0000-000000000001'),
  'Empresa original', 'Sigue con su nombre: el admin de otra consultoría no edita'
);

-- ═══ Quien SÍ edita: el admin de su consultoría ═══════════════════════════════
select set_config('request.jwt.claims', '{"sub":"d3d3d3d3-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ update public.empresas set nombre = 'Empresa renombrada', nombre_comercial = 'Marca', rfc = 'RFC123', sector = 'Servicios',
       tamano = 'Mediana', trabajadores = '80', ciudad = 'Quito', entidad_federativa = 'Pichincha', direccion = 'Av. 1',
       contacto_principal = 'Ana', cargo_contacto = 'Gerente', email_contacto = 'a@e.test', telefono_contacto = '555',
       procesos_principales = 'Ventas', alcance_inicial = 'Todo', norma_interes = 'ISO 9001:2015',
       consultor_asignado_id = 'd3d3d3d3-0000-0000-0000-000000000002', observaciones = 'Nota'
     where id = 'd3d3d3d3-0002-0000-0000-000000000001' $$,
  'El admin de su consultoría edita todos los datos que se cargan al crear'
);
reset role;
select is(
  (select array[nombre, ciudad, norma_interes, consultor_asignado_id::text] from public.empresas where id = 'd3d3d3d3-0002-0000-0000-000000000001'),
  array['Empresa renombrada', 'Quito', 'ISO 9001:2015', 'd3d3d3d3-0000-0000-0000-000000000002'],
  'Los cambios quedaron guardados'
);

select set_config('request.jwt.claims', '{"sub":"d3d3d3d3-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
-- Lo que sigue fuera de la edición.
select throws_ok(
  $$ update public.empresas set consultoria_id = 'd3d3d3d3-0001-0000-0000-000000000002' where id = 'd3d3d3d3-0002-0000-0000-000000000001' $$,
  '42501', null, 'Una empresa no cambia de consultoría'
);
select throws_ok(
  $$ update public.empresas set creado_en = now() where id = 'd3d3d3d3-0002-0000-0000-000000000001' $$,
  '42501', null, 'La fecha de alta no se edita'
);
-- El asignado debe ser de la misma consultoría (clave foránea compuesta).
select throws_ok(
  $$ update public.empresas set consultor_asignado_id = 'd3d3d3d3-0000-0000-0000-000000000005' where id = 'd3d3d3d3-0002-0000-0000-000000000001' $$,
  '23503', null, 'No se asigna un consultor de otra consultoría'
);
-- Editar no rompe archivar.
select lives_ok(
  $$ update public.empresas set activa = false where id = 'd3d3d3d3-0002-0000-0000-000000000001' $$,
  'Archivar sigue funcionando'
);
reset role;

-- ═══ Admin PROCISO ════════════════════════════════════════════════════════════
select set_config('request.jwt.claims', '{"sub":"d3d3d3d3-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ update public.empresas set nombre = 'Por PROCISO' where id = 'd3d3d3d3-0002-0000-0000-000000000001' $$,
  'El Admin PROCISO también edita'
);
-- La política no frena al Admin PROCISO: aquí la que impide mover la empresa es la falta de permiso de columna.
select throws_ok(
  $$ update public.empresas set consultoria_id = 'd3d3d3d3-0001-0000-0000-000000000002' where id = 'd3d3d3d3-0002-0000-0000-000000000001' $$,
  '42501', null, 'Ni el Admin PROCISO mueve una empresa de consultoría'
);
reset role;
select is(
  (select nombre from public.empresas where id = 'd3d3d3d3-0002-0000-0000-000000000001'),
  'Por PROCISO', 'Quedó renombrada por el Admin PROCISO'
);

select * from finish();
rollback;
