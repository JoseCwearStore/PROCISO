-- No conformidades: quién registra, quién trata y quién verifica y cierra.
-- Regla del negocio (elegida por el usuario el 2026-11-07):
--   · El EQUIPO registra la NC (folio NC-001 por proyecto, lo pone el servidor).
--   · El CLIENTE de la empresa participa: documenta corrección, causa y acción, y
--     avanza Abierta → En análisis → En corrección.
--   · Verificar la eficacia y cerrar: SOLO el equipo. "No eficaz" vuelve a En análisis.

begin;
create extension if not exists pgtap with schema extensions;

select plan(34);

-- A admin · K1 consultor del proyecto · K2 consultor de afuera · U cliente de la empresa · U2 cliente de OTRA empresa
insert into auth.users (id, email, aud, role) values
  ('c6c6c6c6-0000-0000-0000-000000000001', 'a@nc.test',  'authenticated', 'authenticated'),
  ('c6c6c6c6-0000-0000-0000-000000000002', 'k1@nc.test', 'authenticated', 'authenticated'),
  ('c6c6c6c6-0000-0000-0000-000000000003', 'k2@nc.test', 'authenticated', 'authenticated'),
  ('c6c6c6c6-0000-0000-0000-000000000004', 'u@nc.test',  'authenticated', 'authenticated'),
  ('c6c6c6c6-0000-0000-0000-000000000005', 'u2@nc.test', 'authenticated', 'authenticated');
insert into public.consultorias (id, nombre) values ('c7c7c7c7-0000-0000-0000-000000000001', 'Consultoría NC');
insert into public.empresas (id, consultoria_id, nombre) values
  ('c8c8c8c8-0000-0000-0000-000000000001', 'c7c7c7c7-0000-0000-0000-000000000001', 'Empresa NC'),
  ('c8c8c8c8-0000-0000-0000-000000000002', 'c7c7c7c7-0000-0000-0000-000000000001', 'Otra empresa NC');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('c6c6c6c6-0000-0000-0000-000000000001', 'A',  'a@nc.test',  'admin_consultoria', 'c7c7c7c7-0000-0000-0000-000000000001', null),
  ('c6c6c6c6-0000-0000-0000-000000000002', 'K1', 'k1@nc.test', 'consultor',         'c7c7c7c7-0000-0000-0000-000000000001', null),
  ('c6c6c6c6-0000-0000-0000-000000000003', 'K2', 'k2@nc.test', 'consultor',         'c7c7c7c7-0000-0000-0000-000000000001', null),
  ('c6c6c6c6-0000-0000-0000-000000000004', 'U',  'u@nc.test',  'usuario_cliente',   'c7c7c7c7-0000-0000-0000-000000000001', 'c8c8c8c8-0000-0000-0000-000000000001'),
  ('c6c6c6c6-0000-0000-0000-000000000005', 'U2', 'u2@nc.test', 'usuario_cliente',   'c7c7c7c7-0000-0000-0000-000000000001', 'c8c8c8c8-0000-0000-0000-000000000002');
insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('c9c9c9c9-0000-0000-0000-000000000001', 'c7c7c7c7-0000-0000-0000-000000000001', 'c8c8c8c8-0000-0000-0000-000000000001', 'Proyecto NC');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('c9c9c9c9-0000-0000-0000-000000000001', 'c6c6c6c6-0000-0000-0000-000000000002', 'c7c7c7c7-0000-0000-0000-000000000001');

