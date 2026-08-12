-- Initial editorial backlog. Articles are intentionally drafts until reviewed by support.
INSERT INTO public.faq_categories (locale, slug, name, sort_order, published)
VALUES
  ('es-CL', 'primeros-pasos', 'Primeros pasos', 10, true),
  ('es-CL', 'escaneo-y-correccion', 'Escaneo y corrección', 20, true),
  ('es-CL', 'resultados-y-cuenta', 'Resultados y cuenta', 30, true),
  ('es-MX', 'primeros-pasos', 'Primeros pasos', 10, true),
  ('es-MX', 'escaneo-y-correccion', 'Escaneo y corrección', 20, true),
  ('es-MX', 'resultados-y-cuenta', 'Resultados y cuenta', 30, true),
  ('pt-BR', 'primeiros-passos', 'Primeiros passos', 10, true),
  ('pt-BR', 'leitura-e-correcao', 'Leitura e correção', 20, true),
  ('pt-BR', 'resultados-e-conta', 'Resultados e conta', 30, true)
ON CONFLICT (locale, slug) DO NOTHING;

INSERT INTO public.faq_articles (category_id, locale, slug, title, excerpt, body_md, tags, status, published, reading_minutes)
SELECT c.id, seed.locale, seed.slug, seed.title, seed.excerpt, seed.body_md, seed.tags, 'draft', false, 3
FROM (VALUES
  ('es-CL', 'como-crear-una-evaluacion', 'primeros-pasos', 'Cómo crear una evaluación', 'Configura tu primera prueba y deja lista la clave de respuestas.', $$# Cómo crear una evaluación

En TuLector puedes crear una evaluación con el número de preguntas y alternativas que necesites.

## Pasos

1. Ingresa al dashboard y abre **Ensayos**.
2. Selecciona **Nuevo ensayo**.
3. Define el nombre, curso, cantidad de preguntas y número de alternativas.
4. Guarda la evaluación y abre el editor de clave.

Antes de imprimir las hojas, revisa que la clave esté completa y que las alternativas coincidan con tu prueba.$$ , ARRAY['evaluación','ensayo','configuración']),
  ('es-CL', 'como-generar-e-imprimir-hojas', 'primeros-pasos', 'Cómo generar e imprimir hojas de respuesta', 'Aprende a crear hojas compatibles con la lectura por cámara.', $$# Cómo generar e imprimir hojas de respuesta

Desde la evaluación selecciona **Generar hoja** y descarga el PDF. Imprime en papel blanco común, manteniendo visibles los marcadores de las esquinas.

## Recomendaciones

- No recortes los bordes de la hoja.
- Usa escala de impresión al 100%; no selecciones “ajustar a página”.
- Comprueba que el código de la evaluación sea legible.

Haz una prueba con una hoja antes de imprimir un curso completo.$$ , ARRAY['hoja','PDF','impresión']),
  ('es-CL', 'como-crear-y-usar-un-gabarito', 'primeros-pasos', 'Cómo crear y usar un gabarito', 'Asocia la clave correcta a una evaluación antes de escanear.', $$# Cómo crear y usar un gabarito

El gabarito indica qué alternativa corresponde a cada pregunta. Abre la evaluación, entra a **Clave de respuestas** y marca una alternativa por pregunta.

Guarda los cambios antes de comenzar a escanear. Si corriges una respuesta después, los resultados se recalculan con la nueva clave.$$ , ARRAY['gabarito','clave','respuestas']),
  ('es-CL', 'como-escanear-hojas-con-la-camara', 'escaneo-y-correccion', 'Cómo escanear hojas con la cámara', 'Guía para leer hojas de respuesta desde el celular.', $$# Cómo escanear hojas con la cámara

Abre TuLector, selecciona la evaluación y apunta la cámara a una hoja completa. Los cuatro marcadores de las esquinas deben quedar dentro de la imagen.

## Para obtener mejores resultados

- Usa buena luz y evita reflejos.
- Mantén el teléfono paralelo a la hoja.
- Asegúrate de que las marcas estén oscuras y dentro de los círculos.

Cuando la hoja sea reconocida, confirma el resultado y continúa con la siguiente.$$ , ARRAY['escanear','cámara','OMR']),
  ('es-CL', 'que-hacer-si-una-hoja-no-se-reconoce', 'escaneo-y-correccion', 'Qué hacer si una hoja no se reconoce', 'Pasos para resolver errores de lectura y revisión manual.', $$# Qué hacer si una hoja no se reconoce

Si una hoja queda en revisión manual, revisa que los marcadores estén visibles, que no haya sombras y que el código de la evaluación corresponda.

Puedes volver a fotografiarla con mejor iluminación. Si el problema persiste, entra a la revisión manual para asignar el alumno o corregir la identificación.$$ , ARRAY['revisión manual','error','escanear']),
  ('es-CL', 'como-corregir-manualmente-un-resultado', 'escaneo-y-correccion', 'Cómo corregir manualmente un resultado', 'Revisa y ajusta una lectura cuando la cámara no pudo interpretar una marca.', $$# Cómo corregir manualmente un resultado

Desde **Resultados** abre la hoja marcada para revisión. Comprueba el alumno, la página y las respuestas detectadas; luego guarda la corrección.

La modificación queda asociada al resultado y puedes volver a revisar el detalle antes de exportar.$$ , ARRAY['revisión','resultado','corrección']),
  ('es-CL', 'como-modificar-la-clave-despues-de-escanear', 'escaneo-y-correccion', 'Cómo modificar la clave después de escanear', 'Actualiza una respuesta anulada o corregida sin repetir el escaneo.', $$# Cómo modificar la clave después de escanear

Abre la evaluación y entra a **Clave de respuestas**. Cambia la alternativa o anula la pregunta y guarda.

Los puntajes y las notas se recalculan automáticamente para las hojas asociadas a esa evaluación.$$ , ARRAY['clave','recalcular','nota']),
  ('es-CL', 'como-interpretar-resultados-por-pregunta', 'resultados-y-cuenta', 'Cómo interpretar los resultados por pregunta', 'Usa el análisis por ítem para detectar aprendizajes que necesitan refuerzo.', $$# Cómo interpretar los resultados por pregunta

En los resultados puedes revisar porcentaje de aciertos, distribución de alternativas y alumnos con dificultades.

Observa especialmente los distractores más elegidos: pueden indicar un error conceptual común y ayudarte a planificar la retroalimentación.$$ , ARRAY['resultados','ítems','análisis']),
  ('es-CL', 'como-exportar-resultados-a-excel', 'resultados-y-cuenta', 'Cómo exportar resultados a Excel', 'Descarga una planilla para analizar o compartir los resultados.', $$# Cómo exportar resultados a Excel

Abre la evaluación o el curso y selecciona **Exportar resultados**. Elige las columnas que necesitas y descarga el archivo.

La planilla incluye identificador del alumno, puntaje, nota y respuestas. Revisa el archivo antes de importarlo en otra plataforma.$$ , ARRAY['exportar','Excel','planilla']),
  ('es-CL', 'como-compartir-resultados-con-estudiantes', 'resultados-y-cuenta', 'Cómo compartir resultados con estudiantes', 'Genera enlaces individuales sin exponer los resultados del curso completo.', $$# Cómo compartir resultados con estudiantes

Desde el detalle de resultados genera un enlace individual para el estudiante. Comparte solo ese enlace por el canal que uses habitualmente.

Evita publicar enlaces en espacios abiertos y revoca o reemplaza enlaces si fueron compartidos por error.$$ , ARRAY['compartir','enlace','estudiantes']),
  ('es-CL', 'como-usar-tulector-sin-conexion', 'resultados-y-cuenta', 'Cómo usar TuLector sin conexión', 'Escanea en salas con conectividad limitada y sincroniza después.', $$# Cómo usar TuLector sin conexión

La aplicación móvil puede conservar el ensayo activo y procesar hojas aunque la conexión sea intermitente. Abre el ensayo antes de entrar a una zona sin señal.

Cuando recuperes internet, deja la aplicación abierta unos instantes para que los resultados pendientes se sincronicen.$$ , ARRAY['offline','sin conexión','app']),
  ('es-CL', 'como-configurar-una-prueba-paes', 'primeros-pasos', 'Cómo configurar una prueba PAES', 'Configura alternativas, puntaje y formato para un ensayo PAES.', $$# Cómo configurar una prueba PAES

Selecciona el formato PAES al crear la evaluación. Revisa la cantidad de preguntas, alternativas y la escala de puntaje antes de generar las hojas.

Para obtener resultados comparables, usa una clave validada y conserva la misma configuración durante la aplicación.$$ , ARRAY['PAES','Chile','ensayo']),
  ('es-CL', 'como-calcular-notas-de-1-a-7', 'resultados-y-cuenta', 'Cómo se calculan las notas de 1.0 a 7.0', 'Entiende la exigencia, el puntaje de corte y la nota resultante.', $$# Cómo se calculan las notas de 1.0 a 7.0

TuLector calcula la nota según la exigencia configurada para la evaluación. La configuración habitual usa 60% como porcentaje necesario para alcanzar un 4.0.

Revisa la exigencia y la escala antes de publicar resultados, especialmente si tu institución usa una política distinta.$$ , ARRAY['notas','exigencia','Chile']),
  ('es-CL', 'que-incluye-el-plan-gratis', 'resultados-y-cuenta', 'Qué incluye el plan gratis', 'Consulta las lecturas disponibles y las diferencias entre planes.', $$# Qué incluye el plan gratis

El plan gratis permite probar la lectura de hojas y revisar las funciones principales. La cuota disponible aparece en **Mi plan** y se actualiza con el uso.

Si necesitas más lecturas, equipos o soporte institucional, revisa los planes disponibles o contacta a ventas.$$ , ARRAY['plan','cuota','lecturas'])
) AS seed(locale, slug, category_slug, title, excerpt, body_md, tags)
JOIN public.faq_categories c ON c.locale = seed.locale AND c.slug = seed.category_slug
ON CONFLICT (locale, slug) DO NOTHING;

NOTIFY pgrst, 'reload schema';
