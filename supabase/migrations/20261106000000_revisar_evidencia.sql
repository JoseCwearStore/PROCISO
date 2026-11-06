-- Cambiar el estado de una evidencia y dejarlo en el historial (auditoría), en
-- UNA transacción y con los permisos del usuario (SECURITY INVOKER):
-- * Si el usuario no ve la evidencia, no la encuentra → 42501.
-- * Si la ve pero no puede editarla (cliente, consultor no asignado), el UPDATE
--   no afecta filas por RLS → 42501, y no queda nada en el historial.

create function public.revisar_evidencia(p_id uuid, p_estado text, p_comentario text) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_evidencia record;
begin
  select id, consultoria_id, proyecto_id, estado into v_evidencia
  from public.evidencias where id = p_id;

  if not found then
    raise exception 'Evidencia no encontrada o sin acceso' using errcode = '42501';
  end if;

  if v_evidencia.estado = p_estado then
    return;
  end if;

  update public.evidencias set estado = p_estado where id = p_id;
  if not found then
    raise exception 'Sin permiso para revisar esta evidencia' using errcode = '42501';
  end if;

  insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion, estado_anterior, estado_nuevo)
  values (v_evidencia.consultoria_id, v_evidencia.proyecto_id, 'evidencia', p_id, auth.uid(), 'Cambio de estado',
          nullif(trim(p_comentario), ''), v_evidencia.estado, p_estado);
end;
$$;

revoke execute on function public.revisar_evidencia(uuid, text, text) from public, anon;
grant execute on function public.revisar_evidencia(uuid, text, text) to authenticated;
