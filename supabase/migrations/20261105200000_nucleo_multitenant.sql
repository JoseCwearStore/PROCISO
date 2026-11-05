-- PROCISO · Núcleo multi-tenant
--
-- Jerarquía: plataforma → consultorías → empresas → proyectos → (procesos, evidencias, documentos…)
--
-- Reglas de diseño:
--   * Cada tabla con datos de un cliente lleva consultoria_id. Las FK compuestas
--     (hijo.x_id, hijo.consultoria_id) → padre(id, consultoria_id) impiden mezclar
--     datos de consultorías distintas, y permiten que el RLS sea de una línea.
--   * Las relaciones se guardan solo del lado del hijo (nada de arrays de IDs).
--   * Estados con text + CHECK (más fáciles de migrar que un ENUM).
--   * Las funciones auxiliares del RLS viven en el esquema private (no expuesto por la API).

create schema if not exists private;

-- ════════════════════════════════════════════════════════════════════════════
-- Tablas
-- ════════════════════════════════════════════════════════════════════════════

create table public.consultorias (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null,
  rfc                text,
  plan               text not null default 'Básico',
  activa             boolean not null default true,
  contacto           text,
  email              text,
  limite_usuarios    integer,
  almacenamiento_gb  integer,
  renovacion         date,
  creado_en          timestamptz not null default now()
);

create table public.empresas (
  id                    uuid primary key default gen_random_uuid(),
  consultoria_id        uuid not null references public.consultorias (id) on delete cascade,
  nombre                text not null,
  nombre_comercial      text,
  rfc                   text,
  sector                text,
  tamano                text,
  trabajadores          text,
  ciudad                text,
  entidad_federativa    text,
  direccion             text,
  contacto_principal    text,
  cargo_contacto        text,
  email_contacto        text,
  telefono_contacto     text,
  procesos_principales  text,
  alcance_inicial       text,
  norma_interes         text not null default 'ISO 9001:2026'
                        check (norma_interes in ('ISO 9001:2026', 'ISO 9001:2015')),
  consultor_asignado_id uuid,
  observaciones         text,
  activa                boolean not null default true,
  creado_en             timestamptz not null default now(),
  unique (id, consultoria_id)
);

create table public.perfiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  nombre             text not null,
  email              text not null,
  rol                text not null
                     check (rol in ('admin_prociso', 'admin_consultoria', 'consultor', 'usuario_cliente')),
  consultoria_id     uuid references public.consultorias (id) on delete cascade,
  empresa_id         uuid,
  cargo              text,
  activo             boolean not null default true,
  password_temporal  boolean not null default false,
  creado_en          timestamptz not null default now(),
  unique (id, consultoria_id),
  foreign key (empresa_id, consultoria_id) references public.empresas (id, consultoria_id) on delete cascade,
  -- Cada rol vive en su nivel de la jerarquía.
  constraint perfiles_nivel_por_rol check (
       (rol = 'admin_prociso' and consultoria_id is null and empresa_id is null)
    or (rol in ('admin_consultoria', 'consultor') and consultoria_id is not null and empresa_id is null)
    or (rol = 'usuario_cliente' and consultoria_id is not null and empresa_id is not null)
  )
);

alter table public.empresas
  add constraint empresas_consultor_asignado_fk
  foreign key (consultor_asignado_id, consultoria_id)
  references public.perfiles (id, consultoria_id) on delete set null (consultor_asignado_id);

