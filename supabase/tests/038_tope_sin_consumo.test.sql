-- Decisión del 12/11: el tope diario de pedidos a la IA solo cuenta lo que SÍ gastó tokens ("si voy a la tienda,
-- no encuentro el producto y me voy, no me lo cobran"). Un 503, una clave inválida, un corte de red o un error nuestro
-- antes de llamar a la IA no se descuentan; un pedido cuya respuesta no sirvió (JSON roto, bloqueada) sí, porque el
-- proveedor ya lo procesó.
--   · analisis_ia.sin_consumo lo escribe SOLO la función (service_role) al cerrar el pedido como Error.
--   · Los topes (general y de video, por usuario y por consultoría) y el indicador de uso ignoran esas filas.
--   · Un pedido en curso (Pendiente), uno completado y uno fallido que sí gastó siguen contando.

begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

-- K1..K5 consultores miembros de P1 (C1) · K6 relleno · U cliente · K7 consultor C2 sin proyecto
insert into auth.users (id, email, aud, role)
select format('40404040-0000-0000-0000-%s', lpad(n::text, 12, '0'))::uuid, format('u%s@sc.test', n), 'authenticated', 'authenticated'
from unnest(array[1, 2, 3, 4, 5, 6, 7]) as n;
insert into public.consultorias (id, nombre) values ('40404040-0000-0000-0001-000000000001', 'Consultoría C1');
insert into public.empresas (id, consultoria_id, nombre) values ('40404040-0000-0000-0002-000000000001', '40404040-0000-0000-0001-000000000001', 'Empresa E1');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id)
select format('40404040-0000-0000-0000-%s', lpad(n::text, 12, '0'))::uuid, format('K%s', n), format('u%s@sc.test', n),
       case when n = 7 then 'usuario_cliente' else 'consultor' end, '40404040-0000-0000-0001-000000000001',
       case when n = 7 then '40404040-0000-0000-0002-000000000001'::uuid end
from unnest(array[1, 2, 3, 4, 5, 6, 7]) as n;
insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('40404040-0000-0000-0003-000000000001', '40404040-0000-0000-0001-000000000001', '40404040-0000-0000-0002-000000000001', 'P1');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id)
select '40404040-0000-0000-0003-000000000001', format('40404040-0000-0000-0000-%s', lpad(n::text, 12, '0'))::uuid, '40404040-0000-0000-0001-000000000001'
from unnest(array[1, 2, 3, 4, 5, 6]) as n;
insert into public.documentos (id, consultoria_id, proyecto_id, nombre, tipo, estado) values
  ('40404040-0000-0000-0004-000000000001', '40404040-0000-0000-0001-000000000001', '40404040-0000-0000-0003-000000000001', 'Doc P1', 'Política', 'Borrador');
insert into public.evidencias (id, consultoria_id, proyecto_id, nombre, tipo, archivo_ruta, archivo_mime) values
  ('40404040-0000-0000-0005-000000000001', '40404040-0000-0000-0001-000000000001', '40404040-0000-0000-0003-000000000001', 'Video P1', 'Video', 'c1/e1/p1/v.mp4', 'video/mp4');

create function pg_temp.como(p_id text) returns void language sql as
  $$ select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', p_id), true) $$;
create function pg_temp.k(p_n int) returns uuid language sql as
  $$ select format('40404040-0000-0000-0000-%s', lpad(p_n::text, 12, '0'))::uuid $$;

-- Relleno directo (como postgres, sin RLS; el trigger del tope SÍ corre).
--   p_modo 'video' o 'texto' · p_estado 'Error' o 'Completado' · p_sin: ¿no gastó tokens?
create function pg_temp.llenar(p_n_usuario int, p_cuantas int, p_modo text, p_estado text, p_sin boolean) returns void language sql as $$
  insert into public.analisis_ia (consultoria_id, proyecto_id, fuente_tipo, documento_id, evidencia_id, criterio_ids, solicitado_por, modo, estado, error_detalle, sin_consumo)
  select '40404040-0000-0000-0001-000000000001', '40404040-0000-0000-0003-000000000001',
         case when p_modo = 'video' then 'evidencia' else 'documento' end,
         case when p_modo = 'video' then null else '40404040-0000-0000-0004-000000000001'::uuid end,
         case when p_modo = 'video' then '40404040-0000-0000-0005-000000000001'::uuid end,
         array[(select id from public.criterios_evaluacion limit 1)], pg_temp.k(p_n_usuario), p_modo, p_estado,
         case when p_estado = 'Error' then 'x' end, p_sin
  from generate_series(1, p_cuantas)
