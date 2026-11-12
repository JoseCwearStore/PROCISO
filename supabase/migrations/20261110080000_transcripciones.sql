-- Transcripción de audio y video con revisión humana ANTES de analizar.
--
-- La transcripción automática puede equivocarse (medido: códigos y cifras decimales). Por eso se GUARDA y se le
-- MUESTRA al consultor, que puede corregirla; la IA analiza el texto ya revisado, no una transcripción que nadie
-- vio. Se conserva siempre lo que escuchó la IA (texto_automatico) además del texto corregido.
--
--   · Una transcripción por evidencia (volver a transcribir la reemplaza, incluida la corrección).
--   · SOLO el servidor (service_role) registra la transcripción automática; SOLO el equipo del proyecto la corrige;
--     la lee quien ve el proyecto (el cliente solo lee). Nadie escribe la tabla directamente.
--   · Quien no tiene permiso recibe el mismo error exista o no la evidencia.
--   · Cada generación y cada corrección deja historial.

create table public.transcripciones (
  id                uuid primary key default gen_random_uuid(),
  consultoria_id    uuid not null,
  proyecto_id       uuid not null,
  evidencia_id      uuid not null unique,
  texto_automatico  text not null check (char_length(texto_automatico) between 1 and 100000),
  texto             text not null check (char_length(texto) between 1 and 100000),
  proveedor         text,
  modelo            text,
  creada_por        uuid not null references public.perfiles (id),
  creada_en         timestamptz not null default now(),
  corregida_por     uuid references public.perfiles (id) on delete set null,
  corregida_en      timestamptz,
  -- La evidencia tiene que ser del MISMO proyecto y consultoría (FK compuesta); si se borra, se borra la transcripción.
  foreign key (evidencia_id, proyecto_id, consultoria_id)
    references public.evidencias (id, proyecto_id, consultoria_id) on delete cascade
);

create index on public.transcripciones (proyecto_id);

alter table public.transcripciones enable row level security;

create policy "ver transcripciones" on public.transcripciones for select to authenticated
  using (private.puede_ver_proyecto(proyecto_id));

-- Nadie escribe directo: ni insert, ni update, ni delete (todo pasa por las funciones de abajo).
revoke all on public.transcripciones from anon;
revoke insert, update, delete on public.transcripciones from authenticated;
grant select on public.transcripciones to authenticated;

-- ─── registrar_transcripcion: SOLO service_role (la Edge Function) ──────────
-- Consultoría y proyecto salen de la evidencia, no de quien llama.
create function public.registrar_transcripcion(
  p_evidencia_id uuid, p_texto text, p_proveedor text, p_modelo text, p_autor_id uuid
) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_ev    record;
  v_texto text := trim(coalesce(p_texto, ''));
begin
  select id, consultoria_id, proyecto_id, tipo into v_ev from public.evidencias where id = p_evidencia_id;
  if not found then
    raise exception 'Evidencia no encontrada' using errcode = '22023';
  end if;
  if v_ev.tipo not in ('Audio', 'Video') then
    raise exception 'Solo se transcriben evidencias de audio o video' using errcode = '22023';
  end if;
  if v_texto = '' then
    raise exception 'La transcripción no puede estar vacía' using errcode = '22023';
  end if;
  if char_length(v_texto) > 100000 then
    raise exception 'La transcripción supera los 100000 caracteres' using errcode = '22023';
  end if;

  -- Volver a transcribir reemplaza todo, incluida la corrección anterior.
  insert into public.transcripciones (consultoria_id, proyecto_id, evidencia_id, texto_automatico, texto, proveedor, modelo, creada_por)
  values (v_ev.consultoria_id, v_ev.proyecto_id, v_ev.id, v_texto, v_texto, p_proveedor, p_modelo, p_autor_id)
  on conflict (evidencia_id) do update set
    texto_automatico = excluded.texto_automatico,
    texto            = excluded.texto,
    proveedor        = excluded.proveedor,
    modelo           = excluded.modelo,
    creada_por       = excluded.creada_por,
    creada_en        = now(),
    corregida_por    = null,
    corregida_en     = null;

  insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion)
  values (v_ev.consultoria_id, v_ev.proyecto_id, 'evidencia', v_ev.id, p_autor_id, 'Transcripción generada',
          'Transcripción automática del archivo de ' || lower(v_ev.tipo));
