-- Transcripción de audio y video con revisión humana ANTES de analizar.
--   · La transcripción automática se guarda por evidencia (una sola) y el consultor puede corregirla.
--   · Solo el servidor (service_role) registra la transcripción automática; solo el EQUIPO del proyecto
--     la corrige (el cliente la lee). Nadie escribe la tabla directamente.
--   · Se conserva SIEMPRE lo que escuchó la IA (texto_automatico) además del texto corregido.
--   · Quien no tiene permiso recibe el mismo error exista o no la evidencia (no se revela el id).
--   · Toda generación y corrección deja historial.

begin;
create extension if not exists pgtap with schema extensions;

select plan(51);

-- K1 consultor miembro de P1 (C1) · K2 consultor de C1 SIN ser miembro · A1 admin de C1
-- CL cliente de E1 · K4 consultor de C2 (miembro de P4)
insert into auth.users (id, email, aud, role)
select format('34343434-0000-0000-0000-%s', lpad(n::text, 12, '0'))::uuid, format('t%s@transcr.test', n), 'authenticated', 'authenticated'
from unnest(array[1, 2, 3, 4, 5]) as n;
insert into public.consultorias (id, nombre) values
  ('34343434-0000-0000-0001-000000000001', 'Consultoría C1'),
  ('34343434-0000-0000-0001-000000000002', 'Consultoría C2');
insert into public.empresas (id, consultoria_id, nombre) values
  ('34343434-0000-0000-0002-000000000001', '34343434-0000-0000-0001-000000000001', 'Empresa E1'),
  ('34343434-0000-0000-0002-000000000002', '34343434-0000-0000-0001-000000000002', 'Empresa E2');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('34343434-0000-0000-0000-000000000001', 'K1', 't1@transcr.test', 'consultor',         '34343434-0000-0000-0001-000000000001', null),
  ('34343434-0000-0000-0000-000000000002', 'K2', 't2@transcr.test', 'consultor',         '34343434-0000-0000-0001-000000000001', null),
  ('34343434-0000-0000-0000-000000000003', 'A1', 't3@transcr.test', 'admin_consultoria', '34343434-0000-0000-0001-000000000001', null),
  ('34343434-0000-0000-0000-000000000004', 'CL', 't4@transcr.test', 'usuario_cliente',   '34343434-0000-0000-0001-000000000001', '34343434-0000-0000-0002-000000000001'),
  ('34343434-0000-0000-0000-000000000005', 'K4', 't5@transcr.test', 'consultor',         '34343434-0000-0000-0001-000000000002', null);
insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('34343434-0000-0000-0003-000000000001', '34343434-0000-0000-0001-000000000001', '34343434-0000-0000-0002-000000000001', 'P1'),
  ('34343434-0000-0000-0003-000000000004', '34343434-0000-0000-0001-000000000002', '34343434-0000-0000-0002-000000000002', 'P4');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('34343434-0000-0000-0003-000000000001', '34343434-0000-0000-0000-000000000001', '34343434-0000-0000-0001-000000000001'),
  ('34343434-0000-0000-0003-000000000004', '34343434-0000-0000-0000-000000000005', '34343434-0000-0000-0001-000000000002');
-- EV1 audio con transcripción · EV2 audio SIN transcripción · EVD documento · EV4 audio de C2
insert into public.evidencias (id, consultoria_id, proyecto_id, nombre, tipo, archivo_ruta, archivo_mime) values
  ('34343434-0000-0000-0004-000000000001', '34343434-0000-0000-0001-000000000001', '34343434-0000-0000-0003-000000000001', 'Entrevista 1', 'Audio', 'c1/e1/p1/ev1.m4a', 'audio/mp4'),
  ('34343434-0000-0000-0004-000000000002', '34343434-0000-0000-0001-000000000001', '34343434-0000-0000-0003-000000000001', 'Entrevista 2', 'Audio', 'c1/e1/p1/ev2.m4a', 'audio/mp4'),
  ('34343434-0000-0000-0004-000000000003', '34343434-0000-0000-0001-000000000001', '34343434-0000-0000-0003-000000000001', 'Procedimiento', 'Documento', 'c1/e1/p1/ev3.pdf', 'application/pdf'),
  ('34343434-0000-0000-0004-000000000004', '34343434-0000-0000-0001-000000000002', '34343434-0000-0000-0003-000000000004', 'Entrevista C2', 'Audio', 'c2/e2/p4/ev4.m4a', 'audio/mp4'),
  ('34343434-0000-0000-0004-000000000005', '34343434-0000-0000-0001-000000000001', '34343434-0000-0000-0003-000000000001', 'Recorrido', 'Video', 'c1/e1/p1/ev5.mp4', 'video/mp4'),
  ('34343434-0000-0000-0004-000000000006', '34343434-0000-0000-0001-000000000001', '34343434-0000-0000-0003-000000000001', 'Audio sin archivo', 'Audio', null, null);

