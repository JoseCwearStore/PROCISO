-- Administración de consultorías y usuarios (reglas elegidas el 2026-11-06).

-- ════════════════════════════════════════════════════════════════════════════
-- Consultoría suspendida = su gente sin acceso
-- ════════════════════════════════════════════════════════════════════════════
-- Todas las políticas pasan por estos helpers. Un solo chequeo central: perfil
-- activo Y consultoría activa (el Admin PROCISO no tiene consultoría).

create function private.yo_habilitado() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.perfiles yo
    left join public.consultorias c on c.id = yo.consultoria_id
    where yo.id = auth.uid() and yo.activo
      and (yo.consultoria_id is null or c.activa)
  )
$$;

create or replace function private.mi_rol() returns text
language sql stable security definer set search_path = '' as $$
  select rol from public.perfiles where id = auth.uid() and activo and private.yo_habilitado()
$$;

create or replace function private.mi_consultoria_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select consultoria_id from public.perfiles where id = auth.uid() and activo and private.yo_habilitado()
$$;

create or replace function private.mi_empresa_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select empresa_id from public.perfiles where id = auth.uid() and activo and private.yo_habilitado()
$$;

create or replace function private.es_admin_de(p_consultoria_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and activo and private.yo_habilitado()
      and rol = 'admin_consultoria' and consultoria_id = p_consultoria_id
  )
$$;

create or replace function private.es_equipo_de(p_consultoria_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and activo and private.yo_habilitado()
      and rol in ('admin_consultoria', 'consultor') and consultoria_id = p_consultoria_id
  )
$$;

create or replace function private.puede_ver_proyecto(p_proyecto_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.proyectos p
    join public.perfiles yo on yo.id = auth.uid() and yo.activo
    where p.id = p_proyecto_id
      and private.yo_habilitado()
      and (
           yo.rol = 'admin_prociso'
        or (yo.rol = 'admin_consultoria' and p.consultoria_id = yo.consultoria_id)
        or (yo.rol = 'consultor' and exists (
              select 1 from public.proyecto_miembros m
              where m.proyecto_id = p.id and m.usuario_id = yo.id))
        or (yo.rol = 'usuario_cliente' and p.empresa_id = yo.empresa_id)
      )
  )
$$;

create or replace function private.puede_editar_proyecto(p_proyecto_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.proyectos p
    join public.perfiles yo on yo.id = auth.uid() and yo.activo
    where p.id = p_proyecto_id
      and private.yo_habilitado()
      and (
           yo.rol = 'admin_prociso'
        or (yo.rol = 'admin_consultoria' and p.consultoria_id = yo.consultoria_id)
        or (yo.rol = 'consultor' and exists (
              select 1 from public.proyecto_miembros m
              where m.proyecto_id = p.id and m.usuario_id = yo.id))
      )
  )
$$;

create or replace function private.es_equipo_del_proyecto(p_proyecto_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.proyectos p
    join public.perfiles yo on yo.id = auth.uid() and yo.activo
    where p.id = p_proyecto_id
      and private.yo_habilitado()
      and (
           (yo.rol = 'admin_consultoria' and p.consultoria_id = yo.consultoria_id)
        or (yo.rol = 'consultor' and exists (
              select 1 from public.proyecto_miembros m
              where m.proyecto_id = p.id and m.usuario_id = yo.id))
      )
  )
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- Permisos por columna de consultorias
-- ════════════════════════════════════════════════════════════════════════════
-- La política "admins editan su consultoría" dejaba al admin cambiar CUALQUIER
-- columna de su fila: suspenderse sin historial o subirse el plan y los límites.
-- Por UPDATE directo, solo los datos de contacto; el estado, por la RPC de abajo.
-- (El INSERT ya está limitado al Admin PROCISO por su política.)

revoke insert, update on public.consultorias from anon, authenticated;
grant insert (id, nombre, rfc, plan, contacto, email, limite_usuarios, almacenamiento_gb, renovacion)
  on public.consultorias to authenticated;
grant update (nombre, rfc, contacto, email) on public.consultorias to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- cambiar_estado_consultoria
-- ════════════════════════════════════════════════════════════════════════════
-- SECURITY DEFINER porque deja historial y el Admin PROCISO no puede insertar en
-- historial por RLS (no tiene consultoría propia). Por eso el permiso se chequea acá.

