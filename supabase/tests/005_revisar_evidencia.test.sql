-- revisar_evidencia: cambia el estado de una evidencia y lo registra en el
-- historial, en una transacción y con los permisos del usuario.

begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

-- K1 consultor asignado · K2 consultor NO asignado · U cliente de la empresa
insert into auth.users (id, email, aud, role) values
  ('fefefefe-1111-0000-0000-000000000001', 'k1@re.test', 'authenticated', 'authenticated'),
  ('fefefefe-1111-0000-0000-000000000002', 'k2@re.test', 'authenticated', 'authenticated'),
  ('fefefefe-1111-0000-0000-000000000003', 'u@re.test',  'authenticated', 'authenticated');
insert into public.consultorias (id, nombre) values ('fbfbfbfb-2222-0000-0000-000000000001', 'Consultoría RE');
insert into public.empresas (id, consultoria_id, nombre) values
  ('fcfcfcfc-2222-0000-0000-000000000001', 'fbfbfbfb-2222-0000-0000-000000000001', 'Empresa RE');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('fefefefe-1111-0000-0000-000000000001', 'K1', 'k1@re.test', 'consultor',       'fbfbfbfb-2222-0000-0000-000000000001', null),
  ('fefefefe-1111-0000-0000-000000000002', 'K2', 'k2@re.test', 'consultor',       'fbfbfbfb-2222-0000-0000-000000000001', null),
  ('fefefefe-1111-0000-0000-000000000003', 'U',  'u@re.test',  'usuario_cliente', 'fbfbfbfb-2222-0000-0000-000000000001', 'fcfcfcfc-2222-0000-0000-000000000001');
insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('fdfdfdfd-2222-0000-0000-000000000001', 'fbfbfbfb-2222-0000-0000-000000000001', 'fcfcfcfc-2222-0000-0000-000000000001', 'Proyecto RE');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('fdfdfdfd-2222-0000-0000-000000000001', 'fefefefe-1111-0000-0000-000000000001', 'fbfbfbfb-2222-0000-0000-000000000001');
insert into public.evidencias (id, consultoria_id, proyecto_id, nombre, tipo, estado, subido_por) values
  ('ffffffff-2222-0000-0000-000000000001', 'fbfbfbfb-2222-0000-0000-000000000001', 'fdfdfdfd-2222-0000-0000-000000000001',
   'Foto del almacén', 'Foto', 'Cargada', 'fefefefe-1111-0000-0000-000000000003');

-- ─── Anónimo ────────────────────────────────────────────────────────────────
set local role anon;
select throws_ok(
  $$ select public.revisar_evidencia('ffffffff-2222-0000-0000-000000000001', 'Aceptada', null) $$,
  '42501', null, 'Un anónimo no puede revisar evidencias'
);
reset role;

-- ─── K1: consultor asignado ─────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"fefefefe-1111-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.revisar_evidencia('ffffffff-2222-0000-0000-000000000001', 'Requiere corrección', 'La foto está borrosa') $$,
  'El consultor asignado cambia el estado de la evidencia'
);
-- Mismo estado: no debe registrar nada nuevo.
select lives_ok(
  $$ select public.revisar_evidencia('ffffffff-2222-0000-0000-000000000001', 'Requiere corrección', null) $$,
  'Repetir el mismo estado no falla'
);
reset role;

select is(
  (select estado from public.evidencias where id = 'ffffffff-2222-0000-0000-000000000001'),
  'Requiere corrección', 'La evidencia quedó en el estado nuevo'
);
select is(
  (select array[estado_anterior, estado_nuevo, descripcion, autor_id::text]
   from public.historial where entidad_tipo = 'evidencia' and entidad_id = 'ffffffff-2222-0000-0000-000000000001'),
  array['Cargada', 'Requiere corrección', 'La foto está borrosa', 'fefefefe-1111-0000-0000-000000000001'],
  'El cambio quedó en el historial (una sola vez), con autor y comentario'
);

-- ─── K2: consultor NO asignado ──────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"fefefefe-1111-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.revisar_evidencia('ffffffff-2222-0000-0000-000000000001', 'Aceptada', null) $$,
  '42501', null, 'Un consultor no asignado no puede revisar evidencias de ese proyecto'
);
reset role;

-- ─── U: cliente (ve la evidencia pero no la revisa) ─────────────────────────
select set_config('request.jwt.claims', '{"sub":"fefefefe-1111-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.revisar_evidencia('ffffffff-2222-0000-0000-000000000001', 'Aceptada', null) $$,
  '42501', null, 'El cliente no puede aprobar sus propias evidencias'
);
reset role;

select is(
  (select count(*) from public.historial where entidad_id = 'ffffffff-2222-0000-0000-000000000001'),
  1::bigint, 'Los intentos rechazados no dejaron rastro en el historial'
);

select * from finish();
rollback;
