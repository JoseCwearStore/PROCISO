-- AUD10-M2 · Las evidencias de un documento se vinculan y desvinculan solo por `guardar_documento`.
-- La política "equipo desvincula" dejaba al equipo borrar vínculos directo por la API, sin mirar el estado del documento
-- (D2: el contenido en revisión está congelado) y sin dejar historial. La pantalla nunca lo usó: vincular y desvincular
-- pasa por `guardar_documento` (SECURITY DEFINER), que sí aplica el congelado. Se cierra la puerta, como en M1.

drop policy if exists "equipo desvincula" on public.documento_evidencias;
revoke delete on public.documento_evidencias from anon, authenticated;
