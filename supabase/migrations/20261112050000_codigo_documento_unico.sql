-- E9 (pruebas manuales) · un código documental no se repite en un proyecto para la misma versión.
--
-- "Crear nueva versión" crea una fila nueva de documentos con el MISMO código y otro número de versión, y
-- decidir_documento reemplaza por código: el código identifica a la familia de versiones. Por eso lo único es
-- (proyecto, código, versión) y no el código solo. Sin esta regla se podían crear varios borradores idénticos
-- ("SGC-OBJ-001" versión 0.1) en el mismo proyecto.
--
-- No importan mayúsculas ni espacios alrededor, y un documento sin código (nulo o en blanco) no cuenta.

-- 1. Antes de crear el índice se arreglan los repetidos que ya existan, sin borrar nada: se conserva el más antiguo
--    con su código y a los demás se les agrega un sufijo (-2, -3...). Después de esto el índice no puede fallar
--    por datos viejos.
with repetidos as (
  select id,
         row_number() over (
           partition by proyecto_id, lower(btrim(codigo)), version
           order by creado_en, id
         ) as n
    from public.documentos
   where codigo is not null and btrim(codigo) <> ''
)
update public.documentos d
   set codigo = btrim(d.codigo) || '-' || r.n
  from repetidos r
 where r.id = d.id and r.n > 1;

-- 2. La regla, en la BD (también cubre dos pedidos a la vez, que una revisión en el navegador no vería).
create unique index documentos_codigo_version_unico
  on public.documentos (proyecto_id, lower(btrim(codigo)), version)
  where codigo is not null and btrim(codigo) <> '';
