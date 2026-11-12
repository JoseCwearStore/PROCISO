-- L5d (AUD05-M2, D8): crear un proyecto y armar su equipo de forma atómica y con historial.
--   · Antes la app insertaba el proyecto y DESPUÉS el miembro (dos escrituras, el resultado de la
--     segunda se descartaba) y no había forma de agregar, quitar ni cambiar al responsable.
--   · Ahora todo pasa por funciones: crear_proyecto, agregar_miembro_proyecto,
--     quitar_miembro_proyecto y cambiar_consultor_proyecto. Solo el Admin de la consultoría.
--   · Se cierra el acceso directo: ya nadie inserta proyectos ni toca proyecto_miembros por la API.

begin;
create extension if not exists pgtap with schema extensions;

select plan(47);

-- A admin C1 · K1, K2 consultores C1 · KI consultor INACTIVO C1 · U cliente C1 · A2 admin C2 · KX consultor C2 · AP admin PROCISO
insert into auth.users (id, email, aud, role)
select format('31313131-0000-0000-0000-%s', lpad(n::text, 12, '0'))::uuid, format('u%s@eq.test', n), 'authenticated', 'authenticated'
from unnest(array[1, 2, 3, 4, 5, 6, 7, 8]) as n;
insert into public.consultorias (id, nombre) values
  ('31313131-0000-0000-0001-000000000001', 'Consultoría C1'),
  ('31313131-0000-0000-0001-000000000002', 'Consultoría C2');
insert into public.empresas (id, consultoria_id, nombre, activa) values
  ('31313131-0000-0000-0002-000000000001', '31313131-0000-0000-0001-000000000001', 'Empresa E1', true),
  ('31313131-0000-0000-0002-000000000002', '31313131-0000-0000-0001-000000000001', 'Empresa archivada', false),
  ('31313131-0000-0000-0002-000000000003', '31313131-0000-0000-0001-000000000002', 'Empresa E2 (C2)', true);
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id, activo) values
  ('31313131-0000-0000-0000-000000000001', 'A',  'u1@eq.test', 'admin_consultoria', '31313131-0000-0000-0001-000000000001', null, true),
  ('31313131-0000-0000-0000-000000000002', 'K1', 'u2@eq.test', 'consultor',         '31313131-0000-0000-0001-000000000001', null, true),
  ('31313131-0000-0000-0000-000000000003', 'K2', 'u3@eq.test', 'consultor',         '31313131-0000-0000-0001-000000000001', null, true),
  ('31313131-0000-0000-0000-000000000004', 'KI', 'u4@eq.test', 'consultor',         '31313131-0000-0000-0001-000000000001', null, false),
  ('31313131-0000-0000-0000-000000000005', 'U',  'u5@eq.test', 'usuario_cliente',   '31313131-0000-0000-0001-000000000001', '31313131-0000-0000-0002-000000000001', true),
  ('31313131-0000-0000-0000-000000000006', 'A2', 'u6@eq.test', 'admin_consultoria', '31313131-0000-0000-0001-000000000002', null, true),
  ('31313131-0000-0000-0000-000000000007', 'KX', 'u7@eq.test', 'consultor',         '31313131-0000-0000-0001-000000000002', null, true),
  ('31313131-0000-0000-0000-000000000008', 'AP', 'u8@eq.test', 'admin_prociso',     null, null, true);

create function pg_temp.como(p_id text) returns void language sql as
  $$ select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', p_id), true) $$;
create function pg_temp.u(p_n int) returns text language sql as
  $$ select format('31313131-0000-0000-0000-%s', lpad(p_n::text, 12, '0')) $$;
create function pg_temp.proyecto(p_nombre text) returns uuid language sql as
  $$ select id from public.proyectos where nombre = p_nombre $$;

-- ─── crear_proyecto: atómico (proyecto + miembro + historial) ───────────────
select pg_temp.como(pg_temp.u(1));
set local role authenticated;
select lives_ok(
  $$ select public.crear_proyecto(
       p_empresa_id => '31313131-0000-0000-0002-000000000001', p_consultor_id => '31313131-0000-0000-0000-000000000002',
       p_nombre => '  P1  ', p_objetivo => 'Implementar', p_edicion_norma => 'ISO 9001:2026') $$,
  'El Admin Consultoría crea un proyecto con su consultor responsable'
);
select is(
  (select row(nombre, consultor_id, estado, consultoria_id, avance)::text from public.proyectos where nombre = 'P1'),
  '(P1,31313131-0000-0000-0000-000000000002,Planificación,31313131-0000-0000-0001-000000000001,0)',
  'Queda con el nombre limpio, el responsable, estado inicial y la consultoría correcta'
);
reset role;
-- Ids de los proyectos creados, legibles por cualquier rol: pg_temp.proyecto() consulta con el rol de quien
-- llama y el RLS le escondería P1 a un admin de OTRA consultoría (la función recibiría NULL).
create temp table ids as select nombre, id from public.proyectos;
grant select on pg_temp.ids to authenticated, anon;
select is((select count(*)::int from public.proyecto_miembros where proyecto_id = pg_temp.proyecto('P1')), 1,
  'El responsable ya es miembro (en la MISMA transacción: ya no puede quedar un proyecto que su consultor no ve)');
