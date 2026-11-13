-- AUD10-M3 · El historial de un documento no admite eventos fabricados.
-- guardar_documento escribía en el historial la acción que mandaba quien llamaba (texto libre, sin lista ni CHECK): un
-- editor podía registrar "Documento aprobado" sin que el estado cambiara. Ahora solo acepta las acciones propias de
-- redactar y enviar (y "Enviado a revisión" solo si el documento queda pendiente), y recorta el detalle a 500 caracteres.
-- El resto de la función es igual que en 20261110010000.

create or replace function public.guardar_documento(p_documento jsonb, p_version jsonb, p_evento jsonb)
 returns void
language plpgsql security definer set search_path = '' as $$
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

  -- M3: el historial de un documento lo escribe el servidor. Desde acá solo entran las acciones propias de redactar y
  -- enviar; las de decisión las escribe cada RPC que hace el cambio de verdad (decidir_documento, dar_visto_bueno_documento,
  -- retirar_documento_de_revision). Antes la acción era texto libre y se podía fabricar "Documento aprobado".
  if p_evento is not null then
    if (p_evento->>'accion') is null
       or (p_evento->>'accion') not in ('Borrador generado', 'Borrador guardado', 'Enviado a revisión', 'Nueva versión creada') then
      raise exception 'El evento "%" no se puede registrar al guardar un documento', coalesce(p_evento->>'accion', '') using errcode = '22023';
    end if;
    if p_evento->>'accion' = 'Enviado a revisión' and v_estado <> 'Pendiente de revisión' then
      raise exception 'Solo se registra el envío a revisión de un documento que queda pendiente de revisión' using errcode = '22023';
    end if;
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
    values (v_consultoria, v_proyecto, 'documento', v_id, auth.uid(), p_evento->>'accion', left(p_evento->>'detalle', 500));
  end if;
end;
$$;
