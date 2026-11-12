-- D6 / AUD01-M2: marcar_contrasena_cambiada() desmarcaba la bandera sin comprobar
-- que la contraseña hubiera cambiado. Quien conociera la contraseña inicial (p. ej.
-- la del seed) podía llamar a la función y no cambiarla nunca.
--
-- Qué se guarda: al marcar un perfil como temporal se guarda la HUELLA (el hash de
-- auth.users.encrypted_password) de ese momento. La función solo desmarca si el hash
-- actual es otro. Se compara el hash y no auth.users.updated_at porque un inicio de
-- sesión ya mueve updated_at (medido el 2026-11-11): con esa fecha la verificación
-- sería decorativa. El hash sí cambia solo cuando cambia la contraseña, y GoTrue
-- rechaza reusar la misma (same_password).
--
-- Límite conocido: esto hace honesta la función, pero NO bloquea el acceso a los datos
-- mientras la contraseña es temporal (las políticas RLS no miran password_temporal).

create table private.contrasena_temporal (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  hash       text  -- puede ser nulo o vacío: un invitado todavía no tiene contraseña
);

-- schema private: ni lectura ni escritura para la API.
revoke all on private.contrasena_temporal from public, anon, authenticated;

-- Quien ya estaba marcado como temporal queda pendiente de un cambio desde ahora.
insert into private.contrasena_temporal (usuario_id, hash)
select p.id, u.encrypted_password
from public.perfiles p
join auth.users u on u.id = p.id
where p.password_temporal;

create function private.guardar_huella_contrasena() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.password_temporal then
    insert into private.contrasena_temporal (usuario_id, hash)
    select new.id, u.encrypted_password from auth.users u where u.id = new.id
    on conflict (usuario_id) do update set hash = excluded.hash;
  else
    delete from private.contrasena_temporal where usuario_id = new.id;
  end if;
  return null;
end;
$$;

revoke execute on function private.guardar_huella_contrasena() from public, anon, authenticated;

create trigger guardar_huella_contrasena
  after insert or update of password_temporal on public.perfiles
  for each row execute function private.guardar_huella_contrasena();

create or replace function public.marcar_contrasena_cambiada() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1
    from private.contrasena_temporal t
    join auth.users u on u.id = t.usuario_id
    where t.usuario_id = auth.uid()
      and u.encrypted_password is not distinct from t.hash
  ) then
    raise exception 'Cambia tu contraseña temporal para continuar.' using errcode = '22023';
  end if;

  update public.perfiles set password_temporal = false where id = auth.uid();
end;
$$;
