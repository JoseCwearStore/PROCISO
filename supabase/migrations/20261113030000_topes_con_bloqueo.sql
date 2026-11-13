-- AUD10-M5 y M6 · Los topes diarios cuentan con bloqueo.
--
-- M6: los triggers de tope (IA, video, soporte) cuentan las filas ya confirmadas más la propia. Dos pedidos a la vez
-- no se ven entre sí (cada uno cuenta solo lo confirmado), así que los dos pasan y el tope se excede. Con un
-- `pg_advisory_xact_lock` por usuario (y por consultoría, en IA) tomado ANTES de contar, el segundo espera a que el
-- primero termine y cuenta ya con el primero incluido. El bloqueo se suelta solo al terminar la transacción. Siempre se
-- toma en el mismo orden (usuario, después consultoría), así que no puede haber un abrazo mortal.
--
-- M5: el tope de 20 transcripciones por día contaba filas de `historial` que se escriben DESPUÉS de llamar al
-- proveedor: dos pedidos a la vez veían el mismo conteo y un pedido que fallaba (y ya había gastado la llamada) no
-- contaba. Ahora el pedido se cuenta al AUTORIZAR, en una tabla propia, con el mismo bloqueo por usuario.

-- ─── M5: pedidos de transcripción ───────────────────────────────────────────
create table private.pedidos_transcripcion (
  id         bigint generated always as identity primary key,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  creado_en  timestamptz not null default now()
);
create index on private.pedidos_transcripcion (usuario_id, creado_en);
revoke all on private.pedidos_transcripcion from public, anon, authenticated;

create or replace function public.autorizar_transcripcion(p_evidencia_id uuid)
returns table (consultoria_id uuid, proyecto_id uuid, tipo text, archivo_ruta text, archivo_mime text)
language plpgsql security definer set search_path = '' as $$
declare
  v_ev   record;
  v_tope integer := private.tope_transcripciones();
begin
  select e.consultoria_id, e.proyecto_id, e.tipo, e.archivo_ruta, e.archivo_mime into v_ev
  from public.evidencias e where e.id = p_evidencia_id;
  if not found or not private.es_equipo_del_proyecto(v_ev.proyecto_id) then
    raise exception 'Evidencia no encontrada o sin permiso para transcribirla' using errcode = '42501';
  end if;
  if v_ev.tipo not in ('Audio', 'Video') then
    raise exception 'Solo se transcriben evidencias de audio o video' using errcode = '22023';
  end if;
  if v_ev.archivo_ruta is null then
    raise exception 'La evidencia no tiene archivo adjunto' using errcode = '22023';
  end if;

  -- M5: se bloquea por usuario antes de contar, y el pedido queda contado en ESTA transacción (no cuando termina).
  perform pg_advisory_xact_lock(hashtextextended('transcripcion:' || auth.uid()::text, 0));
  if (select count(*) from private.pedidos_transcripcion p
      where p.usuario_id = auth.uid() and p.creado_en > now() - interval '24 hours') >= v_tope then
    raise exception 'Alcanzaste el tope diario de transcripciones (%). Inténtalo mañana.', v_tope using errcode = 'IA429';
  end if;
  insert into private.pedidos_transcripcion (usuario_id) values (auth.uid());

  return query select v_ev.consultoria_id, v_ev.proyecto_id, v_ev.tipo, v_ev.archivo_ruta, v_ev.archivo_mime;
end;
$$;

-- ─── M6: topes de IA, video y soporte ───────────────────────────────────────
create or replace function private.aplicar_tope_ia() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_tope  record;
  v_uso   record;
  v_tvid  record;
  v_uvid  record;
begin
  -- M6: el segundo pedido espera al primero y recién ahí cuenta (ver el encabezado). Siempre en este orden.
  perform pg_advisory_xact_lock(hashtextextended('ia:usuario:' || new.solicitado_por::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('ia:consultoria:' || new.consultoria_id::text, 0));

  select * into v_tope from private.topes_ia();
  select * into v_uso from private.uso_ia(new.solicitado_por, new.consultoria_id);

  -- La fila nueva ya está contada (AFTER INSERT): se pasa cuando hay MÁS que el tope.
  if v_uso.usuario > v_tope.por_usuario then
    raise exception 'Alcanzaste el tope diario de pedidos a la IA (% por usuario). Inténtalo mañana.', v_tope.por_usuario
      using errcode = 'IA429';
  end if;
  if v_uso.consultoria > v_tope.por_consultoria then
    raise exception 'La consultoría alcanzó el tope diario de pedidos a la IA (%). Inténtalo mañana.', v_tope.por_consultoria
      using errcode = 'IA429';
  end if;

  if to_jsonb(new) ->> 'modo' = 'video' then
    select * into v_tvid from private.topes_video();
    select * into v_uvid from private.uso_video(new.solicitado_por, new.consultoria_id);
    if v_uvid.usuario > v_tvid.por_usuario then
      raise exception 'Alcanzaste el tope diario de análisis de video (% por usuario). Inténtalo mañana.', v_tvid.por_usuario
        using errcode = 'IA429';
    end if;
    if v_uvid.consultoria > v_tvid.por_consultoria then
      raise exception 'La consultoría alcanzó el tope diario de análisis de video (%). Inténtalo mañana.', v_tvid.por_consultoria
        using errcode = 'IA429';
    end if;
  end if;
  return null;
end;
$$;

create or replace function private.aplicar_tope_soporte() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  c_por_dia constant integer := 10;
begin
  -- M6: ver el encabezado.
  perform pg_advisory_xact_lock(hashtextextended('soporte:usuario:' || new.usuario_id::text, 0));

  -- La fila nueva ya está contada (AFTER INSERT): se pasa cuando hay MÁS que el tope.
  if (select count(*) from public.soporte_reportes
      where usuario_id = new.usuario_id and creado_en > now() - interval '24 hours') > c_por_dia then
    raise exception 'Alcanzaste el máximo de % reportes de soporte por día. Inténtalo mañana.', c_por_dia
      using errcode = 'LM429';
  end if;
  return null;
end;
$$;
