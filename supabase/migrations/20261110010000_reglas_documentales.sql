-- L2 · Reglas documentales (AUD02-H1, M1, M2 · AUD06-M1 en el servidor · AUD02-B1).
--
-- Causa raíz (R2): lo que se revisa y lo que se cierra no era inmutable ni estaba atado a la
-- versión que alguien vio. Decisión D2 (aprobada): congelar el contenido mientras un documento
-- está "Pendiente de revisión" y que cada reenvío cree una versión nueva.
--
--   1. guardar_documento: en revisión no se escribe; la instantánea de una versión ya enviada
--      no se pisa (reenviar exige una versión nueva).
--   2. retirar_documento_de_revision: la salida EXPLÍCITA y auditada de la revisión.
--   3. decidir_documento recibe la versión que el revisor vio (AUD06-M1) y bloquea la fila
--      (AUD02-B1: aprobar y rechazar a la vez); la obsolescencia es solo por mismo código (M1).
--   4. NC Cerrada, entregable Aprobado y tarea Completada no se editan; las ediciones de
--      responsable y fechas dejan historial (M2).

-- ─── 1. guardar_documento ────────────────────────────────────────────────────────────────────
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

  -- FOR UPDATE: no se guarda mientras otra sesión está decidiendo sobre el mismo documento.
  select estado, bloqueado, proyecto_id into v_actual from public.documentos where id = v_id for update;
  if found then
    if v_actual.proyecto_id <> v_proyecto then
      raise exception 'El documento pertenece a otro proyecto' using errcode = '42501';
    end if;
    if v_actual.bloqueado or v_actual.estado in ('Aprobado', 'Obsoleto') then
      raise exception 'El documento está % y no se puede modificar: crea una nueva versión', lower(v_actual.estado)
        using errcode = '42501';
    end if;
    -- D2: lo que el revisor está viendo no puede cambiar debajo de sus pies.
    if v_actual.estado = 'Pendiente de revisión' then
      raise exception 'El documento está en revisión y no se puede modificar: retíralo de la revisión para editarlo'
        using errcode = '42501';
    end if;
  end if;

  if p_version is not null and (p_version->>'version') is distinct from (p_documento->>'version') then
    raise exception 'La versión de la instantánea no coincide con la del documento' using errcode = '22023';
  end if;
  -- La instantánea de una versión ya enviada es inmutable: reenviar exige una versión nueva.
  if p_version is not null and exists (
    select 1 from public.documento_versiones where documento_id = v_id and version = p_version->>'version'
  ) then
    raise exception 'La versión % ya se envió a revisión: crea una versión nueva para reenviar', p_version->>'version'
      using errcode = '42501';
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
            p_version->>'motivo', coalesce(p_documento->'secciones', '[]'::jsonb), v_estado);
  end if;

  if p_evento is not null then
    insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion)
    values (v_consultoria, v_proyecto, 'documento', v_id, auth.uid(), p_evento->>'accion', p_evento->>'detalle');
  end if;
end;
$$;

-- ─── 2. retirar_documento_de_revision ────────────────────────────────────────────────────────
-- La salida explícita de la revisión: solo el equipo del proyecto, y queda en el historial.
-- Antes "guardar como borrador" lo hacía a escondidas; ahora guardar no sale de la revisión.
create or replace function public.retirar_documento_de_revision(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_doc    record;
  v_motivo text := nullif(trim(p_motivo), '');
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  select id, consultoria_id, proyecto_id, estado, version into v_doc
  from public.documentos where id = p_id for update;
  -- Mismo error exista o no el documento: no se revela si el id existe.
  if not found or not private.puede_editar_proyecto(v_doc.proyecto_id) then
    raise exception 'Documento no encontrado o sin permiso para retirarlo' using errcode = '42501';
  end if;
  if v_doc.estado <> 'Pendiente de revisión' then
    raise exception 'Solo se retiran documentos pendientes de revisión' using errcode = '22023';
  end if;

  update public.documentos set estado = 'Borrador' where id = p_id;
  update public.documento_versiones set estado = 'Borrador'
  where documento_id = p_id and version = v_doc.version;

  insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion, estado_anterior, estado_nuevo)
  values (v_doc.consultoria_id, v_doc.proyecto_id, 'documento', p_id, v_uid, 'Documento retirado de revisión',
          coalesce(v_motivo, 'Versión ' || v_doc.version || '.'), 'Pendiente de revisión', 'Borrador');
end;
$$;

revoke execute on function public.retirar_documento_de_revision(uuid, text) from public, anon;
grant  execute on function public.retirar_documento_de_revision(uuid, text) to authenticated;

-- ─── 3. decidir_documento con la versión vista ───────────────────────────────────────────────
-- Cambia la firma (nuevo p_version obligatorio), así que se reemplaza la función entera.
drop function public.decidir_documento(uuid, text, text, text);

