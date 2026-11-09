-- Tipo de proceso (B4, 2026-11-09): Estratégico, Operativo o Apoyo.
-- Clasifica los procesos en el Mapa de procesos y en la Ficha de caracterización.
-- Es OPCIONAL: los procesos ya levantados quedan sin definir (NULL) y se siguen guardando.

alter table public.procesos
  add column tipo text check (tipo in ('Estratégico', 'Operativo', 'Apoyo'));

-- guardar_proceso con el tipo. Misma función de siempre (SECURITY INVOKER: el RLS decide
-- quién escribe); un tipo vacío o ausente queda como NULL y uno inválido lo rechaza el CHECK.
create or replace function public.guardar_proceso(p_proceso jsonb, p_actividades jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_id          uuid := (p_proceso->>'id')::uuid;
  v_proyecto    uuid := (p_proceso->>'proyecto_id')::uuid;
  v_consultoria uuid;
begin
  select consultoria_id into v_consultoria from public.proyectos where id = v_proyecto;
  if v_consultoria is null then
    raise exception 'Proyecto no encontrado o sin acceso' using errcode = '42501';
  end if;

  insert into public.procesos (
    id, consultoria_id, proyecto_id, responsable_id, nombre, descripcion, estado, fecha_levantamiento, tipo,
    objetivo, alcance, puesto_responsable, personal_involucrado,
    entradas, salidas, proveedores, clientes, recursos_materiales, equipos, sistemas, controles,
    registros, indicadores, riesgos, problemas, observaciones, mejoras, no_aplica
  ) values (
    v_id, v_consultoria, v_proyecto, nullif(p_proceso->>'responsable_id', '')::uuid,
    p_proceso->>'nombre', p_proceso->>'descripcion', p_proceso->>'estado', current_date, nullif(p_proceso->>'tipo', ''),
    p_proceso->>'objetivo', p_proceso->>'alcance', p_proceso->>'puesto_responsable', p_proceso->>'personal_involucrado',
    private.lista_texto(p_proceso->'entradas'), private.lista_texto(p_proceso->'salidas'),
    private.lista_texto(p_proceso->'proveedores'), private.lista_texto(p_proceso->'clientes'),
    private.lista_texto(p_proceso->'recursos_materiales'), private.lista_texto(p_proceso->'equipos'),
    private.lista_texto(p_proceso->'sistemas'), private.lista_texto(p_proceso->'controles'),
    private.lista_texto(p_proceso->'registros'), private.lista_texto(p_proceso->'indicadores'),
    private.lista_texto(p_proceso->'riesgos'), private.lista_texto(p_proceso->'problemas'),
    p_proceso->>'observaciones', p_proceso->>'mejoras', coalesce(p_proceso->'no_aplica', '{}'::jsonb)
  )
  -- Al actualizar no se mueve de proyecto ni de consultoría.
  on conflict (id) do update set
    responsable_id = excluded.responsable_id, nombre = excluded.nombre, descripcion = excluded.descripcion,
    estado = excluded.estado, fecha_levantamiento = excluded.fecha_levantamiento, tipo = excluded.tipo,
    objetivo = excluded.objetivo, alcance = excluded.alcance, puesto_responsable = excluded.puesto_responsable,
    personal_involucrado = excluded.personal_involucrado, entradas = excluded.entradas, salidas = excluded.salidas,
    proveedores = excluded.proveedores, clientes = excluded.clientes, recursos_materiales = excluded.recursos_materiales,
    equipos = excluded.equipos, sistemas = excluded.sistemas, controles = excluded.controles,
    registros = excluded.registros, indicadores = excluded.indicadores, riesgos = excluded.riesgos,
    problemas = excluded.problemas, observaciones = excluded.observaciones, mejoras = excluded.mejoras,
    no_aplica = excluded.no_aplica;

  delete from public.actividades
  where proceso_id = v_id
    and id not in (select (a->>'id')::uuid from jsonb_array_elements(coalesce(p_actividades, '[]'::jsonb)) a);

  insert into public.actividades (
    id, consultoria_id, proyecto_id, proceso_id, responsable_id, tipo, descripcion,
    entradas, recursos, controles, resultado, orden
  )
  select (a->>'id')::uuid, v_consultoria, v_proyecto, v_id, nullif(a->>'responsable_id', '')::uuid,
         a->>'tipo', a->>'descripcion', a->>'entradas', a->>'recursos', a->>'controles', a->>'resultado',
         (a->>'orden')::integer
  from jsonb_array_elements(coalesce(p_actividades, '[]'::jsonb)) a
  on conflict (id) do update set
    responsable_id = excluded.responsable_id, tipo = excluded.tipo, descripcion = excluded.descripcion,
    entradas = excluded.entradas, recursos = excluded.recursos, controles = excluded.controles,
    resultado = excluded.resultado, orden = excluded.orden;
end;
$$;