create table public.proyectos (
  id                  uuid primary key default gen_random_uuid(),
  consultoria_id      uuid not null,
  empresa_id          uuid not null,
  consultor_id        uuid,
  nombre              text not null,
  objetivo            text,
  alcance             text,
  descripcion         text,
  estado              text not null default 'Planificación'
                      check (estado in ('Planificación', 'Diagnóstico', 'Recopilación de información',
                                        'Análisis de procesos', 'Elaboración documental', 'Revisión',
                                        'Correcciones', 'Validación', 'Finalizado', 'Suspendido')),
  avance              integer not null default 0 check (avance between 0 and 100),
  edicion_norma       text not null default 'ISO 9001:2026'
                      check (edicion_norma in ('ISO 9001:2026', 'ISO 9001:2015')),
  fecha_inicio        date,
  fecha_fin_estimada  date,
  fecha_fin_real      date,
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),
  unique (id, consultoria_id),
  foreign key (empresa_id, consultoria_id) references public.empresas (id, consultoria_id) on delete cascade,
  foreign key (consultor_id, consultoria_id) references public.perfiles (id, consultoria_id) on delete set null (consultor_id)
);

-- Proyectos "autorizados": un consultor solo ve los proyectos donde es miembro.
create table public.proyecto_miembros (
  proyecto_id     uuid not null,
  usuario_id      uuid not null,
  consultoria_id  uuid not null,
  creado_en       timestamptz not null default now(),
  primary key (proyecto_id, usuario_id),
  foreign key (proyecto_id, consultoria_id) references public.proyectos (id, consultoria_id) on delete cascade,
  foreign key (usuario_id, consultoria_id) references public.perfiles (id, consultoria_id) on delete cascade
);

create table public.fases (
  id              uuid primary key default gen_random_uuid(),
  consultoria_id  uuid not null,
  proyecto_id     uuid not null,
  nombre          text not null,
  estado          text not null default 'Pendiente' check (estado in ('Completada', 'En curso', 'Pendiente')),
  avance          integer not null default 0 check (avance between 0 and 100),
  orden           integer not null,
  foreign key (proyecto_id, consultoria_id) references public.proyectos (id, consultoria_id) on delete cascade
);

create table public.procesos (
  id                    uuid primary key default gen_random_uuid(),
  consultoria_id        uuid not null,
  proyecto_id           uuid not null,
  responsable_id        uuid references public.perfiles (id) on delete set null,
  nombre                text not null,
  descripcion           text,
  estado                text not null default 'Pendiente'
                        check (estado in ('Pendiente', 'En levantamiento', 'Documentado', 'Revisado', 'Aprobado')),
  fecha_levantamiento   date,
  objetivo              text,
  alcance               text,
  puesto_responsable    text,
  personal_involucrado  text,
  -- Ficha del proceso: listas simples, sin tabla propia.
  entradas              text[] not null default '{}',
  salidas               text[] not null default '{}',
  proveedores           text[] not null default '{}',
  clientes              text[] not null default '{}',
  recursos_materiales   text[] not null default '{}',
  equipos               text[] not null default '{}',
  sistemas              text[] not null default '{}',
  controles             text[] not null default '{}',
  registros             text[] not null default '{}',
  indicadores           text[] not null default '{}',
  riesgos               text[] not null default '{}',
  problemas             text[] not null default '{}',
  observaciones         text,
  mejoras               text,
  no_aplica             jsonb not null default '{}',
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now(),
  unique (id, proyecto_id, consultoria_id),
  foreign key (proyecto_id, consultoria_id) references public.proyectos (id, consultoria_id) on delete cascade
);

create table public.actividades (
  id              uuid primary key default gen_random_uuid(),
  consultoria_id  uuid not null,
  proyecto_id     uuid not null,
  proceso_id      uuid not null,
  responsable_id  uuid references public.perfiles (id) on delete set null,
  tipo            text not null default 'Actividad' check (tipo in ('Inicio', 'Actividad', 'Decisión', 'Fin')),
  descripcion     text not null,
  entradas        text,
  recursos        text,
  controles       text,
  resultado       text,
  orden           integer not null,
  foreign key (proceso_id, proyecto_id, consultoria_id)
    references public.procesos (id, proyecto_id, consultoria_id) on delete cascade
);

