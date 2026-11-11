-- L3 · Visibilidad (D1, D3, D4 · AUD01-M3, M5).
--
-- "Cada uno ve solo lo suyo" también DENTRO de una consultoría:
--   · D1  el cliente ve solo las tareas asignadas a usuarios de su empresa (y lo que cuelga de ellas);
--   · D3  los perfiles de cliente los ve solo quien trabaja con esa empresa; el cliente deja de leer
--         las tablas consultorias (plan, RFC, cuotas) y empresas (observaciones internas) y usa
--         vistas de solo lectura con lo mínimo;
--   · D4  solo el Admin PROCISO borra empresas (el resto archiva).

-- ─── D1. Tareas del cliente ──────────────────────────────────────────────────────────────────
-- Mismo patrón que puede_ver_documento: se decide con columnas de la fila (no rompe
-- INSERT … RETURNING). El equipo conserva todo lo que ya veía; el cliente, solo las tareas cuyo
-- asignado es de su misma empresa.
create or replace function private.puede_ver_tarea(p_proyecto_id uuid, p_asignado_a uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.puede_ver_proyecto(p_proyecto_id)
     and (
          coalesce(private.mi_rol(), '') <> 'usuario_cliente'
       or exists (
            select 1 from public.perfiles a
            where a.id = p_asignado_a
              and a.empresa_id is not null
              and a.empresa_id = private.mi_empresa_id()
          )
     )
$$;

-- Para lo que cuelga de una tarea por id (comentarios, historial).
create or replace function private.puede_ver_tarea_por_id(p_tarea_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tareas t
    where t.id = p_tarea_id and private.puede_ver_tarea(t.proyecto_id, t.asignado_a)
  )
$$;

drop policy if exists "ver tareas" on public.tareas;
create policy "ver tareas" on public.tareas for select to authenticated
  using (private.puede_ver_tarea(proyecto_id, asignado_a));

drop policy if exists "ver comentarios" on public.comentarios;
create policy "ver comentarios" on public.comentarios for select to authenticated
  using (
    private.puede_ver_proyecto(proyecto_id)
    and (entidad_tipo <> 'documento' or private.puede_ver_documento(entidad_id, proyecto_id))
    and (entidad_tipo <> 'tarea' or private.puede_ver_tarea_por_id(entidad_id))
  );

drop policy if exists "ver historial" on public.historial;
create policy "ver historial" on public.historial for select to authenticated
  using (
    (select private.es_admin_prociso())
    or (
      proyecto_id is not null
      and private.puede_ver_proyecto(proyecto_id)
      and (entidad_tipo <> 'documento' or private.puede_ver_documento(entidad_id, proyecto_id))
      and (entidad_tipo <> 'tarea' or private.puede_ver_tarea_por_id(entidad_id))
    )
    or (proyecto_id is null and private.es_equipo_de(consultoria_id))
  );

-- ─── D3. Perfiles ───────────────────────────────────────────────────────────────────────────
-- Antes: todo el equipo veía a todos los clientes de la consultoría. Ahora el consultor ve a los
-- clientes de las empresas donde trabaja (miembro de un proyecto) o que tiene asignadas; el admin
-- de la consultoría y el Admin PROCISO siguen viendo todo. El equipo (empresa nula) lo ven todos
-- los de la consultoría, y el cliente ve además a los de su propia empresa.
create or replace function private.consultor_atiende_empresa(p_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.trabaja_con_empresa(p_empresa_id)
      or exists (
           select 1 from public.empresas e
           where e.id = p_empresa_id
             and e.consultor_asignado_id = auth.uid()
             and private.yo_habilitado()
         )
$$;

drop policy if exists "ver perfiles" on public.perfiles;
create policy "ver perfiles" on public.perfiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select private.es_admin_prociso())
    or (
      consultoria_id = (select private.mi_consultoria_id())
      and (
           empresa_id is null
        or (select private.mi_rol()) = 'admin_consultoria'
        or ((select private.mi_rol()) = 'consultor' and private.consultor_atiende_empresa(empresa_id))
        or ((select private.mi_rol()) = 'usuario_cliente' and empresa_id = (select private.mi_empresa_id()))
      )
    )
  );

