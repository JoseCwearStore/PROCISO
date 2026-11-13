-- O35 · Un proyecto no puede terminar antes de empezar.
-- El formulario de "Nuevo proyecto" dejaba crear uno con la fecha fin estimada anterior a la de inicio y la BD lo aceptaba.
-- Ahora lo rechaza `crear_proyecto` (22023, con un mensaje claro) y, como última defensa, un CHECK de la tabla. Las fechas
-- siguen siendo opcionales y una fecha fin igual a la de inicio vale. El resto de la función es igual que antes.

alter table public.proyectos
  add constraint proyectos_fechas_coherentes check (fecha_inicio is null or fecha_fin_estimada is null or fecha_fin_estimada >= fecha_inicio);

create or replace function public.crear_proyecto(p_empresa_id uuid, p_consultor_id uuid, p_nombre text, p_objetivo text DEFAULT NULL::text, p_alcance text DEFAULT NULL::text, p_edicion_norma text DEFAULT 'ISO 9001:2026'::text, p_fecha_inicio date DEFAULT NULL::date, p_fecha_fin_estimada date DEFAULT NULL::date)
 returns public.proyectos
language plpgsql security definer set search_path = '' as $$
declare
  v_consultoria uuid := private.mi_consultoria_id();
  v_empresa     record;
  v_nombre      text := btrim(coalesce(p_nombre, ''));
  v_proyecto    public.proyectos;
begin
  if private.mi_rol() is distinct from 'admin_consultoria' then
    raise exception 'Solo el administrador de la consultoría crea proyectos.' using errcode = '42501';
  end if;

  select id, consultoria_id, activa into v_empresa from public.empresas where id = p_empresa_id;
  if not found or v_empresa.consultoria_id is distinct from v_consultoria then
    raise exception 'Empresa no encontrada.' using errcode = '22023';
  end if;
  if not v_empresa.activa then
    raise exception 'La empresa está archivada: no se le pueden crear proyectos.' using errcode = '22023';
  end if;
  if v_nombre = '' then
    raise exception 'El nombre del proyecto es obligatorio.' using errcode = '22023';
  end if;
  -- O35: un proyecto no termina antes de empezar.
  if p_fecha_inicio is not null and p_fecha_fin_estimada is not null and p_fecha_fin_estimada < p_fecha_inicio then
    raise exception 'La fecha fin estimada no puede ser anterior a la de inicio.' using errcode = '22023';
  end if;
  if p_consultor_id is not null then
    perform private.validar_miembro_equipo(p_consultor_id, v_consultoria);
  end if;

  insert into public.proyectos (consultoria_id, empresa_id, consultor_id, nombre, objetivo, alcance, edicion_norma, fecha_inicio, fecha_fin_estimada)
  values (v_consultoria, p_empresa_id, p_consultor_id, v_nombre, nullif(btrim(coalesce(p_objetivo, '')), ''),
          nullif(btrim(coalesce(p_alcance, '')), ''), coalesce(p_edicion_norma, 'ISO 9001:2026'), p_fecha_inicio, p_fecha_fin_estimada)
  returning * into v_proyecto;

  -- Sin esto el consultor asignado no vería su propio proyecto (el RLS mira proyecto_miembros).
  if p_consultor_id is not null then
    insert into public.proyecto_miembros (proyecto_id, usuario_id, consultoria_id)
    values (v_proyecto.id, p_consultor_id, v_consultoria);
  end if;

  insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion)
  values (v_consultoria, v_proyecto.id, 'proyecto', v_proyecto.id, auth.uid(), 'Proyecto creado', v_nombre);

  return v_proyecto;
end;
$$;
