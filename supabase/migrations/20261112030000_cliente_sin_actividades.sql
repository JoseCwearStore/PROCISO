-- AUD10-M9 (decisión del 12/11): el Usuario Cliente lee los procesos de su empresa pero NO las actividades internas.
--
-- Antes la API le daba procesos y actividades completos aunque la pantalla y la matriz de permisos le dicen que no
-- tiene "Procesos". Los procesos se quedan visibles: el formulario de subir una evidencia exige elegir uno (y el
-- cliente sube evidencias). Las actividades (el detalle interno del levantamiento) pasan a ser solo del equipo y del
-- Admin PROCISO. En la pantalla el desplegable "Actividad" de la subida es opcional y queda deshabilitado si no hay
-- ninguna, así que no se rompe nada; la búsqueda global ya se las ocultaba al cliente.

drop policy "ver" on public.actividades;
create policy "ver" on public.actividades for select to authenticated
  using (
    private.puede_ver_proyecto(proyecto_id)
    and (select private.mi_rol()) is distinct from 'usuario_cliente'
  );
