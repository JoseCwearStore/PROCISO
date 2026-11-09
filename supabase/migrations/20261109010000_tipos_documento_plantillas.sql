-- Tipos de documento de las plantillas del usuario (2026-11-09).
-- Se suman Alcance, Objetivos y Mapa de procesos a los tipos que ya había.
-- Se recrea el CHECK (no hay otra forma de ampliar una lista cerrada) y se deja
-- con nombre explícito para que la próxima ampliación sea igual de directa.

alter table public.documentos drop constraint documentos_tipo_check;

alter table public.documentos add constraint documentos_tipo_check
  check (tipo in ('Procedimiento', 'Manual', 'Instrucción de trabajo', 'Ficha de proceso',
                  'Formato', 'Lista de verificación', 'Matriz', 'Plan', 'Registro', 'Política',
                  'Alcance', 'Objetivos', 'Mapa de procesos'));