-- ─── K1: el equipo registra ─────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"c6c6c6c6-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$ insert into public.no_conformidades (id, consultoria_id, proyecto_id, titulo, descripcion, tipo, fecha_deteccion, responsable_id)
     values ('cacacaca-0000-0000-0000-000000000001', 'c7c7c7c7-0000-0000-0000-000000000001', 'c9c9c9c9-0000-0000-0000-000000000001',
             'Sin control de calibración', 'No hay programa de calibración', 'Mayor', current_date, 'c6c6c6c6-0000-0000-0000-000000000004')
     returning * $$,
  'El consultor del proyecto registra una NC con el cliente como responsable (INSERT … RETURNING)'
);
select lives_ok(
  $$ insert into public.no_conformidades (id, consultoria_id, proyecto_id, titulo, descripcion, tipo, fecha_deteccion, responsable_id)
     values ('cacacaca-0000-0000-0000-000000000002', 'c7c7c7c7-0000-0000-0000-000000000001', 'c9c9c9c9-0000-0000-0000-000000000001',
             'Registros incompletos', 'Faltan firmas', 'Menor', current_date, 'c6c6c6c6-0000-0000-0000-000000000002') $$,
  'Registra una segunda NC'
);
select throws_ok(
  $$ insert into public.no_conformidades (consultoria_id, proyecto_id, titulo, descripcion, fecha_deteccion, responsable_id, estado)
     values ('c7c7c7c7-0000-0000-0000-000000000001', 'c9c9c9c9-0000-0000-0000-000000000001', 'Atajo', 'x', current_date,
             'c6c6c6c6-0000-0000-0000-000000000004', 'Cerrada') $$,
  '42501', null, 'Nadie registra una NC ya Cerrada: el estado no se escribe directo'
);
select throws_ok(
  $$ insert into public.no_conformidades (consultoria_id, proyecto_id, titulo, descripcion, fecha_deteccion, responsable_id, folio)
     values ('c7c7c7c7-0000-0000-0000-000000000001', 'c9c9c9c9-0000-0000-0000-000000000001', 'Folio a mano', 'x', current_date,
             'c6c6c6c6-0000-0000-0000-000000000004', 'NC-999') $$,
  '42501', null, 'El folio no se escribe a mano'
);
select throws_ok(
  $$ insert into public.no_conformidades (consultoria_id, proyecto_id, titulo, descripcion, fecha_deteccion, responsable_id)
     values ('c7c7c7c7-0000-0000-0000-000000000001', 'c9c9c9c9-0000-0000-0000-000000000001', 'Otra empresa', 'x', current_date,
             'c6c6c6c6-0000-0000-0000-000000000005') $$,
  '22023', null, 'El responsable no puede ser un cliente de OTRA empresa'
);
select throws_ok(
  $$ update public.no_conformidades set eficacia = 'Eficaz' where id = 'cacacaca-0000-0000-0000-000000000001' $$,
  '42501', null, 'La eficacia no se escribe directo (solo verificando)'
);
reset role;

select is(
  (select array_agg(folio order by folio) from public.no_conformidades where proyecto_id = 'c9c9c9c9-0000-0000-0000-000000000001'),
  array['NC-001', 'NC-002'],
  'El servidor numera los folios por proyecto'
);
select is(
  (select array[estado, eficacia, registrada_por::text] from public.no_conformidades where id = 'cacacaca-0000-0000-0000-000000000001'),
  array['Abierta', 'Pendiente', 'c6c6c6c6-0000-0000-0000-000000000002'],
  'Nace Abierta, con eficacia Pendiente y registrada por K1'
);

-- ─── U: el cliente participa ────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"c6c6c6c6-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$ insert into public.no_conformidades (consultoria_id, proyecto_id, titulo, descripcion, fecha_deteccion, responsable_id)
     values ('c7c7c7c7-0000-0000-0000-000000000001', 'c9c9c9c9-0000-0000-0000-000000000001', 'Del cliente', 'x', current_date,
             'c6c6c6c6-0000-0000-0000-000000000004') $$,
  '42501', null, 'El cliente no registra NC'
);
select is(
  (select count(*)::int from public.no_conformidades where proyecto_id = 'c9c9c9c9-0000-0000-0000-000000000001'),
  2, 'El cliente ve las NC de su empresa'
);
select lives_ok(
  $$ select public.guardar_tratamiento_nc('cacacaca-0000-0000-0000-000000000001',
       'Se retiró el equipo sin calibrar', 'No había responsable de calibración', 'Crear programa anual de calibración') $$,
  'El cliente documenta corrección, causa y acción'
);
select is_empty(
  $$ update public.no_conformidades set titulo = 'Cambiada' where id = 'cacacaca-0000-0000-0000-000000000001' returning id $$,
  'El cliente no edita los datos del registro (RLS: 0 filas)'
);
select throws_ok(
  $$ select public.cambiar_estado_nc('cacacaca-0000-0000-0000-000000000001', 'En corrección', null) $$,
  '22023', null, 'No se salta de Abierta a En corrección'
);
select lives_ok(
  $$ select public.cambiar_estado_nc('cacacaca-0000-0000-0000-000000000001', 'En análisis', null) $$,
  'El cliente la pasa a En análisis'
);
select lives_ok(
  $$ select public.cambiar_estado_nc('cacacaca-0000-0000-0000-000000000001', 'En corrección', null) $$,
  'Con causa y acción escritas, el cliente la pasa a En corrección'
);
select throws_ok(
  $$ select public.cambiar_estado_nc('cacacaca-0000-0000-0000-000000000001', 'Verificada', 'Me parece bien') $$,
  '42501', null, 'El cliente NO verifica la eficacia de su propia acción'
);
reset role;

