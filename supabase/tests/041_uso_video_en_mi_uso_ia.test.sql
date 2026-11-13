-- O14 · El indicador de uso de IA tiene que mostrar también el tope de VIDEO (5 por usuario y 15 por consultoría al
-- día): hasta ahora la persona lo conocía recién al llegar al rechazo. mi_uso_ia() devuelve, además del consumo
-- general, el consumo de video con los mismos números que aplica el trigger (private.uso_video y private.topes_video):
--   · cuenta solo pedidos de modo 'video' de las últimas 24 h que SÍ gastaron (como el tope);
--   · lo de texto no cuenta como video, y lo que fallaron sin gastar tampoco;
--   · el permiso no cambia: solo el equipo, con sesión.

begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

-- K1..K4 consultores miembros de P1 · U cliente
insert into auth.users (id, email, aud, role)
select format('41414141-0000-0000-0000-%s', lpad(n::text, 12, '0'))::uuid, format('u%s@uv.test', n), 'authenticated', 'authenticated'
from unnest(array[1, 2, 3, 4, 5]) as n;
insert into public.consultorias (id, nombre) values ('41414141-0000-0000-0001-000000000001', 'Consultoría UV');
insert into public.empresas (id, consultoria_id, nombre) values ('41414141-0000-0000-0002-000000000001', '41414141-0000-0000-0001-000000000001', 'Empresa UV');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id)
select format('41414141-0000-0000-0000-%s', lpad(n::text, 12, '0'))::uuid, format('K%s', n), format('u%s@uv.test', n),
       case when n = 5 then 'usuario_cliente' else 'consultor' end, '41414141-0000-0000-0001-000000000001',
       case when n = 5 then '41414141-0000-0000-0002-000000000001'::uuid end
from unnest(array[1, 2, 3, 4, 5]) as n;
insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('41414141-0000-0000-0003-000000000001', '41414141-0000-0000-0001-000000000001', '41414141-0000-0000-0002-000000000001', 'P1');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id)
select '41414141-0000-0000-0003-000000000001', format('41414141-0000-0000-0000-%s', lpad(n::text, 12, '0'))::uuid, '41414141-0000-0000-0001-000000000001'
from unnest(array[1, 2, 3, 4]) as n;
insert into public.documentos (id, consultoria_id, proyecto_id, nombre, tipo, estado) values
  ('41414141-0000-0000-0004-000000000001', '41414141-0000-0000-0001-000000000001', '41414141-0000-0000-0003-000000000001', 'Doc P1', 'Política', 'Borrador');
insert into public.evidencias (id, consultoria_id, proyecto_id, nombre, tipo, archivo_ruta, archivo_mime) values
  ('41414141-0000-0000-0005-000000000001', '41414141-0000-0000-0001-000000000001', '41414141-0000-0000-0003-000000000001', 'Video P1', 'Video', 'c/e/p/v.mp4', 'video/mp4');

create function pg_temp.como(p_id text) returns void language sql as
  $$ select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', p_id), true) $$;
create function pg_temp.k(p_n int) returns uuid language sql as
  $$ select format('41414141-0000-0000-0000-%s', lpad(p_n::text, 12, '0'))::uuid $$;

-- Relleno directo (como postgres, sin RLS; el trigger del tope SÍ corre).
create function pg_temp.llenar(p_n_usuario int, p_cuantas int, p_modo text, p_estado text, p_sin boolean, p_hace interval default '0') returns void language sql as $$
  insert into public.analisis_ia (consultoria_id, proyecto_id, fuente_tipo, documento_id, evidencia_id, criterio_ids, solicitado_por, modo, estado, error_detalle, sin_consumo, creado_en)
  select '41414141-0000-0000-0001-000000000001', '41414141-0000-0000-0003-000000000001',
         case when p_modo = 'video' then 'evidencia' else 'documento' end,
         case when p_modo = 'video' then null else '41414141-0000-0000-0004-000000000001'::uuid end,
         case when p_modo = 'video' then '41414141-0000-0000-0005-000000000001'::uuid end,
         array[(select id from public.criterios_evaluacion limit 1)], pg_temp.k(p_n_usuario), p_modo, p_estado,
         case when p_estado = 'Error' then 'x' end, p_sin, now() - p_hace
  from generate_series(1, p_cuantas)
