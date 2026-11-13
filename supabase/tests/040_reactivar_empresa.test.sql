-- O2 · Reactivar una empresa archivada.
-- El diálogo de archivar promete "puedes reactivarla en cualquier momento", y el botón "Reactivar" de la ficha hace
-- el mismo UPDATE de "activa" que archivar. Se fija quién puede: el admin de SU consultoría (y el Admin PROCISO),
-- no un consultor, no el admin de otra consultoría.

begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, email, aud, role) values
  ('d2d2d2d2-0000-0000-0000-000000000001', 'adminA@re.test', 'authenticated', 'authenticated'),
  ('d2d2d2d2-0000-0000-0000-000000000002', 'consultorA@re.test', 'authenticated', 'authenticated'),
  ('d2d2d2d2-0000-0000-0000-000000000003', 'adminB@re.test', 'authenticated', 'authenticated');
insert into public.consultorias (id, nombre) values
  ('d2d2d2d2-0001-0000-0000-000000000001', 'Consultoría A'),
  ('d2d2d2d2-0001-0000-0000-000000000002', 'Consultoría B');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('d2d2d2d2-0000-0000-0000-000000000001', 'Admin A', 'adminA@re.test', 'admin_consultoria', 'd2d2d2d2-0001-0000-0000-000000000001', null),
  ('d2d2d2d2-0000-0000-0000-000000000002', 'Consultor A', 'consultorA@re.test', 'consultor', 'd2d2d2d2-0001-0000-0000-000000000001', null),
  ('d2d2d2d2-0000-0000-0000-000000000003', 'Admin B', 'adminB@re.test', 'admin_consultoria', 'd2d2d2d2-0001-0000-0000-000000000002', null);
-- Una empresa ARCHIVADA de la consultoría A.
insert into public.empresas (id, consultoria_id, nombre, activa) values
  ('d2d2d2d2-0002-0000-0000-000000000001', 'd2d2d2d2-0001-0000-0000-000000000001', 'Empresa archivada', false);

-- El consultor A SÍ ve la empresa (es miembro de uno de sus proyectos): así lo único que le impide reactivarla es la
-- política de edición, y no que la política de lectura le oculte la fila.
insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('d2d2d2d2-0003-0000-0000-000000000001', 'd2d2d2d2-0001-0000-0000-000000000001', 'd2d2d2d2-0002-0000-0000-000000000001', 'Proyecto RE');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('d2d2d2d2-0003-0000-0000-000000000001', 'd2d2d2d2-0000-0000-0000-000000000002', 'd2d2d2d2-0001-0000-0000-000000000001');

-- ═══ Quien NO puede: el consultor y el admin de otra consultoría ═══════════════
select set_config('request.jwt.claims', '{"sub":"d2d2d2d2-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ update public.empresas set activa = true where id = 'd2d2d2d2-0002-0000-0000-000000000001' $$,
  'Un consultor que SÍ ve la empresa intenta reactivarla (la política de edición no se lo permite)'
);
reset role;
select is(
  (select activa from public.empresas where id = 'd2d2d2d2-0002-0000-0000-000000000001'),
  false, 'Sigue archivada: el consultor no reactiva'
);

select set_config('request.jwt.claims', '{"sub":"d2d2d2d2-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ update public.empresas set activa = true where id = 'd2d2d2d2-0002-0000-0000-000000000001' $$,
  'El admin de OTRA consultoría intenta reactivarla'
);
reset role;
select is(
  (select activa from public.empresas where id = 'd2d2d2d2-0002-0000-0000-000000000001'),
  false, 'Sigue archivada: el admin de otra consultoría no reactiva'
);

-- ═══ Quien SÍ puede: el admin de su consultoría ═══════════════════════════════
select set_config('request.jwt.claims', '{"sub":"d2d2d2d2-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ update public.empresas set activa = true where id = 'd2d2d2d2-0002-0000-0000-000000000001' $$,
  'El admin de su consultoría reactiva la empresa'
);
-- Reactivar no abre la puerta a editar lo demás.
select throws_ok(
  $$ update public.empresas set nombre = 'Renombrada' where id = 'd2d2d2d2-0002-0000-0000-000000000001' $$,
  '42501', null, 'Reactivar es solo "activa": el nombre sigue sin editarse por UPDATE directo'
);
reset role;
select is(
  (select activa from public.empresas where id = 'd2d2d2d2-0002-0000-0000-000000000001'),
  true, 'Quedó activa'
);

-- Y se puede volver a archivar (ida y vuelta).
select set_config('request.jwt.claims', '{"sub":"d2d2d2d2-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ update public.empresas set activa = false where id = 'd2d2d2d2-0002-0000-0000-000000000001' $$,
  'El admin puede archivarla otra vez'
);
reset role;

select * from finish();
rollback;
