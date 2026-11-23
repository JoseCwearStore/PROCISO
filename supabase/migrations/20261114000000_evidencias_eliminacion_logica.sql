-- Eliminación LÓGICA de evidencias (decisión del 23/11, sobre AUD10-M1).
--
-- AUD10-M1 cerró el DELETE de evidencias por la API: ningún rol las borra. Eso no cambia. Lo que se agrega es una
-- marca de "eliminada" que solo el Admin PROCISO pone y quita, con motivo y rastro en el historial:
--   · Una evidencia eliminada desaparece para todos los roles menos el Admin PROCISO (lo decide el RLS, no la pantalla).
--   · Reactivarla es quitar la marca: vuelve exactamente con el estado de revisión que tenía.
--   · Eliminar se rechaza si la evidencia está vinculada a un documento Aprobado o Pendiente de revisión (D2: ese
--     contenido está congelado y no puede quedar con una referencia oculta).
--   · El archivo de Storage no se toca: reactivar tiene que poder devolverlo.

-- ─── 1. Columnas ────────────────────────────────────────────────────────────
alter table public.evidencias
  add column eliminada_en        timestamptz,
  add column eliminada_por       uuid references public.perfiles (id) on delete set null,
  add column motivo_eliminacion  text;

-- Coherencia: la fecha y el motivo van juntos (quién puede quedar en nulo si borran al perfil).
alter table public.evidencias
  add constraint evidencias_eliminacion_coherente
  check ((eliminada_en is null and motivo_eliminacion is null)
      or (eliminada_en is not null and nullif(trim(motivo_eliminacion), '') is not null));

-- Las columnas nuevas NO entran en el grant de INSERT de endurecer_nucleo (lista de columnas explícita): ningún
-- usuario puede marcar una evidencia como eliminada por la API. Solo lo hacen las funciones de abajo.

-- ─── 2. Lectura: la eliminada solo la ve el Admin PROCISO ───────────────────
drop policy if exists "ver evidencias" on public.evidencias;
create policy "ver evidencias" on public.evidencias for select to authenticated
  using (
    private.puede_ver_proyecto(proyecto_id)
    and (eliminada_en is null or (select private.es_admin_prociso()))
  );

-- ─── 3. revisar_evidencia: una evidencia eliminada no se revisa ─────────────
-- Es SECURITY DEFINER (no pasa por el RLS), así que el filtro tiene que ir acá.
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
  from public.evidencias where id = p_id and eliminada_en is null;

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

-- ─── 4. eliminar_evidencia ──────────────────────────────────────────────────
create or replace function public.eliminar_evidencia(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evidencia record;
  v_motivo    text := nullif(trim(p_motivo), '');
begin
  if not (select private.es_admin_prociso()) then
    raise exception 'Solo el administrador de PROCISO puede eliminar evidencias' using errcode = '42501';
  end if;
  if v_motivo is null then
    raise exception 'Indica el motivo de la eliminación.' using errcode = '22023';
  end if;

  select id, consultoria_id, proyecto_id, eliminada_en into v_evidencia
  from public.evidencias where id = p_id;
  if not found then
    raise exception 'La evidencia no existe.' using errcode = '22023';
  end if;
  if v_evidencia.eliminada_en is not null then
    return;
  end if;

  if exists (
    select 1
    from public.documento_evidencias de
    join public.documentos d on d.id = de.documento_id
    where de.evidencia_id = p_id and d.estado in ('Aprobado', 'Pendiente de revisión')
  ) then
    raise exception 'La evidencia está vinculada a un documento aprobado o en revisión: no se puede eliminar.' using errcode = '22023';
  end if;

  update public.evidencias
  set eliminada_en = now(), eliminada_por = auth.uid(), motivo_eliminacion = v_motivo
  where id = p_id;

  insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion)
  values (v_evidencia.consultoria_id, v_evidencia.proyecto_id, 'evidencia', p_id, auth.uid(), 'Evidencia eliminada', v_motivo);
end;
$$;

-- ─── 5. reactivar_evidencia ─────────────────────────────────────────────────
create or replace function public.reactivar_evidencia(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evidencia record;
begin
  if not (select private.es_admin_prociso()) then
    raise exception 'Solo el administrador de PROCISO puede reactivar evidencias' using errcode = '42501';
  end if;

  select id, consultoria_id, proyecto_id, eliminada_en into v_evidencia
  from public.evidencias where id = p_id;
  if not found then
    raise exception 'La evidencia no existe.' using errcode = '22023';
  end if;
  if v_evidencia.eliminada_en is null then
    return;
  end if;

  update public.evidencias
  set eliminada_en = null, eliminada_por = null, motivo_eliminacion = null
  where id = p_id;

  insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion)
  values (v_evidencia.consultoria_id, v_evidencia.proyecto_id, 'evidencia', p_id, auth.uid(), 'Evidencia reactivada');
end;
$$;

revoke execute on function public.eliminar_evidencia(uuid, text) from public, anon;
revoke execute on function public.reactivar_evidencia(uuid)      from public, anon;
grant  execute on function public.eliminar_evidencia(uuid, text) to authenticated;
grant  execute on function public.reactivar_evidencia(uuid)      to authenticated;
