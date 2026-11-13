-- O31 · No se agregan tareas a un proyecto Finalizado.
-- "Nueva tarea" dejaba elegir un proyecto ya cerrado y la BD lo aceptaba: la tarea nueva cambiaba el avance y la historia
-- de un proyecto terminado. La regla es solo al CREAR: las tareas que ya tenía se siguen editando y moviendo.
-- (El resto de validar_tarea es igual que en 20261107010000.)

create or replace function private.validar_tarea() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and exists (
    select 1 from public.proyectos p where p.id = new.proyecto_id and p.estado = 'Finalizado'
  ) then
    raise exception 'El proyecto está finalizado: no se le agregan tareas' using errcode = '22023';
  end if;

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