create function public.cambiar_estado_consultoria(p_id uuid, p_activa boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_activa boolean;
begin
  if not private.es_admin_prociso() then
    raise exception 'Solo el Admin PROCISO suspende o reactiva consultorías' using errcode = '42501';
  end if;

  select activa into v_activa from public.consultorias where id = p_id;
  if not found then
    raise exception 'Consultoría no encontrada' using errcode = '22023';
  end if;
  if p_activa is null or v_activa = p_activa then
    raise exception 'La consultoría ya está en ese estado' using errcode = '22023';
  end if;

  update public.consultorias set activa = p_activa where id = p_id;

  insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion, estado_anterior, estado_nuevo)
  values (p_id, null, 'consultoria', p_id, auth.uid(),
          case when p_activa then 'Consultoría reactivada' else 'Consultoría suspendida' end,
          case when p_activa then 'Su equipo y sus clientes recuperan el acceso.' else 'Su equipo y sus clientes pierden el acceso.' end,
          case when v_activa then 'Activa' else 'Suspendida' end,
          case when p_activa then 'Activa' else 'Suspendida' end);
end;
$$;

revoke execute on function public.cambiar_estado_consultoria(uuid, boolean) from public, anon;
grant execute on function public.cambiar_estado_consultoria(uuid, boolean) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- administrar_usuario: suspender, restablecer y cambiar rol
-- ════════════════════════════════════════════════════════════════════════════
-- SECURITY DEFINER: el navegador no tiene UPDATE sobre rol ni activo (a propósito).
-- Cada permiso se chequea en forma explícita. null = no cambiar ese dato.

create function public.administrar_usuario(p_id uuid, p_rol text, p_activo boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := auth.uid();
  v_obj  record;
  v_hubo boolean := false;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;
  if p_rol is null and p_activo is null then
    raise exception 'Indicá qué cambiar' using errcode = '22023';
  end if;
  if p_id = v_uid then
    raise exception 'Nadie se suspende ni se cambia el rol a sí mismo' using errcode = '22023';
  end if;

  select id, rol, activo, consultoria_id, email into v_obj from public.perfiles where id = p_id;
  -- "No existe" y "no es tuyo" responden lo mismo: no se revela qué usuarios hay.
  if not found
     or not (private.es_admin_prociso()
             or (v_obj.consultoria_id is not null and private.es_admin_de(v_obj.consultoria_id))) then
    raise exception 'Usuario no encontrado o sin permiso' using errcode = '42501';
  end if;

  if p_rol is not null and p_rol is distinct from v_obj.rol then
    if p_rol not in ('consultor', 'admin_consultoria') or v_obj.rol not in ('consultor', 'admin_consultoria') then
      raise exception 'Solo se cambia el rol dentro del equipo (consultor o admin de consultoría)' using errcode = '22023';
    end if;
    update public.perfiles set rol = p_rol where id = p_id;
    insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion, estado_anterior, estado_nuevo)
    values (v_obj.consultoria_id, null, 'usuario', p_id, v_uid, 'Rol actualizado', v_obj.email, v_obj.rol, p_rol);
    v_hubo := true;
  end if;

  if p_activo is not null and p_activo is distinct from v_obj.activo then
    if v_obj.rol = 'admin_prociso' then
      raise exception 'El Admin PROCISO no se administra desde la app' using errcode = '22023';
    end if;
    update public.perfiles set activo = p_activo where id = p_id;
    insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion, estado_anterior, estado_nuevo)
    values (v_obj.consultoria_id, null, 'usuario', p_id, v_uid,
            case when p_activo then 'Acceso restablecido' else 'Acceso suspendido' end, v_obj.email,
            case when v_obj.activo then 'Activo' else 'Suspendido' end,
            case when p_activo then 'Activo' else 'Suspendido' end);
    v_hubo := true;
  end if;

  if not v_hubo then
    raise exception 'El usuario ya está así' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.administrar_usuario(uuid, text, boolean) from public, anon;
grant execute on function public.administrar_usuario(uuid, text, boolean) to authenticated;
