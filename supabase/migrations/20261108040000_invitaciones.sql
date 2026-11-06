-- Invitaciones de usuarios (bloque B). La Edge Function invitar-usuario:
--   1. llama a autorizar_invitacion CON EL TOKEN DEL ADMIN (aquí viven las reglas);
--   2. con la clave secreta invita (auth.admin.inviteUserByEmail);
--   3. con la clave secreta llama a registrar_invitado (perfil + historial).
-- Si el paso 3 falla, la función borra el usuario de Auth para no dejarlo a medias.

-- ════════════════════════════════════════════════════════════════════════════
-- autorizar_invitacion
-- ════════════════════════════════════════════════════════════════════════════
-- SECURITY DEFINER: tiene que ver si el email ya existe en TODA la plataforma
-- (el RLS del admin solo le muestra su consultoría). Cada permiso, explícito.

create function public.autorizar_invitacion(p_email text, p_rol text, p_consultoria_id uuid, p_empresa_id uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(p_email));
begin
  if auth.uid() is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  -- El rol primero: "admin_prociso" no tiene consultoría y si no daría "sin permiso".
  if p_rol is null or p_rol not in ('consultor', 'admin_consultoria', 'usuario_cliente') then
    raise exception 'Desde la app se invita a consultores, admins de consultoría o clientes' using errcode = '22023';
  end if;

  if not (private.es_admin_prociso() or (p_consultoria_id is not null and private.es_admin_de(p_consultoria_id))) then
    raise exception 'Sin permiso para invitar en esta consultoría' using errcode = '42501';
  end if;

  if not exists (select 1 from public.consultorias where id = p_consultoria_id and activa) then
    raise exception 'La consultoría no existe o está suspendida' using errcode = '22023';
  end if;

  if p_rol = 'usuario_cliente' then
    if p_empresa_id is null or not exists (
      select 1 from public.empresas where id = p_empresa_id and consultoria_id = p_consultoria_id
    ) then
      raise exception 'El cliente tiene que ser de una empresa de esta consultoría' using errcode = '22023';
    end if;
  elsif p_empresa_id is not null then
    raise exception 'Solo los clientes pertenecen a una empresa' using errcode = '22023';
  end if;

  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'El email no es válido' using errcode = '22023';
  end if;
  if exists (select 1 from public.perfiles where lower(email) = v_email)
     or exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'Ese email ya tiene un usuario' using errcode = '22023';
  end if;

  return p_consultoria_id;
end;
$$;

revoke execute on function public.autorizar_invitacion(text, text, uuid, uuid) from public, anon;
grant execute on function public.autorizar_invitacion(text, text, uuid, uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- registrar_invitado
-- ════════════════════════════════════════════════════════════════════════════
-- SOLO service_role (la clave secreta, que vive en la Edge Function). Ningún
-- token de usuario lo ejecuta, ni siquiera el del Admin PROCISO.
-- password_temporal = true: el invitado define su contraseña al entrar.

create function public.registrar_invitado(
  p_usuario_id uuid, p_nombre text, p_email text, p_cargo text, p_rol text,
  p_consultoria_id uuid, p_empresa_id uuid, p_autor_id uuid
) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.perfiles (id, nombre, email, cargo, rol, consultoria_id, empresa_id, password_temporal)
  values (p_usuario_id, trim(p_nombre), lower(trim(p_email)), nullif(trim(p_cargo), ''), p_rol,
          p_consultoria_id, p_empresa_id, true);

  insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion, estado_nuevo)
  values (p_consultoria_id, null, 'usuario', p_usuario_id, p_autor_id, 'Usuario invitado',
          lower(trim(p_email)) || ' · ' || p_rol, 'Invitado');
end;
$$;

revoke execute on function public.registrar_invitado(uuid, text, text, text, text, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.registrar_invitado(uuid, text, text, text, text, uuid, uuid, uuid) to service_role;
