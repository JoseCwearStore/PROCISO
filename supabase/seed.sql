-- PROCISO · Datos de demostración (solo desarrollo local)
--
-- Se carga con `supabase db reset`. Todos los usuarios usan la contraseña de
-- prueba: Prociso2026!
--
--   admin@prociso.test       Admin PROCISO       (plataforma)
--   ana@cowin.test           Admin Consultoría   COWIN
--   roberto@cowin.test       Consultor           COWIN · asignado a Marketino
--   maria@cowin.test         Consultor           COWIN · asignada a JAZA
--   carlos@marketino.test    Usuario Cliente     Marketino (COWIN)
--   lucia@jaza.test          Usuario Cliente     JAZA (COWIN)
--   laura@consultoria2.test  Admin Consultoría   Consultoría 2
--   pedro@norte.test         Usuario Cliente     Industrias Norte (Consultoría 2)
--   jorge@cowin.test         Consultor           COWIN · sin proyectos asignados
--
-- Puente con src/data/demo.ts: los IDs de demo apuntan a estos UUID
-- (cons-001 → 1111…001, emp-001/002 → 2222…001/002, proy-001/002/003 → 3333…001/002/004,
-- usr-admin/001…006 → aaaa…001/002/003/004/005/006/009).

-- ─── Usuarios de Auth ───────────────────────────────────────────────────────

with u (id, email) as (
  values
    ('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'admin@prociso.test'),
    ('aaaaaaaa-0000-0000-0000-000000000002'::uuid, 'ana@cowin.test'),
    ('aaaaaaaa-0000-0000-0000-000000000003'::uuid, 'roberto@cowin.test'),
    ('aaaaaaaa-0000-0000-0000-000000000004'::uuid, 'maria@cowin.test'),
    ('aaaaaaaa-0000-0000-0000-000000000005'::uuid, 'carlos@marketino.test'),
    ('aaaaaaaa-0000-0000-0000-000000000006'::uuid, 'lucia@jaza.test'),
    ('aaaaaaaa-0000-0000-0000-000000000007'::uuid, 'laura@consultoria2.test'),
    ('aaaaaaaa-0000-0000-0000-000000000008'::uuid, 'pedro@norte.test'),
    ('aaaaaaaa-0000-0000-0000-000000000009'::uuid, 'jorge@cowin.test')
)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('Prociso2026!', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(),
  '', '', '', ''
from u;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text,
       json_build_object('sub', id::text, 'email', email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users
where email like '%.test';

-- ─── Consultorías y empresas ────────────────────────────────────────────────

insert into public.consultorias (id, nombre, rfc, plan, contacto, email, limite_usuarios, almacenamiento_gb) values
  ('11111111-0000-0000-0000-000000000001', 'COWIN Consultores', 'COW180101AB1', 'Profesional', 'Ana García López', 'ana@cowin.test', 20, 50),
  ('11111111-0000-0000-0000-000000000002', 'Consultoría 2',     'CDO190202CD2', 'Básico',      'Laura Méndez',     'laura@consultoria2.test', 5, 10);

insert into public.empresas (id, consultoria_id, nombre, nombre_comercial, rfc, sector, tamano, trabajadores, ciudad, entidad_federativa,
                             contacto_principal, cargo_contacto, email_contacto, telefono_contacto, procesos_principales, alcance_inicial) values
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Marketino S.A. de C.V.', 'Marketino', 'MAR150505EF3',
   'Servicios de marketing', 'Pequeña', '25', 'Guadalajara', 'Jalisco',
   'Carlos Mendoza', 'Director general', 'carlos@marketino.test', '33 1234 5678',
   'Ventas, diseño de campañas, compras', 'Diseño y ejecución de campañas de marketing digital'),
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 'JAZA Comercializadora S.A. de C.V.', 'JAZA', 'JAZ160606GH4',
   'Comercio', 'Mediana', '80', 'Zapopan', 'Jalisco',
   'Lucía Ramírez', 'Gerente de calidad', 'lucia@jaza.test', '33 8765 4321',
   'Compras, almacén, distribución', 'Comercialización y distribución de productos'),
  ('22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000002', 'Industrias Norte S.A. de C.V.', 'Norte', 'INO170707IJ5',
   'Manufactura', 'Mediana', '120', 'Monterrey', 'Nuevo León',
   'Pedro Salinas', 'Jefe de producción', 'pedro@norte.test', '81 5555 0000',
   'Producción, mantenimiento, calidad', 'Fabricación de piezas metálicas');

-- ─── Perfiles ───────────────────────────────────────────────────────────────

insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id, cargo) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Admin PROCISO',    'admin@prociso.test',      'admin_prociso',     null, null, 'Administrador de plataforma'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Ana García López', 'ana@cowin.test',          'admin_consultoria', '11111111-0000-0000-0000-000000000001', null, 'Directora'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Roberto Vázquez',  'roberto@cowin.test',      'consultor',         '11111111-0000-0000-0000-000000000001', null, 'Consultor ISO'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'María Torres',     'maria@cowin.test',        'consultor',         '11111111-0000-0000-0000-000000000001', null, 'Consultora ISO'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Carlos Mendoza',   'carlos@marketino.test',   'usuario_cliente',   '11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'Director general'),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'Lucía Ramírez',    'lucia@jaza.test',         'usuario_cliente',   '11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002', 'Gerente de calidad'),
  ('aaaaaaaa-0000-0000-0000-000000000007', 'Laura Méndez',     'laura@consultoria2.test', 'admin_consultoria', '11111111-0000-0000-0000-000000000002', null, 'Directora'),
  ('aaaaaaaa-0000-0000-0000-000000000008', 'Pedro Salinas',    'pedro@norte.test',        'usuario_cliente',   '11111111-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000003', 'Jefe de producción'),
  ('aaaaaaaa-0000-0000-0000-000000000009', 'Jorge Hernández',  'jorge@cowin.test',        'consultor',         '11111111-0000-0000-0000-000000000001', null, 'Consultor Junior');

