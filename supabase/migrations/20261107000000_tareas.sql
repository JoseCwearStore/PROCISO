-- Tareas del proyecto.
--
-- Regla del negocio (mismo principio que documentos y evidencias: quien hace el
-- trabajo no lo da por bueno):
--   · Crear, asignar y editar: el EQUIPO del proyecto (puede_editar_proyecto).
--   · Asignables: el equipo del proyecto o los clientes de la empresa del proyecto.
--   · Avanzar Pendiente → En proceso → En revisión (y retomar una devuelta): el ASIGNADO.
--   · Cerrar (Completada) o devolver (Requiere corrección): solo el EQUIPO. El avance
--     del proyecto se calcula con las tareas completadas; si el cliente pudiera
--     completarlas, inflaría el avance sin validación.
--   · Comentar: todos los que ven el proyecto (tabla comentarios, entidad_tipo 'tarea').
--   · Borrar: solo el admin de la consultoría.
--   · "Vencida" NO es un estado: se calcula (estado no final + fecha pasada). Un estado
--     que depende del reloj se pudre si se guarda.

create table public.tareas (
  id                 uuid primary key default gen_random_uuid(),
  consultoria_id     uuid not null,
  proyecto_id        uuid not null,
  titulo             text not null check (length(trim(titulo)) > 0),
  descripcion        text not null default '',
  asignado_a         uuid not null references public.perfiles (id),
  asignado_por       uuid default auth.uid() references public.perfiles (id) on delete set null,
  estado             text not null default 'Pendiente'
                     check (estado in ('Pendiente', 'En proceso', 'En revisión', 'Requiere corrección', 'Completada')),
  prioridad          text not null default 'Media' check (prioridad in ('Alta', 'Media', 'Baja')),
  fecha_vencimiento  date not null,
  fecha_completada   date,
  dependencias       uuid[] not null default '{}',
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now(),
  foreign key (proyecto_id, consultoria_id) references public.proyectos (id, consultoria_id) on delete cascade
);

create index on public.tareas (proyecto_id);
create index on public.tareas (asignado_a);

create trigger tocar_actualizado_en before update on public.tareas
  for each row execute function private.tocar_actualizado_en();

-- El historial ahora también registra tareas.
alter table public.historial drop constraint historial_entidad_tipo_check;
alter table public.historial add constraint historial_entidad_tipo_check
  check (entidad_tipo in ('consultoria', 'empresa', 'proyecto', 'proceso', 'evidencia', 'documento', 'usuario', 'tarea'));

-- ════════════════════════════════════════════════════════════════════════════
-- Reglas que viven en la fila: asignado válido y fecha de completada
-- ════════════════════════════════════════════════════════════════════════════
-- SECURITY DEFINER: tiene que leer perfiles y miembros sin depender de lo que el
-- RLS le deje ver a quien escribe.

create function private.validar_tarea() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.asignado_a is distinct from old.asignado_a then
    if not exists (
      select 1
      from public.perfiles yo
      join public.proyectos p on p.id = new.proyecto_id
      where yo.id = new.asignado_a and yo.activo
        and (
             (yo.rol = 'admin_consultoria' and yo.consultoria_id = p.consultoria_id)
          or (yo.rol = 'consultor' and exists (
                select 1 from public.proyecto_miembros m
                where m.proyecto_id = p.id and m.usuario_id = yo.id))
          or (yo.rol = 'usuario_cliente' and yo.empresa_id = p.empresa_id)
        )
    ) then
      raise exception 'El asignado no es del equipo del proyecto ni cliente de la empresa' using errcode = '22023';
    end if;
  end if;

  -- La fecha de completada la pone el servidor: nadie la inventa.
  if new.estado = 'Completada' then
    new.fecha_completada := coalesce(new.fecha_completada, current_date);
  else
    new.fecha_completada := null;
  end if;

  return new;
end;
$$;

create trigger validar_tarea before insert or update on public.tareas
  for each row execute function private.validar_tarea();