create function public.decidir_documento(p_id uuid, p_estado text, p_seccion_id text, p_comentario text, p_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := auth.uid();
  v_doc        record;
  v_equipo     boolean;
  v_cliente    boolean;
  v_comentario text := nullif(trim(p_comentario), '');
  v_seccion    text := nullif(trim(p_seccion_id), '');
  v_accion     text;
  v_reemplazo  record;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  -- FOR UPDATE (AUD02-B1): una aprobación y un rechazo simultáneos ya no pasan los dos el chequeo.
  select id, consultoria_id, proyecto_id, proceso_id, nombre, tipo, estado, version, codigo
  into v_doc from public.documentos where id = p_id for update;
  if not found or not private.puede_ver_proyecto(v_doc.proyecto_id) then
    raise exception 'Documento no encontrado o sin acceso' using errcode = '42501';
  end if;

  if p_estado not in ('Aprobado', 'En corrección', 'Rechazado') then
    raise exception 'Decisión no válida: %', p_estado using errcode = '22023';
  end if;

  v_equipo  := private.puede_editar_proyecto(v_doc.proyecto_id);
  -- puede_ver_proyecto ya garantizó que el cliente es de la empresa del proyecto.
  v_cliente := private.mi_rol() = 'usuario_cliente';

  if p_estado = 'Aprobado' and not v_cliente then
    raise exception 'Solo el cliente de la empresa aprueba documentos' using errcode = '42501';
  end if;
  if p_estado = 'Rechazado' and not v_equipo then
    raise exception 'Solo el equipo de la consultoría rechaza documentos' using errcode = '42501';
  end if;
  if p_estado = 'En corrección' and not (v_equipo or v_cliente) then
    raise exception 'Sin permiso para revisar este documento' using errcode = '42501';
  end if;

  if v_doc.estado <> 'Pendiente de revisión' then
    raise exception 'Solo se decide sobre documentos pendientes de revisión' using errcode = '22023';
  end if;
  -- AUD06-M1: se decide sobre lo que se vio. Si el documento cambió de versión, hay que volver a verlo.
  if p_version is null then
    raise exception 'Falta indicar la versión del documento que revisaste' using errcode = '22023';
  end if;
  if p_version <> v_doc.version then
    raise exception 'El documento cambió desde que lo abriste (ahora es la versión %): vuelve a cargarlo', v_doc.version
      using errcode = '22023';
  end if;
  if p_estado in ('En corrección', 'Rechazado') and (v_seccion is null or v_comentario is null) then
    raise exception 'La corrección o el rechazo requieren sección y comentario' using errcode = '22023';
  end if;

  update public.documentos set
    estado           = p_estado,
    bloqueado        = (p_estado = 'Aprobado'),
    revisado_por     = case when v_equipo then v_uid else revisado_por end,
    fecha_revision   = case when v_equipo then now() else fecha_revision end,
    aprobado_por     = case when p_estado = 'Aprobado' then v_uid else aprobado_por end,
    fecha_aprobacion = case when p_estado = 'Aprobado' then now() else fecha_aprobacion end
  where id = p_id;

  update public.documento_versiones set estado = p_estado
  where documento_id = p_id and version = v_doc.version;

  if v_comentario is not null then
    insert into public.comentarios (consultoria_id, proyecto_id, entidad_tipo, entidad_id, seccion_id, autor_id, texto)
    values (v_doc.consultoria_id, v_doc.proyecto_id, 'documento', p_id, v_seccion, v_uid, v_comentario);
  end if;

  v_accion := case p_estado
    when 'Aprobado' then 'Documento aprobado'
    when 'Rechazado' then 'Documento rechazado'
    else 'Corrección solicitada'
  end;
  insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion, estado_anterior, estado_nuevo)
  values (v_doc.consultoria_id, v_doc.proyecto_id, 'documento', p_id, v_uid, v_accion,
          coalesce(v_comentario, 'Versión ' || v_doc.version || '.'), v_doc.estado, p_estado);

  if p_estado = 'Aprobado' then
    -- AUD02-M1: reemplaza solo lo que tiene el MISMO código (la versión anterior del mismo documento).
    -- Proceso + tipo se usa únicamente cuando ninguno de los dos tiene código.
    for v_reemplazo in
      update public.documentos d set estado = 'Obsoleto', bloqueado = true
      where d.proyecto_id = v_doc.proyecto_id
        and d.id <> p_id
        and d.estado = 'Aprobado'
        and (
          (v_doc.codigo is not null and d.codigo = v_doc.codigo)
          or (v_doc.codigo is null and d.codigo is null
              and v_doc.proceso_id is not null and d.proceso_id = v_doc.proceso_id and d.tipo = v_doc.tipo)
        )
      returning d.id
    loop
      insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion, estado_anterior, estado_nuevo)
      values (v_doc.consultoria_id, v_doc.proyecto_id, 'documento', v_reemplazo.id, v_uid, 'Documento reemplazado',
              'Sustituido por ' || coalesce(v_doc.codigo, v_doc.nombre) || ', versión ' || v_doc.version || '.',
              'Aprobado', 'Obsoleto');
    end loop;
  end if;
end;
$$;

revoke execute on function public.decidir_documento(uuid, text, text, text, text) from public, anon;
grant  execute on function public.decidir_documento(uuid, text, text, text, text) to authenticated;

