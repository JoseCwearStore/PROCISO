-- Análisis con IA (bloque B1, 2026-11-06):
--   · El EQUIPO del proyecto pide un análisis de un documento o una evidencia,
--     contra criterios del catálogo. Nace "Pendiente".
--   · El CLIENTE lee los análisis (y resultados) de sus proyectos.
--   · Solo el servidor (service_role, la Edge Function) registra el resultado:
--     "Completado" con una fila por criterio, o "Error" con su detalle (para poder actuar).

begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

-- K consultor de P1 · U cliente de E1 · U2 cliente de E2
insert into auth.users (id, email, aud, role) values
  ('09090909-0000-0000-0000-000000000001', 'k@ia.test',  'authenticated', 'authenticated'),
  ('09090909-0000-0000-0000-000000000002', 'u@ia.test',  'authenticated', 'authenticated'),
  ('09090909-0000-0000-0000-000000000003', 'u2@ia.test', 'authenticated', 'authenticated');
insert into public.consultorias (id, nombre) values ('09090909-0000-0000-0001-000000000001', 'Consultoría IA');
insert into public.empresas (id, consultoria_id, nombre) values
  ('09090909-0000-0000-0002-000000000001', '09090909-0000-0000-0001-000000000001', 'Empresa IA 1'),
  ('09090909-0000-0000-0002-000000000002', '09090909-0000-0000-0001-000000000001', 'Empresa IA 2');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('09090909-0000-0000-0000-000000000001', 'K',  'k@ia.test',  'consultor',       '09090909-0000-0000-0001-000000000001', null),
  ('09090909-0000-0000-0000-000000000002', 'U',  'u@ia.test',  'usuario_cliente', '09090909-0000-0000-0001-000000000001', '09090909-0000-0000-0002-000000000001'),
  ('09090909-0000-0000-0000-000000000003', 'U2', 'u2@ia.test', 'usuario_cliente', '09090909-0000-0000-0001-000000000001', '09090909-0000-0000-0002-000000000002');
insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('09090909-0000-0000-0003-000000000001', '09090909-0000-0000-0001-000000000001', '09090909-0000-0000-0002-000000000001', 'P1 IA'),
  ('09090909-0000-0000-0003-000000000002', '09090909-0000-0000-0001-000000000001', '09090909-0000-0000-0002-000000000002', 'P2 IA');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('09090909-0000-0000-0003-000000000001', '09090909-0000-0000-0000-000000000001', '09090909-0000-0000-0001-000000000001');
-- Entregados a revisión: un Borrador no lo ve el cliente (ver 021).
insert into public.documentos (id, consultoria_id, proyecto_id, nombre, tipo, estado) values
  ('09090909-0000-0000-0004-000000000001', '09090909-0000-0000-0001-000000000001', '09090909-0000-0000-0003-000000000001', 'Política IA', 'Política', 'Pendiente de revisión'),
  ('09090909-0000-0000-0004-000000000002', '09090909-0000-0000-0001-000000000001', '09090909-0000-0000-0003-000000000002', 'Política ajena', 'Política', 'Pendiente de revisión');
insert into public.evidencias (id, consultoria_id, proyecto_id, nombre, tipo) values
  ('09090909-0000-0000-0005-000000000001', '09090909-0000-0000-0001-000000000001', '09090909-0000-0000-0003-000000000001', 'Foto tablero', 'Foto');

create function pg_temp.como(p_id text) returns void language sql as $$
  select set_config('request.jwt.claims', '{"sub":"' || p_id || '","role":"authenticated"}', true)
$$;
create function pg_temp.criterio(p_clausula text) returns uuid language sql as $$
  select id from public.criterios_evaluacion where edicion = 'ISO 9001:2026' and clausula = p_clausula
$$;

select has_table('public', 'analisis_ia', 'Existe la tabla de análisis');
select has_table('public', 'analisis_ia_resultados', 'Existe la tabla de resultados por criterio');