select is(
  (select row(entidad_tipo, accion, autor_id)::text from public.historial where entidad_id = pg_temp.proyecto('P1') and accion = 'Proyecto creado'),
  '(proyecto,"Proyecto creado",31313131-0000-0000-0000-000000000001)', 'Deja historial de quién lo creó');
select pg_temp.como(pg_temp.u(2));
set local role authenticated;
select is((select count(*)::int from public.proyectos where nombre = 'P1'), 1, 'El consultor asignado ve su proyecto');
reset role;

-- ─── crear_proyecto: quién puede y qué valida ───────────────────────────────
select pg_temp.como(pg_temp.u(2));
set local role authenticated;
select throws_ok($$ select public.crear_proyecto(p_empresa_id => '31313131-0000-0000-0002-000000000001', p_consultor_id => null, p_nombre => 'X') $$,
  '42501', null, 'Un consultor no crea proyectos');
reset role;
select pg_temp.como(pg_temp.u(5));
set local role authenticated;
select throws_ok($$ select public.crear_proyecto(p_empresa_id => '31313131-0000-0000-0002-000000000001', p_consultor_id => null, p_nombre => 'X') $$,
  '42501', null, 'Un cliente no crea proyectos');
reset role;
select pg_temp.como(pg_temp.u(8));
set local role authenticated;
select throws_ok($$ select public.crear_proyecto(p_empresa_id => '31313131-0000-0000-0002-000000000001', p_consultor_id => null, p_nombre => 'X') $$,
  '42501', null, 'El Admin PROCISO tampoco: el equipo de cada consultoría lo arma su admin');
reset role;
set local role anon;
select throws_ok($$ select public.crear_proyecto(p_empresa_id => '31313131-0000-0000-0002-000000000001', p_consultor_id => null, p_nombre => 'X') $$,
  '42501', null, 'Un anónimo no crea proyectos');
reset role;

select pg_temp.como(pg_temp.u(1));
set local role authenticated;
select throws_ok($$ select public.crear_proyecto(p_empresa_id => '31313131-0000-0000-0002-000000000003', p_consultor_id => null, p_nombre => 'X') $$,
  '22023', null, 'No crea proyectos en una empresa de OTRA consultoría (no se confirma que exista)');
select throws_ok($$ select public.crear_proyecto(p_empresa_id => '31313131-0000-0000-0002-000000000002', p_consultor_id => null, p_nombre => 'X') $$,
  '22023', null, 'No crea proyectos en una empresa archivada');
select throws_ok($$ select public.crear_proyecto(p_empresa_id => '31313131-0000-0000-0002-000000000001', p_consultor_id => '31313131-0000-0000-0000-000000000007', p_nombre => 'X') $$,
  '22023', null, 'El responsable no puede ser de otra consultoría');
select throws_ok($$ select public.crear_proyecto(p_empresa_id => '31313131-0000-0000-0002-000000000001', p_consultor_id => '31313131-0000-0000-0000-000000000004', p_nombre => 'X') $$,
  '22023', null, 'El responsable no puede estar suspendido');
select throws_ok($$ select public.crear_proyecto(p_empresa_id => '31313131-0000-0000-0002-000000000001', p_consultor_id => '31313131-0000-0000-0000-000000000005', p_nombre => 'X') $$,
  '22023', null, 'El responsable no puede ser un cliente');
select throws_ok($$ select public.crear_proyecto(p_empresa_id => '31313131-0000-0000-0002-000000000001', p_consultor_id => null, p_nombre => '   ') $$,
  '22023', null, 'El nombre es obligatorio');
select throws_ok($$ select public.crear_proyecto(p_empresa_id => '31313131-0000-0000-0002-000000000001', p_consultor_id => null, p_nombre => 'X', p_edicion_norma => 'ISO 9001:1994') $$,
  '23514', null, 'La edición de la norma tiene que ser una válida');
