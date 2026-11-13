-- AUD10-M7 · Invitar usuarios: límites y usuarios huérfanos de Auth.
--
-- 1. `consultorias.limite_usuarios` existía y lo mostraba la pantalla, pero ninguna regla lo aplicaba: se podía invitar
--    sin fin. Ahora `autorizar_invitacion` rechaza (IV409) cuando los usuarios ACTIVOS de la consultoría ya son el límite.
--    Un límite en blanco (null) significa sin tope. Vale también para el Admin PROCISO.
-- 2. Tope diario de invitaciones por administrador (20): cada invitación manda un correo (un gasto, y spam si se abusa).
--    Se cuenta al AUTORIZAR, en una tabla propia y con un bloqueo por administrador (como los topes de AUD10-M5/M6).
-- 3. Si la Edge Function moría entre `inviteUserByEmail` y `registrar_invitado`, quedaba un usuario en Auth sin perfil y
--    el reintento se rechazaba con "ese email ya tiene un usuario": había que limpiarlo a mano. Un usuario de Auth se
--    reconoce como HUÉRFANO si no tiene perfil, nunca confirmó el correo, nunca entró y se creó hace más de 5 minutos
--    (los 5 minutos evitan confundirlo con una invitación que todavía está en curso). A un huérfano se le puede volver a
--    invitar: la Edge Function lo borra (huerfano_de_invitacion) y vuelve a invitar.

create function private.tope_invitaciones() returns integer
language sql immutable as $$ select 20 $$;

create table private.pedidos_invitacion (
  id        bigint generated always as identity primary key,
  admin_id  uuid not null references public.perfiles (id) on delete cascade,
  creado_en timestamptz not null default now()
);
create index on private.pedidos_invitacion (admin_id, creado_en);
revoke all on private.pedidos_invitacion from public, anon, authenticated;

create function private.es_usuario_huerfano(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    where u.id = p_id
      and u.created_at < now() - interval '5 minutes'
      and u.email_confirmed_at is null
      and u.last_sign_in_at is null
      and not exists (select 1 from public.perfiles p where p.id = u.id)
  )
$$;
revoke all on function private.es_usuario_huerfano(uuid) from public, anon, authenticated;

create or replace function public.autorizar_invitacion(p_email text, p_rol text, p_consultoria_id uuid, p_empresa_id uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_email  text := lower(trim(p_email));
  v_limite integer;
  v_tope   integer := private.tope_invitaciones();
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
  -- Un usuario de Auth huérfano (ver el encabezado) no cuenta como "ya tiene un usuario": se puede volver a invitar.
  if exists (select 1 from public.perfiles where lower(email) = v_email)
     or exists (select 1 from auth.users u where lower(u.email) = v_email and not private.es_usuario_huerfano(u.id)) then
    raise exception 'Ese email ya tiene un usuario' using errcode = '22023';
  end if;

  -- M7: los dos límites se miran con bloqueo (dos invitaciones a la vez no se ven entre sí) y siempre en este orden.
  perform pg_advisory_xact_lock(hashtextextended('invitacion:consultoria:' || p_consultoria_id::text, 0));
  select c.limite_usuarios into v_limite from public.consultorias c where c.id = p_consultoria_id;
  if v_limite is not null
     and (select count(*) from public.perfiles p where p.consultoria_id = p_consultoria_id and p.activo) >= v_limite then
    raise exception 'La consultoría alcanzó su límite de usuarios (%). Pide ampliarlo antes de invitar a más personas.', v_limite
      using errcode = 'IV409';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('invitacion:admin:' || auth.uid()::text, 0));
  if (select count(*) from private.pedidos_invitacion i
      where i.admin_id = auth.uid() and i.creado_en > now() - interval '24 hours') >= v_tope then
    raise exception 'Alcanzaste el tope diario de invitaciones (%). Inténtalo mañana.', v_tope using errcode = 'IV429';
  end if;
  insert into private.pedidos_invitacion (admin_id) values (auth.uid());

  return p_consultoria_id;
end;
$$;

-- Solo la Edge Function, con la clave secreta: devuelve el id del usuario de Auth huérfano de ese email (o null).
create function public.huerfano_de_invitacion(p_email text) returns uuid
language sql stable security definer set search_path = '' as $$
  select u.id from auth.users u
  where lower(u.email) = lower(trim(p_email)) and private.es_usuario_huerfano(u.id)
  limit 1
$$;
revoke execute on function public.huerfano_de_invitacion(text) from public, anon, authenticated;
grant execute on function public.huerfano_de_invitacion(text) to service_role;
