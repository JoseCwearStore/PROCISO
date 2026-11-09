-- Visibilidad de documentos para el CLIENTE (decidido con el usuario el 2026-11-09).
--
-- Un documento en Borrador o En elaboración es trabajo interno del consultor y
-- todavía no se le entregó al cliente. El cliente ve el resto (Pendiente de
-- revisión, En corrección, Aprobado, Rechazado y Obsoleto) y, con ello, todo lo
-- que tiene que decidir. El equipo del proyecto y los admins ven todo.
--
-- La regla vive en el RLS (no solo en la pantalla) y alcanza a todo lo que
-- cuelga del documento: versiones, evidencias vinculadas, comentarios,
-- historial y análisis de IA.

-- ─── Helper: ¿puedo ver este documento? ─────────────────────────────────────
-- Oculto solo si el documento EXISTE, está en un estado interno y yo no soy del
-- equipo. Si no existe, decide el acceso al proyecto (no inventa restricciones).
create function private.puede_ver_documento(p_documento_id uuid, p_proyecto_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.puede_ver_proyecto(p_proyecto_id)
     and (
          private.puede_editar_proyecto(p_proyecto_id)
       or not exists (
            select 1 from public.documentos d
            where d.id = p_documento_id
              and d.estado in ('Borrador', 'En elaboración')
          )
     );
$$;

revoke execute on function private.puede_ver_documento(uuid, uuid) from public, anon;
grant execute on function private.puede_ver_documento(uuid, uuid) to authenticated;

-- ─── documentos ─────────────────────────────────────────────────────────────
drop policy "ver" on public.documentos;
create policy "ver" on public.documentos for select to authenticated
  using (private.puede_ver_documento(id, proyecto_id));

-- ─── Lo que cuelga del documento ────────────────────────────────────────────
drop policy "ver" on public.documento_versiones;
create policy "ver" on public.documento_versiones for select to authenticated
  using (private.puede_ver_documento(documento_id, proyecto_id));

drop policy "ver" on public.documento_evidencias;
create policy "ver" on public.documento_evidencias for select to authenticated
  using (private.puede_ver_documento(documento_id, proyecto_id));

drop policy "ver comentarios" on public.comentarios;
create policy "ver comentarios" on public.comentarios for select to authenticated
  using (
        private.puede_ver_proyecto(proyecto_id)
    and (entidad_tipo <> 'documento' or private.puede_ver_documento(entidad_id, proyecto_id))
  );

drop policy "ver historial" on public.historial;
create policy "ver historial" on public.historial for select to authenticated
  using (
       (select private.es_admin_prociso())
    or (proyecto_id is not null and private.puede_ver_proyecto(proyecto_id)
        and (entidad_tipo <> 'documento' or private.puede_ver_documento(entidad_id, proyecto_id)))
    or (proyecto_id is null and private.es_equipo_de(consultoria_id))
  );

drop policy "ver análisis" on public.analisis_ia;
create policy "ver análisis" on public.analisis_ia for select to authenticated
  using (
        private.puede_ver_proyecto(proyecto_id)
    and (documento_id is null or private.puede_ver_documento(documento_id, proyecto_id))
  );
