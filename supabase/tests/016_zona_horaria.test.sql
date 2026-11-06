-- Zona horaria (2026-11-06): PROCISO trabaja en México. current_date se calcula
-- con la zona de la sesión; en UTC, después de las ~18 h de México ya era "mañana"
-- (tareas completadas, NC cerradas, entregables aprobados y "vencidas" con la
-- fecha equivocada). La base fija la zona para todas las sesiones.

begin;
create extension if not exists pgtap with schema extensions;

select plan(2);

select is(current_setting('TimeZone'), 'America/Mexico_City', 'La base trabaja con la hora de México');
select is(current_date, (now() at time zone 'America/Mexico_City')::date, 'current_date es la fecha del calendario de México');

select * from finish();
rollback;
