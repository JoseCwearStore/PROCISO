-- AUD10-M1 y AUD10-M4 (decisiones del 12/11).
--
-- M1: ningún rol borra por la API documentos, versiones, evidencias ni proyectos.
--   Antes un administrador (de consultoría o PROCISO) podía destruir una aprobación, y al borrar un proyecto su
--   historial se iba por cascada, llamando a la API; la pantalla no tiene ningún botón para eso. Se revoca el
--   privilegio DELETE y se quitan las políticas "admins borran". Lo que sigue borrando es la CASCADA de D4 (solo el
--   Admin PROCISO borra empresas): corre con los privilegios del dueño de la tabla, no con los del usuario.
--   Si alguna vez hace falta borrar uno, lo hace el administrador de la base a mano.
--
-- M4: quitar a un miembro del proyecto se bloquea también si es responsable de un proceso, de una actividad o de una
--   no conformidad abierta (como ya pasaba con las tareas abiertas): antes esos registros quedaban a cargo de
--   alguien que ya no ve el proyecto.

-- ─── M1 ─────────────────────────────────────────────────────────────────────
drop policy if exists "admins borran" on public.documentos;
drop policy if exists "admins borran" on public.documento_versiones;
drop policy if exists "admins borran evidencias" on public.evidencias;
drop policy if exists "admins borran proyectos" on public.proyectos;

revoke delete on public.documentos, public.documento_versiones, public.evidencias, public.proyectos
  from anon, authenticated;

-- ─── M4 ─────────────────────────────────────────────────────────────────────
create or replace function public.quitar_miembro_proyecto(p_proyecto_id uuid, p_usuario_id uuid) returns void
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
  -- Lo mismo con quien responde por un proceso, una actividad o una no conformidad que sigue abierta.
  if exists (select 1 from public.procesos where proyecto_id = p_proyecto_id and responsable_id = p_usuario_id)
     or exists (select 1 from public.actividades where proyecto_id = p_proyecto_id and responsable_id = p_usuario_id)
     or exists (
       select 1 from public.no_conformidades
       where proyecto_id = p_proyecto_id and estado <> 'Cerrada'
         and (responsable_id = p_usuario_id or responsable_accion_id = p_usuario_id)
     ) then
    raise exception 'Es responsable de procesos, actividades o no conformidades abiertas de este proyecto: reasígnalos antes de quitarlo.'
      using errcode = '22023';
  end if;

  delete from public.proyecto_miembros where proyecto_id = p_proyecto_id and usuario_id = p_usuario_id;

  select nombre into v_nombre from public.perfiles where id = p_usuario_id;
  insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion)
  values (v_proy.consultoria_id, p_proyecto_id, 'proyecto', p_proyecto_id, auth.uid(), 'Miembro quitado del equipo', v_nombre);
end;
$$;