update public.empresas set consultor_asignado_id = 'aaaaaaaa-0000-0000-0000-000000000003' where id = '22222222-0000-0000-0000-000000000001';
update public.empresas set consultor_asignado_id = 'aaaaaaaa-0000-0000-0000-000000000004' where id = '22222222-0000-0000-0000-000000000002';

-- ─── Proyectos ──────────────────────────────────────────────────────────────

insert into public.proyectos (id, consultoria_id, empresa_id, consultor_id, nombre, objetivo, estado, avance, fecha_inicio, fecha_fin_estimada, descripcion) values
  ('33333333-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000003', 'Implementación SGC — Marketino',
   'Implementar el Sistema de Gestión de la Calidad conforme a ISO 9001:2026',
   'Análisis de procesos', 45, '2026-09-01', '2027-02-28', 'Proyecto de implementación completo.'),
  ('33333333-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002',
   'aaaaaaaa-0000-0000-0000-000000000004', 'Implementación SGC — JAZA',
   'Documentar los procesos de compras, almacén y distribución',
   'Recopilación de información', 25, '2026-10-01', '2027-03-31', 'Arranque con levantamiento de información.'),
  ('33333333-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000003',
   null, 'Diagnóstico ISO 9001 — Industrias Norte',
   'Diagnóstico inicial del sistema de calidad',
   'Diagnóstico', 10, '2026-10-15', '2027-01-31', 'Diagnóstico inicial.');

-- Proyecto ya cerrado de Marketino (el "proy-003" de demo.ts).
insert into public.proyectos (id, consultoria_id, empresa_id, consultor_id, nombre, objetivo, estado, avance, fecha_inicio, fecha_fin_estimada, fecha_fin_real, descripcion) values
  ('33333333-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000003', 'Revisión y mantenimiento SGC 2025 — Marketino',
   'Revisión anual del SGC y preparación para la auditoría de seguimiento',
   'Finalizado', 100, '2025-01-15', '2025-11-30', '2025-11-20', 'Revisión anual del sistema de gestión.');

insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('33333333-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001'),
  ('33333333-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001'),
  ('33333333-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000001');

-- Las mismas 5 fases que muestra src/data/demo.ts, con el avance de cada proyecto.
insert into public.fases (consultoria_id, proyecto_id, nombre, estado, avance, orden)
select p.consultoria_id, p.id, f.nombre, f.estado, f.avance, f.orden
from (values
  ('33333333-0000-0000-0000-000000000001'::uuid, 'Diagnóstico inicial',           'Completada', 100, 1),
  ('33333333-0000-0000-0000-000000000001'::uuid, 'Levantamiento de procesos',     'Completada', 100, 2),
  ('33333333-0000-0000-0000-000000000001'::uuid, 'Documentación del SGC',         'En curso',    60, 3),
  ('33333333-0000-0000-0000-000000000001'::uuid, 'Implementación y capacitación', 'Pendiente',    0, 4),
  ('33333333-0000-0000-0000-000000000001'::uuid, 'Auditoría interna',             'Pendiente',    0, 5),
  ('33333333-0000-0000-0000-000000000002'::uuid, 'Diagnóstico inicial',           'En curso',    75, 1),
  ('33333333-0000-0000-0000-000000000002'::uuid, 'Levantamiento de procesos',     'Pendiente',    0, 2),
  ('33333333-0000-0000-0000-000000000002'::uuid, 'Documentación del SGC',         'Pendiente',    0, 3),
  ('33333333-0000-0000-0000-000000000002'::uuid, 'Implementación y capacitación', 'Pendiente',    0, 4),
  ('33333333-0000-0000-0000-000000000002'::uuid, 'Auditoría interna',             'Pendiente',    0, 5),
  ('33333333-0000-0000-0000-000000000003'::uuid, 'Diagnóstico inicial',           'En curso',    30, 1),
  ('33333333-0000-0000-0000-000000000003'::uuid, 'Levantamiento de procesos',     'Pendiente',    0, 2),
  ('33333333-0000-0000-0000-000000000003'::uuid, 'Documentación del SGC',         'Pendiente',    0, 3),
  ('33333333-0000-0000-0000-000000000003'::uuid, 'Implementación y capacitación', 'Pendiente',    0, 4),
  ('33333333-0000-0000-0000-000000000003'::uuid, 'Auditoría interna',             'Pendiente',    0, 5),
  ('33333333-0000-0000-0000-000000000004'::uuid, 'Diagnóstico inicial',           'Completada', 100, 1),
  ('33333333-0000-0000-0000-000000000004'::uuid, 'Levantamiento de procesos',     'Completada', 100, 2),
  ('33333333-0000-0000-0000-000000000004'::uuid, 'Documentación del SGC',         'Completada', 100, 3),
  ('33333333-0000-0000-0000-000000000004'::uuid, 'Implementación y capacitación', 'Completada', 100, 4),
  ('33333333-0000-0000-0000-000000000004'::uuid, 'Auditoría interna',             'Completada', 100, 5)
) as f (proyecto_id, nombre, estado, avance, orden)
join public.proyectos p on p.id = f.proyecto_id;

-- ─── Procesos (los mismos 6 de src/data/demo.ts) ─────────────────────────────

