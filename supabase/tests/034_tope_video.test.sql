-- AUD09-M4: el análisis de VIDEO cuesta mucho más que uno de texto (el modelo mira la imagen y sube el archivo),
-- pero compartía el tope diario de 30/150 con el resto. Tope propio y más bajo, además del general:
--   · 5 análisis de video por usuario y 15 por consultoría en 24 h.
--   · Un pedido de video cuenta TAMBIÉN para el tope general (30/150): el tope de video se suma, no lo reemplaza.
--   · El tope de video no frena los pedidos de texto ni las generaciones.
--   · Quien no tiene permiso recibe 42501 (no se filtra el consumo ajeno): el RLS decide antes que el tope.
--   · La columna `modo` ('texto' por defecto, 'video') la manda la Edge Function; solo admite esos dos valores.

begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

-- K1..K3 consultores de P1 (C1) · K4 consultor de P4 (C2) · U5 cliente de E1 · R11, R12 relleno de C1
insert into auth.users (id, email, aud, role)
select format('35353535-0000-0000-0000-%s', lpad(n::text, 12, '0'))::uuid, format('u%s@video.test', n), 'authenticated', 'authenticated'
from unnest(array[1, 2, 3, 4, 5, 11, 12]) as n;
insert into public.consultorias (id, nombre) values
  ('35353535-0000-0000-0001-000000000001', 'Consultoría C1'),
  ('35353535-0000-0000-0001-000000000002', 'Consultoría C2');
insert into public.empresas (id, consultoria_id, nombre) values
  ('35353535-0000-0000-0002-000000000001', '35353535-0000-0000-0001-000000000001', 'Empresa E1'),
  ('35353535-0000-0000-0002-000000000002', '35353535-0000-0000-0001-000000000002', 'Empresa E2');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id)
select format('35353535-0000-0000-0000-%s', lpad(n::text, 12, '0'))::uuid, format('U%s', n), format('u%s@video.test', n),
       case when n = 5 then 'usuario_cliente' else 'consultor' end,
       case when n = 4 then '35353535-0000-0000-0001-000000000002' else '35353535-0000-0000-0001-000000000001' end::uuid,
       case when n = 5 then '35353535-0000-0000-0002-000000000001'::uuid end
from unnest(array[1, 2, 3, 4, 5, 11, 12]) as n;
insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('35353535-0000-0000-0003-000000000001', '35353535-0000-0000-0001-000000000001', '35353535-0000-0000-0002-000000000001', 'P1'),
  ('35353535-0000-0000-0003-000000000004', '35353535-0000-0000-0001-000000000002', '35353535-0000-0000-0002-000000000002', 'P4');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('35353535-0000-0000-0003-000000000001', '35353535-0000-0000-0000-000000000001', '35353535-0000-0000-0001-000000000001'),
  ('35353535-0000-0000-0003-000000000001', '35353535-0000-0000-0000-000000000002', '35353535-0000-0000-0001-000000000001'),
  ('35353535-0000-0000-0003-000000000001', '35353535-0000-0000-0000-000000000003', '35353535-0000-0000-0001-000000000001'),
  ('35353535-0000-0000-0003-000000000004', '35353535-0000-0000-0000-000000000004', '35353535-0000-0000-0001-000000000002');
insert into public.documentos (id, consultoria_id, proyecto_id, nombre, tipo, estado) values
  ('35353535-0000-0000-0004-000000000001', '35353535-0000-0000-0001-000000000001', '35353535-0000-0000-0003-000000000001', 'Doc P1', 'Política', 'Pendiente de revisión');
insert into public.evidencias (id, consultoria_id, proyecto_id, nombre, tipo, archivo_ruta, archivo_mime) values
  ('35353535-0000-0000-0005-000000000001', '35353535-0000-0000-0001-000000000001', '35353535-0000-0000-0003-000000000001', 'Recorrido P1', 'Video', 'c1/e1/p1/v.mp4', 'video/mp4'),
  ('35353535-0000-0000-0005-000000000004', '35353535-0000-0000-0001-000000000002', '35353535-0000-0000-0003-000000000004', 'Recorrido P4', 'Video', 'c2/e2/p4/v.mp4', 'video/mp4');

create function pg_temp.como(p_id text) returns void language sql as
  $$ select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', p_id), true) $$;
create function pg_temp.k(p_n int) returns uuid language sql as
  $$ select format('35353535-0000-0000-0000-%s', lpad(p_n::text, 12, '0'))::uuid $$;

