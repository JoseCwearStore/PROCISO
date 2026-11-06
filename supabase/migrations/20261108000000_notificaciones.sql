-- Notificaciones: diseño híbrido (decidido con el usuario el 2026-11-06).
--
-- No hay tabla de notificaciones: se CALCULAN en cada lectura, así nunca se
-- desincronizan del estado real.
--   · Pendientes: salen del estado actual (tareas, documentos, entregables) y
--     desaparecen solas cuando se resuelven.
--   · Hechos: salen de public.historial (últimos 15 días).
-- Lo único que se guarda es qué marcó cada usuario como leído.
--
-- Reglas: nunca te notifico de lo que hiciste vos; el Admin PROCISO no recibe
-- notificaciones operativas; "equipo" = admin de la consultoría + consultores
-- miembros del proyecto.

-- ════════════════════════════════════════════════════════════════════════════
-- Leídas
-- ════════════════════════════════════════════════════════════════════════════

create table public.notificaciones_leidas (
  usuario_id  uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  clave       text not null check (length(clave) between 1 and 200),
  leida_en    timestamptz not null default now(),
  primary key (usuario_id, clave)
);

alter table public.notificaciones_leidas enable row level security;

create policy "ver mis leídas" on public.notificaciones_leidas for select to authenticated
  using (usuario_id = (select auth.uid()));

create policy "marcar mis leídas" on public.notificaciones_leidas for insert to authenticated
  with check (usuario_id = (select auth.uid()));

-- Solo se insertan (la clave; el usuario lo pone el default). No se editan ni se borran.
revoke all on public.notificaciones_leidas from anon, authenticated;
grant select on public.notificaciones_leidas to authenticated;
grant insert (clave) on public.notificaciones_leidas to authenticated;

-- Marcar una o todas en una sola llamada. SECURITY INVOKER: el RLS y el permiso
-- por columna siguen mandando (el usuario lo pone el default auth.uid()).
create function public.marcar_notificaciones_leidas(p_claves text[]) returns void
language sql security invoker set search_path = '' as $$
  insert into public.notificaciones_leidas (clave)
  select distinct c from unnest(p_claves) as c
  on conflict do nothing
$$;

revoke execute on function public.marcar_notificaciones_leidas(text[]) from public, anon;
grant execute on function public.marcar_notificaciones_leidas(text[]) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- private.es_equipo_del_proyecto
-- ════════════════════════════════════════════════════════════════════════════
-- No sirve puede_editar_proyecto: incluye al Admin PROCISO.

create function private.es_equipo_del_proyecto(p_proyecto_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.proyectos p
    join public.perfiles yo on yo.id = auth.uid() and yo.activo
    where p.id = p_proyecto_id
      and (
           (yo.rol = 'admin_consultoria' and p.consultoria_id = yo.consultoria_id)
        or (yo.rol = 'consultor' and exists (
              select 1 from public.proyecto_miembros m
              where m.proyecto_id = p.id and m.usuario_id = yo.id))
      )
  )
$$;

