-- No conformidades y acciones correctivas.
--
-- Regla del negocio (elegida por el usuario el 2026-11-07):
--   · El EQUIPO del proyecto registra la NC y edita sus datos.
--   · El CLIENTE de la empresa participa: documenta la corrección inmediata, el análisis
--     de causa y la acción correctiva, y avanza Abierta → En análisis → En corrección.
--     ISO 9001: la organización es dueña de su acción correctiva.
--   · Verificar la eficacia y cerrar: SOLO el equipo. Quien hace la acción no la da por
--     buena. Una verificación "No eficaz" devuelve la NC a En análisis.
--   · Folio NC-001 consecutivo por proyecto, lo pone el servidor.
--   · Borrar: solo el admin de la consultoría.

-- ════════════════════════════════════════════════════════════════════════════
-- Helper: ¿este usuario puede ser responsable/asignado en este proyecto?
-- ════════════════════════════════════════════════════════════════════════════
-- Misma regla para tareas y NC: el equipo del proyecto o un cliente de su empresa.

create function private.es_asignable(p_usuario_id uuid, p_proyecto_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.perfiles yo
    join public.proyectos p on p.id = p_proyecto_id
    where yo.id = p_usuario_id and yo.activo
      and (
           (yo.rol = 'admin_consultoria' and yo.consultoria_id = p.consultoria_id)
        or (yo.rol = 'consultor' and exists (
              select 1 from public.proyecto_miembros m
              where m.proyecto_id = p.id and m.usuario_id = yo.id))
        or (yo.rol = 'usuario_cliente' and yo.empresa_id = p.empresa_id)
      )
  )
$$;

revoke all on function private.es_asignable(uuid, uuid) from public, anon;
grant execute on function private.es_asignable(uuid, uuid) to authenticated;

-- Tareas pasa a usar el helper (mismo comportamiento: lo cubre el test 009).
create or replace function private.validar_tarea() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op = 'INSERT' or new.asignado_a is distinct from old.asignado_a)
     and not private.es_asignable(new.asignado_a, new.proyecto_id) then
    raise exception 'El asignado no es del equipo del proyecto ni cliente de la empresa' using errcode = '22023';
  end if;

  if new.estado = 'Completada' then
    new.fecha_completada := coalesce(new.fecha_completada, current_date);
  else
    new.fecha_completada := null;
  end if;

  return new;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- Tabla
-- ════════════════════════════════════════════════════════════════════════════

create table public.no_conformidades (
  id                     uuid primary key default gen_random_uuid(),
  consultoria_id         uuid not null,
  proyecto_id            uuid not null,
  folio                  text not null,
  titulo                 text not null default '',
  descripcion            text not null check (length(trim(descripcion)) > 0),
  tipo                   text not null default 'Menor' check (tipo in ('Mayor', 'Menor', 'Observación')),
  detectada_en           text not null default '',
  fecha_deteccion        date not null,
  proceso_id             uuid,
  evidencia_ids          uuid[] not null default '{}',
  responsable_id         uuid not null references public.perfiles (id),
  responsable_accion_id  uuid references public.perfiles (id),
  fecha_limite           date,
  estado                 text not null default 'Abierta'
                         check (estado in ('Abierta', 'En análisis', 'En corrección', 'Verificada', 'Cerrada')),
  correccion_inmediata   text not null default '',
  analisis_causa         text not null default '',
  accion_correctiva      text not null default '',
  eficacia               text not null default 'Pendiente' check (eficacia in ('Pendiente', 'Eficaz', 'No eficaz')),
  verificacion_eficacia  text not null default '',
  fecha_cierre           date,
  observaciones          text not null default '',
  registrada_por         uuid default auth.uid() references public.perfiles (id) on delete set null,
  creado_en              timestamptz not null default now(),
  actualizado_en         timestamptz not null default now(),
  unique (proyecto_id, folio),
  foreign key (proyecto_id, consultoria_id) references public.proyectos (id, consultoria_id) on delete cascade,
  foreign key (proceso_id, proyecto_id, consultoria_id)
    references public.procesos (id, proyecto_id, consultoria_id) on delete set null (proceso_id)
);

create index on public.no_conformidades (proyecto_id);
create index on public.no_conformidades (responsable_id);

create trigger tocar_actualizado_en before update on public.no_conformidades
  for each row execute function private.tocar_actualizado_en();