-- ─── K: consultor del proyecto ──────────────────────────────────────────────
select pg_temp.como('09090909-0000-0000-0000-000000000001');
set local role authenticated;
select lives_ok(
  format($$ insert into public.analisis_ia (id, consultoria_id, proyecto_id, fuente_tipo, documento_id, criterio_ids)
            values ('09090909-0000-0000-0006-000000000001', '09090909-0000-0000-0001-000000000001', '09090909-0000-0000-0003-000000000001',
                    'documento', '09090909-0000-0000-0004-000000000001', array[%L, %L]::uuid[]) returning * $$,
         pg_temp.criterio('5.2.1'), pg_temp.criterio('5.2.2')),
  'El equipo pide el análisis de un documento de su proyecto (INSERT … RETURNING)'
);
select lives_ok(
  format($$ insert into public.analisis_ia (id, consultoria_id, proyecto_id, fuente_tipo, evidencia_id, criterio_ids)
            values ('09090909-0000-0000-0006-000000000002', '09090909-0000-0000-0001-000000000001', '09090909-0000-0000-0003-000000000001',
                    'evidencia', '09090909-0000-0000-0005-000000000001', array[%L]::uuid[]) $$,
         pg_temp.criterio('7.1.3')),
  'También pide el análisis de una evidencia (imagen o PDF)'
);
select is((select estado from public.analisis_ia where id = '09090909-0000-0000-0006-000000000001'), 'Pendiente', 'Todo análisis nace pendiente');
select throws_ok(
  format($$ insert into public.analisis_ia (consultoria_id, proyecto_id, fuente_tipo, documento_id, criterio_ids)
            values ('09090909-0000-0000-0001-000000000001', '09090909-0000-0000-0003-000000000001',
                    'documento', '09090909-0000-0000-0004-000000000002', array[%L]::uuid[]) $$, pg_temp.criterio('5.2.1')),
  '23503', null, 'No se cuelga en P1 un documento de otro proyecto'
);
select throws_ok(
  format($$ insert into public.analisis_ia (consultoria_id, proyecto_id, fuente_tipo, documento_id, criterio_ids)
            values ('09090909-0000-0000-0001-000000000001', '09090909-0000-0000-0003-000000000002',
                    'documento', '09090909-0000-0000-0004-000000000002', array[%L]::uuid[]) $$, pg_temp.criterio('5.2.1')),
  '42501', null, 'No pide análisis en un proyecto donde no trabaja'
);
select throws_ok(
  format($$ insert into public.analisis_ia (consultoria_id, proyecto_id, fuente_tipo, documento_id, evidencia_id, criterio_ids)
            values ('09090909-0000-0000-0001-000000000001', '09090909-0000-0000-0003-000000000001', 'documento',
                    '09090909-0000-0000-0004-000000000001', '09090909-0000-0000-0005-000000000001', array[%L]::uuid[]) $$, pg_temp.criterio('5.2.1')),
  '23514', null, 'La fuente es una sola y coincide con su tipo'
);
select throws_ok(
  $$ insert into public.analisis_ia (consultoria_id, proyecto_id, fuente_tipo, documento_id, criterio_ids)
     values ('09090909-0000-0000-0001-000000000001', '09090909-0000-0000-0003-000000000001', 'documento',
             '09090909-0000-0000-0004-000000000001', '{}') $$,
  '23514', null, 'Hay que pedir al menos un criterio'
);
select throws_ok(
  $$ insert into public.analisis_ia (consultoria_id, proyecto_id, fuente_tipo, documento_id, criterio_ids)
     values ('09090909-0000-0000-0001-000000000001', '09090909-0000-0000-0003-000000000001', 'documento',
             '09090909-0000-0000-0004-000000000001', array['09090909-0000-0000-0009-000000000099']::uuid[]) $$,
  '22023', null, 'Los criterios tienen que existir en el catálogo'
);
select throws_ok(
  $$ update public.analisis_ia set estado = 'Completado' where id = '09090909-0000-0000-0006-000000000001' $$,
  '42501', null, 'Nadie marca un análisis como completado desde la app'
);
select throws_ok(
  format($$ insert into public.analisis_ia (consultoria_id, proyecto_id, fuente_tipo, documento_id, criterio_ids, estado)
            values ('09090909-0000-0000-0001-000000000001', '09090909-0000-0000-0003-000000000001', 'documento',
                    '09090909-0000-0000-0004-000000000001', array[%L]::uuid[], 'Completado') $$, pg_temp.criterio('5.2.1')),
  '42501', null, 'Tampoco se crea uno ya completado'
);
select throws_ok(
  format($$ select public.registrar_resultado_analisis('09090909-0000-0000-0006-000000000001', 'Completado', 'x', null, 'p', 'm',
            jsonb_build_array(jsonb_build_object('criterio_id', %L, 'estado', 'Cubierto'))) $$, pg_temp.criterio('5.2.1')),
  '42501', null, 'El resultado no se registra con un token de usuario'
);
reset role;

