-- Indicadores de gestión.
--
-- Regla del negocio (elegida por el usuario el 2026-11-07):
--   · Ámbito "PROCISO" = gestión interna de la consultoría (su desempeño, el de sus
--     consultores). Lo ve todo el equipo; lo crea y edita SOLO el admin.
--   · Ámbito "SGC" = indicadores del sistema de gestión de UNA empresa. Lo editan el
--     admin y los consultores que trabajan con esa empresa; el CLIENTE lo ve en lectura.
--   · Nadie de otra consultoría ve nada. Borra el admin.
-- No hay flujo de estados: alcanza con RLS (sin RPC), como empresas.

create table public.indicadores (
  id              uuid primary key default gen_random_uuid(),
  consultoria_id  uuid not null references public.consultorias (id) on delete cascade,
  ambito          text not null check (ambito in ('PROCISO', 'SGC')),
  empresa_id      uuid,
  nombre          text not null check (length(trim(nombre)) > 0),
  descripcion     text not null default '',
  formula         text not null check (length(trim(formula)) > 0),
  unidad          text not null,
  frecuencia      text not null check (frecuencia in ('Semanal', 'Mensual', 'Trimestral', 'Semestral', 'Anual')),
  responsable_id  uuid not null references public.perfiles (id),
  meta            text not null,
  periodo         text not null,
  valor           text not null default '',
  creado_por      uuid default auth.uid() references public.perfiles (id) on delete set null,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  -- Un indicador del SGC es de UNA empresa; uno interno, de ninguna.
  constraint empresa_segun_ambito check ((ambito = 'SGC') = (empresa_id is not null)),
  -- La empresa tiene que ser de la MISMA consultoría (FK compuesta).
  foreign key (empresa_id, consultoria_id) references public.empresas (id, consultoria_id) on delete cascade
);

create index on public.indicadores (consultoria_id);
create index on public.indicadores (empresa_id);

create trigger tocar_actualizado_en before update on public.indicadores
  for each row execute function private.tocar_actualizado_en();

-- ════════════════════════════════════════════════════════════════════════════
-- Helpers
-- ════════════════════════════════════════════════════════════════════════════

-- ¿Soy un consultor que trabaja con esta empresa (miembro de alguno de sus proyectos)?
create function private.trabaja_con_empresa(p_empresa_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.proyectos p
    join public.proyecto_miembros m on m.proyecto_id = p.id
    join public.perfiles yo on yo.id = m.usuario_id and yo.activo and yo.rol = 'consultor'
    where p.empresa_id = p_empresa_id and m.usuario_id = auth.uid()
  )
$$;

-- ¿Puedo crear/editar un indicador de este ámbito? Internos: solo el admin.
-- SGC: el admin o quien trabaja con la empresa.
create function private.gestiona_indicador(p_ambito text, p_consultoria_id uuid, p_empresa_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.es_admin_prociso()
      or private.es_admin_de(p_consultoria_id)
      or (p_ambito = 'SGC' and p_empresa_id is not null and private.trabaja_con_empresa(p_empresa_id))
$$;

revoke all on function private.trabaja_con_empresa(uuid) from public, anon;
revoke all on function private.gestiona_indicador(text, uuid, uuid) from public, anon;
grant execute on function private.trabaja_con_empresa(uuid) to authenticated;
grant execute on function private.gestiona_indicador(text, uuid, uuid) to authenticated;

-- El responsable: del equipo de la consultoría o, si es del SGC, cliente de ESA empresa.
create function private.validar_indicador() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.perfiles yo
    where yo.id = new.responsable_id and yo.activo
      and (
           (yo.rol in ('admin_consultoria', 'consultor') and yo.consultoria_id = new.consultoria_id)
        or (new.ambito = 'SGC' and yo.rol = 'usuario_cliente' and yo.empresa_id = new.empresa_id)
      )
  ) then
    raise exception 'El responsable no es del equipo de la consultoría ni cliente de la empresa del indicador' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger validar_indicador before insert or update on public.indicadores
  for each row execute function private.validar_indicador();

-- ════════════════════════════════════════════════════════════════════════════
-- RLS + permisos por columna
-- ════════════════════════════════════════════════════════════════════════════
-- La política de lectura decide con las COLUMNAS de la fila (no la busca en su
-- propia tabla), así INSERT … RETURNING funciona.

alter table public.indicadores enable row level security;

create policy "ver indicadores" on public.indicadores for select to authenticated
  using (
       (select private.es_admin_prociso())
    or (ambito = 'PROCISO' and private.es_equipo_de(consultoria_id))
    or (ambito = 'SGC' and (
             private.es_admin_de(consultoria_id)
          or private.trabaja_con_empresa(empresa_id)
          or empresa_id = (select private.mi_empresa_id())
        ))
  );

create policy "gestionar indicadores" on public.indicadores for insert to authenticated
  with check (private.gestiona_indicador(ambito, consultoria_id, empresa_id) and creado_por = (select auth.uid()));

create policy "editar indicadores" on public.indicadores for update to authenticated
  using (private.gestiona_indicador(ambito, consultoria_id, empresa_id))
  with check (private.gestiona_indicador(ambito, consultoria_id, empresa_id));

create policy "admins borran indicadores" on public.indicadores for delete to authenticated
  using ((select private.es_admin_prociso()) or private.es_admin_de(consultoria_id));

-- Un indicador no se muda de consultoría ni cambia de autor.
revoke insert, update on public.indicadores from anon, authenticated;
grant insert (id, consultoria_id, ambito, empresa_id, nombre, descripcion, formula, unidad, frecuencia,
              responsable_id, meta, periodo, valor) on public.indicadores to authenticated;
grant update (ambito, empresa_id, nombre, descripcion, formula, unidad, frecuencia,
              responsable_id, meta, periodo, valor) on public.indicadores to authenticated;
