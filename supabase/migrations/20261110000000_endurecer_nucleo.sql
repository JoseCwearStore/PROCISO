-- L1 · Endurecer el núcleo (AUD01-H1, H2, H3, M1, M6 · AUD02-M3).
--
-- Causa raíz (R1): las tablas del núcleo quedaron SIN permisos por columna, así que las reglas
-- de negocio que viven en las RPC se podían saltar con la API directa. Acá se aplica el patrón
-- del resto del proyecto: grants por columna + RPC SECURITY DEFINER con chequeos explícitos.
--
-- ORDEN: primero las RPC pasan a DEFINER (escriben como servidor), y recién después se cierran
-- los INSERT/UPDATE directos. Al revés romperían revisar_evidencia y guardar_documento.
--
-- Fuera de alcance de este lote (siguen como están): DELETE de empresas (L3, D4), RLS de lectura
-- (L3, D3), procesos/fases/actividades (la app solo escribe procesos por guardar_proceso).

-- ─── 1. revisar_evidencia → DEFINER ──────────────────────────────────────────────────────────
-- Antes dependía de la política UPDATE de evidencias (que se cierra abajo). Ahora el permiso es
-- explícito: quien edita el proyecto. El chequeo va ANTES del atajo "mismo estado" para que un
-- cliente reciba 42501 también cuando pide el estado actual (AUD01-B5).
create or replace function public.revisar_evidencia(p_id uuid, p_estado text, p_comentario text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evidencia record;
begin
  select id, consultoria_id, proyecto_id, estado into v_evidencia
  from public.evidencias where id = p_id;

  -- Mismo error exista o no la evidencia: no se revela si el id existe.
  if not found or not private.puede_editar_proyecto(v_evidencia.proyecto_id) then
    raise exception 'Evidencia no encontrada o sin permiso para revisarla' using errcode = '42501';
  end if;

  if v_evidencia.estado = p_estado then
    return;
  end if;

  update public.evidencias set estado = p_estado where id = p_id;

  insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion, estado_anterior, estado_nuevo)
  values (v_evidencia.consultoria_id, v_evidencia.proyecto_id, 'evidencia', p_id, auth.uid(), 'Cambio de estado',
          nullif(trim(p_comentario), ''), v_evidencia.estado, p_estado);
end;
$$;

-- ─── 2. guardar_documento → DEFINER ──────────────────────────────────────────────────────────
-- Antes el permiso lo daban las políticas INSERT/UPDATE de documentos (que se cierran abajo).
-- Ahora: (a) quien edita el proyecto, y (b) si el id ya existe, debe ser de ESE proyecto.
-- Sin (b), con DEFINER alguien podría pisar el documento de otro proyecto reusando su id.
create or replace function public.guardar_documento(p_documento jsonb, p_version jsonb, p_evento jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id          uuid := (p_documento->>'id')::uuid;
  v_proyecto    uuid := (p_documento->>'proyecto_id')::uuid;
  v_estado      text := p_documento->>'estado';
  v_consultoria uuid;
  v_actual      record;
begin
  if v_proyecto is null or not private.puede_editar_proyecto(v_proyecto) then
    raise exception 'Proyecto no encontrado o sin acceso' using errcode = '42501';
  end if;
  select consultoria_id into v_consultoria from public.proyectos where id = v_proyecto;

  if v_estado not in ('Borrador', 'En elaboración', 'Pendiente de revisión') then
    raise exception 'El estado "%" solo se asigna en la revisión', v_estado using errcode = '42501';
  end if;

  select estado, bloqueado, proyecto_id into v_actual from public.documentos where id = v_id;
  if found then
    if v_actual.proyecto_id <> v_proyecto then
      raise exception 'El documento pertenece a otro proyecto' using errcode = '42501';
    end if;
    if v_actual.bloqueado or v_actual.estado in ('Aprobado', 'Obsoleto') then
      raise exception 'El documento está % y no se puede modificar: crea una nueva versión', lower(v_actual.estado)
        using errcode = '42501';
    end if;
  end if;

  insert into public.documentos (
    id, consultoria_id, proyecto_id, proceso_id, nombre, tipo, estado, version, codigo, categoria,
    plantilla, secciones, referencia_normativa, motivo_cambio, contenido_pendiente
  ) values (
    v_id, v_consultoria, v_proyecto, nullif(p_documento->>'proceso_id', '')::uuid,
    p_documento->>'nombre', p_documento->>'tipo', v_estado, p_documento->>'version',
    nullif(p_documento->>'codigo', ''), nullif(p_documento->>'categoria', ''), nullif(p_documento->>'plantilla', ''),
    coalesce(p_documento->'secciones', '[]'::jsonb),
    coalesce(nullif(p_documento->>'referencia_normativa', ''), 'ISO 9001:2026'),
    nullif(p_documento->>'motivo_cambio', ''), coalesce((p_documento->>'contenido_pendiente')::boolean, false)
  )
  -- Al actualizar no se mueve de proyecto ni se cambia quién lo creó.
  on conflict (id) do update set
    proceso_id = excluded.proceso_id, nombre = excluded.nombre, tipo = excluded.tipo, estado = excluded.estado,
    version = excluded.version, codigo = excluded.codigo, categoria = excluded.categoria, plantilla = excluded.plantilla,
    secciones = excluded.secciones, referencia_normativa = excluded.referencia_normativa,
    motivo_cambio = excluded.motivo_cambio, contenido_pendiente = excluded.contenido_pendiente;

  -- Evidencias vinculadas: quedan exactamente las que vienen.
  delete from public.documento_evidencias
  where documento_id = v_id
    and evidencia_id not in (
      select value::uuid from jsonb_array_elements_text(coalesce(p_documento->'evidencias', '[]'::jsonb))
    );
  insert into public.documento_evidencias (documento_id, evidencia_id, proyecto_id, consultoria_id)
  select v_id, value::uuid, v_proyecto, v_consultoria
  from jsonb_array_elements_text(coalesce(p_documento->'evidencias', '[]'::jsonb))
  on conflict do nothing;

  if p_version is not null then
    insert into public.documento_versiones (consultoria_id, proyecto_id, documento_id, version, autor_id, comentario, motivo, secciones, estado)
    values (v_consultoria, v_proyecto, v_id, p_version->>'version', auth.uid(), p_version->>'comentario',
            p_version->>'motivo', coalesce(p_documento->'secciones', '[]'::jsonb), v_estado)
    on conflict (documento_id, version) do update set
      autor_id = excluded.autor_id, comentario = excluded.comentario, motivo = excluded.motivo,
      secciones = excluded.secciones, estado = excluded.estado, creado_en = now();
  end if;

  if p_evento is not null then
    insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion)
    values (v_consultoria, v_proyecto, 'documento', v_id, auth.uid(), p_evento->>'accion', p_evento->>'detalle');
  end if;