create table public.evidencias (
  id              uuid primary key default gen_random_uuid(),
  consultoria_id  uuid not null,
  proyecto_id     uuid not null,
  proceso_id      uuid,
  actividad_id    uuid references public.actividades (id) on delete set null,
  subido_por      uuid default auth.uid() references public.perfiles (id) on delete set null,
  nombre          text not null,
  tipo            text not null check (tipo in ('Foto', 'Video', 'Audio', 'Documento', 'Formulario')),
  estado          text not null default 'Pendiente'
                  check (estado in ('Pendiente', 'Cargada', 'Revisada', 'Aceptada', 'Requiere corrección')),
  descripcion     text,
  categoria       text,
  -- Ruta en Storage: {consultoria_id}/{empresa_id}/{proyecto_id}/{uuid}.{ext}
  archivo_ruta    text,
  archivo_nombre  text,
  archivo_mime    text,
  archivo_tamano  bigint,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  unique (id, proyecto_id, consultoria_id),
  foreign key (proyecto_id, consultoria_id) references public.proyectos (id, consultoria_id) on delete cascade,
  foreign key (proceso_id, proyecto_id, consultoria_id)
    references public.procesos (id, proyecto_id, consultoria_id) on delete set null (proceso_id)
);

create table public.documentos (
  id                    uuid primary key default gen_random_uuid(),
  consultoria_id        uuid not null,
  proyecto_id           uuid not null,
  proceso_id            uuid,
  nombre                text not null,
  tipo                  text not null
                        check (tipo in ('Procedimiento', 'Manual', 'Instrucción de trabajo', 'Ficha de proceso',
                                        'Formato', 'Lista de verificación', 'Matriz', 'Plan', 'Registro', 'Política')),
  estado                text not null default 'Borrador'
                        check (estado in ('Borrador', 'En elaboración', 'Pendiente de revisión', 'En corrección',
                                          'Aprobado', 'Rechazado', 'Obsoleto')),
  version               text not null default '0.1',
  codigo                text,
  categoria             text check (categoria in ('A', 'B', 'C')),
  plantilla             text,
  secciones             jsonb not null default '[]',
  referencia_normativa  text not null default 'ISO 9001:2026'
                        check (referencia_normativa in ('ISO 9001:2026', 'ISO 9001:2015')),
  motivo_cambio         text,
  bloqueado             boolean not null default false,
  contenido_pendiente   boolean not null default false,
  creado_por            uuid default auth.uid() references public.perfiles (id) on delete set null,
  revisado_por          uuid references public.perfiles (id) on delete set null,
  aprobado_por          uuid references public.perfiles (id) on delete set null,
  fecha_revision        timestamptz,
  fecha_aprobacion      timestamptz,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now(),
  unique (id, proyecto_id, consultoria_id),
  foreign key (proyecto_id, consultoria_id) references public.proyectos (id, consultoria_id) on delete cascade,
  foreign key (proceso_id, proyecto_id, consultoria_id)
    references public.procesos (id, proyecto_id, consultoria_id) on delete set null (proceso_id)
);

create table public.documento_versiones (
  id              uuid primary key default gen_random_uuid(),
  consultoria_id  uuid not null,
  proyecto_id     uuid not null,
  documento_id    uuid not null,
  version         text not null,
  autor_id        uuid default auth.uid() references public.perfiles (id) on delete set null,
  comentario      text,
  motivo          text,
  secciones       jsonb not null default '[]',
  estado          text,
  creado_en       timestamptz not null default now(),
  foreign key (documento_id, proyecto_id, consultoria_id)
    references public.documentos (id, proyecto_id, consultoria_id) on delete cascade
);

create table public.documento_evidencias (
  documento_id    uuid not null,
  evidencia_id    uuid not null,
  proyecto_id     uuid not null,
  consultoria_id  uuid not null,
  primary key (documento_id, evidencia_id),
  foreign key (documento_id, proyecto_id, consultoria_id)
    references public.documentos (id, proyecto_id, consultoria_id) on delete cascade,
  foreign key (evidencia_id, proyecto_id, consultoria_id)
    references public.evidencias (id, proyecto_id, consultoria_id) on delete cascade
);

