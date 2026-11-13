-- O14 (pruebas manuales) · el indicador de uso de IA no mostraba el tope de VIDEO.
--
-- El análisis de video tiene su propio tope, más bajo (5 por usuario y 15 por consultoría al día, ver
-- private.topes_video), pero mi_uso_ia() solo informaba el general (30 / 150): la persona se enteraba del tope de
-- video recién al llegar al rechazo. Ahora mi_uso_ia() devuelve también el consumo de video, de las MISMAS funciones
-- que aplica el trigger (private.uso_video y private.topes_video): lo que se muestra es lo que se aplica.
--
-- Cambia el tipo de retorno (columnas nuevas al final), por eso no alcanza con "create or replace": se borra y se
-- vuelve a crear con los mismos permisos de siempre (solo un usuario con sesión; adentro, solo el equipo).

drop function public.mi_uso_ia();

create function public.mi_uso_ia()
returns table (
  usuario_usados integer, usuario_tope integer, usuario_libera_en timestamptz,
  consultoria_usados integer, consultoria_tope integer, consultoria_libera_en timestamptz,
  video_usuario_usados integer, video_usuario_tope integer,
  video_consultoria_usados integer, video_consultoria_tope integer
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_rol          text := private.mi_rol();
  v_consultoria  uuid := private.mi_consultoria_id();
begin
  if v_rol is null or v_rol not in ('admin_consultoria', 'consultor') or v_consultoria is null then
    raise exception 'Solo el equipo de la consultoría usa la IA.' using errcode = '42501';
  end if;
  return query
    select u.usuario, t.por_usuario, u.usuario_mas_viejo + interval '24 hours',
           u.consultoria, t.por_consultoria, u.consultoria_mas_vieja + interval '24 hours',
           v.usuario, tv.por_usuario, v.consultoria, tv.por_consultoria
    from private.uso_ia(auth.uid(), v_consultoria) u,
         private.topes_ia() t,
         private.uso_video(auth.uid(), v_consultoria) v,
         private.topes_video() tv;
end;
$$;

revoke execute on function public.mi_uso_ia() from public, anon;
grant execute on function public.mi_uso_ia() to authenticated;
