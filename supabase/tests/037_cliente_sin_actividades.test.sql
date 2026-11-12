-- AUD10-M9 (decisión del 12/11): el Usuario Cliente lee los PROCESOS de su empresa (el formulario de subir una
-- evidencia exige elegir uno) pero NO las ACTIVIDADES internas de cada proceso.
--   · Antes la API le daba procesos y actividades completos aunque la pantalla se los ocultaba.
--   · El equipo (consultor, admin de consultoría) y el Admin PROCISO siguen viéndolas; otra consultoría no.

begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

-- A admin C1 · K consultor miembro de P1 · U cliente de E1 · AP admin PROCISO · A2 admin C2
insert into auth.users (id, email, aud, role)
select format('39393939-0000-0000-0000-%s', lpad(n::text, 12, '0'))::uuid, format('u%s@act.test', n), 'authenticated', 'authenticated'
from unnest(array[1, 2, 3, 4, 5]) as n;
insert into public.consultorias (id, nombre) values
  ('39393939-0000-0000-0001-000000000001', 'Consultoría C1'),
  ('39393939-0000-0000-0001-000000000002', 'Consultoría C2');
insert into public.empresas (id, consultoria_id, nombre) values
  ('39393939-0000-0000-0002-000000000001', '39393939-0000-0000-0001-000000000001', 'Empresa E1'),
  ('39393939-0000-0000-0002-000000000002', '39393939-0000-0000-0001-000000000002', 'Empresa E2');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('39393939-0000-0000-0000-000000000001', 'A',  'u1@act.test', 'admin_consultoria', '39393939-0000-0000-0001-000000000001', null),
  ('39393939-0000-0000-0000-000000000002', 'K',  'u2@act.test', 'consultor',         '39393939-0000-0000-0001-000000000001', null),
  ('39393939-0000-0000-0000-000000000003', 'U',  'u3@act.test', 'usuario_cliente',   '39393939-0000-0000-0001-000000000001', '39393939-0000-0000-0002-000000000001'),
  ('39393939-0000-0000-0000-000000000004', 'AP', 'u4@act.test', 'admin_prociso',     null, null),
  ('39393939-0000-0000-0000-000000000005', 'A2', 'u5@act.test', 'admin_consultoria', '39393939-0000-0000-0001-000000000002', null);
insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('39393939-0000-0000-0003-000000000001', '39393939-0000-0000-0001-000000000001', '39393939-0000-0000-0002-000000000001', 'P1');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('39393939-0000-0000-0003-000000000001', '39393939-0000-0000-0000-000000000002', '39393939-0000-0000-0001-000000000001');
insert into public.procesos (id, consultoria_id, proyecto_id, nombre) values
  ('39393939-0000-0000-0004-000000000001', '39393939-0000-0000-0001-000000000001', '39393939-0000-0000-0003-000000000001', 'Proceso P1');
insert into public.actividades (consultoria_id, proyecto_id, proceso_id, descripcion, orden) values
  ('39393939-0000-0000-0001-000000000001', '39393939-0000-0000-0003-000000000001', '39393939-0000-0000-0004-000000000001', 'Actividad interna 1', 1),
  ('39393939-0000-0000-0001-000000000001', '39393939-0000-0000-0003-000000000001', '39393939-0000-0000-0004-000000000001', 'Actividad interna 2', 2);

create function pg_temp.como(p_id text) returns void language sql as
  $$ select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', p_id), true) $$;

-- ─── El cliente: procesos sí, actividades no ────────────────────────────────
select pg_temp.como('39393939-0000-0000-0000-000000000003');
set local role authenticated;
select is((select count(*)::int from public.procesos where proyecto_id = '39393939-0000-0000-0003-000000000001'), 1,
  'El cliente sigue viendo los procesos de su proyecto (los necesita para subir una evidencia)');
select is((select count(*)::int from public.actividades where proyecto_id = '39393939-0000-0000-0003-000000000001'), 0,
  'El cliente NO ve las actividades internas del proceso');
reset role;

-- ─── El equipo y el Admin PROCISO siguen viéndolas ──────────────────────────
select pg_temp.como('39393939-0000-0000-0000-000000000002');
set local role authenticated;
select is((select count(*)::int from public.actividades where proyecto_id = '39393939-0000-0000-0003-000000000001'), 2,
  'Un consultor del proyecto ve las 2 actividades');
reset role;
select pg_temp.como('39393939-0000-0000-0000-000000000001');
set local role authenticated;
select is((select count(*)::int from public.actividades where proyecto_id = '39393939-0000-0000-0003-000000000001'), 2,
  'El Admin de la consultoría ve las 2 actividades');
reset role;
select pg_temp.como('39393939-0000-0000-0000-000000000004');
set local role authenticated;
select is((select count(*)::int from public.actividades where proyecto_id = '39393939-0000-0000-0003-000000000001'), 2,
  'El Admin PROCISO ve las 2 actividades');
reset role;

-- ─── Otra consultoría no ve nada (el aislamiento sigue igual) ───────────────
select pg_temp.como('39393939-0000-0000-0000-000000000005');
set local role authenticated;
select is((select count(*)::int from public.actividades where proyecto_id = '39393939-0000-0000-0003-000000000001'), 0,
  'El admin de otra consultoría no ve las actividades');
select is((select count(*)::int from public.procesos where proyecto_id = '39393939-0000-0000-0003-000000000001'), 0,
  'Ni los procesos');
reset role;

-- ─── Un usuario inactivo no gana acceso por no tener rol (mi_rol() devuelve NULL) ───
update public.perfiles set activo = false where id = '39393939-0000-0000-0000-000000000003';
select pg_temp.como('39393939-0000-0000-0000-000000000003');
set local role authenticated;
select is((select count(*)::int from public.actividades where proyecto_id = '39393939-0000-0000-0003-000000000001'), 0,
  'Un cliente inactivo tampoco ve actividades (el rol nulo no abre la política)');
reset role;

select * from finish();
rollback;
