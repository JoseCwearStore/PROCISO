-- Generación de borradores con IA (B3, 2026-11-09).
--
-- La Edge Function generar-documento redacta partes de un documento (la
-- declaración de la política, del alcance, los objetivos) con el proveedor de IA
-- configurado. Esta tabla es la AUTORIZACIÓN y la auditoría de cada pedido:
--   · El INSERT lo permite el RLS solo al EQUIPO del proyecto (igual que
--     analizar-ia: consume la clave de IA de la consultoría). Sin ese registro, la
--     función no llama a la IA: así no es una puerta abierta a gastar la clave.
--   · Solo el servidor (service_role) cambia el estado: Completado o Error con su motivo.
--   · El texto generado NO se guarda acá: vuelve a la pantalla y se guarda como parte del
--     documento, que el consultor revisa antes de enviarlo.

create table public.generaciones_ia (
  id              uuid primary key default gen_random_uuid(),
  consultoria_id  uuid not null,
  proyecto_id     uuid not null,
  plantilla       text not null check (char_length(plantilla) between 1 and 40),
  solicitado_por  uuid not null default auth.uid() references public.perfiles (id),
  estado          text not null default 'Pendiente' check (estado in ('Pendiente', 'Completado', 'Error')),
  error_detalle   text,
  proveedor       text,
  modelo          text,
  creado_en       timestamptz not null default now(),
  completado_en   timestamptz,
  foreign key (proyecto_id, consultoria_id) references public.proyectos (id, consultoria_id) on delete cascade
);

create index on public.generaciones_ia (proyecto_id);

alter table public.generaciones_ia enable row level security;

create policy "equipo ve generaciones" on public.generaciones_ia for select to authenticated
  using (private.puede_editar_proyecto(proyecto_id));

create policy "equipo pide generación" on public.generaciones_ia for insert to authenticated
  with check (private.es_equipo_del_proyecto(proyecto_id) and solicitado_por = (select auth.uid()));

-- El usuario solo crea el pedido; estado, motivo y autor los pone el servidor.
revoke all on public.generaciones_ia from anon;
revoke insert, update, delete on public.generaciones_ia from authenticated;
grant select on public.generaciones_ia to authenticated;
grant insert (id, consultoria_id, proyecto_id, plantilla) on public.generaciones_ia to authenticated;