-- Relleno directo (como postgres, sin RLS; el trigger del tope SÍ corre).
create function pg_temp.llenar_video(p_n_usuario int, p_cuantas int, p_atras interval default '0 seconds') returns void language sql as $$
  insert into public.analisis_ia (consultoria_id, proyecto_id, fuente_tipo, evidencia_id, criterio_ids, solicitado_por, creado_en, modo)
  select '35353535-0000-0000-0001-000000000001', '35353535-0000-0000-0003-000000000001', 'evidencia',
         '35353535-0000-0000-0005-000000000001', array[(select id from public.criterios_evaluacion limit 1)],
         pg_temp.k(p_n_usuario), now() - p_atras, 'video'
  from generate_series(1, p_cuantas)
$$;
create function pg_temp.llenar_texto(p_n_usuario int, p_cuantas int) returns void language sql as $$
  insert into public.analisis_ia (consultoria_id, proyecto_id, fuente_tipo, documento_id, criterio_ids, solicitado_por)
  select '35353535-0000-0000-0001-000000000001', '35353535-0000-0000-0003-000000000001', 'documento',
         '35353535-0000-0000-0004-000000000001', array[(select id from public.criterios_evaluacion limit 1)], pg_temp.k(p_n_usuario)
  from generate_series(1, p_cuantas)
$$;

-- ─── Tope por usuario: 5 de video en 24 h ───────────────────────────────────
select pg_temp.llenar_video(1, 4);   -- K1 lleva 4

select pg_temp.como('35353535-0000-0000-0000-000000000001');
set local role authenticated;
select lives_ok(
  $$ insert into public.analisis_ia (consultoria_id, proyecto_id, fuente_tipo, evidencia_id, criterio_ids, modo)
     select '35353535-0000-0000-0001-000000000001', '35353535-0000-0000-0003-000000000001', 'evidencia',
            '35353535-0000-0000-0005-000000000001', array[(select id from public.criterios_evaluacion limit 1)], 'video' $$,
  'K1 hace su análisis de video número 5 (el tope es 5, no 4)'
);
select throws_ok(
  $$ insert into public.analisis_ia (consultoria_id, proyecto_id, fuente_tipo, evidencia_id, criterio_ids, modo)
     select '35353535-0000-0000-0001-000000000001', '35353535-0000-0000-0003-000000000001', 'evidencia',
            '35353535-0000-0000-0005-000000000001', array[(select id from public.criterios_evaluacion limit 1)], 'video' $$,
  'IA429', 'Alcanzaste el tope diario de análisis de video (5 por usuario). Inténtalo mañana.',
  'El análisis de video número 6 de K1 se rechaza'
);
reset role;
select is(
  (select count(*)::int from public.analisis_ia where solicitado_por = pg_temp.k(1) and modo = 'video'),
  5, 'El pedido rechazado no deja fila (siguen 5)'
);

-- ─── El tope de video no frena el texto ni las generaciones ─────────────────
select pg_temp.como('35353535-0000-0000-0000-000000000001');
set local role authenticated;
select lives_ok(
  $$ insert into public.analisis_ia (consultoria_id, proyecto_id, fuente_tipo, documento_id, criterio_ids)
     select '35353535-0000-0000-0001-000000000001', '35353535-0000-0000-0003-000000000001', 'documento',
            '35353535-0000-0000-0004-000000000001', array[(select id from public.criterios_evaluacion limit 1)] $$,
  'Con el tope de video agotado, K1 sigue pidiendo análisis de texto'
);
reset role;
select is(
  (select count(*)::int from public.analisis_ia where solicitado_por = pg_temp.k(1) and modo = 'texto'),
  1, 'Sin `modo` el pedido queda como "texto" (valor por defecto)'
);

-- ─── Un pedido de video cuenta también para el tope general (30) ────────────
select pg_temp.llenar_texto(2, 29);   -- K2 lleva 29 pedidos de texto

select pg_temp.como('35353535-0000-0000-0000-000000000002');
set local role authenticated;
select lives_ok(
  $$ insert into public.analisis_ia (consultoria_id, proyecto_id, fuente_tipo, evidencia_id, criterio_ids, modo)
     select '35353535-0000-0000-0001-000000000001', '35353535-0000-0000-0003-000000000001', 'evidencia',
            '35353535-0000-0000-0005-000000000001', array[(select id from public.criterios_evaluacion limit 1)], 'video' $$,
  'K2 hace su pedido número 30 con un video (el de video cuenta para el general)'
);
select throws_ok(
  $$ insert into public.analisis_ia (consultoria_id, proyecto_id, fuente_tipo, evidencia_id, criterio_ids, modo)
     select '35353535-0000-0000-0001-000000000001', '35353535-0000-0000-0003-000000000001', 'evidencia',
            '35353535-0000-0000-0005-000000000001', array[(select id from public.criterios_evaluacion limit 1)], 'video' $$,
  'IA429', 'Alcanzaste el tope diario de pedidos a la IA (30 por usuario). Inténtalo mañana.',
  'El pedido 31 de K2 (un video, con solo 1 de video) se rechaza por el tope GENERAL'
);
reset role;