-- ─── U2 y K2: de afuera ─────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"c6c6c6c6-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*)::int from public.no_conformidades where proyecto_id = 'c9c9c9c9-0000-0000-0000-000000000001'),
  0, 'Un cliente de otra empresa no ve las NC'
);
select throws_ok(
  $$ select public.guardar_tratamiento_nc('cacacaca-0000-0000-0000-000000000001', 'x', 'x', 'x') $$,
  '42501', null, 'Un cliente de otra empresa no documenta el tratamiento'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"c6c6c6c6-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.cambiar_estado_nc('cacacaca-0000-0000-0000-000000000001', 'Verificada', 'Bien') $$,
  '42501', null, 'Un consultor que no es del proyecto no verifica'
);
reset role;

-- ─── K1: el equipo verifica (primero No eficaz, después Eficaz) y cierra ────
select set_config('request.jwt.claims', '{"sub":"c6c6c6c6-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.cambiar_estado_nc('cacacaca-0000-0000-0000-000000000002', 'En análisis', null) $$,
  'El equipo también puede avanzar el tratamiento'
);
select throws_ok(
  $$ select public.cambiar_estado_nc('cacacaca-0000-0000-0000-000000000002', 'En corrección', null) $$,
  '22023', null, 'Sin análisis de causa ni acción correctiva no pasa a En corrección'
);
select throws_ok(
  $$ select public.cambiar_estado_nc('cacacaca-0000-0000-0000-000000000001', 'Verificada', '   ') $$,
  '22023', null, 'Verificar exige describir la verificación'
);
select throws_ok(
  $$ select public.cambiar_estado_nc('cacacaca-0000-0000-0000-000000000001', 'Cerrada', null) $$,
  '22023', null, 'No se cierra sin verificar antes'
);
select lives_ok(
  $$ select public.cambiar_estado_nc('cacacaca-0000-0000-0000-000000000001', 'En análisis', 'El equipo sigue sin calibrar') $$,
  'Verificación No eficaz: vuelve a En análisis'
);
reset role;

select is(
  (select array[estado, eficacia, verificacion_eficacia] from public.no_conformidades where id = 'cacacaca-0000-0000-0000-000000000001'),
  array['En análisis', 'No eficaz', 'El equipo sigue sin calibrar'],
  'Queda En análisis con eficacia No eficaz y la verificación registrada'
);

select set_config('request.jwt.claims', '{"sub":"c6c6c6c6-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.cambiar_estado_nc('cacacaca-0000-0000-0000-000000000001', 'En corrección', null) $$,
  'El cliente vuelve a aplicar la acción'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"c6c6c6c6-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.cambiar_estado_nc('cacacaca-0000-0000-0000-000000000001', 'Verificada', 'Calibración vigente en los 4 equipos') $$,
  'El equipo verifica la eficacia'
);
reset role;

select is(
  (select array[estado, eficacia] from public.no_conformidades where id = 'cacacaca-0000-0000-0000-000000000001'),
  array['Verificada', 'Eficaz'],
  'Queda Verificada y Eficaz'
);

select set_config('request.jwt.claims', '{"sub":"c6c6c6c6-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.guardar_tratamiento_nc('cacacaca-0000-0000-0000-000000000001', 'x', 'x', 'Otra acción') $$,
  '22023', null, 'Una NC verificada ya no cambia su tratamiento'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"c6c6c6c6-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.cambiar_estado_nc('cacacaca-0000-0000-0000-000000000001', 'Cerrada', null) $$,
  'El equipo cierra la NC'
);
select is_empty(
  $$ delete from public.no_conformidades where id = 'cacacaca-0000-0000-0000-000000000002' returning id $$,
  'Un consultor no borra NC (solo el admin)'
);
reset role;

select is(
  (select array[estado, (fecha_cierre = current_date)::text] from public.no_conformidades where id = 'cacacaca-0000-0000-0000-000000000001'),
  array['Cerrada', 'true'],
  'Queda Cerrada con fecha de cierre de hoy'
);
select is(
  (select array_agg(h.estado_nuevo || ':' || p.nombre order by h.id)
   from public.historial h join public.perfiles p on p.id = h.autor_id
   where h.entidad_tipo = 'no_conformidad' and h.entidad_id = 'cacacaca-0000-0000-0000-000000000001'
     and h.estado_nuevo is not null),
  array['En análisis:U', 'En corrección:U', 'En análisis:K1', 'En corrección:U', 'Verificada:K1', 'Cerrada:K1'],
  'El historial registra cada cambio con su autor real'
);

select set_config('request.jwt.claims', '{"sub":"c6c6c6c6-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select isnt_empty(
  $$ delete from public.no_conformidades where id = 'cacacaca-0000-0000-0000-000000000002' returning id $$,
  'El admin de la consultoría borra una NC'
);
reset role;

select * from finish();
rollback;