select lives_ok($$ select public.crear_proyecto(p_empresa_id => '31313131-0000-0000-0002-000000000001', p_consultor_id => null, p_nombre => 'P-sin-responsable') $$,
  'Se puede crear sin responsable (se asigna después)');
reset role;
select is((select count(*)::int from public.proyecto_miembros where proyecto_id = pg_temp.proyecto('P-sin-responsable')), 0, 'Sin responsable no hay miembros');

-- ─── Acceso directo cerrado ─────────────────────────────────────────────────
select pg_temp.como(pg_temp.u(1));
set local role authenticated;
select throws_ok($$ insert into public.proyectos (consultoria_id, empresa_id, nombre) values ('31313131-0000-0000-0001-000000000001', '31313131-0000-0000-0002-000000000001', 'directo') $$,
  '42501', null, 'Ni el admin inserta proyectos por la API: solo con crear_proyecto');
select throws_ok($$ insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values (pg_temp.proyecto('P1'), '31313131-0000-0000-0000-000000000003', '31313131-0000-0000-0001-000000000001') $$,
  '42501', null, 'Ni agrega miembros por la API');
select throws_ok($$ delete from public.proyecto_miembros $$, '42501', null, 'Ni quita miembros por la API');
reset role;

-- ─── agregar_miembro_proyecto ───────────────────────────────────────────────
select pg_temp.como(pg_temp.u(1));
set local role authenticated;
select lives_ok($$ select public.agregar_miembro_proyecto(pg_temp.proyecto('P1'), '31313131-0000-0000-0000-000000000003') $$, 'El admin agrega a K2 al equipo');
reset role;
select is((select count(*)::int from public.proyecto_miembros where proyecto_id = pg_temp.proyecto('P1')), 2, 'K2 quedó como miembro');
select is((select count(*)::int from public.historial where entidad_id = pg_temp.proyecto('P1') and accion = 'Miembro agregado al equipo'), 1, 'Quedó en el historial');
select pg_temp.como(pg_temp.u(1));
set local role authenticated;
select throws_ok($$ select public.agregar_miembro_proyecto(pg_temp.proyecto('P1'), '31313131-0000-0000-0000-000000000003') $$, '22023', null, 'No se agrega dos veces');
select throws_ok($$ select public.agregar_miembro_proyecto(pg_temp.proyecto('P1'), '31313131-0000-0000-0000-000000000007') $$, '22023', null, 'No se agrega a alguien de otra consultoría');
select throws_ok($$ select public.agregar_miembro_proyecto(pg_temp.proyecto('P1'), '31313131-0000-0000-0000-000000000004') $$, '22023', null, 'No se agrega a un usuario suspendido');
select throws_ok($$ select public.agregar_miembro_proyecto(pg_temp.proyecto('P1'), '31313131-0000-0000-0000-000000000005') $$, '22023', null, 'No se agrega a un cliente');
select throws_ok($$ select public.agregar_miembro_proyecto('31313131-0000-0000-0009-000000000000', '31313131-0000-0000-0000-000000000003') $$, '22023', null, 'Un proyecto que no existe da "no encontrado"');
reset role;
select pg_temp.como(pg_temp.u(2));
set local role authenticated;
select throws_ok($$ select public.agregar_miembro_proyecto(pg_temp.proyecto('P1'), '31313131-0000-0000-0000-000000000003') $$, '42501', null, 'Un consultor (aunque sea el responsable) no arma el equipo');
reset role;
select pg_temp.como(pg_temp.u(6));
set local role authenticated;
-- Con una persona ELEGIBLE para P1 (K2, de C1): si el chequeo de pertenencia del proyecto faltara, fallaría
-- por OTRA regla ("ya es parte"); por eso se exige el mensaje exacto de "no encontrado".
select throws_ok($$ select public.agregar_miembro_proyecto((select id from pg_temp.ids where nombre = 'P1'), '31313131-0000-0000-0000-000000000003') $$,
  '22023', 'Proyecto no encontrado.', 'El admin de OTRA consultoría recibe "no encontrado" (no se entera de que el proyecto existe)');
reset role;

-- ─── quitar_miembro_proyecto ────────────────────────────────────────────────
insert into public.tareas (consultoria_id, proyecto_id, titulo, asignado_a, estado, fecha_vencimiento) values
  ('31313131-0000-0000-0001-000000000001', pg_temp.proyecto('P1'), 'Tarea abierta de K2', '31313131-0000-0000-0000-000000000003', 'En proceso', current_date + 5);