alter table public.historial drop constraint historial_entidad_tipo_check;
alter table public.historial add constraint historial_entidad_tipo_check
  check (entidad_tipo in ('consultoria', 'empresa', 'proyecto', 'proceso', 'evidencia', 'documento', 'usuario', 'tarea', 'no_conformidad'));

-- ════════════════════════════════════════════════════════════════════════════
-- Reglas en la fila: folio y responsables válidos
-- ════════════════════════════════════════════════════════════════════════════

create function private.validar_no_conformidad() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_ultimo integer;
begin
  if tg_op = 'INSERT' then
    -- Bloquear el proyecto serializa las altas concurrentes: dos NC nunca toman el mismo folio.
    perform 1 from public.proyectos where id = new.proyecto_id for update;
    select coalesce(max(substring(folio from 4)::integer), 0) into v_ultimo
    from public.no_conformidades where proyecto_id = new.proyecto_id and folio ~ '^NC-[0-9]+$';
    new.folio := 'NC-' || lpad((v_ultimo + 1)::text, 3, '0');
  end if;

  if (tg_op = 'INSERT' or new.responsable_id is distinct from old.responsable_id)
     and not private.es_asignable(new.responsable_id, new.proyecto_id) then
    raise exception 'El responsable no es del equipo del proyecto ni cliente de la empresa' using errcode = '22023';
  end if;
  if new.responsable_accion_id is not null
     and (tg_op = 'INSERT' or new.responsable_accion_id is distinct from old.responsable_accion_id)
     and not private.es_asignable(new.responsable_accion_id, new.proyecto_id) then
    raise exception 'El responsable de la acción no es del equipo del proyecto ni cliente de la empresa' using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger validar_no_conformidad before insert or update on public.no_conformidades
  for each row execute function private.validar_no_conformidad();

-- ════════════════════════════════════════════════════════════════════════════
-- RLS + permisos por columna
-- ════════════════════════════════════════════════════════════════════════════

alter table public.no_conformidades enable row level security;

-- El cliente ve las NC de su empresa (puede_ver_proyecto ya lo contempla).
create policy "ver no conformidades" on public.no_conformidades for select to authenticated
  using (private.puede_ver_proyecto(proyecto_id));

create policy "equipo registra no conformidades" on public.no_conformidades for insert to authenticated
  with check (private.puede_editar_proyecto(proyecto_id) and registrada_por = (select auth.uid()));

create policy "equipo edita no conformidades" on public.no_conformidades for update to authenticated
  using (private.puede_editar_proyecto(proyecto_id))
  with check (private.puede_editar_proyecto(proyecto_id));

create policy "admins borran no conformidades" on public.no_conformidades for delete to authenticated
  using ((select private.es_admin_prociso()) or private.es_admin_de(consultoria_id));

-- Directo solo los datos del registro. Folio, estado, eficacia, verificación, cierre
-- y tratamiento van por las funciones de abajo (que dejan historial y validan quién).
revoke insert, update on public.no_conformidades from anon, authenticated;
grant insert (id, consultoria_id, proyecto_id, titulo, descripcion, tipo, detectada_en, fecha_deteccion, proceso_id,
              evidencia_ids, responsable_id, responsable_accion_id, fecha_limite, observaciones)
  on public.no_conformidades to authenticated;
grant update (titulo, descripcion, tipo, detectada_en, fecha_deteccion, proceso_id, evidencia_ids,
              responsable_id, responsable_accion_id, fecha_limite, observaciones)
  on public.no_conformidades to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- guardar_tratamiento_nc: equipo o cliente, mientras no esté verificada
-- ════════════════════════════════════════════════════════════════════════════
-- SECURITY DEFINER porque el cliente no tiene UPDATE: cada permiso se verifica acá.

create function public.guardar_tratamiento_nc(p_id uuid, p_correccion text, p_causa text, p_accion text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_nc  record;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  select id, consultoria_id, proyecto_id, estado into v_nc from public.no_conformidades where id = p_id;
  -- Ver el proyecto alcanza: lo ven el equipo y los clientes de ESA empresa.
  if not found or not private.puede_ver_proyecto(v_nc.proyecto_id) then
    raise exception 'No conformidad no encontrada o sin acceso' using errcode = '42501';
  end if;

  if v_nc.estado in ('Verificada', 'Cerrada') then
    raise exception 'Una no conformidad verificada ya no cambia su tratamiento' using errcode = '22023';
  end if;

  update public.no_conformidades set
    correccion_inmediata = coalesce(trim(p_correccion), ''),
    analisis_causa       = coalesce(trim(p_causa), ''),
    accion_correctiva    = coalesce(trim(p_accion), '')
  where id = p_id;

  insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion)
  values (v_nc.consultoria_id, v_nc.proyecto_id, 'no_conformidad', p_id, v_uid, 'Tratamiento actualizado',
          'Corrección, análisis de causa y acción correctiva.');