$$;

-- Sin nada de video todavía: los topes salen de la BD (5 y 15), no de la pantalla.
select pg_temp.como(pg_temp.k(1)::text);
set local role authenticated;
select is(
  (select row(video_usuario_usados, video_usuario_tope, video_consultoria_usados, video_consultoria_tope)::text from public.mi_uso_ia()),
  '(0,5,0,15)', 'Sin videos: 0 de 5 por usuario y 0 de 15 por consultoría'
);
reset role;

-- K1: 2 completados + 1 que falló DESPUÉS de gastar + 1 que falló SIN gastar (no cuenta) + 10 de texto (no son video).
select pg_temp.llenar(1, 2, 'video', 'Completado', false);
select pg_temp.llenar(1, 1, 'video', 'Error', false);
select pg_temp.llenar(1, 1, 'video', 'Error', true);
select pg_temp.llenar(1, 10, 'texto', 'Completado', false);
-- K2: 4 videos completados (cuentan para la consultoría, no para K1).
select pg_temp.llenar(2, 4, 'video', 'Completado', false);
-- K3: un video de hace 25 horas (ya no cuenta).
select pg_temp.llenar(3, 1, 'video', 'Completado', false, interval '25 hours');

select pg_temp.como(pg_temp.k(1)::text);
set local role authenticated;
select is(
  (select video_usuario_usados from public.mi_uso_ia()), 3,
  'K1: 3 videos propios cuentan (2 completados + 1 que falló después de gastar)'
);
select is(
  (select video_consultoria_usados from public.mi_uso_ia()), 7,
  'La consultoría suma los videos de todos: 3 de K1 + 4 de K2 (el de hace 25 h no cuenta)'
);
select is(
  (select usuario_usados from public.mi_uso_ia()), 13,
  'El consumo GENERAL sigue igual: 3 de video que gastaron + 10 de texto'
);
select is(
  (select usuario_tope from public.mi_uso_ia()), 30,
  'El tope general sigue en 30 por usuario'
);
reset role;

-- K3 no tiene videos propios en las últimas 24 h, y K2 ve su propio conteo.
select pg_temp.como(pg_temp.k(3)::text);
set local role authenticated;
select is(
  (select video_usuario_usados from public.mi_uso_ia()), 0,
  'K3: su video de hace 25 horas no cuenta'
);
reset role;
select pg_temp.como(pg_temp.k(2)::text);
set local role authenticated;
select is(
  (select video_usuario_usados from public.mi_uso_ia()), 4,
  'K2 ve SUS 4 videos, no los de K1'
);
reset role;

-- Una sola fuente: si cambian los topes de video, mi_uso_ia lo refleja sin tocar nada más. (Se cambia dentro de la
-- transacción de la prueba; el rollback del final lo deja como estaba.)
create or replace function private.topes_video() returns table (por_usuario integer, por_consultoria integer)
language sql immutable set search_path = '' as $$ select 7, 20 $$;
select pg_temp.como(pg_temp.k(1)::text);
set local role authenticated;
select is(
  (select row(video_usuario_tope, video_consultoria_tope)::text from public.mi_uso_ia()),
  '(7,20)', 'Los topes de video salen de private.topes_video(): no están escritos aparte'
);
reset role;

-- El permiso no cambia.
select pg_temp.como(pg_temp.k(5)::text);
set local role authenticated;
select throws_ok($$ select * from public.mi_uso_ia() $$, '42501', null, 'Un cliente sigue sin ver el consumo de IA');
reset role;
select is(
  (select array[has_function_privilege('anon', 'public.mi_uso_ia()', 'execute'), has_function_privilege('authenticated', 'public.mi_uso_ia()', 'execute')]::text),
  '{f,t}', 'Solo un usuario con sesión puede ejecutar mi_uso_ia()'
);

select * from finish();
rollback;
