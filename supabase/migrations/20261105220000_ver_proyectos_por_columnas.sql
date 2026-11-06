-- La política "ver proyectos" usaba private.puede_ver_proyecto(id), que BUSCA el
-- proyecto en la tabla. En un INSERT ... RETURNING esa búsqueda no encuentra la
-- fila nueva (la función STABLE ve el snapshot del inicio de la sentencia), así
-- que Postgres rechazaba el RETURNING con 42501 aunque el usuario tuviera
-- permiso para crear el proyecto.
--
-- La nueva política decide con las columnas de la propia fila. Las reglas son las
-- mismas que las de puede_ver_proyecto.

drop policy "ver proyectos" on public.proyectos;

create policy "ver proyectos" on public.proyectos for select to authenticated
  using (
       (select private.es_admin_prociso())
    or private.es_admin_de(consultoria_id)
    or ((select private.mi_rol()) = 'usuario_cliente' and empresa_id = (select private.mi_empresa_id()))
    or exists (
      select 1 from public.proyecto_miembros m
      where m.proyecto_id = proyectos.id and m.usuario_id = (select auth.uid())
    )
  );