-- ════════════════════════════════════════════════════════════════════════════
-- RLS + permisos por columna
-- ════════════════════════════════════════════════════════════════════════════

alter table public.tareas enable row level security;

create policy "ver tareas" on public.tareas for select to authenticated
  using (private.puede_ver_proyecto(proyecto_id));

create policy "equipo crea tareas" on public.tareas for insert to authenticated
  with check (private.puede_editar_proyecto(proyecto_id) and asignado_por = (select auth.uid()));

create policy "equipo edita tareas" on public.tareas for update to authenticated
  using (private.puede_editar_proyecto(proyecto_id))
  with check (private.puede_editar_proyecto(proyecto_id));

create policy "admins borran tareas" on public.tareas for delete to authenticated
  using ((select private.es_admin_prociso()) or private.es_admin_de(consultoria_id));

-- Sin GRANT sobre estado, fecha_completada ni asignado_por: el estado cambia SOLO
-- por cambiar_estado_tarea (que deja historial; un historial opcional no es
-- auditoría) y asignado_por lo pone el default auth.uid().
revoke insert, update on public.tareas from anon, authenticated;
grant insert (id, consultoria_id, proyecto_id, titulo, descripcion, asignado_a, prioridad, fecha_vencimiento, dependencias)
  on public.tareas to authenticated;
grant update (titulo, descripcion, asignado_a, prioridad, fecha_vencimiento, dependencias)
  on public.tareas to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- cambiar_estado_tarea
-- ════════════════════════════════════════════════════════════════════════════
-- SECURITY DEFINER porque el cliente no tiene UPDATE sobre tareas. Por eso CADA
-- permiso se verifica acá en forma explícita (y lo cubre una prueba de mutación).

create function public.cambiar_estado_tarea(p_id uuid, p_estado text, p_comentario text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid        uuid := auth.uid();
  v_tarea      record;
  v_equipo     boolean;
  v_comentario text := nullif(trim(p_comentario), '');
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  select id, consultoria_id, proyecto_id, asignado_a, estado
  into v_tarea from public.tareas where id = p_id;
  if not found or not private.puede_ver_proyecto(v_tarea.proyecto_id) then
    raise exception 'Tarea no encontrada o sin acceso' using errcode = '42501';
  end if;

  if p_estado is null or p_estado not in ('Pendiente', 'En proceso', 'En revisión', 'Requiere corrección', 'Completada') then
    raise exception 'Estado no válido: %', p_estado using errcode = '22023';
  end if;

  v_equipo := private.puede_editar_proyecto(v_tarea.proyecto_id);

  -- Fuera del equipo, solo el asignado y solo hacia adelante en su trabajo.
  if not v_equipo then
    if v_tarea.asignado_a <> v_uid then
      raise exception 'Solo el asignado o el equipo cambian el estado de esta tarea' using errcode = '42501';
    end if;
    if not (
         (v_tarea.estado in ('Pendiente', 'Requiere corrección') and p_estado = 'En proceso')
      or (v_tarea.estado = 'En proceso' and p_estado = 'En revisión')
    ) then
      raise exception 'El asignado avanza su tarea; cerrarla o devolverla es del equipo' using errcode = '42501';
    end if;
  end if;

  if v_tarea.estado = p_estado then
    raise exception 'La tarea ya está en %', p_estado using errcode = '22023';
  end if;

  update public.tareas set estado = p_estado where id = p_id;

  insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion, estado_anterior, estado_nuevo)
  values (v_tarea.consultoria_id, v_tarea.proyecto_id, 'tarea', p_id, v_uid, 'Cambio de estado', v_comentario, v_tarea.estado, p_estado);

  if v_comentario is not null then
    insert into public.comentarios (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, texto)
    values (v_tarea.consultoria_id, v_tarea.proyecto_id, 'tarea', p_id, v_uid, v_comentario);
  end if;
end;
$$;

revoke execute on function public.cambiar_estado_tarea(uuid, text, text) from public, anon;
grant execute on function public.cambiar_estado_tarea(uuid, text, text) to authenticated;
