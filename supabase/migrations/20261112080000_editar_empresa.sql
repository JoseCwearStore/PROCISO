-- O2 · Editar una empresa.
-- Hasta ahora la única columna editable era `activa` (archivar / reactivar), así que un dato mal cargado al crear la
-- empresa no se podía corregir. Se abre el UPDATE a las MISMAS columnas que el alta (20261110000000), menos la
-- consultoría: una empresa no cambia de dueño (sigue dando 42501), y tampoco `id` ni `creado_en`.
--
-- Quién edita lo decide la política "admins editan empresas" (20261110020000): el Admin PROCISO y el admin de la
-- consultoría de la empresa; un consultor o el admin de otra consultoría no modifican filas (0 filas afectadas).
-- Se eligió el permiso por columna y no una RPC porque la política ya cubre el "quién" y el asignado se valida solo
-- (clave foránea compuesta: el consultor asignado tiene que ser de la misma consultoría).

grant update (nombre, nombre_comercial, rfc, sector, tamano, trabajadores, ciudad,
              entidad_federativa, direccion, contacto_principal, cargo_contacto, email_contacto,
              telefono_contacto, procesos_principales, alcance_inicial, norma_interes,
              consultor_asignado_id, observaciones)
  on public.empresas to authenticated;