end;
$$;

revoke execute on function public.guardar_tratamiento_nc(uuid, text, text, text) from public, anon;
grant execute on function public.guardar_tratamiento_nc(uuid, text, text, text) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- cambiar_estado_nc: la máquina de estados
-- ════════════════════════════════════════════════════════════════════════════
--   Abierta → En análisis                 equipo o cliente
--   En análisis → En corrección           equipo o cliente; exige causa y acción
--   En corrección → Verificada            SOLO equipo; exige verificación → Eficaz
--   En corrección → En análisis           SOLO equipo; exige verificación → No eficaz
--   Verificada → Cerrada                  SOLO equipo; pone fecha_cierre

create function public.cambiar_estado_nc(p_id uuid, p_estado text, p_verificacion text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid           uuid := auth.uid();
  v_nc            record;
  v_equipo        boolean;
  v_verificacion  text := nullif(trim(p_verificacion), '');
  v_solo_equipo   boolean;
  v_eficacia      text;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  select id, consultoria_id, proyecto_id, estado, eficacia, analisis_causa, accion_correctiva
  into v_nc from public.no_conformidades where id = p_id;
  if not found or not private.puede_ver_proyecto(v_nc.proyecto_id) then
    raise exception 'No conformidad no encontrada o sin acceso' using errcode = '42501';
  end if;

  v_equipo := private.puede_editar_proyecto(v_nc.proyecto_id);
  v_eficacia := v_nc.eficacia;

  -- 1) ¿La transición existe? (y qué rol pide)
  if v_nc.estado = 'Abierta' and p_estado = 'En análisis' then
    v_solo_equipo := false;
  elsif v_nc.estado = 'En análisis' and p_estado = 'En corrección' then
    v_solo_equipo := false;
  elsif v_nc.estado = 'En corrección' and p_estado in ('Verificada', 'En análisis') then
    v_solo_equipo := true;
  elsif v_nc.estado = 'Verificada' and p_estado = 'Cerrada' then
    v_solo_equipo := true;
  else
    raise exception 'Transición no válida: % → %', v_nc.estado, p_estado using errcode = '22023';
  end if;

  -- 2) ¿Quién? Verificar y cerrar es del equipo: quien hizo la acción no la da por buena.
  if v_solo_equipo and not v_equipo then
    raise exception 'Verificar la eficacia y cerrar le corresponde a la consultoría' using errcode = '42501';
  end if;

  -- 3) ¿Con qué datos?
  if p_estado = 'En corrección'
     and (trim(v_nc.analisis_causa) = '' or trim(v_nc.accion_correctiva) = '') then
    raise exception 'Para pasar a corrección hace falta el análisis de causa y la acción correctiva' using errcode = '22023';
  end if;
  if v_nc.estado = 'En corrección' then
    if v_verificacion is null then
      raise exception 'La verificación de eficacia tiene que describir qué se revisó' using errcode = '22023';
    end if;
    v_eficacia := case when p_estado = 'Verificada' then 'Eficaz' else 'No eficaz' end;
  end if;

  update public.no_conformidades set
    estado                = p_estado,
    eficacia              = v_eficacia,
    verificacion_eficacia = coalesce(v_verificacion, verificacion_eficacia),
    fecha_cierre          = case when p_estado = 'Cerrada' then current_date else null end
  where id = p_id;

  insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion, estado_anterior, estado_nuevo)
  values (v_nc.consultoria_id, v_nc.proyecto_id, 'no_conformidad', p_id, v_uid,
          case
            when v_nc.estado = 'En corrección' then 'Verificación de eficacia: ' || v_eficacia
            when p_estado = 'Cerrada' then 'No conformidad cerrada'
            else 'Cambio de estado'
          end,
          v_verificacion, v_nc.estado, p_estado);
end;
$$;

revoke execute on function public.cambiar_estado_nc(uuid, text, text) from public, anon;
grant execute on function public.cambiar_estado_nc(uuid, text, text) to authenticated;
