-- L4 (AUD04-B1 y B4, decisión D5 del audit): topes de uso de la IA y cierre de pedidos huérfanos.
--
-- Cada pedido a la IA (analizar-ia / generar-documento) gasta la clave de IA de la
-- consultoría. Hasta hoy solo había rastro (cada pedido queda registrado) pero ningún
-- límite de frecuencia: 8 pedidos seguidos del mismo consultor → 8 × 200.
--
-- El tope vive en la BD y no en la función porque ahí no se puede saltear llamando a la
-- API directamente, y se prueba con pgTAP (028):
--   · 30 pedidos por usuario y 150 por consultoría en las últimas 24 horas;
--   · análisis y generaciones cuentan JUNTOS (gastan la misma clave);
--   · es un trigger AFTER INSERT: corre DESPUÉS de que el RLS aprobó la fila, así quien no
--     tiene permiso recibe 42501 y no se entera del consumo de la consultoría;
--   · si se pasa, aborta el INSERT con el código IA429 (la función lo traduce a HTTP 429).
-- Cambiar los topes = editar las dos constantes de private.aplicar_tope_ia().
--
-- Además: un pedido "Pendiente" viejo (la función se cayó o el proveedor se colgó) quedaba
-- así para siempre. public.cerrar_pedidos_ia_huerfanos() los pasa a "Error"; solo la
-- ejecuta el servidor (la Edge Function la llama antes de cada pedido).

-- ─── Índices para contar rápido ─────────────────────────────────────────────
create index on public.analisis_ia (solicitado_por, creado_en);
create index on public.analisis_ia (consultoria_id, creado_en);
create index on public.generaciones_ia (solicitado_por, creado_en);
create index on public.generaciones_ia (consultoria_id, creado_en);

-- ─── El tope ────────────────────────────────────────────────────────────────
-- DEFINER: tiene que contar los pedidos de TODA la consultoría, no solo los que el RLS
-- le deja ver a quien pide.
create function private.aplicar_tope_ia() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  c_por_usuario    constant integer := 30;
  c_por_consultoria constant integer := 150;
  v_usuario        integer;
  v_consultoria    integer;
begin
  select
    count(*) filter (where t.solicitado_por = new.solicitado_por),
    count(*) filter (where t.consultoria_id = new.consultoria_id)
  into v_usuario, v_consultoria
  from (
    select solicitado_por, consultoria_id from public.analisis_ia
      where creado_en > now() - interval '24 hours'
        and (solicitado_por = new.solicitado_por or consultoria_id = new.consultoria_id)
    union all
    select solicitado_por, consultoria_id from public.generaciones_ia
      where creado_en > now() - interval '24 hours'
        and (solicitado_por = new.solicitado_por or consultoria_id = new.consultoria_id)
  ) t;

  -- La fila nueva ya está contada (AFTER INSERT): se pasa cuando hay MÁS que el tope.
  if v_usuario > c_por_usuario then
    raise exception 'Alcanzaste el tope diario de pedidos a la IA (% por usuario). Inténtalo mañana.', c_por_usuario
      using errcode = 'IA429';
  end if;
  if v_consultoria > c_por_consultoria then
    raise exception 'La consultoría alcanzó el tope diario de pedidos a la IA (%). Inténtalo mañana.', c_por_consultoria
      using errcode = 'IA429';
  end if;
  return null;
end;
$$;

create trigger aplicar_tope_ia after insert on public.analisis_ia
  for each row execute function private.aplicar_tope_ia();
create trigger aplicar_tope_ia after insert on public.generaciones_ia
  for each row execute function private.aplicar_tope_ia();

-- ─── Pedidos huérfanos ──────────────────────────────────────────────────────
create function public.cerrar_pedidos_ia_huerfanos(p_minutos integer default 10) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  c_motivo constant text := 'El pedido no terminó: la función se interrumpió o tardó demasiado. Inténtalo de nuevo.';
  v_analisis integer;
  v_generaciones integer;
begin
  update public.analisis_ia
     set estado = 'Error', error_detalle = c_motivo, completado_en = now()
   where estado = 'Pendiente' and creado_en < now() - make_interval(mins => p_minutos);
  get diagnostics v_analisis = row_count;

  update public.generaciones_ia
     set estado = 'Error', error_detalle = c_motivo, completado_en = now()
   where estado = 'Pendiente' and creado_en < now() - make_interval(mins => p_minutos);
  get diagnostics v_generaciones = row_count;

  return v_analisis + v_generaciones;
end;
$$;

revoke execute on function public.cerrar_pedidos_ia_huerfanos(integer) from public, anon, authenticated;
grant execute on function public.cerrar_pedidos_ia_huerfanos(integer) to service_role;