-- Auditoría: solo se agregan filas, nunca se editan ni se borran.
create table public.historial (
  id               bigint generated always as identity primary key,
  consultoria_id   uuid not null references public.consultorias (id) on delete cascade,
  proyecto_id      uuid,
  entidad_tipo     text not null
                   check (entidad_tipo in ('consultoria', 'empresa', 'proyecto', 'proceso', 'evidencia', 'documento', 'usuario')),
  entidad_id       uuid not null,
  autor_id         uuid default auth.uid() references public.perfiles (id) on delete set null,
  accion           text not null,
  descripcion      text,
  estado_anterior  text,
  estado_nuevo     text,
  creado_en        timestamptz not null default now(),
  foreign key (proyecto_id, consultoria_id) references public.proyectos (id, consultoria_id) on delete cascade
);

-- ════════════════════════════════════════════════════════════════════════════
-- Índices (Postgres no indexa las FK automáticamente)
-- ════════════════════════════════════════════════════════════════════════════

create index on public.empresas (consultoria_id);
create index on public.perfiles (consultoria_id);
create index on public.perfiles (empresa_id);
create index on public.proyectos (consultoria_id);
create index on public.proyectos (empresa_id);
create index on public.proyecto_miembros (usuario_id);
create index on public.fases (proyecto_id);
create index on public.procesos (proyecto_id);
create index on public.actividades (proceso_id);
create index on public.evidencias (proyecto_id);
create index on public.evidencias (proceso_id);
create index on public.documentos (proyecto_id);
create index on public.documento_versiones (documento_id);
create index on public.historial (proyecto_id);
create index on public.historial (entidad_tipo, entidad_id);

-- ════════════════════════════════════════════════════════════════════════════
-- actualizado_en automático
-- ════════════════════════════════════════════════════════════════════════════

create function private.tocar_actualizado_en() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

create trigger tocar_actualizado_en before update on public.proyectos
  for each row execute function private.tocar_actualizado_en();
create trigger tocar_actualizado_en before update on public.procesos
  for each row execute function private.tocar_actualizado_en();
create trigger tocar_actualizado_en before update on public.evidencias
  for each row execute function private.tocar_actualizado_en();
create trigger tocar_actualizado_en before update on public.documentos
  for each row execute function private.tocar_actualizado_en();

-- ════════════════════════════════════════════════════════════════════════════
-- Funciones auxiliares del RLS
--
-- SECURITY DEFINER: leen perfiles/proyectos sin pasar por el RLS, lo que evita
-- recursión (una política de perfiles que consulta perfiles) y mantiene las
-- políticas cortas.
-- ════════════════════════════════════════════════════════════════════════════

create function private.mi_rol() returns text
language sql stable security definer set search_path = '' as $$
  select rol from public.perfiles where id = auth.uid() and activo
$$;

create function private.mi_consultoria_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select consultoria_id from public.perfiles where id = auth.uid() and activo
$$;

create function private.mi_empresa_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select empresa_id from public.perfiles where id = auth.uid() and activo
$$;

create function private.es_admin_prociso() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.mi_rol() = 'admin_prociso', false)
$$;

create function private.es_admin_de(p_consultoria_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and activo
      and rol = 'admin_consultoria' and consultoria_id = p_consultoria_id
  )
$$;

create function private.es_equipo_de(p_consultoria_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and activo
      and rol in ('admin_consultoria', 'consultor') and consultoria_id = p_consultoria_id
  )
$$;

