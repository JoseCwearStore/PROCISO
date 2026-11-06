-- El usuario no tiene permiso de UPDATE sobre perfiles.password_temporal (solo
-- sobre nombre y cargo). Esta función hace exactamente una cosa: desmarcar la
-- bandera del propio usuario después de cambiar su contraseña temporal.

create function public.marcar_contrasena_cambiada() returns void
language sql security definer set search_path = '' as $$
  update public.perfiles set password_temporal = false where id = auth.uid()
$$;

revoke execute on function public.marcar_contrasena_cambiada() from public, anon;
grant execute on function public.marcar_contrasena_cambiada() to authenticated;