end;
$$;

-- ─── 3. historial: solo lo escribe el servidor (AUD01-H3) ───────────────────────────────────
-- Todas las RPC que lo escriben ya son DEFINER (ahora también las dos de arriba);
-- registrar_invitado solo la ejecuta service_role (Edge Function invitar-usuario).
revoke insert on public.historial from authenticated;
drop policy if exists "registrar en historial" on public.historial;

-- ─── 4. documentos y sus hijos: solo por RPC (AUD01-H1, M1) ─────────────────────────────────
-- La app los escribe únicamente con guardar_documento y decidir_documento.
-- documento_versiones queda como instantánea inmutable: nadie la edita a mano.
revoke insert, update on public.documentos          from authenticated;
revoke insert, update on public.documento_versiones from authenticated;
revoke insert, update on public.documento_evidencias from authenticated;
drop policy if exists "equipo crea"  on public.documentos;
drop policy if exists "equipo edita" on public.documentos;
drop policy if exists "equipo crea"  on public.documento_versiones;
drop policy if exists "equipo edita" on public.documento_versiones;
drop policy if exists "equipo crea"  on public.documento_evidencias;
drop policy if exists "equipo edita" on public.documento_evidencias;

-- ─── 5. evidencias (AUD01-H2) ───────────────────────────────────────────────────────────────
-- El INSERT del cliente se limita a las columnas que usa la app; subido_por lo pone el default
-- (auth.uid()). El estado lo fuerza un trigger a 'Cargada' (la UI siempre lo manda así: quitarlo
-- del grant rompería la subida). Después, el estado solo cambia por revisar_evidencia.
revoke insert, update on public.evidencias from authenticated;
grant insert (id, consultoria_id, proyecto_id, proceso_id, actividad_id, nombre, tipo, estado,
              descripcion, categoria, archivo_ruta, archivo_nombre, archivo_mime, archivo_tamano)
  on public.evidencias to authenticated;
drop policy if exists "equipo revisa evidencias" on public.evidencias;

create or replace function private.forzar_estado_evidencia()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Solo con sesión de usuario: el seed y las migraciones (auth.uid() nulo) cargan estados reales.
  if auth.uid() is not null then
    new.estado := 'Cargada';
  end if;
  return new;
end;
$$;

create trigger forzar_estado_evidencia
  before insert on public.evidencias
  for each row execute function private.forzar_estado_evidencia();

-- ─── 6. proyectos y empresas: permisos por columna (AUD01-M1) ───────────────────────────────
-- Columnas exactas que la app escribe (Anexo de AUD-05). avance y consultor_id no se editan
-- por UPDATE; el estado inicial y el avance salen de los defaults.
revoke insert, update on public.proyectos from authenticated;
grant insert (consultoria_id, empresa_id, consultor_id, nombre, objetivo, alcance, edicion_norma,
              fecha_inicio, fecha_fin_estimada)
  on public.proyectos to authenticated;
grant update (estado) on public.proyectos to authenticated;

revoke insert, update on public.empresas from authenticated;
grant insert (consultoria_id, nombre, nombre_comercial, rfc, sector, tamano, trabajadores, ciudad,
              entidad_federativa, direccion, contacto_principal, cargo_contacto, email_contacto,
              telefono_contacto, procesos_principales, alcance_inicial, norma_interes,
              consultor_asignado_id, observaciones)
  on public.empresas to authenticated;
grant update (activa) on public.empresas to authenticated;

-- ─── 7. La suspensión llega a todos los caminos de lectura (AUD01-M6, AUD02-M3) ─────────────
create or replace function private.trabaja_con_empresa(p_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.proyectos p
    join public.proyecto_miembros m on m.proyecto_id = p.id
    join public.perfiles yo on yo.id = m.usuario_id and yo.activo and yo.rol = 'consultor'
    where p.empresa_id = p_empresa_id and m.usuario_id = auth.uid()
      and private.yo_habilitado()
  )
$$;

drop policy if exists "ver empresas" on public.empresas;
create policy "ver empresas" on public.empresas for select to authenticated using (
  (select private.es_admin_prociso())
  or private.es_admin_de(consultoria_id)
  or (consultor_asignado_id = (select auth.uid()) and (select private.yo_habilitado()))
  or id = (select private.mi_empresa_id())
  or exists (
    select 1
    from public.proyectos p
    join public.proyecto_miembros m on m.proyecto_id = p.id
    where p.empresa_id = empresas.id and m.usuario_id = (select auth.uid())
      and (select private.yo_habilitado())
  )
);
-- private.es_asignable no se toca: evalúa al usuario DESTINO (p_usuario_id), no a quien llama.