-- Generado desde src/data/demo.ts (PROCESOS). proc-00N → 5555…00N.
insert into public.procesos (id, consultoria_id, proyecto_id, responsable_id, nombre, descripcion, estado, fecha_levantamiento,
                             objetivo, alcance, puesto_responsable, personal_involucrado,
                             entradas, salidas, proveedores, clientes, recursos_materiales, equipos, sistemas, controles,
                             registros, indicadores, riesgos, problemas, observaciones, mejoras, no_aplica) values
  ('55555555-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000005', 'Gestión de compras y proveedores', 'Proceso para la selección, evaluación y seguimiento de proveedores.', 'Documentado', '2024-03-20', null, null, null, null, array['Necesidad de compra', 'Catálogo de proveedores aprobados']::text[], array['Orden de compra autorizada', 'Evaluación de proveedor']::text[], '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', null, null, '{}'::jsonb),
  ('55555555-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000005', 'Control de producción', 'Proceso de planificación, control y seguimiento de la producción.', 'Revisado', '2024-04-05', null, null, null, null, array['Plan de producción', 'Materias primas']::text[], array['Producto terminado', 'Registros de producción']::text[], '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', null, null, '{}'::jsonb),
  ('55555555-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000005', 'Atención al cliente y postventa', 'Proceso para la recepción y atención de quejas y reclamaciones de clientes.', 'En levantamiento', '2024-05-18', null, null, null, null, array['Solicitud del cliente']::text[], array['Respuesta al cliente', 'Registro de satisfacción']::text[], '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', null, null, '{}'::jsonb),
  ('55555555-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000005', 'Gestión de recursos humanos', 'Proceso de reclutamiento, selección, capacitación y evaluación del personal.', 'Pendiente', null, null, null, null, null, array['Requerimiento de personal']::text[], array['Personal contratado']::text[], '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', null, null, '{}'::jsonb),
  ('55555555-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000006', 'Recepción y almacenamiento de mercancía', 'Recepción, inspección y almacenamiento de productos.', 'En levantamiento', '2024-09-10', null, null, null, null, array['Guía de remisión']::text[], array['Producto almacenado']::text[], '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', null, null, '{}'::jsonb),
  ('55555555-0000-0000-0000-000000000006', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000006', 'Despacho y entrega a clientes', 'Preparación de pedidos y entrega de mercancía a clientes.', 'Pendiente', null, null, null, null, null, array['Pedido confirmado']::text[], array['Entrega confirmada']::text[], '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', null, null, '{}'::jsonb);

-- ─── Evidencias (las mismas 5 de src/data/demo.ts; los archivos llegan con Storage) ─

-- Generado desde src/data/demo.ts (EVIDENCIAS). evid-00N → 4444…00N.
insert into public.evidencias (id, consultoria_id, proyecto_id, proceso_id, subido_por, nombre, tipo, estado, descripcion, archivo_nombre, creado_en) values
  ('44444444-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000005', 'Formato de evaluación de proveedores', 'Formulario', 'Revisada', 'Formato actual para evaluar y dar seguimiento a proveedores.', 'evaluacion_proveedores_v2.xlsx', '2024-03-22 12:00:00-06'),
  ('44444444-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000005', 'Fotografías del área de almacén', 'Foto', 'Cargada', 'Fotografías del área de recepción y almacenamiento.', 'fotos_almacen_mar2024.zip', '2024-03-25 12:00:00-06'),
  ('44444444-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000005', 'Video recorrido de planta de producción', 'Video', 'Cargada', 'Recorrido por las líneas de producción principales.', 'recorrido_planta_abr2024.mp4', '2024-04-08 12:00:00-06'),
  ('44444444-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002', '55555555-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000006', 'Formulario de recepción de mercancía', 'Formulario', 'Cargada', 'Formato actual de recepción e inspección de productos.', 'formato_recepcion_actual.pdf', '2024-09-12 12:00:00-06'),
  ('44444444-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000005', 'Audio entrevista con jefe de producción', 'Audio', 'Pendiente', 'Entrevista de levantamiento pendiente de carga.', null, now());

-- Evidencia de Consultoría 2 (fuera del rango del puente 4444…001-005).
insert into public.evidencias (id, consultoria_id, proyecto_id, proceso_id, subido_por, nombre, tipo, estado, descripcion) values
  ('44444444-0000-0000-0000-000000000010', '11111111-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000003',
   null, 'aaaaaaaa-0000-0000-0000-000000000008', 'Audio de entrevista', 'Audio', 'Cargada', 'Entrevista con producción');

-- ─── Documentos (los mismos 5 de src/data/demo.ts, con su historial de versiones) ─

-- Generado desde src/data/demo.ts (DOCUMENTOS). doc-00N → 6666…00N.
insert into public.documentos (id, consultoria_id, proyecto_id, proceso_id, nombre, tipo, estado, version, codigo, categoria,
                               secciones, referencia_normativa, contenido_pendiente, bloqueado,
                               creado_por, revisado_por, aprobado_por, creado_en, actualizado_en) values
  ('66666666-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001', 'Procedimiento de selección y evaluación de proveedores', 'Procedimiento', 'Pendiente de revisión', '1.0', null, null, '[]'::jsonb, 'ISO 9001:2026', false, false, 'aaaaaaaa-0000-0000-0000-000000000003', null, null, '2024-06-01 12:00:00-06', '2024-07-15 12:00:00-06'),
  ('66666666-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000002', 'Procedimiento de control de producción', 'Procedimiento', 'Aprobado', '2.0', null, null, '[]'::jsonb, 'ISO 9001:2026', false, true, 'aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000005', '2024-04-15 12:00:00-06', '2024-05-30 12:00:00-06'),
  ('66666666-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000002', 'Instrucción de trabajo: Calibración de equipos', 'Instrucción de trabajo', 'En elaboración', '0.5', null, null, '[]'::jsonb, 'ISO 9001:2026', true, false, 'aaaaaaaa-0000-0000-0000-000000000003', null, null, '2024-07-20 12:00:00-06', '2024-07-20 12:00:00-06'),
  ('66666666-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000003', 'Procedimiento de atención a quejas y reclamaciones', 'Procedimiento', 'Borrador', '0.1', null, null, '[]'::jsonb, 'ISO 9001:2026', true, false, 'aaaaaaaa-0000-0000-0000-000000000003', null, null, '2024-08-01 12:00:00-06', '2024-08-01 12:00:00-06'),
  ('66666666-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', null, 'Manual de calidad', 'Manual', 'En corrección', '1.1', null, null, '[]'::jsonb, 'ISO 9001:2026', false, false, 'aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', null, '2024-05-01 12:00:00-06', '2024-08-10 12:00:00-06');

insert into public.documento_versiones (consultoria_id, proyecto_id, documento_id, version, autor_id, comentario, motivo, secciones, estado, creado_en) values
  ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', '66666666-0000-0000-0000-000000000001', '0.9', 'aaaaaaaa-0000-0000-0000-000000000003', 'Borrador inicial', null, '[]'::jsonb, null, '2024-06-01 12:00:00-06'),
  ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', '66666666-0000-0000-0000-000000000001', '1.0', 'aaaaaaaa-0000-0000-0000-000000000003', 'Incorporación de comentarios del cliente', null, '[]'::jsonb, null, '2024-07-15 12:00:00-06'),
  ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', '66666666-0000-0000-0000-000000000002', '1.0', 'aaaaaaaa-0000-0000-0000-000000000003', 'Borrador inicial', null, '[]'::jsonb, null, '2024-04-15 12:00:00-06'),
  ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', '66666666-0000-0000-0000-000000000002', '1.1', 'aaaaaaaa-0000-0000-0000-000000000003', 'Correcciones post-revisión', null, '[]'::jsonb, null, '2024-05-05 12:00:00-06'),
  ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', '66666666-0000-0000-0000-000000000002', '2.0', 'aaaaaaaa-0000-0000-0000-000000000003', 'Versión final aprobada', null, '[]'::jsonb, null, '2024-05-30 12:00:00-06'),
  ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', '66666666-0000-0000-0000-000000000003', '0.5', 'aaaaaaaa-0000-0000-0000-000000000003', 'Borrador en elaboración', null, '[]'::jsonb, null, '2024-07-20 12:00:00-06'),
  ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', '66666666-0000-0000-0000-000000000004', '0.1', 'aaaaaaaa-0000-0000-0000-000000000003', 'Primer borrador', null, '[]'::jsonb, null, '2024-08-01 12:00:00-06'),
  ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', '66666666-0000-0000-0000-000000000005', '1.0', 'aaaaaaaa-0000-0000-0000-000000000003', 'Primera versión', null, '[]'::jsonb, null, '2024-05-01 12:00:00-06'),
  ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', '66666666-0000-0000-0000-000000000005', '1.1', 'aaaaaaaa-0000-0000-0000-000000000003', 'En corrección por observaciones', null, '[]'::jsonb, null, '2024-08-10 12:00:00-06');

-- Código y contenido de demostración (el demo original no los traía): sin secciones
-- no se puede anclar un comentario de revisión.
update public.documentos d set codigo = c.codigo, secciones = c.secciones
from (values
  ('66666666-0000-0000-0000-000000000001'::uuid, 'PRO-COM-001', '[
    {"id":"s1","titulo":"Objetivo","tipo":"texto","contenido":"Establecer los criterios para seleccionar, evaluar y reevaluar a los proveedores que impactan la calidad del servicio."},
    {"id":"s2","titulo":"Alcance","tipo":"texto","contenido":"Aplica a todos los proveedores de servicios y licencias de Marketino."},
    {"id":"s3","titulo":"Criterios de evaluación","tipo":"tabla","filas":[["Criterio","Peso"],["Calidad","40 %"],["Tiempo de entrega","30 %"],["Precio","30 %"]]}
  ]'::jsonb),
  ('66666666-0000-0000-0000-000000000002'::uuid, 'PRO-PRD-001', '[
    {"id":"s1","titulo":"Objetivo","tipo":"texto","contenido":"Planificar y controlar la producción de campañas para cumplir los requisitos del cliente."},
    {"id":"s2","titulo":"Responsabilidades","tipo":"texto","contenido":"El jefe de producción aprueba el plan semanal; los ejecutivos registran el avance diario."}
  ]'::jsonb),
  ('66666666-0000-0000-0000-000000000003'::uuid, 'IT-PRD-001', '[
    {"id":"s1","titulo":"Propósito","tipo":"texto","contenido":"Describir la calibración de los equipos de medición utilizados en producción."}
  ]'::jsonb),
  ('66666666-0000-0000-0000-000000000004'::uuid, 'PRO-ATC-001', '[
    {"id":"s1","titulo":"Objetivo","tipo":"texto","contenido":"Atender y resolver las quejas de los clientes en un plazo máximo de cinco días hábiles."}
  ]'::jsonb),
  ('66666666-0000-0000-0000-000000000005'::uuid, 'MAN-SGC-001', '[
    {"id":"s1","titulo":"Política de calidad","tipo":"texto","contenido":"Marketino se compromete a cumplir los requisitos de sus clientes y a mejorar continuamente su sistema de gestión."},
    {"id":"s2","titulo":"Alcance del SGC","tipo":"texto","contenido":"Diseño y ejecución de campañas de marketing digital."}
  ]'::jsonb)
) as c (id, codigo, secciones)
where d.id = c.id;

insert into public.documento_evidencias (documento_id, evidencia_id, proyecto_id, consultoria_id) values
  ('66666666-0000-0000-0000-000000000002', '44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001');

-- ─── Historial ──────────────────────────────────────────────────────────────

insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion, estado_anterior, estado_nuevo) values
  ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'documento', '66666666-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000003', 'Cambio de estado', 'Enviado a revisión', 'Borrador', 'Pendiente de revisión'),
  ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'evidencia', '44444444-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000003', 'Cambio de estado', 'Evidencia revisada', 'Cargada', 'Revisada');


