-- L4 (AUD04-B1/B4, decisión D5): topes de uso de la IA y cierre de pedidos huérfanos.
--   · Cada pedido a la IA (análisis o generación) gasta la clave de la consultoría. Tope en
--     la BD (no se puede saltear llamando a la API): 30 pedidos por usuario y 150 por
--     consultoría en 24 h, contando análisis y generaciones JUNTOS.
--   · Quien no tiene permiso recibe 42501, no el tope (no se filtra el consumo ajeno).
--   · Un pedido "Pendiente" viejo (la función se cayó o el proveedor se colgó) se cierra
--     como "Error" con un barrido que solo ejecuta el servidor.

begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

-- K1..K3 consultores de P1 (C1) · K4 consultor de P4 (C2) · U cliente de E1 · R1..R5 relleno de C1
insert into auth.users (id, email, aud, role)
select format('28282828-0000-0000-0000-%s', lpad(n::text, 12, '0'))::uuid, format('u%s@tope.test', n), 'authenticated', 'authenticated'
from unnest(array[1, 2, 3, 4, 5, 11, 12, 13, 14, 15]) as n;
insert into public.consultorias (id, nombre) values
  ('28282828-0000-0000-0001-000000000001', 'Consultoría C1'),
  ('28282828-0000-0000-0001-000000000002', 'Consultoría C2');
insert into public.empresas (id, consultoria_id, nombre) values
  ('28282828-0000-0000-0002-000000000001', '28282828-0000-0000-0001-000000000001', 'Empresa E1'),
  ('28282828-0000-0000-0002-000000000002', '28282828-0000-0000-0001-000000000002', 'Empresa E2');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id)
select format('28282828-0000-0000-0000-%s', lpad(n::text, 12, '0'))::uuid, format('U%s', n), format('u%s@tope.test', n),
       case when n = 5 then 'usuario_cliente' else 'consultor' end,
       case when n = 4 then '28282828-0000-0000-0001-000000000002' else '28282828-0000-0000-0001-000000000001' end::uuid,
       case when n = 5 then '28282828-0000-0000-0002-000000000001'::uuid end
from unnest(array[1, 2, 3, 4, 5, 11, 12, 13, 14, 15]) as n;
insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('28282828-0000-0000-0003-000000000001', '28282828-0000-0000-0001-000000000001', '28282828-0000-0000-0002-000000000001', 'P1'),
  -- P1b: proyecto de C1 SIN miembros: el contador del tope tiene que verlo igual (DEFINER)
  ('28282828-0000-0000-0003-000000000002', '28282828-0000-0000-0001-000000000001', '28282828-0000-0000-0002-000000000001', 'P1b'),
  ('28282828-0000-0000-0003-000000000004', '28282828-0000-0000-0001-000000000002', '28282828-0000-0000-0002-000000000002', 'P4');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('28282828-0000-0000-0003-000000000001', '28282828-0000-0000-0000-000000000001', '28282828-0000-0000-0001-000000000001'),
  ('28282828-0000-0000-0003-000000000001', '28282828-0000-0000-0000-000000000002', '28282828-0000-0000-0001-000000000001'),
  ('28282828-0000-0000-0003-000000000001', '28282828-0000-0000-0000-000000000003', '28282828-0000-0000-0001-000000000001'),
  ('28282828-0000-0000-0003-000000000004', '28282828-0000-0000-0000-000000000004', '28282828-0000-0000-0001-000000000002');
insert into public.documentos (id, consultoria_id, proyecto_id, nombre, tipo, estado) values
  ('28282828-0000-0000-0004-000000000001', '28282828-0000-0000-0001-000000000001', '28282828-0000-0000-0003-000000000001', 'Doc P1', 'Política', 'Pendiente de revisión'),
  ('28282828-0000-0000-0004-000000000004', '28282828-0000-0000-0001-000000000002', '28282828-0000-0000-0003-000000000004', 'Doc P4', 'Política', 'Pendiente de revisión');

create function pg_temp.como(p_id text) returns void language sql as
  $$ select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', p_id), true) $$;
create function pg_temp.k(p_n int) returns uuid language sql as
  $$ select format('28282828-0000-0000-0000-%s', lpad(p_n::text, 12, '0'))::uuid $$;

-- Relleno directo (como postgres, sin RLS; el trigger del tope SÍ corre).
create function pg_temp.llenar_gen(p_n_usuario int, p_cuantas int, p_atras interval default '0 seconds', p_proyecto uuid default '28282828-0000-0000-0003-000000000001') returns void language sql as $$
  insert into public.generaciones_ia (consultoria_id, proyecto_id, plantilla, solicitado_por, creado_en, estado)
  select '28282828-0000-0000-0001-000000000001', p_proyecto,
         'politica', pg_temp.k(p_n_usuario), now() - p_atras, 'Completado'
  from generate_series(1, p_cuantas)
