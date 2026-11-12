-- L5a2 (AUD07-M2): soporte y reporte de errores de verdad.
--
-- La pantalla de Ayuda tenía un formulario que descartaba el mensaje y avisaba "registrado":
-- simulaba una acción. Ahora el reporte se guarda, lo ve quien corresponde y un admin lo marca
-- como atendido.
--
--   · Cualquier usuario con sesión activa envía un reporte (soporte o error).
--   · Usuario y consultoría los pone la BD (defaults): el cliente HTTP solo manda tipo, asunto y
--     mensaje, así que no puede enviar "a nombre de otro" ni en otra consultoría.
--   · Lo leen: su autor, el Admin Consultoría de esa consultoría y el Admin PROCISO.
--   · Nadie edita ni borra un reporte. Solo atender_reporte() lo pasa a "Atendido".
--   · Tope de 10 reportes por usuario en 24 horas (trigger AFTER INSERT, código LM429), para que
--     el formulario no sirva de buzón sin fondo.

create table public.soporte_reportes (
  id             uuid primary key default gen_random_uuid(),
  -- null cuando lo envía el Admin PROCISO (no pertenece a ninguna consultoría)
  consultoria_id uuid default private.mi_consultoria_id() references public.consultorias (id) on delete cascade,
  usuario_id     uuid not null default auth.uid() references public.perfiles (id),
  tipo           text not null check (tipo in ('Soporte', 'Error')),
  asunto         text not null check (char_length(btrim(asunto)) between 1 and 120),
  mensaje        text not null check (char_length(btrim(mensaje)) between 1 and 2000),
  estado         text not null default 'Abierto' check (estado in ('Abierto', 'Atendido')),
  atendido_por   uuid references public.perfiles (id),
  atendido_en    timestamptz,
  creado_en      timestamptz not null default now(),
  check (
       (estado = 'Abierto'  and atendido_por is null     and atendido_en is null)
    or (estado = 'Atendido' and atendido_por is not null and atendido_en is not null)
  )
);

create index on public.soporte_reportes (usuario_id, creado_en);
create index on public.soporte_reportes (consultoria_id, estado, creado_en);

alter table public.soporte_reportes enable row level security;

create policy "ver reportes de soporte" on public.soporte_reportes for select to authenticated
  using (
    (usuario_id = (select auth.uid()) and (select private.yo_habilitado()))
    or (select private.es_admin_prociso())
    or private.es_admin_de(consultoria_id)
  );

create policy "enviar reporte de soporte" on public.soporte_reportes for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and (select private.yo_habilitado())
    and consultoria_id is not distinct from (select private.mi_consultoria_id())
  );

-- Sin policies de UPDATE ni DELETE y sin grants: el contenido de un reporte no se toca.
revoke all on public.soporte_reportes from anon, authenticated;
grant select on public.soporte_reportes to authenticated;
grant insert (tipo, asunto, mensaje) on public.soporte_reportes to authenticated;

-- ─── Tope: 10 por usuario en 24 horas ───────────────────────────────────────
create function private.aplicar_tope_soporte() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  c_por_dia constant integer := 10;
begin
  -- La fila nueva ya está contada (AFTER INSERT): se pasa cuando hay MÁS que el tope.
  if (select count(*) from public.soporte_reportes
      where usuario_id = new.usuario_id and creado_en > now() - interval '24 hours') > c_por_dia then
    raise exception 'Alcanzaste el máximo de % reportes de soporte por día. Inténtalo mañana.', c_por_dia
      using errcode = 'LM429';
  end if;
  return null;
end;
$$;

create trigger aplicar_tope_soporte after insert on public.soporte_reportes
  for each row execute function private.aplicar_tope_soporte();

-- ─── Atender un reporte ─────────────────────────────────────────────────────
-- Solo un admin (de la consultoría del reporte, o el Admin PROCISO). Si el reporte no existe o
-- es de otra consultoría la respuesta es la misma ("no encontrado"): no se confirma que exista.
create function public.atender_reporte(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_rol text := private.mi_rol();
  v_rep record;
begin
  if v_rol is null or v_rol not in ('admin_consultoria', 'admin_prociso') then
    raise exception 'Solo un administrador atiende los reportes.' using errcode = '42501';
  end if;

  select id, estado, consultoria_id into v_rep from public.soporte_reportes where id = p_id for update;
  if not found
     or (v_rol = 'admin_consultoria' and v_rep.consultoria_id is distinct from private.mi_consultoria_id()) then
    raise exception 'Reporte no encontrado.' using errcode = '22023';
  end if;
  if v_rep.estado = 'Atendido' then
    raise exception 'El reporte ya está atendido.' using errcode = '22023';
  end if;

  update public.soporte_reportes
     set estado = 'Atendido', atendido_por = auth.uid(), atendido_en = now()
   where id = p_id;
end;
$$;

revoke execute on function public.atender_reporte(uuid) from public, anon;
grant execute on function public.atender_reporte(uuid) to authenticated;
