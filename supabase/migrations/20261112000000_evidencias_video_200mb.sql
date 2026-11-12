-- Tope del bucket `evidencias`: de 25 MB a 200 MB, para poder subir un video de hasta ~10 minutos
-- y analizarlo con el modelo de video nativo (ver supabase/functions/_compartido/video.ts).
--
-- El tope es del BUCKET: el servidor no distingue por tipo de archivo, así que una foto o un PDF también
-- podrían pesar hasta 200 MB. El límite de 25 MB para lo que no es video lo aplica la pantalla (Evidencias.tsx);
-- y la Edge Function acota el tamaño de PDF y texto antes de procesarlos (verificarTamanoArchivo).
update storage.buckets
set file_size_limit = 209715200 -- 200 MB
where id = 'evidencias';