-- ════════════════════════════════════════════════════════════════════════════
-- Tareas
-- ════════════════════════════════════════════════════════════════════════════
-- Generado desde src/data/demo.ts (TAREAS) con herramientas/generar_seed_tareas.mts. tar-00N → 7777…00N.
-- Fechas relativas a current_date (ancla del demo: 10/09/2024).
insert into public.tareas (id, consultoria_id, proyecto_id, titulo, descripcion, asignado_a, asignado_por, estado, prioridad, fecha_vencimiento, fecha_completada, dependencias) values
  ('77777777-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'Redactar procedimiento de gestión de compras', 'Elaborar el procedimiento documentado para el proceso de compras.', 'aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', 'En proceso', 'Alta', current_date + 5, null, array['77777777-0000-0000-0000-000000000006']::uuid[]),
  ('77777777-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'Reunión de revisión con cliente - Manufact. Norte', 'Revisión de avances del proyecto y alineación con equipo directivo del cliente.', 'aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', 'Pendiente', 'Alta', current_date + -10, null, array[]::uuid[]),
  ('77777777-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'Levantar proceso de atención al cliente', 'Agendar y realizar sesiones de entrevistas con el equipo de servicio al cliente.', 'aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', 'En revisión', 'Media', current_date + 20, null, array[]::uuid[]),
  ('77777777-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'Revisar y aprobar manual de calidad v1.1', 'Revisión del manual de calidad por parte de la dirección.', 'aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'Pendiente', 'Alta', current_date + 10, null, array[]::uuid[]),
  ('77777777-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'Cargar evidencias de proceso de compras', 'Solicitar y cargar evidencias documentales del proceso actual.', 'aaaaaaaa-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000003', 'Completada', 'Media', current_date + -164, current_date + -166, array[]::uuid[]),
  ('77777777-0000-0000-0000-000000000006', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'Entrevista con jefe de producción', 'Levantamiento del proceso de control de producción.', 'aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', 'Completada', 'Alta', current_date + -153, current_date + -154, array[]::uuid[]),
  ('77777777-0000-0000-0000-000000000007', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'Elaborar IT: calibración de equipos', 'Redactar instrucción de trabajo para la calibración de equipos de medición.', 'aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', 'En proceso', 'Media', current_date + 25, null, array['77777777-0000-0000-0000-000000000006']::uuid[]),
  ('77777777-0000-0000-0000-000000000008', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'Capacitación en SGC al personal operativo', 'Sesión de sensibilización e inducción al SGC para el personal.', 'aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', 'Pendiente', 'Baja', current_date + 51, null, array[]::uuid[]),
  ('77777777-0000-0000-0000-000000000009', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002', 'Diagnóstico inicial - Distribuidora Altiplano', 'Aplicar cuestionario de diagnóstico GAP con la alta dirección.', 'aaaaaaaa-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000002', 'En proceso', 'Alta', current_date + 5, null, array[]::uuid[]),
  ('77777777-0000-0000-0000-000000000010', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002', 'Reunión de arranque con Distribuidora Altiplano', 'Presentación del proyecto, objetivos y plan de trabajo.', 'aaaaaaaa-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000002', 'Completada', 'Alta', current_date + -36, current_date + -36, array[]::uuid[]),
  ('77777777-0000-0000-0000-000000000011', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002', 'Enviar contrato de servicios al cliente', 'Gestionar firma del contrato de servicios de consultoría.', 'aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'Completada', 'Alta', current_date + -44, current_date + -46, array[]::uuid[]),
  ('77777777-0000-0000-0000-000000000012', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002', 'Definir alcance del SGC con la dirección', 'Determinar el alcance del sistema de gestión con el cliente.', 'aaaaaaaa-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000002', 'Pendiente', 'Alta', current_date + 20, null, array['77777777-0000-0000-0000-000000000009']::uuid[]),
  ('77777777-0000-0000-0000-000000000013', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002', 'Levantar proceso de recepción de mercancía', 'Entrevistas y observación del proceso de recepción en bodega.', 'aaaaaaaa-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000002', 'Pendiente', 'Media', current_date + 51, null, array[]::uuid[]),
  ('77777777-0000-0000-0000-000000000014', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002', 'Elaborar informe de diagnóstico inicial', 'Informe con hallazgos del diagnóstico GAP y recomendaciones.', 'aaaaaaaa-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000002', 'Requiere corrección', 'Alta', current_date + 20, null, array['77777777-0000-0000-0000-000000000009']::uuid[]),
  ('77777777-0000-0000-0000-000000000015', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'Auditoría interna - revisión documental', 'Revisión de la documentación del SGC previa a auditoría de certificación.', 'aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', 'Pendiente', 'Alta', current_date + 66, null, array[]::uuid[]),
  ('77777777-0000-0000-0000-000000000016', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'Elaborar formato de registro de no conformidades', 'Crear el formato oficial para el registro y seguimiento de NC.', 'aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', 'Pendiente', 'Media', current_date + -26, null, array[]::uuid[]),
  ('77777777-0000-0000-0000-000000000017', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'Revisión de listas de verificación', 'Validar que las listas de verificación cubren todos los requisitos.', 'aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'Pendiente', 'Media', current_date + 30, null, array[]::uuid[]),
  ('77777777-0000-0000-0000-000000000018', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'Actualizar matriz de riesgos y oportunidades', 'Revisar y actualizar la matriz de riesgos con el equipo del cliente.', 'aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', 'En proceso', 'Media', current_date + 15, null, array[]::uuid[]),
  ('77777777-0000-0000-0000-000000000019', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002', 'Recopilar expedientes de personal capacitado', 'Recopilar evidencias de capacitaciones previas del personal.', 'aaaaaaaa-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000004', 'Pendiente', 'Baja', current_date + 51, null, array[]::uuid[]),
  ('77777777-0000-0000-0000-000000000020', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'Presentar informe de avance mensual', 'Informe de avance del mes al equipo directivo.', 'aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', 'En revisión', 'Media', current_date + 25, null, array[]::uuid[]);

insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion, estado_anterior, estado_nuevo, creado_en) values
  ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'tarea', '77777777-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', 'Cambio de estado', null, 'En proceso', 'En revisión', now() - interval '0 days' - interval '498 minutes'),
  ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'tarea', '77777777-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000005', 'Cambio de estado', null, 'En proceso', 'Completada', now() - interval '166 days' - interval '497 minutes'),
  ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'tarea', '77777777-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000003', 'Cambio de estado', null, 'En proceso', 'Completada', now() - interval '154 days' - interval '496 minutes'),
  ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002', 'tarea', '77777777-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000004', 'Cambio de estado', null, 'En proceso', 'Completada', now() - interval '36 days' - interval '494 minutes'),
  ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002', 'tarea', '77777777-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000002', 'Cambio de estado', null, 'En proceso', 'Completada', now() - interval '46 days' - interval '493 minutes'),
  ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002', 'tarea', '77777777-0000-0000-0000-000000000014', 'aaaaaaaa-0000-0000-0000-000000000004', 'Cambio de estado', null, 'En proceso', 'En revisión', now() - interval '0 days' - interval '492 minutes'),
  ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002', 'tarea', '77777777-0000-0000-0000-000000000014', 'aaaaaaaa-0000-0000-0000-000000000002', 'Cambio de estado', null, 'En revisión', 'Requiere corrección', now() - interval '0 days' - interval '491 minutes'),
  ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'tarea', '77777777-0000-0000-0000-000000000020', 'aaaaaaaa-0000-0000-0000-000000000003', 'Cambio de estado', null, 'En proceso', 'En revisión', now() - interval '0 days' - interval '489 minutes');

insert into public.comentarios (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, texto, creado_en) values
  ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'tarea', '77777777-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 'Prioridad alta, necesario para completar la fase 3.', now() - interval '5 days' - interval '499 minutes'),
  ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002', 'tarea', '77777777-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000004', 'Primera sesión realizada el 08/09. Pendiente segunda sesión.', now() - interval '0 days' - interval '495 minutes'),
  ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002', 'tarea', '77777777-0000-0000-0000-000000000014', 'aaaaaaaa-0000-0000-0000-000000000002', 'Favor de agregar la sección de brechas identificadas vs requisitos de la norma.', now() - interval '0 days' - interval '490 minutes');
