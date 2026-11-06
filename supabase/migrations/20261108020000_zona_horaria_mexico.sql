-- PROCISO trabaja en México. current_date y el texto de los timestamptz usan la
-- zona de la sesión; en UTC, después de las ~18 h de México la base ya creía que
-- era "mañana" (afectaba fecha_completada, fecha_cierre, fecha_aprobacion,
-- fecha_levantamiento y las tareas "vencidas" de mis_notificaciones).
-- Fijarla en la base corrige todos los usos actuales y los futuros de una vez.
-- (Desde 2022 la Ciudad de México no tiene horario de verano: UTC-6 todo el año.)

alter database postgres set timezone to 'America/Mexico_City';
