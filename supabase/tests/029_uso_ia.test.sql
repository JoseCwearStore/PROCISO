-- L4b: el equipo ve cuánto lleva gastado del tope diario de IA (D5) para anticiparse al 429.
--   public.mi_uso_ia() devuelve el consumo de las últimas 24 h del usuario y de su
--   consultoría, los topes y cuándo se libera el próximo cupo.
--   · Los topes salen de private.topes_ia(), la MISMA fuente que usa el trigger (028).
--   · Solo el equipo (consultor / admin de consultoría): el cliente y el Admin PROCISO no
--     usan la IA de una consultoría; un anónimo ni siquiera puede ejecutarla.

begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

-- K1, K2 consultores de P1 (C1) · A admin de la consultoría C1 · U cliente · AP admin PROCISO · K4 consultor de C2
insert into auth.users (id, email, aud, role)
select format('29292929-0000-0000-0000-%s', lpad(n::text, 12, '0'))::uuid, format('u%s@uso.test', n), 'authenticated', 'authenticated'
from unnest(array[1, 2, 3, 4, 5, 6]) as n;
insert into public.consultorias (id, nombre) values
  ('29292929-0000-0000-0001-000000000001', 'Consultoría C1'),
  ('29292929-0000-0000-0001-000000000002', 'Consultoría C2');
insert into public.empresas (id, consultoria_id, nombre) values
  ('29292929-0000-0000-0002-000000000001', '29292929-0000-0000-0001-000000000001', 'Empresa E1'),
  ('29292929-0000-0000-0002-000000000002', '29292929-0000-0000-0001-000000000002', 'Empresa E2');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('29292929-0000-0000-0000-000000000001', 'K1', 'u1@uso.test', 'consultor',         '29292929-0000-0000-0001-000000000001', null),
  ('29292929-0000-0000-0000-000000000002', 'K2', 'u2@uso.test', 'consultor',         '29292929-0000-0000-0001-000000000001', null),
  ('29292929-0000-0000-0000-000000000003', 'A',  'u3@uso.test', 'admin_consultoria', '29292929-0000-0000-0001-000000000001', null),
  ('29292929-0000-0000-0000-000000000004', 'U',  'u4@uso.test', 'usuario_cliente',   '29292929-0000-0000-0001-000000000001', '29292929-0000-0000-0002-000000000001'),
  ('29292929-0000-0000-0000-000000000005', 'AP', 'u5@uso.test', 'admin_prociso',     null, null),
  ('29292929-0000-0000-0000-000000000006', 'K4', 'u6@uso.test', 'consultor',         '29292929-0000-0000-0001-000000000002', null);
insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('29292929-0000-0000-0003-000000000001', '29292929-0000-0000-0001-000000000001', '29292929-0000-0000-0002-000000000001', 'P1'),
  ('29292929-0000-0000-0003-000000000004', '29292929-0000-0000-0001-000000000002', '29292929-0000-0000-0002-000000000002', 'P4');
insert into public.documentos (id, consultoria_id, proyecto_id, nombre, tipo, estado) values
  ('29292929-0000-0000-0004-000000000001', '29292929-0000-0000-0001-000000000001', '29292929-0000-0000-0003-000000000001', 'Doc P1', 'Política', 'Pendiente de revisión');

create function pg_temp.como(p_id text) returns void language sql as
  $$ select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', p_id), true) $$;
create function pg_temp.k(p_n int) returns uuid language sql as
  $$ select format('29292929-0000-0000-0000-%s', lpad(p_n::text, 12, '0'))::uuid $$;

-- Relleno directo (como postgres): generaciones y análisis de C1 (o de C2 con p_c2).
create function pg_temp.gen(p_usuario int, p_cuantas int, p_atras interval default '0 seconds', p_c2 boolean default false) returns void language sql as $$
  insert into public.generaciones_ia (consultoria_id, proyecto_id, plantilla, solicitado_por, creado_en, estado)
  select case when p_c2 then '29292929-0000-0000-0001-000000000002' else '29292929-0000-0000-0001-000000000001' end::uuid,
         case when p_c2 then '29292929-0000-0000-0003-000000000004' else '29292929-0000-0000-0003-000000000001' end::uuid,
         'politica', pg_temp.k(p_usuario), now() - p_atras, 'Completado'
  from generate_series(1, p_cuantas)
$$;
create function pg_temp.ana(p_usuario int, p_cuantas int) returns void language sql as $$
  insert into public.analisis_ia (consultoria_id, proyecto_id, fuente_tipo, documento_id, criterio_ids, solicitado_por, estado)
  select '29292929-0000-0000-0001-000000000001', '29292929-0000-0000-0003-000000000001', 'documento',
         '29292929-0000-0000-0004-000000000001', array[(select id from public.criterios_evaluacion limit 1)], pg_temp.k(p_usuario), 'Completado'
  from generate_series(1, p_cuantas)
$$;

