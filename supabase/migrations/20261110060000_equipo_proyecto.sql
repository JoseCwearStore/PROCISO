-- L5d (AUD05-M2, decisión D8): crear un proyecto y armar su equipo de forma atómica y con historial.
--
-- El problema: la app insertaba el proyecto y DESPUÉS el miembro (dos escrituras; el resultado de la
-- segunda se descartaba). Si fallaba, el consultor asignado no veía su propio proyecto (el RLS mira
-- proyecto_miembros) y no existía ninguna pantalla ni función para repararlo, sumar a otro consultor,
-- quitar a alguien o cambiar al responsable (proyectos.consultor_id no se puede actualizar por la API).
--
-- Ahora todo pasa por cuatro funciones, SOLO para el Admin de la consultoría (decisión del usuario:
-- el admin arma el equipo; un consultor lo ve pero no lo cambia):
--   · crear_proyecto            proyecto + miembro responsable + historial, en una transacción.
--   · agregar_miembro_proyecto  suma a un consultor del equipo.
--   · quitar_miembro_proyecto   lo quita (no al responsable ni a quien tiene tareas abiertas).
--   · cambiar_consultor_proyecto cambia al responsable y se asegura de que sea miembro.
-- Cada una deja historial. Se cierra el acceso directo: ya no se inserta en proyectos ni se toca
-- proyecto_miembros por la API (como se hizo con documentos en L1).
--
-- Quien no es admin recibe 42501. Un proyecto o una persona que no existen —o son de OTRA
-- consultoría— reciben el mismo 22023 "no encontrado": no se confirma que existan.

-- ─── Una persona del equipo de la consultoría ───────────────────────────────
create function private.validar_miembro_equipo(p_usuario_id uuid, p_consultoria_id uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.perfiles
    where id = p_usuario_id and consultoria_id = p_consultoria_id and activo
      and rol in ('consultor', 'admin_consultoria')
  ) then
    raise exception 'La persona no existe, está suspendida o no es del equipo de la consultoría.' using errcode = '22023';
  end if;
end;
$$;
revoke execute on function private.validar_miembro_equipo(uuid, uuid) from public, anon, authenticated;

-- ─── crear_proyecto ─────────────────────────────────────────────────────────
create function public.crear_proyecto(
  p_empresa_id uuid,
  p_consultor_id uuid,
  p_nombre text,
  p_objetivo text default null,
  p_alcance text default null,
  p_edicion_norma text default 'ISO 9001:2026',
  p_fecha_inicio date default null,
  p_fecha_fin_estimada date default null
) returns public.proyectos
language plpgsql security definer set search_path = '' as $$
declare
  v_consultoria uuid := private.mi_consultoria_id();
  v_empresa     record;
  v_nombre      text := btrim(coalesce(p_nombre, ''));
  v_proyecto    public.proyectos;
begin
  if private.mi_rol() is distinct from 'admin_consultoria' then
    raise exception 'Solo el administrador de la consultoría crea proyectos.' using errcode = '42501';
  end if;

  select id, consultoria_id, activa into v_empresa from public.empresas where id = p_empresa_id;
  if not found or v_empresa.consultoria_id is distinct from v_consultoria then
    raise exception 'Empresa no encontrada.' using errcode = '22023';
  end if;
  if not v_empresa.activa then
    raise exception 'La empresa está archivada: no se le pueden crear proyectos.' using errcode = '22023';
  end if;
  if v_nombre = '' then
    raise exception 'El nombre del proyecto es obligatorio.' using errcode = '22023';
  end if;
  if p_consultor_id is not null then
    perform private.validar_miembro_equipo(p_consultor_id, v_consultoria);
  end if;

  insert into public.proyectos (consultoria_id, empresa_id, consultor_id, nombre, objetivo, alcance, edicion_norma, fecha_inicio, fecha_fin_estimada)
  values (v_consultoria, p_empresa_id, p_consultor_id, v_nombre, nullif(btrim(coalesce(p_objetivo, '')), ''),
          nullif(btrim(coalesce(p_alcance, '')), ''), coalesce(p_edicion_norma, 'ISO 9001:2026'), p_fecha_inicio, p_fecha_fin_estimada)
  returning * into v_proyecto;

  -- Sin esto el consultor asignado no vería su propio proyecto (el RLS mira proyecto_miembros).
  if p_consultor_id is not null then
    insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id)
    values (v_proyecto.id, p_consultor_id, v_consultoria);
  end if;

  insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion)
  values (v_consultoria, v_proyecto.id, 'proyecto', v_proyecto.id, auth.uid(), 'Proyecto creado', v_nombre);

  return v_proyecto;
end;
$$;

-- ─── Un proyecto de MI consultoría, bloqueado mientras se cambia su equipo ──
-- (tipo compuesto explícito: con `record` el analizador de `db lint` no puede inferir la estructura)
create type private.proyecto_equipo as (id uuid, consultoria_id uuid, consultor_id uuid, nombre text);

create function private.proyecto_para_equipo(p_proyecto_id uuid) returns private.proyecto_equipo
language plpgsql security definer set search_path = '' as $$
declare
  v_proy private.proyecto_equipo;
begin
  if private.mi_rol() is distinct from 'admin_consultoria' then
    raise exception 'Solo el administrador de la consultoría arma el equipo del proyecto.' using errcode = '42501';
  end if;
  select id, consultoria_id, consultor_id, nombre into v_proy from public.proyectos where id = p_proyecto_id for update;
  if not found or v_proy.consultoria_id is distinct from private.mi_consultoria_id() then
    raise exception 'Proyecto no encontrado.' using errcode = '22023';
  end if;
  return v_proy;