create function private.puede_ver_proyecto(p_proyecto_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.proyectos p
    join public.perfiles yo on yo.id = auth.uid() and yo.activo
    where p.id = p_proyecto_id
      and (
           yo.rol = 'admin_prociso'
        or (yo.rol = 'admin_consultoria' and p.consultoria_id = yo.consultoria_id)
        or (yo.rol = 'consultor' and exists (
              select 1 from public.proyecto_miembros m
              where m.proyecto_id = p.id and m.usuario_id = yo.id))
        or (yo.rol = 'usuario_cliente' and p.empresa_id = yo.empresa_id)
      )
  )
$$;

-- Igual que puede_ver_proyecto, pero el cliente solo lee.
create function private.puede_editar_proyecto(p_proyecto_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.proyectos p
    join public.perfiles yo on yo.id = auth.uid() and yo.activo
    where p.id = p_proyecto_id
      and (
           yo.rol = 'admin_prociso'
        or (yo.rol = 'admin_consultoria' and p.consultoria_id = yo.consultoria_id)
        or (yo.rol = 'consultor' and exists (
              select 1 from public.proyecto_miembros m
              where m.proyecto_id = p.id and m.usuario_id = yo.id))
      )
  )
$$;

revoke all on all functions in schema private from public, anon;
grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- Row Level Security
-- ════════════════════════════════════════════════════════════════════════════

alter table public.consultorias        enable row level security;
alter table public.empresas            enable row level security;
alter table public.perfiles            enable row level security;
alter table public.proyectos           enable row level security;
alter table public.proyecto_miembros   enable row level security;
alter table public.fases               enable row level security;
alter table public.procesos            enable row level security;
alter table public.actividades         enable row level security;
alter table public.evidencias          enable row level security;
alter table public.documentos          enable row level security;
alter table public.documento_versiones enable row level security;
alter table public.documento_evidencias enable row level security;
alter table public.historial           enable row level security;

-- ─── consultorias ───────────────────────────────────────────────────────────

create policy "ver su consultoría" on public.consultorias for select to authenticated
  using ((select private.es_admin_prociso()) or id = (select private.mi_consultoria_id()));

create policy "admin plataforma crea consultorías" on public.consultorias for insert to authenticated
  with check ((select private.es_admin_prociso()));

create policy "admins editan su consultoría" on public.consultorias for update to authenticated
  using ((select private.es_admin_prociso()) or private.es_admin_de(id))
  with check ((select private.es_admin_prociso()) or private.es_admin_de(id));

create policy "admin plataforma borra consultorías" on public.consultorias for delete to authenticated
  using ((select private.es_admin_prociso()));

-- ─── perfiles ───────────────────────────────────────────────────────────────
-- El equipo de la consultoría ve a todos sus perfiles. El cliente ve al equipo
-- y a los usuarios de su propia empresa, pero no a los de otras empresas.

create policy "ver perfiles" on public.perfiles for select to authenticated
  using (
       id = (select auth.uid())
    or (select private.es_admin_prociso())
    or (
      consultoria_id = (select private.mi_consultoria_id())
      and (
           (select private.mi_rol()) in ('admin_consultoria', 'consultor')
        or empresa_id is null
        or empresa_id = (select private.mi_empresa_id())
      )
    )
  );

-- Cada uno edita su propio perfil. Los permisos de columna (abajo) limitan
-- qué columnas: nadie puede cambiarse el rol ni la consultoría.
create policy "editar mi perfil" on public.perfiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Alta y baja de usuarios: desde una función del servidor (service role), no desde el navegador.

revoke insert, update, delete on public.perfiles from anon, authenticated;
grant update (nombre, cargo) on public.perfiles to authenticated;

-- ─── empresas ───────────────────────────────────────────────────────────────

create policy "ver empresas" on public.empresas for select to authenticated
  using (
       (select private.es_admin_prociso())
    or private.es_admin_de(consultoria_id)
    or consultor_asignado_id = (select auth.uid())
    or id = (select private.mi_empresa_id())
    or exists (
      select 1 from public.proyectos p
      join public.proyecto_miembros m on m.proyecto_id = p.id
      where p.empresa_id = empresas.id and m.usuario_id = (select auth.uid())
    )
  );

