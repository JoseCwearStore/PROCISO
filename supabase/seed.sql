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
    ('aaaaaaaa-0000-0000-0000-000000000008'::uuid, 'pedro@norte.test')
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
  ('aaaaaaaa-0000-0000-0000-000000000008', 'Pedro Salinas',    'pedro@norte.test',        'usuario_cliente',   '11111111-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000003', 'Jefe de producción');

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

insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id) values
  ('33333333-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001'),
  ('33333333-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000001');

insert into public.fases (consultoria_id, proyecto_id, nombre, estado, avance, orden)
select '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', f.nombre, f.estado, f.avance, f.orden
from (values
  ('Diagnóstico',               'Completada', 100, 1),
  ('Recopilación de información','Completada', 100, 2),
  ('Análisis de procesos',      'En curso',    40, 3),
  ('Elaboración documental',    'Pendiente',    0, 4),
  ('Revisión y validación',     'Pendiente',    0, 5)
) as f (nombre, estado, avance, orden);

-- ─── Procesos y actividades (Marketino) ─────────────────────────────────────

insert into public.procesos (id, consultoria_id, proyecto_id, responsable_id, nombre, descripcion, estado, objetivo,
                             entradas, salidas, clientes, indicadores, riesgos) values
  ('55555555-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000005', 'Ventas', 'Atención a prospectos y cierre de contratos', 'Documentado',
   'Convertir prospectos en clientes con propuestas claras',
   '{"Solicitud del cliente","Brief de campaña"}', '{"Propuesta comercial","Contrato firmado"}',
   '{"Clientes corporativos"}', '{"Tasa de cierre","Tiempo de respuesta"}', '{"Propuesta con alcance mal definido"}'),
  ('55555555-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000005', 'Compras', 'Adquisición de servicios y licencias', 'En levantamiento',
   'Asegurar proveedores confiables', '{"Requisición"}', '{"Orden de compra"}', '{}', '{"Entregas a tiempo"}', '{}');

insert into public.actividades (consultoria_id, proyecto_id, proceso_id, tipo, descripcion, resultado, orden) values
  ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001', 'Inicio',    'Recibir solicitud del cliente',          'Solicitud registrada', 1),
  ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001', 'Actividad', 'Elaborar propuesta comercial',           'Propuesta',            2),
  ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001', 'Decisión',  '¿El cliente acepta la propuesta?',       'Sí / No',              3),
  ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001', 'Fin',       'Firmar contrato',                        'Contrato firmado',     4);

-- ─── Evidencias (solo metadatos; los archivos llegan con la integración de Storage) ─

insert into public.evidencias (id, consultoria_id, proyecto_id, proceso_id, subido_por, nombre, tipo, estado, descripcion) values
  ('44444444-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001',
   '55555555-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000005', 'Formato de propuesta comercial', 'Documento', 'Revisada', 'Plantilla vigente de propuestas'),
  ('44444444-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001',
   null, 'aaaaaaaa-0000-0000-0000-000000000005', 'Foto del área de trabajo', 'Foto', 'Cargada', 'Oficina principal'),
  ('44444444-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002',
   null, 'aaaaaaaa-0000-0000-0000-000000000006', 'Video del almacén', 'Video', 'Pendiente', 'Recorrido por el almacén'),
  ('44444444-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000003',
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