$$;
create function pg_temp.llenar_ana(p_n_usuario int, p_cuantas int) returns void language sql as $$
  insert into public.analisis_ia (consultoria_id, proyecto_id, fuente_tipo, documento_id, criterio_ids, solicitado_por)
  select '28282828-0000-0000-0001-000000000001', '28282828-0000-0000-0003-000000000001', 'documento',
         '28282828-0000-0000-0004-000000000001', array[(select id from public.criterios_evaluacion limit 1)], pg_temp.k(p_n_usuario)
  from generate_series(1, p_cuantas)
$$;

-- ─── Tope por usuario: 30 en 24 h, análisis y generaciones JUNTOS ───────────
select pg_temp.llenar_ana(1, 20);
select pg_temp.llenar_gen(1, 9, '23 hours');   -- K1 lleva 29 (9 son de hace 23 h: la ventana es de 24 h)

select pg_temp.como('28282828-0000-0000-0000-000000000001');
set local role authenticated;
select lives_ok(
  $$ insert into public.generaciones_ia (consultoria_id, proyecto_id, plantilla)
     values ('28282828-0000-0000-0001-000000000001', '28282828-0000-0000-0003-000000000001', 'politica') $$,
  'K1 hace su pedido número 30 (el tope es 30, no 29)'
);
select throws_ok(
  $$ insert into public.analisis_ia (consultoria_id, proyecto_id, fuente_tipo, documento_id, criterio_ids)
     select '28282828-0000-0000-0001-000000000001', '28282828-0000-0000-0003-000000000001', 'documento',
            '28282828-0000-0000-0004-000000000001', array[(select id from public.criterios_evaluacion limit 1)] $$,
  'IA429', 'Alcanzaste el tope diario de pedidos a la IA (30 por usuario). Inténtalo mañana.',
  'El pedido 31 de K1 (un análisis) se rechaza: análisis y generaciones cuentan juntos'
);
select throws_ok(
  $$ insert into public.generaciones_ia (consultoria_id, proyecto_id, plantilla)
     values ('28282828-0000-0000-0001-000000000001', '28282828-0000-0000-0003-000000000001', 'politica') $$,
  'IA429', 'Alcanzaste el tope diario de pedidos a la IA (30 por usuario). Inténtalo mañana.',
  'El pedido 31 de K1 (una generación) también se rechaza'
);
reset role;
select is(
  (select count(*)::int from (
     select 1 from public.analisis_ia where solicitado_por = pg_temp.k(1)
     union all select 1 from public.generaciones_ia where solicitado_por = pg_temp.k(1)) t),
  30, 'Los pedidos rechazados no dejan filas (siguen 30)'
);

-- ─── La ventana es de 24 h: lo viejo no cuenta ──────────────────────────────
select pg_temp.llenar_gen(2, 40, '25 hours');   -- K2 tiene 40 pedidos de AYER

select pg_temp.como('28282828-0000-0000-0000-000000000002');
set local role authenticated;
select lives_ok(
  $$ insert into public.generaciones_ia (consultoria_id, proyecto_id, plantilla)
     values ('28282828-0000-0000-0001-000000000001', '28282828-0000-0000-0003-000000000001', 'politica') $$,
  'Los pedidos de hace más de 24 h no cuentan: K2 pide sin problema'
);
reset role;

-- ─── Tope por consultoría: 150 en 24 h ──────────────────────────────────────
select pg_temp.llenar_gen(11, 29, '0 seconds', '28282828-0000-0000-0003-000000000002');   -- en P1b, sin miembros
select pg_temp.llenar_gen(12, 29);
select pg_temp.llenar_gen(13, 29);
select pg_temp.llenar_gen(14, 29);
select pg_temp.llenar_gen(15, 2);   -- C1: 30 (K1) + 1 (K2) + 116 + 2 = 149

select pg_temp.como('28282828-0000-0000-0000-000000000003');
set local role authenticated;
select lives_ok(
  $$ insert into public.generaciones_ia (consultoria_id, proyecto_id, plantilla)
     values ('28282828-0000-0000-0001-000000000001', '28282828-0000-0000-0003-000000000001', 'politica') $$,
  'K3 hace el pedido 150 de la consultoría (el tope es 150, no 149)'
);
select throws_ok(
  $$ insert into public.generaciones_ia (consultoria_id, proyecto_id, plantilla)
     values ('28282828-0000-0000-0001-000000000001', '28282828-0000-0000-0003-000000000001', 'politica') $$,
  'IA429', 'La consultoría alcanzó el tope diario de pedidos a la IA (150). Inténtalo mañana.',
  'El pedido 151 de la consultoría se rechaza aunque K3 casi no haya pedido'
);
reset role;

