-- O34 · Crear, archivar y reactivar una empresa quedan en el historial.
-- Antes no dejaban nada: la pestaña Historial de la ficha no mostraba cuándo ni quién registró la empresa ni cuándo se
-- archivó. Las empresas se escriben directo por la API (sin RPC), así que lo registra un trigger y vale para cualquier
-- camino. Editar otros datos no genera ruido: solo el alta y los cambios de `activa`.

create function private.historial_empresa() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion)
    values (new.consultoria_id, null, 'empresa', new.id, auth.uid(), 'Empresa registrada', new.nombre);
  elsif new.activa is distinct from old.activa then
    insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion, estado_anterior, estado_nuevo)
    values (new.consultoria_id, null, 'empresa', new.id, auth.uid(),
            case when new.activa then 'Empresa reactivada' else 'Empresa archivada' end, new.nombre,
            case when old.activa then 'Activa' else 'Archivada' end,
            case when new.activa then 'Activa' else 'Archivada' end);
  end if;
  return null;
end;
$$;
revoke all on function private.historial_empresa() from public, anon, authenticated;

create trigger historial_empresa after insert or update of activa on public.empresas
  for each row execute function private.historial_empresa();
