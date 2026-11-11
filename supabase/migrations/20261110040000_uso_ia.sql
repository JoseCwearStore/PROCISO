-- L4b: mostrar el consumo del tope diario de IA (D5) para que nadie se tope sin enterarse.
--
-- Los topes y el conteo dejan de estar escritos dentro del trigger y pasan a UNA fuente que
-- usan los dos: el trigger que RECHAZA (028) y la función que INFORMA (esta). Así el número
-- que ve la pantalla nunca puede diferir del que aplica la BD.
--   · private.topes_ia()  → los topes (30 por usuario, 150 por consultoría en 24 h).
--   · private.uso_ia()    → cuántos pedidos lleva un usuario y su consultoría en 24 h
--                           (análisis y generaciones juntos) y cuál es el más viejo.
--   · public.mi_uso_ia()  → lo que ve el equipo: consumo, topes y cuándo se libera el cupo.

create function private.topes_ia() returns table (por_usuario integer, por_consultoria integer)
language sql immutable set search_path = '' as $$
  select 30, 150
$$;

-- DEFINER: tiene que contar TODA la consultoría, no solo lo que el RLS le deja ver a quien pregunta.
create function private.uso_ia(p_usuario uuid, p_consultoria uuid)
returns table (usuario integer, consultoria integer, usuario_mas_viejo timestamptz, consultoria_mas_vieja timestamptz)
language sql stable security definer set search_path = '' as $$
  select
    (count(*) filter (where t.solicitado_por = p_usuario))::integer,
    (count(*) filter (where t.consultoria_id = p_consultoria))::integer,
    min(t.creado_en) filter (where t.solicitado_por = p_usuario),
    min(t.creado_en) filter (where t.consultoria_id = p_consultoria)
  from (
    select solicitado_por, consultoria_id, creado_en from public.analisis_ia
      where creado_en > now() - interval '24 hours'
        and (solicitado_por = p_usuario or consultoria_id = p_consultoria)
    union all
    select solicitado_por, consultoria_id, creado_en from public.generaciones_ia
      where creado_en > now() - interval '24 hours'
        and (solicitado_por = p_usuario or consultoria_id = p_consultoria)
  ) t
$$;

-- El trigger del tope (028), ahora apoyado en las dos funciones de arriba. Mismos mensajes y
-- mismo código IA429; sigue siendo AFTER INSERT (el RLS decide primero).
create or replace function private.aplicar_tope_ia() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_tope record;
  v_uso  record;
begin
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
  return null;
end;
$$;

-- ─── Lo que ve el equipo ────────────────────────────────────────────────────
-- libera_en = cuando el pedido MÁS VIEJO de la ventana cumple 24 h (ahí se libera un cupo).
-- Solo el equipo: el cliente y el Admin PROCISO no gastan la clave de IA de una consultoría.
create function public.mi_uso_ia()
returns table (
  usuario_usados integer, usuario_tope integer, usuario_libera_en timestamptz,
  consultoria_usados integer, consultoria_tope integer, consultoria_libera_en timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_rol          text := private.mi_rol();
  v_consultoria  uuid := private.mi_consultoria_id();
begin
  if v_rol is null or v_rol not in ('admin_consultoria', 'consultor') or v_consultoria is null then
    raise exception 'Solo el equipo de la consultoría usa la IA.' using errcode = '42501';
  end if;
  return query
    select u.usuario, t.por_usuario, u.usuario_mas_viejo + interval '24 hours',
           u.consultoria, t.por_consultoria, u.consultoria_mas_vieja + interval '24 hours'
    from private.uso_ia(auth.uid(), v_consultoria) u, private.topes_ia() t;
end;
$$;

revoke execute on function private.topes_ia() from public, anon, authenticated;
revoke execute on function private.uso_ia(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.mi_uso_ia() from public, anon;
grant execute on function public.mi_uso_ia() to authenticated;
