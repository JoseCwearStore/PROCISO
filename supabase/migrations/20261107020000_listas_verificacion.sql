-- Listas de verificación (autoevaluación / revisión documental).
--
-- Regla del negocio (elegida por el usuario el 2026-11-07):
--   · El EQUIPO del proyecto crea y edita las listas; el admin las borra.
--   · El CLIENTE de la empresa las ve en LECTURA.
--   · Cada hallazgo ("No cumple" o "Parcialmente atendido") genera UNA tarea de
--     seguimiento para el responsable de la lista, en la MISMA transacción en que
--     se guarda la lista: o queda todo o no queda nada.

-- ════════════════════════════════════════════════════════════════════════════
-- Tablas
-- ════════════════════════════════════════════════════════════════════════════

create table public.listas_verificacion (
  id              uuid primary key default gen_random_uuid(),
  consultoria_id  uuid not null,
  proyecto_id     uuid not null,
  proceso_id      uuid,
  nombre          text not null check (length(trim(nombre)) > 0),
  area            text not null default '',
  responsable_id  uuid not null references public.perfiles (id),
  fecha           date not null,
  edicion_norma   text not null default 'ISO 9001:2026' check (edicion_norma in ('ISO 9001:2026', 'ISO 9001:2015')),
  creada_por      uuid default auth.uid() references public.perfiles (id) on delete set null,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  unique (id, proyecto_id, consultoria_id),
  foreign key (proyecto_id, consultoria_id) references public.proyectos (id, consultoria_id) on delete cascade,
  foreign key (proceso_id, proyecto_id, consultoria_id)
    references public.procesos (id, proyecto_id, consultoria_id) on delete set null (proceso_id)
);

create table public.lista_preguntas (
  id                       uuid primary key default gen_random_uuid(),
  consultoria_id           uuid not null,
  proyecto_id              uuid not null,
  lista_id                 uuid not null,
  orden                    integer not null default 0,
  pregunta                 text not null check (length(trim(pregunta)) > 0),
  estado                   text not null default 'Pendiente de verificar'
                           check (estado in ('Cumple según la evidencia revisada', 'No cumple según la evidencia revisada',
                                             'Parcialmente atendido', 'No aplica', 'Pendiente de verificar')),
  referencia_requisito     text not null default '',
  evidencia_id             uuid,
  observaciones            text not null default '',
  justificacion_no_aplica  text not null default '',
  -- "No aplica" sin justificar no es una respuesta: es una omisión.
  constraint no_aplica_justificado check (estado <> 'No aplica' or length(trim(justificacion_no_aplica)) > 0),
  foreign key (lista_id, proyecto_id, consultoria_id)
    references public.listas_verificacion (id, proyecto_id, consultoria_id) on delete cascade,
  -- La evidencia tiene que ser del MISMO proyecto (lo garantiza la FK compuesta).
  foreign key (evidencia_id, proyecto_id, consultoria_id)
    references public.evidencias (id, proyecto_id, consultoria_id) on delete set null (evidencia_id)
);

create index on public.listas_verificacion (proyecto_id);
create index on public.lista_preguntas (lista_id);

create trigger tocar_actualizado_en before update on public.listas_verificacion
  for each row execute function private.tocar_actualizado_en();

-- Tarea de seguimiento ↔ pregunta: deduplicación exacta (no por título) y, si la
-- lista se borra, la tarea sobrevive sin vínculo: el trabajo no se pierde.
alter table public.tareas
  add column pregunta_id uuid references public.lista_preguntas (id) on delete set null;
create unique index tareas_una_por_pregunta on public.tareas (pregunta_id) where pregunta_id is not null;
grant insert (pregunta_id) on public.tareas to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- Responsable válido (las tareas de seguimiento se le asignan a él)
-- ════════════════════════════════════════════════════════════════════════════

create function private.validar_lista() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op = 'INSERT' or new.responsable_id is distinct from old.responsable_id)
     and not private.es_asignable(new.responsable_id, new.proyecto_id) then
    raise exception 'El responsable no es del equipo del proyecto ni cliente de la empresa' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger validar_lista before insert or update on public.listas_verificacion
  for each row execute function private.validar_lista();

-- ════════════════════════════════════════════════════════════════════════════
-- RLS: el cliente lee, el equipo escribe, el admin borra la lista
-- ════════════════════════════════════════════════════════════════════════════

alter table public.listas_verificacion enable row level security;
alter table public.lista_preguntas enable row level security;

create policy "ver listas" on public.listas_verificacion for select to authenticated
  using (private.puede_ver_proyecto(proyecto_id));
create policy "equipo crea listas" on public.listas_verificacion for insert to authenticated
  with check (private.puede_editar_proyecto(proyecto_id) and creada_por = (select auth.uid()));
create policy "equipo edita listas" on public.listas_verificacion for update to authenticated
  using (private.puede_editar_proyecto(proyecto_id))
  with check (private.puede_editar_proyecto(proyecto_id));
create policy "admins borran listas" on public.listas_verificacion for delete to authenticated
  using ((select private.es_admin_prociso()) or private.es_admin_de(consultoria_id));

create policy "ver preguntas" on public.lista_preguntas for select to authenticated
  using (private.puede_ver_proyecto(proyecto_id));
