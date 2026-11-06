-- Entregables del proyecto.
--
-- Regla del negocio (elegida por el usuario el 2026-11-07), mismo principio que
-- documentos: la consultoría produce, el cliente acepta.
--   · El EQUIPO registra los entregables y los ENTREGA (Pendiente/Rechazado → En revisión).
--   · El CLIENTE de la empresa los APRUEBA o los RECHAZA (con motivo).
--   · Un entregable vinculado a un documento solo se aprueba si ese documento (o una
--     versión posterior con el mismo código, en el mismo proyecto) está Aprobado.
--   · Un proyecto no se finaliza con entregables sin aprobar (antes era solo una regla
--     de la pantalla: un PATCH por API la salteaba).
--   · Borrar: solo el admin.

create table public.entregables (
  id                uuid primary key default gen_random_uuid(),
  consultoria_id    uuid not null,
  proyecto_id       uuid not null,
  nombre            text not null check (length(trim(nombre)) > 0),
  tipo              text not null default '',
  estado            text not null default 'Pendiente' check (estado in ('Pendiente', 'En revisión', 'Aprobado', 'Rechazado')),
  fecha_entrega     date,
  fecha_aprobacion  date,
  aprobado_por      uuid references public.perfiles (id) on delete set null,
  documento_id      uuid,
  creado_por        uuid default auth.uid() references public.perfiles (id) on delete set null,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),
  foreign key (proyecto_id, consultoria_id) references public.proyectos (id, consultoria_id) on delete cascade,
  -- El documento tiene que ser del MISMO proyecto (FK compuesta).
  foreign key (documento_id, proyecto_id, consultoria_id)
    references public.documentos (id, proyecto_id, consultoria_id) on delete set null (documento_id)
);

create index on public.entregables (proyecto_id);

create trigger tocar_actualizado_en before update on public.entregables
  for each row execute function private.tocar_actualizado_en();

alter table public.historial drop constraint historial_entidad_tipo_check;
alter table public.historial add constraint historial_entidad_tipo_check
  check (entidad_tipo in ('consultoria', 'empresa', 'proyecto', 'proceso', 'evidencia', 'documento', 'usuario',
                          'tarea', 'no_conformidad', 'entregable'));

alter table public.comentarios drop constraint comentarios_entidad_tipo_check;
alter table public.comentarios add constraint comentarios_entidad_tipo_check
  check (entidad_tipo in ('documento', 'evidencia', 'proceso', 'tarea', 'no_conformidad', 'entregable'));

-- ════════════════════════════════════════════════════════════════════════════
-- RLS + permisos por columna
-- ════════════════════════════════════════════════════════════════════════════

alter table public.entregables enable row level security;

create policy "ver entregables" on public.entregables for select to authenticated
  using (private.puede_ver_proyecto(proyecto_id));
create policy "equipo registra entregables" on public.entregables for insert to authenticated
  with check (private.puede_editar_proyecto(proyecto_id) and creado_por = (select auth.uid()));
create policy "equipo edita entregables" on public.entregables for update to authenticated
  using (private.puede_editar_proyecto(proyecto_id))
  with check (private.puede_editar_proyecto(proyecto_id));
create policy "admins borran entregables" on public.entregables for delete to authenticated
  using ((select private.es_admin_prociso()) or private.es_admin_de(consultoria_id));

-- Estado, aprobación y autor: solo por decidir_entregable (deja historial).
revoke insert, update on public.entregables from anon, authenticated;
grant insert (id, consultoria_id, proyecto_id, nombre, tipo, fecha_entrega, documento_id) on public.entregables to authenticated;
grant update (nombre, tipo, fecha_entrega, documento_id) on public.entregables to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- decidir_entregable
-- ════════════════════════════════════════════════════════════════════════════
-- SECURITY DEFINER porque el cliente no tiene UPDATE: cada permiso se verifica
-- acá en forma explícita (y lo cubre una prueba de mutación).

create function public.decidir_entregable(p_id uuid, p_estado text, p_comentario text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid         uuid := auth.uid();
  v_ent         record;
  v_equipo      boolean;
  v_cliente     boolean;
  v_comentario  text := nullif(trim(p_comentario), '');
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  select id, consultoria_id, proyecto_id, estado, documento_id into v_ent from public.entregables where id = p_id;
  if not found or not private.puede_ver_proyecto(v_ent.proyecto_id) then
    raise exception 'Entregable no encontrado o sin acceso' using errcode = '42501';
  end if;

  v_equipo  := private.puede_editar_proyecto(v_ent.proyecto_id);
  -- puede_ver_proyecto ya garantizó que el cliente es de la empresa del proyecto.
  v_cliente := private.mi_rol() = 'usuario_cliente';

  if p_estado = 'En revisión' then
    if not v_equipo then
      raise exception 'Entregar le corresponde a la consultoría' using errcode = '42501';
    end if;
    if v_ent.estado not in ('Pendiente', 'Rechazado') then
      raise exception 'Solo se entrega lo pendiente o lo rechazado' using errcode = '22023';
    end if;
  elsif p_estado in ('Aprobado', 'Rechazado') then
    if not v_cliente then
      raise exception 'Aprobar o rechazar le corresponde al cliente de la empresa' using errcode = '42501';
    end if;
    if v_ent.estado <> 'En revisión' then
      raise exception 'Solo se decide sobre entregables en revisión' using errcode = '22023';
    end if;
    if p_estado = 'Rechazado' and v_comentario is null then
      raise exception 'Rechazar exige explicar el motivo' using errcode = '22023';
    end if;
    if p_estado = 'Aprobado' and v_ent.documento_id is not null and not exists (
      select 1
      from public.documentos vinculado
      join public.documentos d on d.proyecto_id = vinculado.proyecto_id
                              and (d.id = vinculado.id or (vinculado.codigo is not null and d.codigo = vinculado.codigo))
      where vinculado.id = v_ent.documento_id and d.estado = 'Aprobado'
    ) then
      raise exception 'El documento vinculado todavía no está aprobado' using errcode = '22023';
    end if;
  else
    raise exception 'Decisión no válida: %', p_estado using errcode = '22023';
  end if;

  update public.entregables set
    estado           = p_estado,
    aprobado_por     = case when p_estado = 'Aprobado' then v_uid else null end,
    fecha_aprobacion = case when p_estado = 'Aprobado' then current_date else null end
  where id = p_id;

  insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion, estado_anterior, estado_nuevo)
  values (v_ent.consultoria_id, v_ent.proyecto_id, 'entregable', p_id, v_uid,
          case p_estado when 'En revisión' then 'Entregable entregado' when 'Aprobado' then 'Entregable aprobado' else 'Entregable rechazado' end,
          v_comentario, v_ent.estado, p_estado);

  if v_comentario is not null then
    insert into public.comentarios (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, texto)
    values (v_ent.consultoria_id, v_ent.proyecto_id, 'entregable', p_id, v_uid, v_comentario);
  end if;
end;
$$;

revoke execute on function public.decidir_entregable(uuid, text, text) from public, anon;
grant execute on function public.decidir_entregable(uuid, text, text) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- Un proyecto no se finaliza con entregables sin aprobar
-- ════════════════════════════════════════════════════════════════════════════

create function private.validar_finalizacion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.estado = 'Finalizado' and old.estado is distinct from 'Finalizado'
     and exists (select 1 from public.entregables e where e.proyecto_id = new.id and e.estado <> 'Aprobado') then
    raise exception 'Para finalizar el proyecto, todos sus entregables tienen que estar aprobados' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger validar_finalizacion before update of estado on public.proyectos
  for each row execute function private.validar_finalizacion();