-- ─── La ventana es de 24 h: los videos de ayer no cuentan ───────────────────
select pg_temp.llenar_video(3, 10, '25 hours');   -- K3 tiene 10 videos de AYER

select pg_temp.como('35353535-0000-0000-0000-000000000003');
set local role authenticated;
select lives_ok(
  $$ insert into public.analisis_ia (consultoria_id, proyecto_id, fuente_tipo, evidencia_id, criterio_ids, modo)
     select '35353535-0000-0000-0001-000000000001', '35353535-0000-0000-0003-000000000001', 'evidencia',
            '35353535-0000-0000-0005-000000000001', array[(select id from public.criterios_evaluacion limit 1)], 'video' $$,
  'Los videos de hace más de 24 h no cuentan: K3 pide sin problema'
);
reset role;

-- ─── Tope por consultoría: 15 de video en 24 h ──────────────────────────────
-- C1 lleva 5 (K1) + 1 (K2) + 1 (K3) = 7; con 5 + 3 de relleno llega a 15.
select pg_temp.llenar_video(11, 5);
select pg_temp.llenar_video(12, 3);

select pg_temp.como('35353535-0000-0000-0000-000000000003');
set local role authenticated;
select throws_ok(
  $$ insert into public.analisis_ia (consultoria_id, proyecto_id, fuente_tipo, evidencia_id, criterio_ids, modo)
     select '35353535-0000-0000-0001-000000000001', '35353535-0000-0000-0003-000000000001', 'evidencia',
            '35353535-0000-0000-0005-000000000001', array[(select id from public.criterios_evaluacion limit 1)], 'video' $$,
  'IA429', 'La consultoría alcanzó el tope diario de análisis de video (15). Inténtalo mañana.',
  'El video 16 de la consultoría se rechaza aunque K3 haya pedido solo 1'
);
reset role;

select pg_temp.como('35353535-0000-0000-0000-000000000004');
set local role authenticated;
select lives_ok(
  $$ insert into public.analisis_ia (consultoria_id, proyecto_id, fuente_tipo, evidencia_id, criterio_ids, modo)
     select '35353535-0000-0000-0001-000000000002', '35353535-0000-0000-0003-000000000004', 'evidencia',
            '35353535-0000-0000-0005-000000000004', array[(select id from public.criterios_evaluacion limit 1)], 'video' $$,
  'El tope de video de una consultoría no afecta a otra (C2 sigue pidiendo)'
);
select lives_ok(
  $$ insert into public.generaciones_ia (consultoria_id, proyecto_id, plantilla)
     values ('35353535-0000-0000-0001-000000000002', '35353535-0000-0000-0003-000000000004', 'politica') $$,
  'Las generaciones (misma función del tope, sin columna modo) siguen funcionando'
);
reset role;

-- ─── Sin permiso: 42501, no el tope ─────────────────────────────────────────
select pg_temp.como('35353535-0000-0000-0000-000000000005');
set local role authenticated;
select throws_ok(
  $$ insert into public.analisis_ia (consultoria_id, proyecto_id, fuente_tipo, evidencia_id, criterio_ids, modo)
     select '35353535-0000-0000-0001-000000000001', '35353535-0000-0000-0003-000000000001', 'evidencia',
            '35353535-0000-0000-0005-000000000001', array[(select id from public.criterios_evaluacion limit 1)], 'video' $$,
  '42501', null, 'Un cliente, con la consultoría al tope de video, recibe "sin permiso" y no el tope'
);
reset role;

-- ─── `modo` solo admite "texto" o "video" ───────────────────────────────────
select throws_ok(
  $$ insert into public.analisis_ia (consultoria_id, proyecto_id, fuente_tipo, evidencia_id, criterio_ids, solicitado_por, modo)
     select '35353535-0000-0000-0001-000000000002', '35353535-0000-0000-0003-000000000004', 'evidencia',
            '35353535-0000-0000-0005-000000000004', array[(select id from public.criterios_evaluacion limit 1)], pg_temp.k(4), 'audio' $$,
  '23514', null, 'Un modo que no es "texto" ni "video" no se acepta'
);

select * from finish();
rollback;