select pg_temp.como('28282828-0000-0000-0000-000000000004');
set local role authenticated;
select lives_ok(
  $$ insert into public.generaciones_ia (consultoria_id, proyecto_id, plantilla)
     values ('28282828-0000-0000-0001-000000000002', '28282828-0000-0000-0003-000000000004', 'politica') $$,
  'El tope de una consultoría no afecta a otra (C2 sigue pidiendo)'
);
reset role;

-- ─── Sin permiso: 42501, no el tope (no se filtra el consumo ajeno) ─────────
select pg_temp.como('28282828-0000-0000-0000-000000000005');
set local role authenticated;
select throws_ok(
  $$ insert into public.generaciones_ia (consultoria_id, proyecto_id, plantilla)
     values ('28282828-0000-0000-0001-000000000001', '28282828-0000-0000-0003-000000000001', 'politica') $$,
  '42501', null, 'Un cliente, con la consultoría al tope, recibe "sin permiso" y no el tope'
);
reset role;

-- ─── Pedidos huérfanos: el servidor los cierra como Error ───────────────────
-- (en C2, que está lejos del tope)
insert into public.analisis_ia (id, consultoria_id, proyecto_id, fuente_tipo, documento_id, criterio_ids, solicitado_por, estado, creado_en) values
  ('28282828-0000-0000-0006-000000000001', '28282828-0000-0000-0001-000000000002', '28282828-0000-0000-0003-000000000004', 'documento', '28282828-0000-0000-0004-000000000004',
   array[(select id from public.criterios_evaluacion limit 1)], pg_temp.k(4), 'Pendiente', now() - interval '20 minutes'),
  ('28282828-0000-0000-0006-000000000002', '28282828-0000-0000-0001-000000000002', '28282828-0000-0000-0003-000000000004', 'documento', '28282828-0000-0000-0004-000000000004',
   array[(select id from public.criterios_evaluacion limit 1)], pg_temp.k(4), 'Pendiente', now() - interval '1 minute'),
  ('28282828-0000-0000-0006-000000000003', '28282828-0000-0000-0001-000000000002', '28282828-0000-0000-0003-000000000004', 'documento', '28282828-0000-0000-0004-000000000004',
   array[(select id from public.criterios_evaluacion limit 1)], pg_temp.k(4), 'Completado', now() - interval '20 minutes');
insert into public.generaciones_ia (id, consultoria_id, proyecto_id, plantilla, solicitado_por, estado, creado_en) values
  ('28282828-0000-0000-0007-000000000001', '28282828-0000-0000-0001-000000000002', '28282828-0000-0000-0003-000000000004', 'politica', pg_temp.k(4), 'Pendiente', now() - interval '20 minutes');

set local role service_role;
select is(public.cerrar_pedidos_ia_huerfanos(), 2, 'El barrido cierra los 2 pedidos Pendiente de hace más de 10 minutos');
reset role;
select is(
  (select row(estado, error_detalle is not null, completado_en is not null)::text from public.analisis_ia where id = '28282828-0000-0000-0006-000000000001'),
  '(Error,t,t)', 'El análisis huérfano queda en Error, con motivo y fecha de cierre'
);
select is(
  (select estado from public.generaciones_ia where id = '28282828-0000-0000-0007-000000000001'),
  'Error', 'La generación huérfana también'
);
select is(
  (select estado from public.analisis_ia where id = '28282828-0000-0000-0006-000000000002'),
  'Pendiente', 'Un pedido de hace 1 minuto sigue Pendiente (todavía puede terminar)'
);
select is(
  (select estado from public.analisis_ia where id = '28282828-0000-0000-0006-000000000003'),
  'Completado', 'Un pedido ya Completado no se toca'
);

select pg_temp.como('28282828-0000-0000-0000-000000000001');
set local role authenticated;
select throws_ok($$ select public.cerrar_pedidos_ia_huerfanos() $$, '42501', null, 'Un usuario no puede ejecutar el barrido');
reset role;
set local role anon;
select throws_ok($$ select public.cerrar_pedidos_ia_huerfanos() $$, '42501', null, 'Un anónimo tampoco');
reset role;

select * from finish();
rollback;