end;
$$;

revoke execute on function public.registrar_transcripcion(uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.registrar_transcripcion(uuid, text, text, text, uuid) to service_role;

-- ─── corregir_transcripcion: el EQUIPO del proyecto ─────────────────────────
-- DEFINER con el permiso explícito antes de tocar nada. Mismo error exista o no la evidencia.
create function public.corregir_transcripcion(p_evidencia_id uuid, p_texto text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_ev    record;
  v_t     record;
  v_texto text := trim(coalesce(p_texto, ''));
begin
  select id, consultoria_id, proyecto_id into v_ev from public.evidencias where id = p_evidencia_id;
  if not found or not private.es_equipo_del_proyecto(v_ev.proyecto_id) then
    raise exception 'Evidencia no encontrada o sin permiso para corregir su transcripción' using errcode = '42501';
  end if;

  select texto into v_t from public.transcripciones where evidencia_id = p_evidencia_id for update;
  if not found then
    raise exception 'Esa evidencia todavía no tiene transcripción' using errcode = '22023';
  end if;
  if v_texto = '' then
    raise exception 'El texto de la transcripción no puede estar vacío' using errcode = '22023';
  end if;
  if char_length(v_texto) > 100000 then
    raise exception 'La transcripción supera los 100000 caracteres' using errcode = '22023';
  end if;

  -- Sin cambios no se toca nada: ni la fecha de corrección ni el historial.
  if v_texto = v_t.texto then
    return;
  end if;

  update public.transcripciones
     set texto = v_texto, corregida_por = auth.uid(), corregida_en = now()
   where evidencia_id = p_evidencia_id;

  insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion)
  values (v_ev.consultoria_id, v_ev.proyecto_id, 'evidencia', v_ev.id, auth.uid(), 'Transcripción corregida',
          'Se corrigió el texto de la transcripción (' || char_length(v_texto) || ' caracteres)');
end;
$$;

revoke execute on function public.corregir_transcripcion(uuid, text) from public, anon;
grant execute on function public.corregir_transcripcion(uuid, text) to authenticated;

-- ─── autorizar_transcripcion: quién puede transcribir y cuánto por día ──────
-- La Edge Function la llama con el token del usuario ANTES de gastar la clave del servicio de
-- transcripción: devuelve qué archivo transcribir o rechaza. Solo el equipo del proyecto.
-- Mismo error exista o no la evidencia. Cuenta las transcripciones generadas en las últimas 24 h
-- (del historial): una transcripción llama a un servicio externo que se paga o tiene cuota.

-- Única fuente del tope diario de transcripciones por usuario (solo la usan funciones DEFINER).
create function private.tope_transcripciones() returns integer
language sql immutable set search_path = '' as $$ select 20 $$;

create function public.autorizar_transcripcion(p_evidencia_id uuid)
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
  if (select count(*) from public.historial h
      where h.autor_id = auth.uid() and h.accion = 'Transcripción generada'
        and h.creado_en > now() - interval '24 hours') >= v_tope then
    raise exception 'Alcanzaste el tope diario de transcripciones (%). Inténtalo mañana.', v_tope using errcode = 'IA429';
  end if;
  return query select v_ev.consultoria_id, v_ev.proyecto_id, v_ev.tipo, v_ev.archivo_ruta, v_ev.archivo_mime;
end;
$$;

revoke execute on function public.autorizar_transcripcion(uuid) from public, anon;
grant execute on function public.autorizar_transcripcion(uuid) to authenticated;