-- ─── U: cliente ─────────────────────────────────────────────────────────────
select pg_temp.como('09090909-0000-0000-0000-000000000002');
set local role authenticated;
select throws_ok(
  format($$ insert into public.analisis_ia (consultoria_id, proyecto_id, fuente_tipo, documento_id, criterio_ids)
            values ('09090909-0000-0000-0001-000000000001', '09090909-0000-0000-0003-000000000001', 'documento',
                    '09090909-0000-0000-0004-000000000001', array[%L]::uuid[]) $$, pg_temp.criterio('5.2.1')),
  '42501', null, 'El cliente no pide análisis (consumen la clave de la consultoría)'
);
reset role;

-- ─── Servidor: registra resultados ─────────────────────────────────────────
set local role service_role;
select lives_ok(
  format($$ select public.registrar_resultado_analisis('09090909-0000-0000-0006-000000000001', 'Completado',
            'La política cubre parcialmente los requisitos.', null, 'openai-compatible', 'gpt-oss:120b-cloud',
            jsonb_build_array(
              jsonb_build_object('criterio_id', %L, 'estado', 'Parcial', 'hallazgos', 'Falta el compromiso de mejora continua.', 'sugerencias', 'Agregarlo.'),
              jsonb_build_object('criterio_id', %L, 'estado', 'Cubierto', 'hallazgos', 'Se comunica en la inducción.'))) $$,
         pg_temp.criterio('5.2.1'), pg_temp.criterio('5.2.2')),
  'El servidor registra el análisis completado con un resultado por criterio'
);
select throws_ok(
  format($$ select public.registrar_resultado_analisis('09090909-0000-0000-0006-000000000001', 'Completado', 'otra vez', null, 'p', 'm',
            jsonb_build_array(jsonb_build_object('criterio_id', %L, 'estado', 'Cubierto'))) $$, pg_temp.criterio('5.2.1')),
  '22023', null, 'Un análisis cerrado no se vuelve a registrar'
);
select throws_ok(
  format($$ select public.registrar_resultado_analisis('09090909-0000-0000-0006-000000000002', 'Completado', 'x', null, 'p', 'm',
            jsonb_build_array(jsonb_build_object('criterio_id', %L, 'estado', 'Cubierto'))) $$, pg_temp.criterio('4.1')),
  '22023', null, 'Solo se registran resultados de los criterios pedidos'
);
select lives_ok(
  $$ select public.registrar_resultado_analisis('09090909-0000-0000-0006-000000000002', 'Error', null,
       'El modelo configurado no acepta imágenes.', 'openai-compatible', 'gpt-oss:120b-cloud', '[]'::jsonb) $$,
  'Un fallo queda registrado como Error con su detalle (para poder actuar)'
);
reset role;

select is(
  (select row(estado, error_detalle, completado_en is not null)::text from public.analisis_ia where id = '09090909-0000-0000-0006-000000000002'),
  row('Error', 'El modelo configurado no acepta imágenes.', true)::text,
  'El análisis con error guarda el motivo y la fecha'
);

-- ─── Lectura ────────────────────────────────────────────────────────────────
select pg_temp.como('09090909-0000-0000-0000-000000000002');
set local role authenticated;
select is((select count(*)::int from public.analisis_ia_resultados), 2, 'El cliente lee los resultados de su proyecto');
reset role;

select pg_temp.como('09090909-0000-0000-0000-000000000003');
set local role authenticated;
select is((select count(*)::int from public.analisis_ia) + (select count(*)::int from public.analisis_ia_resultados), 0,
  'El cliente de otra empresa no ve análisis ni resultados ajenos');
reset role;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok('select count(*) from public.analisis_ia', '42501', null, 'Sin sesión no se leen análisis');
reset role;

select * from finish();
rollback;