revoke execute on function private.es_equipo_del_proyecto(uuid) from public, anon;
grant execute on function private.es_equipo_del_proyecto(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- mis_notificaciones
-- ════════════════════════════════════════════════════════════════════════════
-- SECURITY INVOKER: el RLS de cada tabla sigue decidiendo qué filas se ven; las
-- reglas de abajo solo eligen, de lo visible, qué le corresponde a quién.

create function public.mis_notificaciones()
returns table (
  clave         text,
  tipo          text,
  titulo        text,
  descripcion   text,
  fecha         timestamptz,
  pagina        text,
  proyecto_id   uuid,
  entidad_tipo  text,
  entidad_id    uuid,
  leida         boolean
)
language sql stable security invoker set search_path = '' as $$
  with yo as (
    select auth.uid() as id, private.mi_rol() as rol
  ),
  todas as (
    -- ─── Pendientes ─────────────────────────────────────────────────────────
    -- Tareas: al asignado (vencida o no) y al consultor líder (solo vencidas).
    select
      case when t.fecha_vencimiento < current_date then 'tarea_vencida:' else 'tarea_asignada:' end || t.id as clave,
      case when t.fecha_vencimiento < current_date then 'error' else 'info' end as tipo,
      case when t.fecha_vencimiento < current_date then 'Tarea vencida: ' else 'Tarea asignada: ' end || t.titulo as titulo,
      case when t.fecha_vencimiento < current_date
        then 'Venció el ' || to_char(t.fecha_vencimiento, 'DD/MM/YYYY') || ' sin completarse.'
        else 'Vence el ' || to_char(t.fecha_vencimiento, 'DD/MM/YYYY') || '.'
      end as descripcion,
      t.actualizado_en as fecha, 'tablero-tareas' as pagina, t.proyecto_id, 'tarea' as entidad_tipo, t.id as entidad_id
    from public.tareas t, yo
    where t.estado <> 'Completada'
      and (
           (t.asignado_a = yo.id and (t.estado <> 'En revisión' or t.fecha_vencimiento < current_date))
        or (t.fecha_vencimiento < current_date and t.asignado_a <> yo.id and exists (
              select 1 from public.proyectos p where p.id = t.proyecto_id and p.consultor_id = yo.id))
      )

    union all
    -- Documentos por revisar: el equipo (menos el autor) revisa y el cliente aprueba.
    select
      'doc_revision:' || d.id || ':' || d.version, 'info', 'Documento pendiente de revisión',
      '"' || d.nombre || '" v' || d.version || ' espera revisión.',
      d.actualizado_en, 'revisiones', d.proyecto_id, 'documento', d.id
    from public.documentos d, yo
    where d.estado = 'Pendiente de revisión'
      and (
           (private.es_equipo_del_proyecto(d.proyecto_id) and d.creado_por is distinct from yo.id)
        or yo.rol = 'usuario_cliente'
      )

    union all
    -- Entregables por aprobar: al cliente de la empresa.
    select
      'entregable_revision:' || e.id, 'info', 'Entregable por aprobar',
      '"' || e.nombre || '" espera tu aprobación.',
      e.actualizado_en, 'inicio', e.proyecto_id, 'entregable', e.id
    from public.entregables e, yo
    where e.estado = 'En revisión' and yo.rol = 'usuario_cliente'

    -- ─── Hechos (historial, últimos 15 días, nunca los míos) ──────────────
    union all
    select
      'h:' || h.id, 'warning', 'Tarea requiere corrección',
      '"' || t.titulo || '" fue devuelta con observaciones.',
      h.creado_en, 'tablero-tareas', h.proyecto_id, 'tarea', h.entidad_id
    from public.historial h
    join public.tareas t on t.id = h.entidad_id
    cross join yo
    where h.entidad_tipo = 'tarea' and h.estado_nuevo = 'Requiere corrección'
      and t.asignado_a = yo.id
      and h.creado_en >= now() - interval '15 days' and h.autor_id is distinct from yo.id

    union all
    select
      'h:' || h.id,
      case h.estado_nuevo when 'Aprobado' then 'success' else 'error' end,
      'Entregable ' || lower(h.estado_nuevo),
      '"' || e.nombre || '" fue ' || lower(h.estado_nuevo) || ' por el cliente.',
      h.creado_en, 'proyectos', h.proyecto_id, 'entregable', h.entidad_id
    from public.historial h
    join public.entregables e on e.id = h.entidad_id
    cross join yo
    where h.entidad_tipo = 'entregable' and h.estado_nuevo in ('Aprobado', 'Rechazado')
      and private.es_equipo_del_proyecto(h.proyecto_id)
      and h.creado_en >= now() - interval '15 days' and h.autor_id is distinct from yo.id

    union all
    select
      'h:' || h.id,
      case h.estado_nuevo when 'Aprobado' then 'success' when 'Rechazado' then 'error' else 'warning' end,
      case h.estado_nuevo when 'Aprobado' then 'Documento aprobado' when 'Rechazado' then 'Documento rechazado'
                          else 'Documento con correcciones' end,
      '"' || d.nombre || '" v' || d.version || ': ' || lower(h.accion) || '.',
      h.creado_en, 'documentacion', h.proyecto_id, 'documento', h.entidad_id
    from public.historial h
    join public.documentos d on d.id = h.entidad_id
    cross join yo
    where h.entidad_tipo = 'documento' and h.estado_nuevo in ('Aprobado', 'En corrección', 'Rechazado')
      and (d.creado_por = yo.id or yo.rol = 'usuario_cliente')
      and h.creado_en >= now() - interval '15 days' and h.autor_id is distinct from yo.id

    union all
    select
      'h:' || h.id, 'info', 'Tratamiento de no conformidad',
      n.folio || ' ' || n.titulo || ': se actualizó corrección, causa y acción.',
      h.creado_en, 'no-conformidades', h.proyecto_id, 'no_conformidad', h.entidad_id
    from public.historial h
    join public.no_conformidades n on n.id = h.entidad_id
    cross join yo
    where h.entidad_tipo = 'no_conformidad' and h.accion = 'Tratamiento actualizado'
      and private.es_equipo_del_proyecto(h.proyecto_id)
      and h.creado_en >= now() - interval '15 days' and h.autor_id is distinct from yo.id
  )
  select
    x.clave, x.tipo, x.titulo, x.descripcion, x.fecha, x.pagina, x.proyecto_id, x.entidad_tipo, x.entidad_id,
    exists (
      select 1 from public.notificaciones_leidas l
      where l.usuario_id = (select yo.id from yo) and l.clave = x.clave
    ) as leida
  from todas x
  -- El Admin PROCISO (y un usuario inactivo, sin rol) no recibe notificaciones operativas.
  where (select yo.rol from yo) in ('admin_consultoria', 'consultor', 'usuario_cliente')
  order by x.fecha desc
$$;

revoke execute on function public.mis_notificaciones() from public, anon;
grant execute on function public.mis_notificaciones() to authenticated;