$$;

-- ─── Tope de VIDEO por usuario: lo que no gastó no cuenta ───────────────────
select pg_temp.llenar(1, 5, 'video', 'Error', true);    -- K1: 5 videos que fallaron SIN gastar
select pg_temp.llenar(2, 5, 'video', 'Error', false);   -- K2: 5 videos que fallaron DESPUÉS de gastar (JSON roto, bloqueado…)

select pg_temp.como(pg_temp.k(1)::text);
set local role authenticated;
select lives_ok(
  $$ insert into public.analisis_ia (consultoria_id, proyecto_id, fuente_tipo, evidencia_id, criterio_ids, modo)
     select '40404040-0000-0000-0001-000000000001', '40404040-0000-0000-0003-000000000001', 'evidencia',
            '40404040-0000-0000-0005-000000000001', array[(select id from public.criterios_evaluacion limit 1)], 'video' $$,
  'K1 pide otro video: sus 5 anteriores fallaron sin gastar y no cuentan'
);
reset role;
select pg_temp.como(pg_temp.k(2)::text);
set local role authenticated;
select throws_ok(
  $$ insert into public.analisis_ia (consultoria_id, proyecto_id, fuente_tipo, evidencia_id, criterio_ids, modo)
     select '40404040-0000-0000-0001-000000000001', '40404040-0000-0000-0003-000000000001', 'evidencia',
            '40404040-0000-0000-0005-000000000001', array[(select id from public.criterios_evaluacion limit 1)], 'video' $$,
  'IA429', 'Alcanzaste el tope diario de análisis de video (5 por usuario). Inténtalo mañana.',
  'K2 no puede: sus 5 videos fallaron pero SÍ gastaron tokens'
);
reset role;

-- ─── Tope GENERAL por usuario (30) ──────────────────────────────────────────
select pg_temp.llenar(3, 30, 'texto', 'Error', true);    -- K3: 30 pedidos que no gastaron
select pg_temp.llenar(4, 30, 'texto', 'Completado', false); -- K4: 30 pedidos completados (gastaron)

select pg_temp.como(pg_temp.k(3)::text);
set local role authenticated;
select lives_ok(
  $$ insert into public.analisis_ia (consultoria_id, proyecto_id, fuente_tipo, documento_id, criterio_ids)
     select '40404040-0000-0000-0001-000000000001', '40404040-0000-0000-0003-000000000001', 'documento',
            '40404040-0000-0000-0004-000000000001', array[(select id from public.criterios_evaluacion limit 1)] $$,
  'K3 pide otro análisis: sus 30 anteriores no gastaron y no cuentan'
);
reset role;
select pg_temp.como(pg_temp.k(4)::text);
set local role authenticated;
select throws_ok(
  $$ insert into public.analisis_ia (consultoria_id, proyecto_id, fuente_tipo, documento_id, criterio_ids)
     select '40404040-0000-0000-0001-000000000001', '40404040-0000-0000-0003-000000000001', 'documento',
            '40404040-0000-0000-0004-000000000001', array[(select id from public.criterios_evaluacion limit 1)] $$,
  'IA429', 'Alcanzaste el tope diario de pedidos a la IA (30 por usuario). Inténtalo mañana.',
  'K4 no puede: sus 30 análisis se completaron y gastaron'
);
reset role;

-- ─── El indicador de uso muestra lo mismo que aplica el tope ────────────────
select is(
  (select usuario from private.uso_ia(pg_temp.k(1), '40404040-0000-0000-0001-000000000001')), 1,
  'private.uso_ia de K1 cuenta solo el pedido nuevo (los 5 sin consumo no entran)');
select is(
  (select usuario from private.uso_video(pg_temp.k(1), '40404040-0000-0000-0001-000000000001')), 1,
  'private.uso_video de K1 también');
select pg_temp.como(pg_temp.k(1)::text);
set local role authenticated;
select is((select usuario_usados from public.mi_uso_ia()), 1, 'mi_uso_ia (lo que ve la pantalla) dice 1 de 30 para K1');
reset role;