create policy "equipo crea preguntas" on public.lista_preguntas for insert to authenticated
  with check (private.puede_editar_proyecto(proyecto_id));
create policy "equipo edita preguntas" on public.lista_preguntas for update to authenticated
  using (private.puede_editar_proyecto(proyecto_id))
  with check (private.puede_editar_proyecto(proyecto_id));
-- Quitar una pregunta es parte de editar la lista: lo hace el equipo.
create policy "equipo quita preguntas" on public.lista_preguntas for delete to authenticated
  using (private.puede_editar_proyecto(proyecto_id));

-- ════════════════════════════════════════════════════════════════════════════
-- guardar_lista: lista + preguntas + tareas de seguimiento en UNA transacción
-- ════════════════════════════════════════════════════════════════════════════
-- SECURITY INVOKER (como guardar_proceso): corre con los permisos del usuario,
-- así que el RLS de las tres tablas sigue decidiendo. Solo el equipo escribe.
-- Devuelve las tareas creadas, para que la pantalla las muestre sin recargar.

create function public.guardar_lista(p_lista jsonb, p_preguntas jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_id          uuid := (p_lista->>'id')::uuid;
  v_proyecto    uuid := (p_lista->>'proyecto_id')::uuid;
  v_consultoria uuid;
  v_lista       record;
  v_creadas     jsonb;
begin
  select consultoria_id into v_consultoria from public.proyectos where id = v_proyecto;
  if v_consultoria is null then
    raise exception 'Proyecto no encontrado o sin acceso' using errcode = '42501';
  end if;

  insert into public.listas_verificacion (id, consultoria_id, proyecto_id, proceso_id, nombre, area, responsable_id, fecha, edicion_norma)
  values (v_id, v_consultoria, v_proyecto, nullif(p_lista->>'proceso_id', '')::uuid, p_lista->>'nombre',
          coalesce(p_lista->>'area', ''), (p_lista->>'responsable_id')::uuid, (p_lista->>'fecha')::date,
          coalesce(p_lista->>'edicion_norma', 'ISO 9001:2026'))
  -- Al actualizar no se mueve de proyecto ni cambia quién la creó.
  on conflict (id) do update set
    proceso_id = excluded.proceso_id, nombre = excluded.nombre, area = excluded.area,
    responsable_id = excluded.responsable_id, fecha = excluded.fecha, edicion_norma = excluded.edicion_norma
  returning nombre, responsable_id, fecha into v_lista;

  -- Preguntas: se conservan por ID (la tarea de seguimiento apunta a la pregunta).
  delete from public.lista_preguntas
  where lista_id = v_id
    and id not in (select (p->>'id')::uuid from jsonb_array_elements(coalesce(p_preguntas, '[]'::jsonb)) p);

  insert into public.lista_preguntas (
    id, consultoria_id, proyecto_id, lista_id, orden, pregunta, estado,
    referencia_requisito, evidencia_id, observaciones, justificacion_no_aplica
  )
  select (p->>'id')::uuid, v_consultoria, v_proyecto, v_id, coalesce((p->>'orden')::integer, 0), p->>'pregunta',
         p->>'estado', coalesce(p->>'referencia_requisito', ''), nullif(p->>'evidencia_id', '')::uuid,
         coalesce(p->>'observaciones', ''), coalesce(p->>'justificacion_no_aplica', '')
  from jsonb_array_elements(coalesce(p_preguntas, '[]'::jsonb)) p
  on conflict (id) do update set
    orden = excluded.orden, pregunta = excluded.pregunta, estado = excluded.estado,
    referencia_requisito = excluded.referencia_requisito, evidencia_id = excluded.evidencia_id,
    observaciones = excluded.observaciones, justificacion_no_aplica = excluded.justificacion_no_aplica;

  -- Una tarea por hallazgo que todavía no la tenga.
  with nuevas as (
    insert into public.tareas (consultoria_id, proyecto_id, titulo, descripcion, asignado_a, prioridad, fecha_vencimiento, pregunta_id)
    select v_consultoria, v_proyecto,
           'Seguimiento de hallazgo: ' || p.pregunta,
           'Hallazgo identificado en la lista “' || v_lista.nombre || '”. Estado: ' || p.estado || '.',
           v_lista.responsable_id,
           case when p.estado = 'No cumple según la evidencia revisada' then 'Alta' else 'Media' end,
           v_lista.fecha, p.id
    from public.lista_preguntas p
    where p.lista_id = v_id
      and p.estado in ('No cumple según la evidencia revisada', 'Parcialmente atendido')
      and not exists (select 1 from public.tareas t where t.pregunta_id = p.id)
    order by p.orden
    returning id, proyecto_id, titulo, descripcion, asignado_a, asignado_por, estado, prioridad,
              fecha_vencimiento, fecha_completada, dependencias
  )
  select coalesce(jsonb_agg(to_jsonb(nuevas)), '[]'::jsonb) into v_creadas from nuevas;

  return v_creadas;
end;
$$;

revoke execute on function public.guardar_lista(jsonb, jsonb) from public, anon;
grant execute on function public.guardar_lista(jsonb, jsonb) to authenticated;
