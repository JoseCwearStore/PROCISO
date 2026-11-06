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

-- ─── Documentos ─────────────────────────────────────────────────────────────

insert into public.documentos (id, consultoria_id, proyecto_id, proceso_id, nombre, tipo, estado, version, codigo, categoria, creado_por, secciones) values
  ('66666666-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001',
   null, 'Política de calidad', 'Política', 'Pendiente de revisión', '1.0', 'POL-001', 'A', 'aaaaaaaa-0000-0000-0000-000000000003',
   '[{"id":"s1","titulo":"Declaración","tipo":"texto","contenido":"En Marketino nos comprometemos a satisfacer los requisitos de nuestros clientes y a mejorar continuamente."}]'),
  ('66666666-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001',
   '55555555-0000-0000-0000-000000000001', 'Procedimiento de ventas', 'Procedimiento', 'Borrador', '0.1', 'PRO-VEN-001', 'B', 'aaaaaaaa-0000-0000-0000-000000000003',
   '[{"id":"s1","titulo":"Objetivo","tipo":"texto","contenido":"Describir cómo se atienden y cierran las solicitudes de clientes."}]');

insert into public.documento_versiones (consultoria_id, proyecto_id, documento_id, version, autor_id, comentario, estado, secciones)
select consultoria_id, proyecto_id, id, version, creado_por, 'Versión inicial', estado, secciones
from public.documentos;

insert into public.documento_evidencias (documento_id, evidencia_id, proyecto_id, consultoria_id) values
  ('66666666-0000-0000-0000-000000000002', '44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001');

-- ─── Historial ──────────────────────────────────────────────────────────────

insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion, estado_anterior, estado_nuevo) values
  ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'documento', '66666666-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000003', 'Cambio de estado', 'Enviado a revisión', 'Borrador', 'Pendiente de revisión'),
  ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'evidencia', '44444444-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000003', 'Cambio de estado', 'Evidencia revisada', 'Cargada', 'Revisada');