-- ─── Quién escribe la marca: solo la función ────────────────────────────────
insert into public.analisis_ia (id, consultoria_id, proyecto_id, fuente_tipo, evidencia_id, criterio_ids, solicitado_por, modo) values
  ('40404040-0000-0000-0006-000000000001', '40404040-0000-0000-0001-000000000001', '40404040-0000-0000-0003-000000000001', 'evidencia',
   '40404040-0000-0000-0005-000000000001', array[(select id from public.criterios_evaluacion limit 1)], pg_temp.k(6), 'video'),
  ('40404040-0000-0000-0006-000000000002', '40404040-0000-0000-0001-000000000001', '40404040-0000-0000-0003-000000000001', 'evidencia',
   '40404040-0000-0000-0005-000000000001', array[(select id from public.criterios_evaluacion limit 1)], pg_temp.k(6), 'video'),
  ('40404040-0000-0000-0006-000000000003', '40404040-0000-0000-0001-000000000001', '40404040-0000-0000-0003-000000000001', 'evidencia',
   '40404040-0000-0000-0005-000000000001', array[(select id from public.criterios_evaluacion limit 1)], pg_temp.k(6), 'video');

set local role service_role;
select public.registrar_resultado_analisis('40404040-0000-0000-0006-000000000001', 'Error', null, 'saturado', 'gemini', 'm', '[]'::jsonb, true);
select public.registrar_resultado_analisis('40404040-0000-0000-0006-000000000002', 'Error', null, 'respuesta rota', 'gemini', 'm', '[]'::jsonb);
select public.registrar_resultado_analisis('40404040-0000-0000-0006-000000000003', 'Completado', 'ok', null, 'gemini', 'm', '[]'::jsonb, true);
reset role;
select is(
  (select array_agg(sin_consumo order by id) from public.analisis_ia where id::text like '40404040-0000-0000-0006-%'),
  array[true, false, false],
  'La función marca sin_consumo solo en un Error con la marca; sin marca queda en falso; un Completado nunca queda marcado');

select pg_temp.como(pg_temp.k(1)::text);
set local role authenticated;
select throws_ok(
  $$ insert into public.analisis_ia (consultoria_id, proyecto_id, fuente_tipo, documento_id, criterio_ids, sin_consumo)
     select '40404040-0000-0000-0001-000000000001', '40404040-0000-0000-0003-000000000001', 'documento',
            '40404040-0000-0000-0004-000000000001', array[(select id from public.criterios_evaluacion limit 1)], true $$,
  '42501', null, 'Un usuario no puede pedir un análisis ya marcado como "sin consumo" (columna sin permiso)');
select throws_ok(
  $$ select public.registrar_resultado_analisis('40404040-0000-0000-0006-000000000001', 'Error', null, 'x', 'p', 'm', '[]'::jsonb, true) $$,
  '42501', null, 'Un usuario no puede cerrar un pedido ni marcarlo (solo la función)');
reset role;
select is(
  (select array_agg(has_function_privilege(r, 'public.registrar_resultado_analisis(uuid, text, text, text, text, text, jsonb, boolean)', 'EXECUTE') order by r)
   from unnest(array['anon', 'authenticated', 'service_role']) as r),
  array[false, false, true],
  'Solo service_role puede ejecutar registrar_resultado_analisis (el EXECUTE, además del permiso sobre la tabla)');

-- ─── Un pedido en curso (Pendiente) sigue contando mientras no termine ──────
select pg_temp.llenar(5, 4, 'video', 'Error', true);    -- K5: 4 sin gasto (no cuentan)
insert into public.analisis_ia (consultoria_id, proyecto_id, fuente_tipo, evidencia_id, criterio_ids, solicitado_por, modo) values
  ('40404040-0000-0000-0001-000000000001', '40404040-0000-0000-0003-000000000001', 'evidencia', '40404040-0000-0000-0005-000000000001',
   array[(select id from public.criterios_evaluacion limit 1)], pg_temp.k(5), 'video');
select is(
  (select usuario from private.uso_video(pg_temp.k(5), '40404040-0000-0000-0001-000000000001')), 1,
  'Un video en curso (Pendiente) cuenta; los 4 anteriores sin gasto no');

select * from finish();
rollback;
