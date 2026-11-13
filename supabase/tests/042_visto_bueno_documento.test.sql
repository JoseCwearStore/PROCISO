-- O23 · Visto bueno del equipo sobre un documento pendiente de revisión.
-- El equipo (consultor miembro, admin de la consultoría) deja constancia de que revisó la versión; NO decide:
-- no cambia el estado ni `revisado_por`, y el cliente puede aprobar igual (el visto bueno no bloquea).

begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

-- K1 consultor miembro · K2 consultor NO miembro · U cliente de la empresa · A admin de la consultoría
insert into auth.users (id, email, aud, role) values
  ('e1e1e1e1-0000-0000-0000-000000000001', 'k1@vb.test', 'authenticated', 'authenticated'),
  ('e1e1e1e1-0000-0000-0000-000000000002', 'k2@vb.test', 'authenticated', 'authenticated'),
  ('e1e1e1e1-0000-0000-0000-000000000003', 'u@vb.test',  'authenticated', 'authenticated'),
  ('e1e1e1e1-0000-0000-0000-000000000004', 'a@vb.test',  'authenticated', 'authenticated');
insert into public.consultorias (id, nombre) values ('e2e2e2e2-0000-0000-0000-000000000001', 'Consultoría VB');
insert into public.empresas (id, consultoria_id, nombre) values
  ('e3e3e3e3-0000-0000-0000-000000000001', 'e2e2e2e2-0000-0000-0000-000000000001', 'Empresa VB');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('e1e1e1e1-0000-0000-0000-000000000001', 'K1', 'k1@vb.test', 'consultor',         'e2e2e2e2-0000-0000-0000-000000000001', null),
  ('e1e1e1e1-0000-0000-0000-000000000002', 'K2', 'k2@vb.test', 'consultor',         'e2e2e2e2-0000-0000-0000-000000000001', null),
  ('e1e1e1e1-0000-0000-0000-000000000003', 'U',  'u@vb.test',  'usuario_cliente',   'e2e2e2e2-0000-0000-0000-000000000001', 'e3e3e3e3-0000-0000-0000-000000000001'),
  ('e1e1e1e1-0000-0000-0000-000000000004', 'A',  'a@vb.test',  'admin_consultoria', 'e2e2e2e2-0000-0000-0000-000000000001', null);
insert into public.proyectos (id, consultoria_id, empresa_id, nombre) values
  ('e4e4e4e4-0000-0000-0000-000000000001', 'e2e2e2e2-0000-0000-0000-000000000001', 'e3e3e3e3-0000-0000-0000-000000000001', 'Proyecto VB');
insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('e4e4e4e4-0000-0000-0000-000000000001', 'e1e1e1e1-0000-0000-0000-000000000001', 'e2e2e2e2-0000-0000-0000-000000000001');

-- P pendiente 1.1 · B borrador · P2 pendiente (para el administrador)
insert into public.documentos (id, consultoria_id, proyecto_id, nombre, tipo, estado, version, codigo) values
  ('e5e5e5e5-0000-0000-0000-000000000001', 'e2e2e2e2-0000-0000-0000-000000000001', 'e4e4e4e4-0000-0000-0000-000000000001', 'Compras', 'Procedimiento', 'Pendiente de revisión', '1.1', 'VB-1'),
  ('e5e5e5e5-0000-0000-0000-000000000002', 'e2e2e2e2-0000-0000-0000-000000000001', 'e4e4e4e4-0000-0000-0000-000000000001', 'Política', 'Política', 'Borrador', '0.1', 'VB-2'),
  ('e5e5e5e5-0000-0000-0000-000000000003', 'e2e2e2e2-0000-0000-0000-000000000001', 'e4e4e4e4-0000-0000-0000-000000000001', 'Plan', 'Plan', 'Pendiente de revisión', '1.0', 'VB-3');

