-- Análisis con IA (bloque B1, reglas elegidas con el usuario el 2026-11-06).
--
-- Flujo: el EQUIPO pide un análisis (nace "Pendiente"); la Edge Function lo
-- procesa con el proveedor configurado y SOLO ella (service_role) registra el
-- resultado: "Completado" con una fila por criterio, o "Error" con su detalle.
-- El cliente lee los análisis de sus proyectos. Todo resultado es una
-- PREEVALUACIÓN: requiere revisión humana y no es un dictamen de conformidad.

create table public.analisis_ia (
  id              uuid primary key default gen_random_uuid(),
  consultoria_id  uuid not null,
  proyecto_id     uuid not null,
  -- La fuente: un documento de la app o una evidencia (imagen, PDF; video/audio en el futuro).
  fuente_tipo     text not null check (fuente_tipo in ('documento', 'evidencia')),
  documento_id    uuid,
  evidencia_id    uuid,
  criterio_ids    uuid[] not null check (cardinality(criterio_ids) >= 1),
  solicitado_por  uuid not null default auth.uid() references public.perfiles (id),
  estado          text not null default 'Pendiente' check (estado in ('Pendiente', 'Completado', 'Error')),
  resumen         text,
  error_detalle   text,
  proveedor       text,
  modelo          text,
  creado_en       timestamptz not null default now(),
  completado_en   timestamptz,
  check (
       (fuente_tipo = 'documento' and documento_id is not null and evidencia_id is null)
    or (fuente_tipo = 'evidencia' and evidencia_id is not null and documento_id is null)
  ),
  foreign key (proyecto_id, consultoria_id) references public.proyectos (id, consultoria_id) on delete cascade,
  -- La fuente tiene que ser del MISMO proyecto (FK compuestas).
  foreign key (documento_id, proyecto_id, consultoria_id)
    references public.documentos (id, proyecto_id, consultoria_id) on delete cascade,
  foreign key (evidencia_id, proyecto_id, consultoria_id)
    references public.evidencias (id, proyecto_id, consultoria_id) on delete cascade
);

create index on public.analisis_ia (proyecto_id);
create index on public.analisis_ia (documento_id);
create index on public.analisis_ia (evidencia_id);

create table public.analisis_ia_resultados (
  id           uuid primary key default gen_random_uuid(),
  analisis_id  uuid not null references public.analisis_ia (id) on delete cascade,
  criterio_id  uuid not null references public.criterios_evaluacion (id),
  estado       text not null check (estado in ('Cubierto', 'Parcial', 'Hueco', 'No evaluable', 'No aplica')),
  hallazgos    text,
  sugerencias  text,
  orden        integer not null default 0,
  unique (analisis_id, criterio_id)
);

create index on public.analisis_ia_resultados (analisis_id);

-- ─── Validación: los criterios pedidos existen en el catálogo ───────────────
-- (un arreglo no admite FK). INVOKER: el catálogo lo lee cualquier usuario activo.
create function private.validar_analisis_ia() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if exists (
    select 1 from unnest(new.criterio_ids) as c(id)
    where not exists (select 1 from public.criterios_evaluacion ce where ce.id = c.id)
  ) then
    raise exception 'Hay criterios que no existen en el catálogo' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger validar_analisis_ia before insert on public.analisis_ia
  for each row execute function private.validar_analisis_ia();

-- ─── RLS y permisos ─────────────────────────────────────────────────────────
alter table public.analisis_ia enable row level security;
alter table public.analisis_ia_resultados enable row level security;

create policy "ver análisis" on public.analisis_ia for select to authenticated
  using (private.puede_ver_proyecto(proyecto_id));

-- Lo pide el equipo del proyecto (no el cliente: consume la clave de la consultoría).
create policy "equipo pide análisis" on public.analisis_ia for insert to authenticated
  with check (private.es_equipo_del_proyecto(proyecto_id) and solicitado_por = (select auth.uid()));

create policy "ver resultados" on public.analisis_ia_resultados for select to authenticated
  using (exists (select 1 from public.analisis_ia a where a.id = analisis_id));

-- El usuario solo crea el pedido; estado, resultado y autor los pone el servidor.
revoke all on public.analisis_ia, public.analisis_ia_resultados from anon;
revoke insert, update, delete on public.analisis_ia, public.analisis_ia_resultados from authenticated;
grant select on public.analisis_ia, public.analisis_ia_resultados to authenticated;
grant insert (id, consultoria_id, proyecto_id, fuente_tipo, documento_id, evidencia_id, criterio_ids)
  on public.analisis_ia to authenticated;

-- ─── registrar_resultado_analisis: SOLO service_role (la Edge Function) ─────
create function public.registrar_resultado_analisis(
  p_analisis_id uuid, p_estado text, p_resumen text, p_error text,
  p_proveedor text, p_modelo text, p_resultados jsonb
) returns void
language plpgsql security invoker set search_path = '' as $$
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
    completado_en = now()
  where id = p_analisis_id;
end;
$$;

revoke execute on function public.registrar_resultado_analisis(uuid, text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.registrar_resultado_analisis(uuid, text, text, text, text, text, jsonb) to service_role;