-- ─── 4. Registros cerrados inmutables + historial de ediciones (AUD02-M2) ───────────────────
-- Los cambios de estado (reabrir, etc.) vienen de las RPC y siguen igual: el trigger solo frena
-- las ediciones que dejan el estado final como está pero cambian el contenido.
create or replace function private.proteger_registro_cerrado()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_final text := case tg_table_name
    when 'no_conformidades' then 'Cerrada'
    when 'entregables'      then 'Aprobado'
    else 'Completada'
  end;
begin
  if old.estado = v_final and new.estado = old.estado
     and (to_jsonb(new) - 'actualizado_en') is distinct from (to_jsonb(old) - 'actualizado_en') then
    raise exception 'El registro está % y no se puede modificar', lower(v_final) using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger proteger_registro_cerrado before update on public.tareas
  for each row execute function private.proteger_registro_cerrado();
create trigger proteger_registro_cerrado before update on public.no_conformidades
  for each row execute function private.proteger_registro_cerrado();
create trigger proteger_registro_cerrado before update on public.entregables
  for each row execute function private.proteger_registro_cerrado();

-- Ediciones directas relevantes: quién cambió qué. Corre como servidor porque el historial
-- ya no admite INSERT de usuarios (L1). Sin sesión (seed, migraciones) no registra nada.
create or replace function private.auditar_edicion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_tipo text := case tg_table_name
    when 'tareas' then 'tarea' when 'no_conformidades' then 'no_conformidad' else 'entregable' end;
begin
  if v_uid is null then
    return null;
  end if;

  if tg_table_name = 'tareas' then
    if new.asignado_a is distinct from old.asignado_a then
      insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion)
      values (new.consultoria_id, new.proyecto_id, v_tipo, new.id, v_uid, 'Tarea reasignada',
              coalesce((select nombre from public.perfiles where id = old.asignado_a), 'sin asignar') || ' → ' ||
              coalesce((select nombre from public.perfiles where id = new.asignado_a), 'sin asignar'));
    end if;
    if new.fecha_vencimiento is distinct from old.fecha_vencimiento then
      insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion)
      values (new.consultoria_id, new.proyecto_id, v_tipo, new.id, v_uid, 'Fecha de vencimiento cambiada',
              coalesce(to_char(old.fecha_vencimiento, 'DD/MM/YYYY'), 'sin fecha') || ' → ' ||
              coalesce(to_char(new.fecha_vencimiento, 'DD/MM/YYYY'), 'sin fecha'));
    end if;

  elsif tg_table_name = 'no_conformidades' then
    if new.responsable_id is distinct from old.responsable_id then
      insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion)
      values (new.consultoria_id, new.proyecto_id, v_tipo, new.id, v_uid, 'Responsable cambiado',
              coalesce((select nombre from public.perfiles where id = old.responsable_id), 'sin asignar') || ' → ' ||
              coalesce((select nombre from public.perfiles where id = new.responsable_id), 'sin asignar'));
    end if;
    if new.responsable_accion_id is distinct from old.responsable_accion_id then
      insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion)
      values (new.consultoria_id, new.proyecto_id, v_tipo, new.id, v_uid, 'Responsable de la acción cambiado',
              coalesce((select nombre from public.perfiles where id = old.responsable_accion_id), 'sin asignar') || ' → ' ||
              coalesce((select nombre from public.perfiles where id = new.responsable_accion_id), 'sin asignar'));
    end if;
    if new.fecha_limite is distinct from old.fecha_limite then
      insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion)
      values (new.consultoria_id, new.proyecto_id, v_tipo, new.id, v_uid, 'Fecha límite cambiada',
              coalesce(to_char(old.fecha_limite, 'DD/MM/YYYY'), 'sin fecha') || ' → ' ||
              coalesce(to_char(new.fecha_limite, 'DD/MM/YYYY'), 'sin fecha'));
    end if;

  else -- entregables
    if new.documento_id is distinct from old.documento_id then
      insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion)
      values (new.consultoria_id, new.proyecto_id, v_tipo, new.id, v_uid, 'Documento vinculado cambiado',
              coalesce((select nombre from public.documentos where id = old.documento_id), 'sin documento') || ' → ' ||
              coalesce((select nombre from public.documentos where id = new.documento_id), 'sin documento'));
    end if;
    if new.fecha_entrega is distinct from old.fecha_entrega then
      insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion)
      values (new.consultoria_id, new.proyecto_id, v_tipo, new.id, v_uid, 'Fecha de entrega cambiada',
              coalesce(to_char(old.fecha_entrega, 'DD/MM/YYYY'), 'sin fecha') || ' → ' ||
              coalesce(to_char(new.fecha_entrega, 'DD/MM/YYYY'), 'sin fecha'));
    end if;
  end if;

  return null;
end;
$$;

create trigger auditar_edicion after update on public.tareas
  for each row execute function private.auditar_edicion();
create trigger auditar_edicion after update on public.no_conformidades
  for each row execute function private.auditar_edicion();
create trigger auditar_edicion after update on public.entregables
  for each row execute function private.auditar_edicion();