-- ─── Anónimo ────────────────────────────────────────────────────────────────
set local role anon;
select throws_ok(
  $$ select public.dar_visto_bueno_documento('e5e5e5e5-0000-0000-0000-000000000001', '1.1') $$,
  '42501', null, 'Un anónimo no puede dar visto bueno'
);
reset role;

-- ─── K2: consultor NO miembro ───────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"e1e1e1e1-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.dar_visto_bueno_documento('e5e5e5e5-0000-0000-0000-000000000001', '1.1') $$,
  '42501', null, 'Un consultor que no es miembro del proyecto no puede'
);
reset role;

-- ─── U: el cliente ve el documento pero no es del equipo ────────────────────
select set_config('request.jwt.claims', '{"sub":"e1e1e1e1-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.dar_visto_bueno_documento('e5e5e5e5-0000-0000-0000-000000000001', '1.1') $$,
  '42501', null, 'El cliente no da el visto bueno del equipo'
);
reset role;

-- ─── K1: consultor miembro ──────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"e1e1e1e1-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.dar_visto_bueno_documento('e5e5e5e5-0000-0000-0000-000000000001', '1.0') $$,
  '22023', null, 'Con una versión vieja (cambió desde que lo abriste) se rechaza'
);
select throws_ok(
  $$ select public.dar_visto_bueno_documento('e5e5e5e5-0000-0000-0000-000000000002', '0.1') $$,
  '22023', null, 'Solo sobre un documento pendiente de revisión (un borrador no)'
);
select lives_ok(
  $$ select public.dar_visto_bueno_documento('e5e5e5e5-0000-0000-0000-000000000001', '1.1') $$,
  'El consultor miembro da el visto bueno de la versión pendiente'
);
select throws_ok(
  $$ select public.dar_visto_bueno_documento('e5e5e5e5-0000-0000-0000-000000000001', '1.1') $$,
  '22023', null, 'No se da dos veces el visto bueno de la misma versión'
);
reset role;

select is(
  (select array[visto_bueno_por::text, visto_bueno_version, (visto_bueno_en is not null)::text]
   from public.documentos where id = 'e5e5e5e5-0000-0000-0000-000000000001'),
  array['e1e1e1e1-0000-0000-0000-000000000001', '1.1', 'true'],
  'Quedaron grabados quién, cuándo y de qué versión'
);
select is(
  (select array[estado, revisado_por::text] from public.documentos where id = 'e5e5e5e5-0000-0000-0000-000000000001'),
  array['Pendiente de revisión', null],
  'El visto bueno no cambia el estado ni marca revisor'
);
select is(
  (select array[accion, autor_id::text, estado_anterior, estado_nuevo] from public.historial
   where entidad_id = 'e5e5e5e5-0000-0000-0000-000000000001' and accion = 'Visto bueno del equipo'),
  array['Visto bueno del equipo', 'e1e1e1e1-0000-0000-0000-000000000001', null, null],
  'Quedó en el historial, sin cambio de estado'
);

-- ─── El cliente aún puede aprobar ───────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"e1e1e1e1-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.decidir_documento('e5e5e5e5-0000-0000-0000-000000000001', 'Aprobado', null, null, '1.1') $$,
  'El cliente aprueba un documento que ya tiene visto bueno (no bloquea)'
);
reset role;
select is(
  (select estado from public.documentos where id = 'e5e5e5e5-0000-0000-0000-000000000001'),
  'Aprobado', 'Quedó aprobado'
);

-- ─── Admin de la consultoría ────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"e1e1e1e1-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.dar_visto_bueno_documento('e5e5e5e5-0000-0000-0000-000000000003', '1.0') $$,
  'El admin de la consultoría también da visto bueno'
);
-- No se puede escribir las columnas a mano (solo la RPC).
select throws_ok(
  $$ update public.documentos set visto_bueno_por = null where id = 'e5e5e5e5-0000-0000-0000-000000000003' $$,
  '42501', null, 'Nadie edita el visto bueno por la API directa'
);
reset role;

select * from finish();
rollback;
