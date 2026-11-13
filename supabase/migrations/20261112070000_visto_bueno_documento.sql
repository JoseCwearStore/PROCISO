-- O23 · Visto bueno del equipo.
-- Un documento pendiente de revisión lo aprueba el CLIENTE, pero antes el equipo (consultor miembro o admin de la
-- consultoría) puede dejar constancia de que revisó esa versión. No decide nada: no cambia el estado, no marca
-- `revisado_por` y NO bloquea al cliente (puede aprobar con o sin visto bueno).
--
-- Vigencia: el visto bueno es de UNA versión (`visto_bueno_version`). Si el documento se corrige y se reenvía sale
-- una versión nueva y el visto bueno anterior deja de valer (el cliente lo calcula comparando con `version`).
-- Las columnas solo las escribe la RPC: authenticated no tiene UPDATE sobre `documentos` (20261110000000).

alter table public.documentos
  add column visto_bueno_por     uuid references public.perfiles (id) on delete set null,
  add column visto_bueno_en      timestamptz,
  add column visto_bueno_version text;

create function public.dar_visto_bueno_documento(p_id uuid, p_version text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_doc record;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  select id, consultoria_id, proyecto_id, estado, version, visto_bueno_version
  into v_doc from public.documentos where id = p_id;
  if not found or not private.puede_ver_proyecto(v_doc.proyecto_id) then
    raise exception 'Documento no encontrado o sin acceso' using errcode = '42501';
  end if;

  if not private.puede_editar_proyecto(v_doc.proyecto_id) then
    raise exception 'Solo el equipo de la consultoría da el visto bueno' using errcode = '42501';
  end if;

  if v_doc.estado <> 'Pendiente de revisión' then
    raise exception 'Solo se da visto bueno a un documento pendiente de revisión' using errcode = '22023';
  end if;
  if p_version is distinct from v_doc.version then
    raise exception 'El documento cambió desde que lo abriste (ahora es la versión %): vuelve a cargarlo', v_doc.version
      using errcode = '22023';
  end if;
  if v_doc.visto_bueno_version is not distinct from v_doc.version then
    raise exception 'Esta versión ya tiene el visto bueno del equipo' using errcode = '22023';
  end if;

  update public.documentos set
    visto_bueno_por     = v_uid,
    visto_bueno_en      = now(),
    visto_bueno_version = v_doc.version
  where id = p_id;

  insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion)
  values (v_doc.consultoria_id, v_doc.proyecto_id, 'documento', p_id, v_uid, 'Visto bueno del equipo',
          'Versión ' || v_doc.version || '.');
end;
$$;

revoke execute on function public.dar_visto_bueno_documento(uuid, text) from public, anon;
grant execute on function public.dar_visto_bueno_documento(uuid, text) to authenticated;
