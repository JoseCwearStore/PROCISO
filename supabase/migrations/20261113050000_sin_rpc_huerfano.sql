-- AUD10-M7 (simplificación) · Se retira `huerfano_de_invitacion`.
-- Servía para que la Edge Function borrara al usuario huérfano de Auth antes de re-invitar. Probado contra Supabase: al
-- invitar de nuevo a un usuario sin confirmar, Supabase reutiliza ese mismo usuario y reenvía el correo, así que no hace
-- falta borrar nada (y borrar usuarios desde una función es un riesgo que no se justifica). Lo que SÍ se queda es
-- `autorizar_invitacion` dejando pasar al huérfano (private.es_usuario_huerfano): sin eso la BD rechazaba el reintento.
drop function public.huerfano_de_invitacion(text);