create function pg_temp.como(p_n int) returns void language sql as
  $$ select set_config('request.jwt.claims', format('{"sub":"34343434-0000-0000-0000-%s","role":"authenticated"}', lpad(p_n::text, 12, '0')), true) $$;

-- ─── Permisos de la tabla: nadie escribe directo ────────────────────────────
set local role anon;
select throws_ok($$ select * from public.transcripciones $$, '42501', null,
  'Un anónimo no puede leer las transcripciones');
reset role;

select pg_temp.como(1);
set local role authenticated;
select throws_ok(
  $$ insert into public.transcripciones (consultoria_id, proyecto_id, evidencia_id, texto_automatico, texto, creada_por)
     values ('34343434-0000-0000-0001-000000000001', '34343434-0000-0000-0003-000000000001',
             '34343434-0000-0000-0004-000000000001', 'inventada', 'inventada', '34343434-0000-0000-0000-000000000001') $$,
  '42501', null, 'Un consultor no inserta transcripciones directamente (solo el servidor las registra)');
select throws_ok($$ update public.transcripciones set texto = 'x' $$, '42501', null,
  'Un consultor no actualiza la tabla directamente (solo con corregir_transcripcion)');
select throws_ok($$ delete from public.transcripciones $$, '42501', null,
  'Un consultor no borra transcripciones directamente');
select throws_ok(
  $$ select public.registrar_transcripcion('34343434-0000-0000-0004-000000000001', 'x', 'groq', 'w', '34343434-0000-0000-0000-000000000001') $$,
  '42501', null, 'Un consultor no puede ejecutar registrar_transcripcion (es solo del servidor)');
reset role;
set local role anon;
select throws_ok(
  $$ select public.registrar_transcripcion('34343434-0000-0000-0004-000000000001', 'x', 'groq', 'w', '34343434-0000-0000-0000-000000000001') $$,
  '42501', null, 'Un anónimo tampoco');
reset role;

-- ─── registrar_transcripcion (servicio) ─────────────────────────────────────
set local role service_role;
select lives_ok(
  $$ select public.registrar_transcripcion('34343434-0000-0000-0004-000000000001', '  Las quejas se resuelven en 5 días.  ', 'groq', 'whisper-large-v3-turbo', '34343434-0000-0000-0000-000000000001') $$,
  'El servidor registra la transcripción automática de un audio');
reset role;
select is(
  (select texto = 'Las quejas se resuelven en 5 días.' and texto_automatico = texto and corregida_en is null and corregida_por is null
          and proveedor = 'groq' and modelo = 'whisper-large-v3-turbo' and creada_por = '34343434-0000-0000-0000-000000000001'
   from public.transcripciones where evidencia_id = '34343434-0000-0000-0004-000000000001'),
  true, 'Queda guardada sin espacios de los bordes, sin corrección y con su autor y su modelo');
select is(
  (select proyecto_id::text || '/' || consultoria_id::text from public.transcripciones where evidencia_id = '34343434-0000-0000-0004-000000000001'),
  '34343434-0000-0000-0003-000000000001/34343434-0000-0000-0001-000000000001',
  'El proyecto y la consultoría los pone la BD a partir de la evidencia (no los manda quien llama)');

set local role service_role;
select throws_ok(
  $$ select public.registrar_transcripcion('34343434-0000-0000-0004-0000000000ff', 'x', 'groq', 'w', '34343434-0000-0000-0000-000000000001') $$,
  '22023', 'Evidencia no encontrada', 'No se registra para una evidencia que no existe');
select throws_ok(
  $$ select public.registrar_transcripcion('34343434-0000-0000-0004-000000000003', 'x', 'groq', 'w', '34343434-0000-0000-0000-000000000001') $$,
  '22023', 'Solo se transcriben evidencias de audio o video', 'No se registra para una evidencia que no es de audio ni video');