-- ─── D3. consultorias y empresas: el cliente usa vistas mínimas ─────────────────────────────
-- Las columnas no se pueden ocultar por rol con permisos (authenticated es un solo rol), así que
-- al cliente se le quita la lectura de la TABLA y se le da una vista de solo lectura que ya trae
-- las columnas sensibles en nulo. La vista corre con los permisos de su dueño y filtra por la
-- consultoría / empresa del usuario; el equipo sigue leyendo las tablas como siempre.
drop policy if exists "ver su consultoría" on public.consultorias;
create policy "ver su consultoría" on public.consultorias for select to authenticated
  using (
    (select private.es_admin_prociso())
    or (id = (select private.mi_consultoria_id()) and coalesce((select private.mi_rol()), '') <> 'usuario_cliente')
  );

create view public.mi_consultoria with (security_barrier = true) as
  select c.id, c.nombre,
         ''::text                          as plan,
         case when false then c.rfc end    as rfc,
         c.activa,
         case when false then c.contacto end          as contacto,
         case when false then c.email end             as email,
         case when false then c.limite_usuarios end   as limite_usuarios,
         case when false then c.almacenamiento_gb end as almacenamiento_gb,
         case when false then c.renovacion end        as renovacion,
         c.creado_en
  from public.consultorias c
  where c.id = private.mi_consultoria_id();

drop policy if exists "ver empresas" on public.empresas;
create policy "ver empresas" on public.empresas for select to authenticated
  using (
    (select private.es_admin_prociso())
    or private.es_admin_de(consultoria_id)
    or (consultor_asignado_id = (select auth.uid()) and (select private.yo_habilitado()))
    or exists (
      select 1
      from public.proyectos p
      join public.proyecto_miembros m on m.proyecto_id = p.id
      where p.empresa_id = empresas.id and m.usuario_id = (select auth.uid())
        and (select private.yo_habilitado())
    )
  );

create view public.mi_empresa with (security_barrier = true) as
  select e.id, e.consultoria_id, e.nombre, e.nombre_comercial, e.rfc, e.sector, e.tamano, e.trabajadores,
         e.ciudad, e.entidad_federativa, e.direccion, e.contacto_principal, e.cargo_contacto,
         e.email_contacto, e.telefono_contacto, e.procesos_principales, e.alcance_inicial, e.norma_interes,
         e.consultor_asignado_id,
         case when false then e.observaciones end as observaciones,   -- nota interna del consultor
         e.activa, e.creado_en
  from public.empresas e
  where e.id = private.mi_empresa_id();

-- Supabase da ALL a anon/authenticated por defecto en objetos nuevos: una vista simple es
-- actualizable y correría con los permisos de su dueño. Solo lectura, y solo para usuarios.
revoke all on public.mi_consultoria from public, anon, authenticated;
revoke all on public.mi_empresa     from public, anon, authenticated;
grant select on public.mi_consultoria to authenticated;
grant select on public.mi_empresa     to authenticated;

-- ─── D4. Solo el Admin PROCESO borra empresas (AUD01-M3) ────────────────────────────────────
-- El resto archiva (activa = false). Antes una sola política FOR ALL daba también el DELETE,
-- con cascada total, al admin de la consultoría.
drop policy if exists "admins gestionan empresas" on public.empresas;
create policy "admins crean empresas" on public.empresas for insert to authenticated
  with check ((select private.es_admin_prociso()) or private.es_admin_de(consultoria_id));
create policy "admins editan empresas" on public.empresas for update to authenticated
  using ((select private.es_admin_prociso()) or private.es_admin_de(consultoria_id))
  with check ((select private.es_admin_prociso()) or private.es_admin_de(consultoria_id));
create policy "admin prociso borra empresas" on public.empresas for delete to authenticated
  using ((select private.es_admin_prociso()));
