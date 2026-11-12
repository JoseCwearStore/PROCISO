-- Decisión del 12/11: el tope diario de pedidos a la IA solo cuenta lo que SÍ gastó tokens.
--
-- "Si voy a la tienda, no encuentro el producto y me voy, no me lo cobran": un 503 del proveedor, una clave
-- inválida, un corte de red o un error nuestro antes de llamar a la IA no se descuentan del cupo. Un pedido cuya
-- respuesta no sirvió (JSON roto, bloqueada, cortada) SÍ cuenta, porque el proveedor ya lo procesó.
--
--   · analisis_ia.sin_consumo: lo escribe SOLO la Edge Function (service_role) al cerrar el pedido como Error; el
--     usuario no puede (no está en el grant de INSERT) y un Completado nunca queda marcado.
--   · Los topes (general y de video, por usuario y por consultoría) y el indicador de uso ignoran esas filas, porque
--     leen de las mismas dos funciones (private.uso_ia y private.uso_video).
--   · Un pedido en curso (Pendiente) sigue contando mientras no termine, y el barrido de huérfanos no los marca
--     (no se sabe qué pasó: se cuenta, lo conservador).
-- Solo los análisis; las generaciones de borradores (generaciones_ia) quedan como estaban.

alter table public.analisis_ia add column sin_consumo boolean not null default false;

-- ─── Una sola fuente del conteo (la usan el trigger que rechaza y la función que informa) ───
create or replace function private.uso_ia(p_usuario uuid, p_consultoria uuid)
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
        and not sin_consumo
        and (solicitado_por = p_usuario or consultoria_id = p_consultoria)
    union all
    select solicitado_por, consultoria_id, creado_en from public.generaciones_ia
      where creado_en > now() - interval '24 hours'
        and (solicitado_por = p_usuario or consultoria_id = p_consultoria)
  ) t
$$;

create or replace function private.uso_video(p_usuario uuid, p_consultoria uuid)
returns table (usuario integer, consultoria integer)
language sql stable security definer set search_path = '' as $$
  select
    (count(*) filter (where a.solicitado_por = p_usuario))::integer,
    (count(*) filter (where a.consultoria_id = p_consultoria))::integer
  from public.analisis_ia a
  where a.modo = 'video'
    and not a.sin_consumo
    and a.creado_en > now() - interval '24 hours'
    and (a.solicitado_por = p_usuario or a.consultoria_id = p_consultoria)
$$;

-- ─── La función que cierra el pedido: ahora dice si gastó o no ──────────────
-- Misma firma + un parámetro con valor por defecto (falso): una llamada vieja sigue contando como antes.
drop function public.registrar_resultado_analisis(uuid, text, text, text, text, text, jsonb);

create function public.registrar_resultado_analisis(
  p_analisis_id uuid, p_estado text, p_resumen text, p_error text,
  p_proveedor text, p_modelo text, p_resultados jsonb,
  p_sin_consumo boolean default false
) returns void
language plpgsql set search_path = '' as $$
declare
  v_analisis record;
  v_item     jsonb;
  v_orden    integer := 0;
begin
  select id, estado, criterio_ids into v_analisis from public.analisis_ia where id = p_analisis_id for update;
  if not found then
    raise exception 'Análisis no encontrado' using errcode = '22023';
  end if;
  if v_analisis.estado <> 'Pendiente' then
    raise exception 'El análisis ya está cerrado (%)', v_analisis.estado using errcode = '22023';
  end if;
  if p_estado not in ('Completado', 'Error') then
    raise exception 'Estado no válido: %', p_estado using errcode = '22023';
  end if;

  if p_estado = 'Completado' then
    for v_item in select * from jsonb_array_elements(coalesce(p_resultados, '[]'::jsonb)) loop
      if not ((v_item->>'criterio_id')::uuid = any (v_analisis.criterio_ids)) then
        raise exception 'El criterio % no fue pedido en este análisis', v_item->>'criterio_id' using errcode = '22023';
      end if;
      v_orden := v_orden + 1;
      insert into public.analisis_ia_resultados (analisis_id, criterio_id, estado, hallazgos, sugerencias, orden)
      values (p_analisis_id, (v_item->>'criterio_id')::uuid, v_item->>'estado',
              v_item->>'hallazgos', v_item->>'sugerencias', v_orden);
    end loop;
  end if;

  update public.analisis_ia set
    estado        = p_estado,
    resumen       = p_resumen,
    error_detalle = case when p_estado = 'Error' then coalesce(p_error, 'Error sin detalle') else null end,
    proveedor     = p_proveedor,
    modelo        = p_modelo,
    -- Solo un Error puede quedar "sin consumo": un análisis completado siempre gastó.
    sin_consumo   = (p_estado = 'Error' and coalesce(p_sin_consumo, false)),
    completado_en = now()
  where id = p_analisis_id;
end;
$$;

revoke execute on function public.registrar_resultado_analisis(uuid, text, text, text, text, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.registrar_resultado_analisis(uuid, text, text, text, text, text, jsonb, boolean) to service_role;