select throws_ok(
  $$ select public.registrar_transcripcion('34343434-0000-0000-0004-000000000002', '   ', 'groq', 'w', '34343434-0000-0000-0000-000000000001') $$,
  '22023', 'La transcripción no puede estar vacía', 'No se registra un texto vacío');
select throws_ok(
  $$ select public.registrar_transcripcion('34343434-0000-0000-0004-000000000002', repeat('a', 100001), 'groq', 'w', '34343434-0000-0000-0000-000000000001') $$,
  '22023', 'La transcripción supera los 100000 caracteres', 'No se registra un texto de más de 100000 caracteres');
reset role;

-- ─── Visibilidad: la ve quien ve el proyecto (el cliente solo la lee) ───────
select pg_temp.como(1); set local role authenticated;
select is((select count(*)::int from public.transcripciones), 1, 'K1 (equipo del proyecto) la ve');
reset role;
select pg_temp.como(3); set local role authenticated;
select is((select count(*)::int from public.transcripciones), 1, 'A1 (admin de la consultoría) la ve');
reset role;
select pg_temp.como(4); set local role authenticated;
select is((select count(*)::int from public.transcripciones), 1, 'CL (cliente de la empresa) la ve');
reset role;
select pg_temp.como(2); set local role authenticated;
select is((select count(*)::int from public.transcripciones), 0, 'K2 (consultor que NO es miembro del proyecto) no la ve');
reset role;
select pg_temp.como(5); set local role authenticated;
select is((select count(*)::int from public.transcripciones), 0, 'K4 (otra consultoría) no la ve');
reset role;

-- ─── corregir_transcripcion (equipo) ────────────────────────────────────────
select pg_temp.como(1); set local role authenticated;
select lives_ok(
  $$ select public.corregir_transcripcion('34343434-0000-0000-0004-000000000001', '  Las quejas se resuelven en cinco días hábiles.  ') $$,
  'K1 corrige la transcripción de su proyecto');
reset role;
select is(
  (select texto = 'Las quejas se resuelven en cinco días hábiles.'
          and texto_automatico = 'Las quejas se resuelven en 5 días.'
          and corregida_por = '34343434-0000-0000-0000-000000000001' and corregida_en is not null
   from public.transcripciones where evidencia_id = '34343434-0000-0000-0004-000000000001'),
  true, 'Cambia el texto, CONSERVA lo que escuchó la IA y deja quién y cuándo la corrigió');
select is(
  (select count(*)::int from public.historial
   where entidad_tipo = 'evidencia' and entidad_id = '34343434-0000-0000-0004-000000000001'
     and accion = 'Transcripción corregida' and autor_id = '34343434-0000-0000-0000-000000000001'),
  1, 'La corrección deja historial');

create temp table previo as
  select corregida_en from public.transcripciones where evidencia_id = '34343434-0000-0000-0004-000000000001';
select pg_temp.como(1); set local role authenticated;
select lives_ok(
  $$ select public.corregir_transcripcion('34343434-0000-0000-0004-000000000001', 'Las quejas se resuelven en cinco días hábiles.') $$,
  'Corregir con el mismo texto no falla');
reset role;
select is(
  (select corregida_en from public.transcripciones where evidencia_id = '34343434-0000-0000-0004-000000000001'),
  (select corregida_en from previo), 'Con el mismo texto no se toca la fecha de corrección');
select is(
  (select count(*)::int from public.historial where entidad_id = '34343434-0000-0000-0004-000000000001' and accion = 'Transcripción corregida'),
  1, 'Con el mismo texto no se agrega otro historial');

select pg_temp.como(1); set local role authenticated;
select throws_ok(
  $$ select public.corregir_transcripcion('34343434-0000-0000-0004-000000000001', '   ') $$,
  '22023', 'El texto de la transcripción no puede estar vacío', 'No se puede dejar la transcripción vacía');
select throws_ok(
  $$ select public.corregir_transcripcion('34343434-0000-0000-0004-000000000001', repeat('a', 100001)) $$,
  '22023', 'La transcripción supera los 100000 caracteres', 'No se acepta un texto de más de 100000 caracteres');
select throws_ok(
  $$ select public.corregir_transcripcion('34343434-0000-0000-0004-000000000002', 'algo') $$,
  '22023', 'Esa evidencia todavía no tiene transcripción', 'No se corrige una evidencia que todavía no se transcribió');
reset role;

