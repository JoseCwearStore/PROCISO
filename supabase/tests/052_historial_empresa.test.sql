-- O34 · Crear, archivar y reactivar una empresa quedan en el historial (antes no dejaban nada: la pestaña Historial de la
-- empresa no mostraba cuándo ni quién la registró). Lo escribe un trigger, así vale para cualquier camino de escritura.

begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email, aud, role) values ('52525252-0000-0000-0000-000000000001', 'a@he.test', 'authenticated', 'authenticated');
insert into public.consultorias (id, nombre) values ('52525252-0000-0000-0001-000000000001', 'Consultoría HE');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('52525252-0000-0000-0000-000000000001', 'A', 'a@he.test', 'admin_consultoria', '52525252-0000-0000-0001-000000000001', null);

select set_config('request.jwt.claims', '{"sub":"52525252-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
insert into public.empresas (consultoria_id, nombre) values ('52525252-0000-0000-0001-000000000001', 'Empresa HE');
reset role;

select is(
  (select array[accion, autor_id::text, descripcion] from public.historial where entidad_id = (select id from public.empresas where nombre = 'Empresa HE') and entidad_tipo = 'empresa'),
  array['Empresa registrada', '52525252-0000-0000-0000-000000000001', 'Empresa HE'],
  'Crear una empresa deja "Empresa registrada", a nombre de quien la creó');

select set_config('request.jwt.claims', '{"sub":"52525252-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
update public.empresas set activa = false where id = (select id from public.empresas where nombre = 'Empresa HE');
reset role;
select is(
  (select array[accion, estado_anterior, estado_nuevo] from public.historial
   where entidad_id = (select id from public.empresas where nombre = 'Empresa HE') and accion = 'Empresa archivada'),
  array['Empresa archivada', 'Activa', 'Archivada'], 'Archivarla deja "Empresa archivada" con el cambio de estado');

set local role authenticated;
update public.empresas set activa = true where id = (select id from public.empresas where nombre = 'Empresa HE');
reset role;
select is(
  (select array[accion, estado_anterior, estado_nuevo] from public.historial
   where entidad_id = (select id from public.empresas where nombre = 'Empresa HE') and accion = 'Empresa reactivada'),
  array['Empresa reactivada', 'Archivada', 'Activa'], 'Reactivarla deja "Empresa reactivada"');

-- Editar datos que no son el estado no genera ruido en el historial.
set local role authenticated;
update public.empresas set ciudad = 'Quito' where id = (select id from public.empresas where nombre = 'Empresa HE');
reset role;
select is(
  (select count(*)::int from public.historial where entidad_id = (select id from public.empresas where nombre = 'Empresa HE')),
  3, 'Editar la ciudad no agrega eventos (solo registro, archivado y reactivación)');

-- Un UPDATE que deja activa igual no cuenta como archivado ni reactivación.
set local role authenticated;
update public.empresas set activa = true where id = (select id from public.empresas where nombre = 'Empresa HE');
reset role;
select is(
  (select count(*)::int from public.historial where entidad_id = (select id from public.empresas where nombre = 'Empresa HE') and accion in ('Empresa archivada', 'Empresa reactivada')),
  2, 'Guardar con el mismo estado no inventa un archivado o una reactivación');

select is(
  (select count(*)::int from public.historial where entidad_id = (select id from public.empresas where nombre = 'Empresa HE') and proyecto_id is not null),
  0, 'Los eventos de la empresa no cuelgan de ningún proyecto');

select * from finish();
rollback;
