-- O36 · El "Valor observado" de un indicador es un número (con punto o coma) o queda vacío (= sin datos).
-- La columna `valor` es texto libre y la pantalla guardaba cualquier cosa ("abc %"), que luego se mostraba como si fuera
-- una medición. Los valores que ya hay (vacío o números) cumplen la regla. La unidad va en su propio campo, no en el valor.

alter table public.indicadores
  add constraint indicadores_valor_numerico check (valor ~ '^\s*(-?[0-9]+([.,][0-9]+)?)?\s*$');
