-- Revisión de documentos y comentarios.

-- ════════════════════════════════════════════════════════════════════════════
-- Comentarios (tabla genérica, como se decidió en el diseño inicial)
-- ════════════════════════════════════════════════════════════════════════════
-- Inmutables: son la retroalimentación de una revisión (no se editan ni se borran).

create table public.comentarios (
  id              uuid primary key default gen_random_uuid(),
  consultoria_id  uuid not null,
  proyecto_id     uuid not null,
  entidad_tipo    text not null check (entidad_tipo in ('documento', 'evidencia', 'proceso', 'tarea', 'no_conformidad')),
  entidad_id      uuid not null,
  seccion_id      text,
  autor_id        uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  texto           text not null check (length(trim(texto)) > 0),
  creado_en       timestamptz not null default now(),
  foreign key (proyecto_id, consultoria_id) references public.proyectos (id, consultoria_id) on delete cascade
);

create index on public.comentarios (entidad_tipo, entidad_id);
create index on public.comentarios (proyecto_id);

alter table public.comentarios enable row level security;

create policy "ver comentarios" on public.comentarios for select to authenticated
  using (private.puede_ver_proyecto(proyecto_id));

-- Comentan quienes ven el proyecto (también el cliente), siempre a su nombre.
create policy "comentar" on public.comentarios for insert to authenticated
  with check (private.puede_ver_proyecto(proyecto_id) and autor_id = (select auth.uid()));

revoke update, delete on public.comentarios from anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- decidir_documento
-- ════════════════════════════════════════════════════════════════════════════
-- Regla del negocio: el EQUIPO del proyecto revisa (pide corrección o rechaza) y
-- el CLIENTE de la empresa aprueba (o pide corrección).
--
-- SECURITY DEFINER porque el cliente no tiene UPDATE sobre documentos (redactar
-- es del equipo). Por eso CADA permiso se verifica acá en forma explícita.
--
-- Al aprobar, la versión aprobada anterior del mismo documento (mismo código, o
-- mismo proceso y tipo) DENTRO DEL MISMO PROYECTO queda Obsoleta en la misma
-- transacción: nunca hay dos versiones vigentes.

create function public.decidir_documento(p_id uuid, p_estado text, p_seccion_id text, p_comentario text) returns void
language plpgsql security definer set search_path = '' as $$
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

  select id, consultoria_id, proyecto_id, proceso_id, nombre, tipo, estado, version, codigo
  into v_doc from public.documentos where id = p_id;
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
    for v_reemplazo in
      update public.documentos d set estado = 'Obsoleto', bloqueado = true
      where d.proyecto_id = v_doc.proyecto_id
        and d.id <> p_id
        and d.estado = 'Aprobado'
        and (
          (v_doc.codigo is not null and d.codigo = v_doc.codigo)
          or (v_doc.proceso_id is not null and d.proceso_id = v_doc.proceso_id and d.tipo = v_doc.tipo)
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

revoke execute on function public.decidir_documento(uuid, text, text, text) from public, anon;
grant execute on function public.decidir_documento(uuid, text, text, text) to authenticated;
