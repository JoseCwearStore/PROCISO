-- Integridad de comentarios: entidad_id no tiene FK (la tabla es genérica), así
-- que hasta ahora se podía comentar "en mi proyecto" apuntando a una entidad de
-- otro proyecto, a una que no existe o declarando un tipo que no es el suyo.
--
-- SECURITY INVOKER a propósito: la búsqueda corre con el RLS de quien comenta.
-- Una entidad que no ve es, para esta validación, una entidad que no existe:
-- así el trigger no revela si un id existe en un proyecto ajeno.

create function private.validar_comentario() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  v_existe boolean;
begin
  -- Corre ANTES del WITH CHECK del RLS: a quien no ve el proyecto se le responde
  -- "sin permiso" (lo mismo que diría el RLS), no "no existe". Sin usuario en
  -- sesión (seed, mantenimiento como postgres) no aplica: anon igual no tiene
  -- INSERT, y la validación de la entidad de abajo sí corre para todos.
  if auth.uid() is not null and not private.puede_ver_proyecto(new.proyecto_id) then
    raise exception 'Sin acceso a este proyecto' using errcode = '42501';
  end if;

  v_existe := case new.entidad_tipo
    when 'tarea'          then exists (select 1 from public.tareas           where id = new.entidad_id and proyecto_id = new.proyecto_id)
    when 'proceso'        then exists (select 1 from public.procesos         where id = new.entidad_id and proyecto_id = new.proyecto_id)
    when 'documento'      then exists (select 1 from public.documentos       where id = new.entidad_id and proyecto_id = new.proyecto_id)
    when 'evidencia'      then exists (select 1 from public.evidencias       where id = new.entidad_id and proyecto_id = new.proyecto_id)
    when 'no_conformidad' then exists (select 1 from public.no_conformidades where id = new.entidad_id and proyecto_id = new.proyecto_id)
    -- decidir_entregable deja el comentario del cliente al aprobar o rechazar.
    when 'entregable'     then exists (select 1 from public.entregables      where id = new.entidad_id and proyecto_id = new.proyecto_id)
    else false
  end;

  if not v_existe then
    raise exception 'El comentario apunta a un % que no existe en este proyecto', new.entidad_tipo using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger validar_comentario before insert on public.comentarios
  for each row execute function private.validar_comentario();
