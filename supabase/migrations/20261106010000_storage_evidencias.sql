-- Archivos de evidencias en Supabase Storage.
--
-- Bucket PRIVADO: no hay URLs públicas; se accede con URLs firmadas que vencen.
-- Ruta: {consultoria_id}/{empresa_id}/{proyecto_id}/{archivo}
--
-- El tamaño y los tipos se validan en el servidor (el atributo "accept" del
-- formulario es solo una sugerencia que cualquiera puede saltear).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidencias', 'evidencias', false, 26214400, -- 25 MB, el mismo límite que muestra la pantalla
  array[
    'image/*', 'video/*', 'audio/*',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
);

-- Devuelve el proyecto de una ruta SOLO si la ruta es coherente: el proyecto
-- existe y pertenece a esa consultoría y a esa empresa. Si no (ruta mal formada
-- o armada a mano), devuelve NULL, y puede_ver_proyecto(NULL) es false.
create function private.proyecto_de_ruta(p_nombre text) returns uuid
language sql stable security definer set search_path = '' as $$
  with partes as (
    select (string_to_array(p_nombre, '/')) as p
  )
  select pr.id
  from partes, public.proyectos pr
  where array_length(partes.p, 1) = 4
    and partes.p[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and partes.p[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and partes.p[3] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and pr.id = partes.p[3]::uuid
    and pr.consultoria_id = partes.p[1]::uuid
    and pr.empresa_id = partes.p[2]::uuid
$$;

revoke all on function private.proyecto_de_ruta(text) from public, anon;
grant execute on function private.proyecto_de_ruta(text) to authenticated;

-- Ver y subir: quien puede ver el proyecto (el cliente también sube evidencias).
create policy "evidencias: ver archivos" on storage.objects for select to authenticated
  using (bucket_id = 'evidencias' and private.puede_ver_proyecto(private.proyecto_de_ruta(name)));

create policy "evidencias: subir archivos" on storage.objects for insert to authenticated
  with check (bucket_id = 'evidencias' and private.puede_ver_proyecto(private.proyecto_de_ruta(name)));

-- Borrar: solo quien puede editar el proyecto (no el cliente).
create policy "evidencias: borrar archivos" on storage.objects for delete to authenticated
  using (bucket_id = 'evidencias' and private.puede_editar_proyecto(private.proyecto_de_ruta(name)));

-- Sin política de UPDATE: un archivo subido no se reemplaza; se sube otro.
