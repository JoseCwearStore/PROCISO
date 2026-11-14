# Estado del proyecto

Resumen para quien llega nuevo: qué hay construido, cómo está verificado, qué decisiones de diseño se tomaron y qué falta. Última actualización: **13/11/2026** (`main` = `1c7d653` al escribirlo). La instalación está en el [README](../README.md).

## Qué hace la plataforma

Apoyo para consultorías **ISO 9001:2026**: la empresa responde preguntas guiadas y sube evidencias; la IA genera **borradores** y hace **preevaluaciones**; un **consultor humano** revisa y valida. No certifica.

**Roles:** Admin PROCISO · Admin Consultoría · Consultor (equipo) · Cliente (usuario de la empresa). Cada consultoría solo ve lo suyo (RLS en la base).

**Módulos del menú:** Inicio · Empresas cliente · Proyectos · Levantamiento de procesos · Procesos · Evidencias · Documentación · Revisiones y aprobaciones · Tablero de tareas · Listas de verificación · No conformidades · Indicadores e informes · Notificaciones · Ayuda y soporte (y, para administradores, Usuarios y Configuración).

## Cómo funciona la IA

- **Analizar** un documento o una evidencia (imagen, PDF, audio, video) contra criterios de la norma. El resultado se guarda en `analisis_ia` y `analisis_ia_resultados` (un renglón por criterio: Cubierto, Parcial, Hueco, No evaluable, No aplica, con hallazgo y sugerencia). Solo lo pide el **equipo**; lo ven equipo y cliente.
- **Generar borradores** de partes de un documento (política, alcance, objetivos) a partir del cuestionario guiado. Si la IA falla, se genera el borrador con las respuestas del usuario.
- **Audio y video** se transcriben o analizan con un servicio externo: el archivo sale de la plataforma.
- **El análisis no valida nada.** Un documento pasa por Borrador → En revisión → Aprobado / Rechazado por decisión de una persona (`decidir_documento`); al aprobar, la versión anterior queda Obsoleta y se registra el visto bueno del equipo.
- Desde un criterio en **Hueco o Parcial** el equipo puede iniciar una **no conformidad** con los datos precargados; no se crea nada sin confirmar.
- Todo resultado es una **preevaluación, no un dictamen**, y el contenido analizado puede venir de la empresa evaluada.

**Límites vigentes:** videos de máximo **10 min** y **200 MB**, con **5 min recomendados** (aviso entre 5 y 10); 30 pedidos de IA por usuario y 150 por consultoría al día; 5 análisis de video por usuario y 15 por consultoría. Las imágenes exigen un modelo con visión (`qwen/qwen3.8-27b`, que está en **Preview** en Groq).

## Decisiones de diseño

- **Visto bueno del equipo** al aprobar un documento: se registra quién y cuándo, no solo en rechazos.
- **Avance de un proyecto** se pondera por lo que el proyecto realmente tiene: sin tareas cuenta el % de entregables; sin entregables, el % de tareas; con ambos, 70 % entregables y 30 % tareas.
- **Responsable de un proceso:** puede ser del equipo o del cliente.
- **Un documento nuevo versiona** por código: crear otra versión obsolesce la anterior al aprobarse.
- **Tope de uso de IA** por usuario y consultoría, y aparte para video, porque un video cuesta mucho más que un texto.
- **Las reglas de negocio y la seguridad viven en la base** (RLS, funciones `SECURITY DEFINER`); las Edge Functions son delgadas.

## Cómo está verificado

- **Pruebas automáticas:** Vitest (lógica en `src/lib`) y pgTAP (reglas y RLS de la base). Última cifra anotada: Vitest 1306, pgTAP 870 `(medido antes de los últimos cambios de video y O37)`.
- **Pruebas manuales en pantalla:** recorridas Inicio, Empresas, Proyectos, Levantamiento de procesos, Procesos, Evidencias, Documentación, Revisiones y Tablero de tareas, con varios roles y con los hallazgos corregidos.

## Qué falta

- **Módulos sin recorrer:** No conformidades (pantalla completa), Listas de verificación, Indicadores e informes, Notificaciones, Ayuda y soporte, Usuarios y Configuración.
- **Roles sin recorrer en los módulos nuevos:** Admin PROCISO, Admin Consultoría y Cliente.
- **Pasada de escrituras** (crear, guardar, cambiar estado, aprobar, exportar PDF y Word) y modo móvil y oscuro.
- **Verificación pendiente:** el README no se siguió desde una instalación limpia; el CI `base-de-datos` nunca había corrido en GitHub; no se probaron los bloqueos de subir un video de más de 10 min ni de más de 200 MB; no se probaron documentos de texto con Qwen.
- **Manual de usuario:** se escribirá al terminar la revisión de módulos.
- **Riesgo conocido:** Qwen tiene modo de razonamiento y el lector de respuestas toma el JSON de la primera `{` a la última `}`; con una corrida no apareció el problema, pero no queda descartado.