select pg_temp.gen(1, 3);                       -- K1: 3 generaciones hoy
select pg_temp.ana(1, 2);                       -- K1: 2 análisis hoy      → K1 lleva 5 (análisis y generaciones juntos)
select pg_temp.gen(2, 4);                       -- K2: 4 hoy               → C1 lleva 9
select pg_temp.gen(6, 5, '0 seconds', true);    -- K4: 5 hoy en C2 (otra consultoría)
select pg_temp.gen(1, 10, '25 hours');          -- K1: 10 de AYER (no cuentan)

-- ─── K1: cuenta lo suyo y lo de su consultoría, con los topes ───────────────
select pg_temp.como('29292929-0000-0000-0000-000000000001');
set local role authenticated;
select is(
  (select row(usuario_usados, usuario_tope, consultoria_usados, consultoria_tope)::text from public.mi_uso_ia()),
  '(5,30,9,150)',
  'K1 ve 5 de 30 (análisis y generaciones juntos, sin lo de hace 25 h) y 9 de 150 de su consultoría'
);
reset role;

select pg_temp.gen(1, 1, '23 hours');           -- K1: 1 de hace 23 h (todavía cuenta)
select pg_temp.gen(2, 1, '23 hours 30 minutes');-- K2: 1 de hace 23 h 30 min (la más vieja de la consultoría)

select pg_temp.como('29292929-0000-0000-0000-000000000001');
set local role authenticated;
select is(
  (select row(usuario_usados, consultoria_usados)::text from public.mi_uso_ia()),
  '(6,11)', 'Los pedidos de hace 23 h siguen contando (la ventana es de 24 h)'
);
select is(
  (select usuario_libera_en from public.mi_uso_ia()),
  now() + interval '1 hour',
  'El próximo cupo del usuario se libera cuando su pedido más viejo cumple 24 h (en 1 hora)'
);
select is(
  (select consultoria_libera_en from public.mi_uso_ia()),
  now() + interval '30 minutes',
  'El de la consultoría, cuando el más viejo de TODA la consultoría cumple 24 h (en 30 minutos)'
);
reset role;

-- ─── A: admin de la consultoría, sin pedidos propios ────────────────────────
select pg_temp.como('29292929-0000-0000-0000-000000000003');
set local role authenticated;
select is(
  (select row(usuario_usados, usuario_tope, consultoria_usados)::text from public.mi_uso_ia()),
  '(0,30,11)', 'El admin de la consultoría también la usa: 0 propios y los 11 de la consultoría'
);
select is((select usuario_libera_en from public.mi_uso_ia()), null, 'Sin pedidos propios no hay fecha de liberación');
reset role;

-- ─── K4: otra consultoría, sin mezclar ──────────────────────────────────────
select pg_temp.como('29292929-0000-0000-0000-000000000006');
set local role authenticated;
select is(
  (select row(usuario_usados, consultoria_usados)::text from public.mi_uso_ia()),
  '(5,5)', 'El consumo de otra consultoría no se mezcla (C2 lleva 5, no 16)'
);
reset role;

-- ─── Quienes NO la usan ─────────────────────────────────────────────────────
select pg_temp.como('29292929-0000-0000-0000-000000000004');
set local role authenticated;
select throws_ok($$ select * from public.mi_uso_ia() $$, '42501', null, 'Un cliente no ve el consumo de IA (no la usa)');
reset role;
select pg_temp.como('29292929-0000-0000-0000-000000000005');
set local role authenticated;
select throws_ok($$ select * from public.mi_uso_ia() $$, '42501', null, 'El Admin PROCISO tampoco (no gasta la clave de una consultoría)');
reset role;
set local role anon;
select throws_ok($$ select * from public.mi_uso_ia() $$, '42501', null, 'Un anónimo no puede ejecutarla');
reset role;

-- ─── Al llegar al tope, usados = tope (lo que la pantalla usa para bloquear) ─
select pg_temp.gen(1, 24);                      -- K1: 6 + 24 = 30
select pg_temp.como('29292929-0000-0000-0000-000000000001');
set local role authenticated;
select is(
  (select usuario_usados = usuario_tope from public.mi_uso_ia()),
  true, 'Con 30 pedidos, usados es igual al tope (la pantalla bloquea el botón)'
);
reset role;

-- ─── Permisos de ejecución ──────────────────────────────────────────────────
select is(
  (select array[has_function_privilege('anon', 'public.mi_uso_ia()', 'execute'), has_function_privilege('authenticated', 'public.mi_uso_ia()', 'execute')]::text),
  '{f,t}', 'Solo un usuario con sesión puede ejecutar mi_uso_ia()'
);

select is(
  (select array[
     has_function_privilege('authenticated', 'private.uso_ia(uuid, uuid)', 'execute'),
     has_function_privilege('anon', 'private.uso_ia(uuid, uuid)', 'execute'),
     has_function_privilege('authenticated', 'private.topes_ia()', 'execute')]::text),
  '{f,f,f}', 'Las funciones internas del conteo (que aceptan cualquier id) no se ejecutan desde la API'
);

select * from finish();
rollback;