-- Sin permiso: el MISMO error exista o no la evidencia.
select pg_temp.como(4); set local role authenticated;
select throws_ok(
  $$ select public.corregir_transcripcion('34343434-0000-0000-0004-000000000001', 'hackeada') $$,
  '42501', 'Evidencia no encontrada o sin permiso para corregir su transcripción', 'El cliente la lee pero no la corrige');
reset role;
select pg_temp.como(2); set local role authenticated;
select throws_ok(
  $$ select public.corregir_transcripcion('34343434-0000-0000-0004-000000000001', 'hackeada') $$,
  '42501', 'Evidencia no encontrada o sin permiso para corregir su transcripción', 'Un consultor que no es del proyecto no la corrige');
reset role;
select pg_temp.como(5); set local role authenticated;
select throws_ok(
  $$ select public.corregir_transcripcion('34343434-0000-0000-0004-000000000001', 'hackeada') $$,
  '42501', 'Evidencia no encontrada o sin permiso para corregir su transcripción', 'Otra consultoría no la corrige (y no se entera de que existe)');
select throws_ok(
  $$ select public.corregir_transcripcion('34343434-0000-0000-0004-0000000000ff', 'x') $$,
  '42501', 'Evidencia no encontrada o sin permiso para corregir su transcripción', 'Una evidencia inexistente da el mismo error que una ajena');
reset role;
set local role anon;
select throws_ok(
  $$ select public.corregir_transcripcion('34343434-0000-0000-0004-000000000001', 'x') $$,
  '42501', null, 'Un anónimo no puede ejecutar corregir_transcripcion');
reset role;
select is(
  (select texto from public.transcripciones where evidencia_id = '34343434-0000-0000-0004-000000000001'),
  'Las quejas se resuelven en cinco días hábiles.', 'Nada de lo anterior cambió el texto');

-- ─── Volver a transcribir reemplaza todo, incluida la corrección ────────────
set local role service_role;
select lives_ok(
  $$ select public.registrar_transcripcion('34343434-0000-0000-0004-000000000001', 'Texto nuevo del audio.', 'groq', 'whisper-large-v3', '34343434-0000-0000-0000-000000000003') $$,
  'Se puede volver a transcribir la misma evidencia');
reset role;
select is(
  (select texto = 'Texto nuevo del audio.' and texto_automatico = 'Texto nuevo del audio.' and corregida_por is null
          and corregida_en is null and creada_por = '34343434-0000-0000-0000-000000000003' and modelo = 'whisper-large-v3'
   from public.transcripciones where evidencia_id = '34343434-0000-0000-0004-000000000001'),
  true, 'La transcripción nueva reemplaza al texto y a la corrección anterior');
select is(
  (select count(*)::int from public.transcripciones where evidencia_id = '34343434-0000-0000-0004-000000000001'),
  1, 'Sigue habiendo UNA sola transcripción por evidencia');
select is(
  (select count(*)::int from public.historial where entidad_id = '34343434-0000-0000-0004-000000000001' and accion = 'Transcripción generada'),
  2, 'Cada transcripción generada deja historial');

-- ─── También se transcribe un video (su audio) ──────────────────────────────
set local role service_role;
select lives_ok(
  $$ select public.registrar_transcripcion('34343434-0000-0000-0004-000000000005', 'Texto del audio del video.', 'groq', 'w', '34343434-0000-0000-0000-000000000001') $$,
  'También se registra la transcripción de una evidencia de video');
reset role;

-- ─── autorizar_transcripcion: quién puede transcribir y cuánto por día ──────
-- La función de borde la llama con el token del usuario ANTES de gastar la clave del servicio de
-- transcripción: devuelve qué archivo transcribir o rechaza.
select pg_temp.como(1); set local role authenticated;
select is(
  (select archivo_ruta || '|' || archivo_mime || '|' || tipo || '|' || proyecto_id::text
   from public.autorizar_transcripcion('34343434-0000-0000-0004-000000000002')),
  'c1/e1/p1/ev2.m4a|audio/mp4|Audio|34343434-0000-0000-0003-000000000001',
  'El equipo del proyecto recibe el archivo a transcribir (ruta, tipo y proyecto salen de la BD)');
select throws_ok(
  $$ select * from public.autorizar_transcripcion('34343434-0000-0000-0004-000000000003') $$,
  '22023', 'Solo se transcriben evidencias de audio o video', 'No autoriza una evidencia que no es de audio ni video');
