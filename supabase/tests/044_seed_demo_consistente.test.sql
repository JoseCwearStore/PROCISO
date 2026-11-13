-- Los datos de demostración (seed.sql) tienen que cumplir las reglas de la propia app; si no, las pantallas muestran
-- cosas imposibles (O9, O15). Mira solo las filas del seed (ids 5555…, 4444…, 7777…), así que no depende de lo que
-- el usuario cargue probando.

begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

-- O9: un proceso Documentado o Revisado exige al menos una actividad (la secuencia y el diagrama salen de ahí).
select is(
  (select count(*) from public.procesos p
   where p.id::text like '55555555-%' and p.estado in ('Documentado', 'Revisado')
     and not exists (select 1 from public.actividades a where a.proceso_id = p.id)),
  0::bigint, 'Todo proceso Documentado o Revisado del seed tiene actividades'
);

-- Cada proceso con actividades empieza con un Inicio y las actividades tienen un orden sin repetir.
select is(
  (select count(*) from public.procesos p
   where p.id::text like '55555555-%' and exists (select 1 from public.actividades a where a.proceso_id = p.id)
     and not exists (select 1 from public.actividades a where a.proceso_id = p.id and a.tipo = 'Inicio' and a.orden = 1)),
  0::bigint, 'Los procesos con actividades arrancan con un Inicio en el orden 1'
);
select is(
  (select count(*) from (
     select proceso_id, orden from public.actividades where proceso_id::text like '55555555-%'
     group by proceso_id, orden having count(*) > 1) repetidas),
  0::bigint, 'Ningún proceso del seed repite el orden de sus actividades'
);

-- Las actividades del seed tienen un responsable que sí puede serlo en ese proyecto.
select is(
  (select count(*) from public.actividades a
   where a.proceso_id::text like '55555555-%' and a.responsable_id is not null
     and not private.es_asignable(a.responsable_id, a.proyecto_id)),
  0::bigint, 'Los responsables de las actividades del seed son asignables en su proyecto'
);

-- O5: las tareas del seed solo se asignan a quien la regla permite (equipo, admin de la consultoría o cliente de la empresa).
select is(
  (select count(*) from public.tareas t
   where t.id::text like '77777777-%' and not private.es_asignable(t.asignado_a, t.proyecto_id)),
  0::bigint, 'Las tareas del seed están asignadas a personas asignables en su proyecto'
);

-- O15: el nombre de archivo de una evidencia de demostración tiene una extensión que el bucket admite (antes había un
-- .zip, que Storage rechaza, y el archivo nunca se podía cargar).
select is(
  (select count(*) from public.evidencias e
   where e.id::text like '44444444-%' and e.archivo_nombre is not null
     and e.archivo_nombre !~* '\.(pdf|png|jpe?g|webp|mp4|webm|mov|mp3|m4a|wav|docx?|xlsx?)$'),
  0::bigint, 'Las evidencias del seed con archivo usan una extensión que el bucket admite'
);

select * from finish();
rollback;
