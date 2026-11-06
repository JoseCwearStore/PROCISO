-- Guardar un documento desde el editor, en UNA transacción y con los permisos
-- del usuario (SECURITY INVOKER: el RLS sigue decidiendo quién escribe).
--
-- Reglas del control de documentos que se aplican en el servidor:
-- * Desde el editor solo se usan los estados de redacción. Aprobar, rechazar o
--   pedir correcciones es exclusivo de la revisión (otra función).
-- * Un documento Aprobado u Obsoleto (o bloqueado) no se modifica: se crea una
--   nueva versión.

-- Una instantánea por versión: reenviar la misma versión la actualiza.
alter table public.documento_versiones
  add constraint documento_versiones_documento_version_unica unique (documento_id, version);

-- Desvincular evidencias es parte de editar el documento.
drop policy "admins borran" on public.documento_evidencias;
create policy "equipo desvincula" on public.documento_evidencias for delete to authenticated
  using (private.puede_editar_proyecto(proyecto_id));

create function public.guardar_documento(p_documento jsonb, p_version jsonb, p_evento jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_id          uuid := (p_documento->>'id')::uuid;
  v_proyecto    uuid := (p_documento->>'proyecto_id')::uuid;
  v_estado      text := p_documento->>'estado';
  v_consultoria uuid;
  v_actual      record;
begin
  select consultoria_id into v_consultoria from public.proyectos where id = v_proyecto;
  if v_consultoria is null then
    raise exception 'Proyecto no encontrado o sin acceso' using errcode = '42501';
  end if;

  if v_estado not in ('Borrador', 'En elaboración', 'Pendiente de revisión') then
    raise exception 'El estado "%" solo se asigna en la revisión', v_estado using errcode = '42501';
  end if;

  select estado, bloqueado into v_actual from public.documentos where id = v_id;
  if found and (v_actual.bloqueado or v_actual.estado in ('Aprobado', 'Obsoleto')) then
    raise exception 'El documento está % y no se puede modificar: crea una nueva versión', lower(v_actual.estado)
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

revoke execute on function public.guardar_documento(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.guardar_documento(jsonb, jsonb, jsonb) to authenticated;