select throws_ok(
  $$ select * from public.autorizar_transcripcion('34343434-0000-0000-0004-000000000006') $$,
  '22023', 'La evidencia no tiene archivo adjunto', 'No autoriza una evidencia sin archivo');
reset role;

select pg_temp.como(4); set local role authenticated;
select throws_ok(
  $$ select * from public.autorizar_transcripcion('34343434-0000-0000-0004-000000000002') $$,
  '42501', 'Evidencia no encontrada o sin permiso para transcribirla', 'El cliente no transcribe (gasta la clave de la consultoría)');
reset role;
select pg_temp.como(2); set local role authenticated;
select throws_ok(
  $$ select * from public.autorizar_transcripcion('34343434-0000-0000-0004-000000000002') $$,
  '42501', 'Evidencia no encontrada o sin permiso para transcribirla', 'Un consultor que no es del proyecto no transcribe');
reset role;
select pg_temp.como(5); set local role authenticated;
select throws_ok(
  $$ select * from public.autorizar_transcripcion('34343434-0000-0000-0004-000000000002') $$,
  '42501', 'Evidencia no encontrada o sin permiso para transcribirla', 'Otra consultoría no transcribe (y no se entera de que existe)');
select throws_ok(
  $$ select * from public.autorizar_transcripcion('34343434-0000-0000-0004-0000000000ff') $$,
  '42501', 'Evidencia no encontrada o sin permiso para transcribirla', 'Una evidencia inexistente da el mismo error que una ajena');
reset role;
set local role anon;
select throws_ok(
  $$ select * from public.autorizar_transcripcion('34343434-0000-0000-0004-000000000002') $$,
  '42501', null, 'Un anónimo no puede ejecutar autorizar_transcripcion');
reset role;

-- Tope diario por usuario (la transcripción gasta la clave de un servicio externo). Cuenta las generadas en 24 h.
insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, creado_en)
select '34343434-0000-0000-0001-000000000001', '34343434-0000-0000-0003-000000000001', 'evidencia',
       '34343434-0000-0000-0004-000000000002', '34343434-0000-0000-0000-000000000001', 'Transcripción generada',
       case when n <= 5 then now() - interval '25 hours' else now() - interval '1 hour' end
-- 5 viejas (no cuentan) + las recientes que faltan para que K1 quede en (tope - 1), contando las que ya generó arriba
from generate_series(1, 5 + private.tope_transcripciones() - 1 - (
  select count(*)::int from public.historial
  where autor_id = '34343434-0000-0000-0000-000000000001' and accion = 'Transcripción generada' and creado_en > now() - interval '24 hours'
)) as n;
select pg_temp.como(1); set local role authenticated;
select lives_ok(
  $$ select * from public.autorizar_transcripcion('34343434-0000-0000-0004-000000000002') $$,
  'Con (tope - 1) transcripciones de hoy todavía puede hacer una más (las de hace más de 24 h no cuentan)');
reset role;
insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion)
values ('34343434-0000-0000-0001-000000000001', '34343434-0000-0000-0003-000000000001', 'evidencia',
        '34343434-0000-0000-0004-000000000002', '34343434-0000-0000-0000-000000000001', 'Transcripción generada');
select pg_temp.como(1); set local role authenticated;
select throws_ok(
  $$ select * from public.autorizar_transcripcion('34343434-0000-0000-0004-000000000002') $$,
  'IA429', format('Alcanzaste el tope diario de transcripciones (%s). Inténtalo mañana.', private.tope_transcripciones()),
  'Al llegar al tope del día se rechaza con un mensaje que dice cuánto es');
reset role;
select pg_temp.como(3); set local role authenticated;
select lives_ok(
  $$ select * from public.autorizar_transcripcion('34343434-0000-0000-0004-000000000002') $$,
  'El tope es por usuario: A1 no hizo ninguna hoy y puede');
reset role;
-- Los tests de arriba derivan el tope de esta función: este lo FIJA (si alguien lo cambia, tiene que enterarse).
select is(private.tope_transcripciones(), 20, 'El tope diario es de 20 transcripciones por usuario');

-- ─── Cascada ────────────────────────────────────────────────────────────────
delete from public.evidencias where id = '34343434-0000-0000-0004-000000000001';
select is(
  (select count(*)::int from public.transcripciones where evidencia_id = '34343434-0000-0000-0004-000000000001'),
  0, 'Al borrar la evidencia se borra su transcripción');

select * from finish();
rollback;