end;
$$;
revoke execute on function private.proyecto_para_equipo(uuid) from public, anon, authenticated;

-- ─── agregar_miembro_proyecto ───────────────────────────────────────────────
create function public.agregar_miembro_proyecto(p_proyecto_id uuid, p_usuario_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_proy   private.proyecto_equipo := private.proyecto_para_equipo(p_proyecto_id);
  v_nombre text;
begin
  perform private.validar_miembro_equipo(p_usuario_id, v_proy.consultoria_id);
  if exists (select 1 from public.proyecto_miembros where proyecto_id = p_proyecto_id and usuario_id = p_usuario_id) then
    raise exception 'Ya es parte del equipo del proyecto.' using errcode = '22023';
  end if;

  insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id)
  values (p_proyecto_id, p_usuario_id, v_proy.consultoria_id);

  select nombre into v_nombre from public.perfiles where id = p_usuario_id;
  insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion)
  values (v_proy.consultoria_id, p_proyecto_id, 'proyecto', p_proyecto_id, auth.uid(), 'Miembro agregado al equipo', v_nombre);
end;
$$;

-- ─── quitar_miembro_proyecto ────────────────────────────────────────────────
create function public.quitar_miembro_proyecto(p_proyecto_id uuid, p_usuario_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_proy   private.proyecto_equipo := private.proyecto_para_equipo(p_proyecto_id);
  v_nombre text;
begin
  if p_usuario_id is not distinct from v_proy.consultor_id then
    raise exception 'Es el consultor responsable: cámbialo antes de quitarlo del equipo.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.proyecto_miembros where proyecto_id = p_proyecto_id and usuario_id = p_usuario_id) then
    raise exception 'No es parte del equipo del proyecto.' using errcode = '22023';
  end if;
  -- Las tareas solo se pueden asignar a quien es del equipo (validar_tarea): quitarlo dejaría tareas huérfanas.
  if exists (select 1 from public.tareas where proyecto_id = p_proyecto_id and asignado_a = p_usuario_id and estado <> 'Completada') then
    raise exception 'Tiene tareas abiertas en este proyecto: reasígnalas antes de quitarlo.' using errcode = '22023';
  end if;

  delete from public.proyecto_miembros where proyecto_id = p_proyecto_id and usuario_id = p_usuario_id;

  select nombre into v_nombre from public.perfiles where id = p_usuario_id;
  insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion)
  values (v_proy.consultoria_id, p_proyecto_id, 'proyecto', p_proyecto_id, auth.uid(), 'Miembro quitado del equipo', v_nombre);
end;
$$;

-- ─── cambiar_consultor_proyecto ─────────────────────────────────────────────
create function public.cambiar_consultor_proyecto(p_proyecto_id uuid, p_consultor_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_proy    private.proyecto_equipo := private.proyecto_para_equipo(p_proyecto_id);
  v_antes   text;
  v_despues text;
begin
  perform private.validar_miembro_equipo(p_consultor_id, v_proy.consultoria_id);
  if p_consultor_id is not distinct from v_proy.consultor_id then
    raise exception 'Ya es el consultor responsable del proyecto.' using errcode = '22023';
  end if;

  update public.proyectos set consultor_id = p_consultor_id where id = p_proyecto_id;
  -- El responsable tiene que ser miembro: si no, no vería su propio proyecto.
  insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id)
  values (p_proyecto_id, p_consultor_id, v_proy.consultoria_id)
  on conflict do nothing;

  select nombre into v_antes from public.perfiles where id = v_proy.consultor_id;
  select nombre into v_despues from public.perfiles where id = p_consultor_id;
  insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion)
  values (v_proy.consultoria_id, p_proyecto_id, 'proyecto', p_proyecto_id, auth.uid(), 'Consultor responsable cambiado',
          coalesce(v_antes, 'Sin responsable') || ' → ' || v_despues);
end;
$$;

-- ─── Permisos: solo con sesión; adentro cada función decide si es admin ─────
revoke execute on function public.crear_proyecto(uuid, uuid, text, text, text, text, date, date) from public, anon;
revoke execute on function public.agregar_miembro_proyecto(uuid, uuid) from public, anon;
revoke execute on function public.quitar_miembro_proyecto(uuid, uuid) from public, anon;
revoke execute on function public.cambiar_consultor_proyecto(uuid, uuid) from public, anon;
grant execute on function public.crear_proyecto(uuid, uuid, text, text, text, text, date, date) to authenticated;
grant execute on function public.agregar_miembro_proyecto(uuid, uuid) to authenticated;
grant execute on function public.quitar_miembro_proyecto(uuid, uuid) to authenticated;
grant execute on function public.cambiar_consultor_proyecto(uuid, uuid) to authenticated;

-- ─── Se cierra el acceso directo ────────────────────────────────────────────
-- (el admin ya no crea proyectos ni arma el equipo por la API: solo con las funciones de arriba)
revoke insert on public.proyectos from authenticated;
revoke insert, delete on public.proyecto_miembros from authenticated;
drop policy "admins crean proyectos" on public.proyectos;
drop policy "admins asignan miembros" on public.proyecto_miembros;
drop policy "admins quitan miembros" on public.proyecto_miembros;
