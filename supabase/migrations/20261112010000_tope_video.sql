-- AUD09-M4: tope propio, más bajo, para el análisis de VIDEO.
--
-- Un análisis de video cuesta mucho más que uno de texto (el modelo mira la imagen y el archivo se sube al
-- proveedor), pero compartía el tope diario de 30 por usuario / 150 por consultoría con todo lo demás.
-- Ahora, ADEMÁS del tope general (el pedido de video también cuenta ahí):
--   · 5 análisis de video por usuario y 15 por consultoría en 24 h.
-- Cambiar los topes = editar private.topes_video() (una sola fuente, como private.topes_ia()).
--
-- `modo` distingue el pedido ('texto' por defecto, 'video'). Lo manda la Edge Function al crear el pedido:
-- el costo real solo ocurre en la rama de video de la función, que siempre inserta con modo = 'video'.

alter table public.analisis_ia
  add column modo text not null default 'texto' check (modo in ('texto', 'video'));

-- Lo ya hecho con el modelo de video (la función anota proveedor = 'gemini') se cuenta como video.
update public.analisis_ia set modo = 'video' where proveedor = 'gemini';

grant insert (modo) on public.analisis_ia to authenticated;

create function private.topes_video() returns table (por_usuario integer, por_consultoria integer)
language sql immutable set search_path = '' as $$
  select 5, 15
$$;

-- DEFINER: tiene que contar TODA la consultoría, no solo lo que el RLS le deja ver a quien pide.
create function private.uso_video(p_usuario uuid, p_consultoria uuid)
returns table (usuario integer, consultoria integer)
language sql stable security definer set search_path = '' as $$
  select
    (count(*) filter (where a.solicitado_por = p_usuario))::integer,
    (count(*) filter (where a.consultoria_id = p_consultoria))::integer
  from public.analisis_ia a
  where a.modo = 'video'
    and a.creado_en > now() - interval '24 hours'
    and (a.solicitado_por = p_usuario or a.consultoria_id = p_consultoria)
$$;

revoke execute on function private.topes_video() from public, anon, authenticated;
revoke execute on function private.uso_video(uuid, uuid) from public, anon, authenticated;

-- El trigger del tope (compartido por analisis_ia y generaciones_ia): igual que antes, más el tope de video.
-- `to_jsonb(new)->>'modo'` porque generaciones_ia no tiene esa columna. Primero el tope general: si ya
-- se pasó, ese es el mensaje (es el límite que el usuario ve en pantalla).
create or replace function private.aplicar_tope_ia() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_tope  record;
  v_uso   record;
  v_tvid  record;
  v_uvid  record;
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