create policy "admins gestionan empresas" on public.empresas for all to authenticated
  using ((select private.es_admin_prociso()) or private.es_admin_de(consultoria_id))
  with check ((select private.es_admin_prociso()) or private.es_admin_de(consultoria_id));

-- ─── proyectos ──────────────────────────────────────────────────────────────

create policy "ver proyectos" on public.proyectos for select to authenticated
  using (private.puede_ver_proyecto(id));

create policy "admins crean proyectos" on public.proyectos for insert to authenticated
  with check ((select private.es_admin_prociso()) or private.es_admin_de(consultoria_id));

create policy "equipo edita proyectos" on public.proyectos for update to authenticated
  using (private.puede_editar_proyecto(id))
  with check (private.puede_editar_proyecto(id));

create policy "admins borran proyectos" on public.proyectos for delete to authenticated
  using ((select private.es_admin_prociso()) or private.es_admin_de(consultoria_id));

-- ─── proyecto_miembros ──────────────────────────────────────────────────────

create policy "ver miembros" on public.proyecto_miembros for select to authenticated
  using (private.puede_ver_proyecto(proyecto_id));

create policy "admins asignan miembros" on public.proyecto_miembros for insert to authenticated
  with check ((select private.es_admin_prociso()) or private.es_admin_de(consultoria_id));

create policy "admins quitan miembros" on public.proyecto_miembros for delete to authenticated
  using ((select private.es_admin_prociso()) or private.es_admin_de(consultoria_id));

-- ─── Hijos del proyecto: se ven si se ve el proyecto, se editan si se edita ─

do $$
declare
  t text;
begin
  foreach t in array array['fases', 'procesos', 'actividades', 'documentos', 'documento_versiones', 'documento_evidencias']
  loop
    execute format(
      'create policy "ver" on public.%I for select to authenticated
         using (private.puede_ver_proyecto(proyecto_id))', t);
    execute format(
      'create policy "equipo crea" on public.%I for insert to authenticated
         with check (private.puede_editar_proyecto(proyecto_id))', t);
    execute format(
      'create policy "equipo edita" on public.%I for update to authenticated
         using (private.puede_editar_proyecto(proyecto_id))
         with check (private.puede_editar_proyecto(proyecto_id))', t);
    execute format(
      'create policy "admins borran" on public.%I for delete to authenticated
         using ((select private.es_admin_prociso()) or private.es_admin_de(consultoria_id))', t);
  end loop;
end;
$$;

-- ─── evidencias: el cliente también puede cargar ────────────────────────────

create policy "ver evidencias" on public.evidencias for select to authenticated
  using (private.puede_ver_proyecto(proyecto_id));

create policy "cargar evidencias" on public.evidencias for insert to authenticated
  with check (private.puede_ver_proyecto(proyecto_id) and subido_por = (select auth.uid()));

create policy "equipo revisa evidencias" on public.evidencias for update to authenticated
  using (private.puede_editar_proyecto(proyecto_id))
  with check (private.puede_editar_proyecto(proyecto_id));

create policy "admins borran evidencias" on public.evidencias for delete to authenticated
  using ((select private.es_admin_prociso()) or private.es_admin_de(consultoria_id));

-- ─── historial: inmutable ───────────────────────────────────────────────────

create policy "ver historial" on public.historial for select to authenticated
  using (
       (select private.es_admin_prociso())
    or (proyecto_id is not null and private.puede_ver_proyecto(proyecto_id))
    or (proyecto_id is null and private.es_equipo_de(consultoria_id))
  );

create policy "registrar en historial" on public.historial for insert to authenticated
  with check (
        consultoria_id = (select private.mi_consultoria_id())
    and autor_id = (select auth.uid())
    and (proyecto_id is null or private.puede_ver_proyecto(proyecto_id))
  );

revoke update, delete on public.historial from anon, authenticated;