select pg_temp.como(pg_temp.u(1));
set local role authenticated;
select throws_ok($$ select public.quitar_miembro_proyecto(pg_temp.proyecto('P1'), '31313131-0000-0000-0000-000000000002') $$, '22023', null,
  'No se quita al responsable (primero se cambia)');
select throws_ok($$ select public.quitar_miembro_proyecto(pg_temp.proyecto('P1'), '31313131-0000-0000-0000-000000000003') $$, '22023', null,
  'No se quita a quien tiene tareas abiertas en el proyecto (reasignarlas antes)');
reset role;
update public.tareas set estado = 'Completada', fecha_completada = current_date where titulo = 'Tarea abierta de K2';
select pg_temp.como(pg_temp.u(2));
set local role authenticated;
select throws_ok($$ select public.quitar_miembro_proyecto(pg_temp.proyecto('P1'), '31313131-0000-0000-0000-000000000003') $$, '42501', null, 'Un consultor no quita miembros');
reset role;
select pg_temp.como(pg_temp.u(1));
set local role authenticated;
select lives_ok($$ select public.quitar_miembro_proyecto(pg_temp.proyecto('P1'), '31313131-0000-0000-0000-000000000003') $$, 'Con la tarea completada sí se quita a K2');
select throws_ok($$ select public.quitar_miembro_proyecto(pg_temp.proyecto('P1'), '31313131-0000-0000-0000-000000000003') $$, '22023', null, 'Quitar a quien ya no es miembro da error claro');
reset role;
select is((select count(*)::int from public.historial where entidad_id = pg_temp.proyecto('P1') and accion = 'Miembro quitado del equipo'), 1, 'Quedó en el historial');
select pg_temp.como(pg_temp.u(3));
set local role authenticated;
select is((select count(*)::int from public.proyectos where nombre = 'P1'), 0, 'K2, ya sin ser miembro, deja de ver el proyecto');
reset role;

-- ─── cambiar_consultor_proyecto ─────────────────────────────────────────────
select pg_temp.como(pg_temp.u(1));
set local role authenticated;
select lives_ok($$ select public.cambiar_consultor_proyecto(pg_temp.proyecto('P1'), '31313131-0000-0000-0000-000000000003') $$, 'El admin cambia el responsable a K2');
select throws_ok($$ select public.cambiar_consultor_proyecto(pg_temp.proyecto('P1'), '31313131-0000-0000-0000-000000000003') $$, '22023', null, 'Cambiar al mismo responsable da error claro');
select throws_ok($$ select public.cambiar_consultor_proyecto(pg_temp.proyecto('P1'), '31313131-0000-0000-0000-000000000007') $$, '22023', null, 'El nuevo responsable tiene que ser de la consultoría');
reset role;
select is((select consultor_id::text from public.proyectos where nombre = 'P1'), pg_temp.u(3), 'El responsable cambió');
select is((select count(*)::int from public.proyecto_miembros where proyecto_id = pg_temp.proyecto('P1') and usuario_id = pg_temp.u(3)::uuid), 1,
  'El nuevo responsable quedó como miembro (si no, no vería su proyecto)');
select is((select count(*)::int from public.historial where entidad_id = pg_temp.proyecto('P1') and accion = 'Consultor responsable cambiado'), 1, 'Quedó en el historial');
select pg_temp.como(pg_temp.u(2));
set local role authenticated;
select throws_ok($$ select public.cambiar_consultor_proyecto(pg_temp.proyecto('P1'), '31313131-0000-0000-0000-000000000002') $$, '42501', null, 'Un consultor no cambia al responsable');
reset role;

-- ─── Permisos de ejecución ──────────────────────────────────────────────────
select is(
  (select array_agg(has_function_privilege('anon', p.oid, 'execute') order by p.proname)::text
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('crear_proyecto', 'agregar_miembro_proyecto', 'quitar_miembro_proyecto', 'cambiar_consultor_proyecto')),
  '{f,f,f,f}', 'Un anónimo no puede ejecutar ninguna de las cuatro funciones');
select is(
  (select array_agg(has_function_privilege('authenticated', p.oid, 'execute') order by p.proname)::text
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('crear_proyecto', 'agregar_miembro_proyecto', 'quitar_miembro_proyecto', 'cambiar_consultor_proyecto')),
  '{t,t,t,t}', 'Un usuario con sesión sí (y adentro la función decide si es admin)');

select * from finish();
rollback;
