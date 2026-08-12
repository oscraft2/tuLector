-- Second editorial batch: practical help-center content inspired by SaaS
-- knowledge bases. These articles are published because they cover stable,
-- low-risk workflows and can be edited later from /admin/help-center.
INSERT INTO public.faq_categories (locale, slug, name, sort_order, published)
VALUES
  ('es-CL', 'cuenta-y-acceso', 'Cuenta y acceso', 40, true),
  ('es-CL', 'planes-y-facturacion', 'Planes y facturación', 50, true),
  ('es-CL', 'equipos-y-colegios', 'Equipos y colegios', 60, true),
  ('es-CL', 'problemas-frecuentes', 'Problemas frecuentes', 70, true),
  ('es-CL', 'seguridad-y-privacidad', 'Seguridad y privacidad', 80, true),
  ('es-MX', 'cuenta-y-acceso', 'Cuenta y acceso', 40, true),
  ('es-MX', 'planes-y-facturacion', 'Planes y facturación', 50, true),
  ('es-MX', 'equipos-y-colegios', 'Equipos y colegios', 60, true),
  ('es-MX', 'problemas-frecuentes', 'Problemas frecuentes', 70, true),
  ('es-MX', 'seguridad-y-privacidad', 'Seguridad y privacidad', 80, true)
ON CONFLICT (locale, slug) DO NOTHING;

WITH content(locale, category_slug, slug, title, excerpt, body_md, tags) AS (VALUES
  ('es-CL', 'primeros-pasos', 'que-puedo-hacer-con-tulector', 'Qué puedes hacer con TuLector', 'Una vista rápida de las funciones principales para docentes, academias y colegios.', $$# Qué puedes hacer con TuLector

TuLector convierte la cámara de un celular en un lector de hojas de respuesta. Puedes crear evaluaciones, imprimir hojas, escanear cursos completos y revisar resultados sin digitar cada respuesta.

## Flujo recomendado

1. Crea una evaluación.
2. Genera e imprime las hojas.
3. Carga o completa la clave de respuestas.
4. Escanea las hojas con la cámara.
5. Revisa y comparte los resultados.

También puedes exportar información para continuar el análisis en una planilla.$$ , ARRAY['inicio','funciones','flujo']),
  ('es-CL', 'primeros-pasos', 'como-empezar-en-tulector', 'Cómo empezar en TuLector', 'La ruta más corta para pasar de una hoja en blanco a un resultado corregido.', $$# Cómo empezar en TuLector

Para comenzar solo necesitas una cuenta, una evaluación y hojas impresas. Entra al dashboard y sigue el botón **Nuevo ensayo**.

En tu primera prueba usa pocas preguntas. Así podrás revisar el formato, validar la clave y familiarizarte con el escaneo antes de aplicarla a todo el curso.

Cuando el resultado sea correcto, reutiliza la configuración para tus siguientes evaluaciones.$$ , ARRAY['inicio','primeros pasos','dashboard']),
  ('es-CL', 'primeros-pasos', 'como-elegir-el-tipo-de-evaluacion', 'Cómo elegir el tipo de evaluación', 'Diferencias entre una evaluación personalizada, PAES y otros formatos.', $$# Cómo elegir el tipo de evaluación

Elige **Personalizada** cuando necesitas controlar libremente preguntas, alternativas y escala. Usa un formato específico cuando quieres conservar una estructura conocida, como PAES o SIMCE.

La elección afecta las sugerencias de configuración y el tipo de resultado mostrado. No cambia la lectura básica de la hoja: la clave sigue siendo la fuente para corregir.$$ , ARRAY['evaluación','PAES','SIMCE']),
  ('es-CL', 'primeros-pasos', 'como-duplicar-una-evaluacion', 'Cómo duplicar una evaluación', 'Reutiliza una prueba sin comenzar desde cero.', $$# Cómo duplicar una evaluación

Desde la lista de ensayos abre el menú de acciones de la evaluación y selecciona **Duplicar**. La copia conserva la configuración y la clave, pero queda como una evaluación independiente.

Cambia el nombre, fecha o curso antes de imprimir. Los resultados de la evaluación original no se mezclan con la copia.$$ , ARRAY['duplicar','ensayo','reutilizar']),
  ('es-CL', 'primeros-pasos', 'como-archivar-una-evaluacion', 'Cómo archivar una evaluación', 'Ordena tu dashboard sin perder los resultados históricos.', $$# Cómo archivar una evaluación

Archiva una evaluación cuando ya no la usarás durante el periodo actual. Archivar ayuda a mantener limpia la lista de trabajo y conserva la información histórica.

Antes de archivarla, exporta los resultados que necesites y confirma que no existan hojas pendientes de revisión.$$ , ARRAY['archivar','organización','resultados']),
  ('es-CL', 'escaneo-y-correccion', 'como-preparar-el-celular-para-escanear', 'Cómo preparar el celular para escanear', 'Ajustes simples para obtener lecturas rápidas y precisas.', $$# Cómo preparar el celular para escanear

Limpia la cámara, carga el celular y desactiva notificaciones que puedan interrumpir la sesión. Coloca las hojas sobre una superficie plana y con luz pareja.

Evita reflejos directos, ventanas detrás de la hoja y sombras de tu mano. No necesitas una cámara profesional: la estabilidad y el contraste importan más que la resolución máxima.$$ , ARRAY['celular','cámara','preparación']),
  ('es-CL', 'escaneo-y-correccion', 'que-lapiz-usar-en-las-hojas', 'Qué lápiz usar en las hojas de respuesta', 'Recomendaciones para que las marcas sean fáciles de leer.', $$# Qué lápiz usar en las hojas de respuesta

Recomendamos lápiz grafito HB o un lápiz pasta negro. La marca debe quedar dentro del círculo y tener suficiente contraste.

Evita lápices muy claros, colores suaves y marcas incompletas. Si el estudiante cambia una respuesta, debe borrar bien la alternativa anterior antes de marcar la nueva.$$ , ARRAY['lápiz','marcas','hoja']),
  ('es-CL', 'escaneo-y-correccion', 'como-escanear-varias-hojas-seguidas', 'Cómo escanear varias hojas seguidas', 'Organiza una sesión de corrección para avanzar más rápido.', $$# Cómo escanear varias hojas seguidas

Selecciona la evaluación antes de iniciar y ten las hojas ordenadas. Después de cada lectura espera la confirmación del resultado antes de mover la hoja.

Si una hoja queda en revisión, sepárala y continúa con la siguiente. Al final vuelve a las revisiones para no interrumpir el ritmo de la sesión.$$ , ARRAY['lote','curso','velocidad']),
  ('es-CL', 'escaneo-y-correccion', 'por-que-aparece-una-hoja-en-revision', 'Por qué aparece una hoja en revisión', 'Qué significa la revisión manual y cómo resolverla.', $$# Por qué aparece una hoja en revisión

La revisión manual protege tus resultados cuando el sistema no puede identificar con suficiente confianza una hoja, un alumno o una marca.

Revisa la imagen, confirma el código de la evaluación y asigna el estudiante correcto. Si hay marcas ambiguas, corrige solo con evidencia visible en la hoja.$$ , ARRAY['revisión manual','confianza','imagen']),
  ('es-CL', 'escaneo-y-correccion', 'como-evitar-dobles-lecturas', 'Cómo evitar dobles lecturas', 'Buenas prácticas para no procesar dos veces la misma hoja.', $$# Cómo evitar dobles lecturas

Mantén las hojas ya procesadas en una pila separada. No vuelvas a escanear una hoja solo porque quieres revisar su resultado: abre el detalle desde el dashboard.

Si necesitas repetir la lectura, verifica primero si se creará una nueva entrada o si corresponde corregir la existente.$$ , ARRAY['duplicado','escaneo','orden']),
  ('es-CL', 'escaneo-y-correccion', 'que-hacer-con-una-marca-ambigua', 'Qué hacer con una marca ambigua', 'Cómo actuar cuando un estudiante marcó dos alternativas o borró una respuesta.', $$# Qué hacer con una marca ambigua

Una marca ambigua puede aparecer cuando hay dos alternativas oscuras, una respuesta borrada de forma incompleta o un círculo apenas marcado.

Compara la imagen con la hoja original y aplica el criterio de evaluación de tu institución. No adivines la respuesta: si no existe evidencia suficiente, deja el caso en revisión.$$ , ARRAY['marca doble','ambigua','revisión']),
  ('es-CL', 'resultados-y-cuenta', 'como-filtrar-resultados-por-curso', 'Cómo filtrar resultados por curso', 'Encuentra rápidamente un grupo, evaluación o estudiante.', $$# Cómo filtrar resultados por curso

En el dashboard selecciona el curso o la evaluación que quieres analizar. Usa los filtros antes de exportar para que la planilla contenga solo el grupo necesario.

Si no ves un curso, revisa que la evaluación y los estudiantes estén asociados al mismo colegio activo.$$ , ARRAY['filtros','curso','dashboard']),
  ('es-CL', 'resultados-y-cuenta', 'como-ver-el-detalle-de-un-estudiante', 'Cómo ver el detalle de un estudiante', 'Revisa respuestas, puntaje y preguntas con dificultad.', $$# Cómo ver el detalle de un estudiante

Abre una evaluación y selecciona el nombre del estudiante. El detalle muestra sus respuestas, aciertos, puntaje y nota cuando la evaluación tiene una clave válida.

Usa este espacio para retroalimentar preguntas específicas. El resultado individual no reemplaza la revisión pedagógica del trabajo del estudiante.$$ , ARRAY['estudiante','detalle','retroalimentación']),
  ('es-CL', 'resultados-y-cuenta', 'como-recalcular-resultados', 'Cómo recalcular resultados', 'Qué hacer después de cambiar una clave o configuración.', $$# Cómo recalcular resultados

Cuando cambias una clave, una pregunta anulada o una escala, TuLector recalcula los resultados asociados a la evaluación.

Espera a que termine el procesamiento antes de exportar. Si el cambio no aparece, actualiza la página y confirma que estás viendo la evaluación correcta.$$ , ARRAY['recalcular','clave','resultados']),
  ('es-CL', 'resultados-y-cuenta', 'como-leer-el-analisis-de-distractores', 'Cómo leer el análisis de distractores', 'Usa las alternativas incorrectas para detectar errores comunes.', $$# Cómo leer el análisis de distractores

El análisis de distractores muestra qué alternativas incorrectas fueron elegidas con mayor frecuencia.

Un distractor muy seleccionado puede señalar una confusión común, una instrucción poco clara o un contenido que necesita refuerzo. Contrasta siempre el dato con el objetivo de aprendizaje.$$ , ARRAY['distractores','análisis','aprendizaje']),
  ('es-CL', 'resultados-y-cuenta', 'como-compartir-un-reporte', 'Cómo compartir un reporte', 'Comparte resultados sin enviar toda la información del curso.', $$# Cómo compartir un reporte

Elige el alcance del reporte antes de compartirlo: estudiante, curso o evaluación. Para información individual, usa un enlace privado o descarga solo las filas necesarias.

No envíes por canales abiertos una planilla con nombres, RUT u otros datos de estudiantes.$$ , ARRAY['reporte','compartir','privacidad']),
  ('es-CL', 'cuenta-y-acceso', 'como-iniciar-sesion', 'Cómo iniciar sesión', 'Accede a tu cuenta desde el navegador o la aplicación.', $$# Cómo iniciar sesión

Abre TuLector y selecciona **Iniciar sesión**. Escribe el correo y contraseña asociados a tu cuenta o utiliza el proveedor disponible en tu pantalla.

Si ingresas desde un dispositivo compartido, cierra sesión al terminar y no guardes la contraseña en el navegador.$$ , ARRAY['login','acceso','cuenta']),
  ('es-CL', 'cuenta-y-acceso', 'olvide-mi-contrasena', 'Olvidé mi contraseña', 'Recupera el acceso sin crear una segunda cuenta.', $$# Olvidé mi contraseña

En la pantalla de inicio de sesión selecciona **¿Olvidaste tu contraseña?** e ingresa el correo de tu cuenta.

Revisa la bandeja de entrada y la carpeta de spam. El enlace de recuperación es personal y no debes compartirlo. Si no recibes el correo después de unos minutos, crea un ticket con tu dirección de cuenta.$$ , ARRAY['contraseña','recuperación','acceso']),
  ('es-CL', 'cuenta-y-acceso', 'como-cambiar-el-correo-de-la-cuenta', 'Cómo cambiar el correo de la cuenta', 'Mantén actualizado el correo que recibe avisos y enlaces.', $$# Cómo cambiar el correo de la cuenta

El correo identifica tu cuenta y puede recibir enlaces de recuperación, avisos y respuestas de soporte. Antes de cambiarlo, confirma que tienes acceso a la nueva dirección.

Si el cambio no está disponible en tu configuración, solicita ayuda indicando el correo actual y el nuevo. Nunca envíes tu contraseña.$$ , ARRAY['correo','perfil','cuenta']),
  ('es-CL', 'cuenta-y-acceso', 'como-cambiar-de-colegio', 'Cómo cambiar de colegio', 'Trabaja con otra institución cuando tienes más de una membresía.', $$# Cómo cambiar de colegio

Si perteneces a más de un colegio, usa el selector de institución del dashboard para cambiar el contexto activo.

Confirma siempre el nombre del colegio antes de crear una evaluación, escanear hojas o exportar resultados. Esto evita mezclar trabajo entre instituciones.$$ , ARRAY['colegio','membresía','dashboard']),
  ('es-CL', 'planes-y-facturacion', 'donde-ver-mi-plan', 'Dónde ver mi plan', 'Consulta el plan, uso y lecturas disponibles.', $$# Dónde ver mi plan

Entra al dashboard y abre **Mi plan** o **Facturación**. Allí puedes revisar el plan activo, lecturas utilizadas y límites del periodo.

Si el uso mostrado no coincide con tu actividad, guarda una captura y contacta a soporte indicando el colegio y la fecha.$$ , ARRAY['plan','cuota','facturación']),
  ('es-CL', 'planes-y-facturacion', 'que-ocurre-si-agoto-las-lecturas', 'Qué ocurre si agoto las lecturas', 'Entiende el límite de uso y cómo continuar trabajando.', $$# Qué ocurre si agoto las lecturas

Cuando alcanzas el límite de tu plan, los nuevos escaneos pueden quedar bloqueados hasta renovar o ampliar la cuota.

Tus evaluaciones y resultados existentes no se eliminan. Revisa **Mi plan** para conocer las opciones disponibles o contacta a ventas para una solución institucional.$$ , ARRAY['lecturas','cuota','plan']),
  ('es-CL', 'planes-y-facturacion', 'como-solicitar-una-factura', 'Cómo solicitar una factura', 'Qué datos necesitamos para ayudarte con la documentación de pago.', $$# Cómo solicitar una factura

Contacta al equipo de ventas o facturación con el nombre legal de la institución, identificador tributario, dirección y datos de contacto.

Indica también el plan o compra asociada y la fecha aproximada. No envíes datos de tarjetas ni contraseñas por correo o ticket.$$ , ARRAY['factura','pago','institución']),
  ('es-CL', 'equipos-y-colegios', 'como-invitar-a-un-docente', 'Cómo invitar a un docente', 'Agrega integrantes al equipo sin compartir contraseñas.', $$# Cómo invitar a un docente

Desde la administración del colegio abre **Equipo** o **Invitaciones** y escribe el correo del docente. Selecciona el rol que necesita y envía la invitación.

Cada persona debe usar su propia cuenta. Así se mantienen los permisos, la trazabilidad y la privacidad de los resultados.$$ , ARRAY['equipo','invitación','docente']),
  ('es-CL', 'equipos-y-colegios', 'que-rol-dar-a-cada-integrante', 'Qué rol dar a cada integrante', 'Elige permisos adecuados para administradores, docentes y visualizadores.', $$# Qué rol dar a cada integrante

Entrega permisos de administración solo a quienes gestionan el colegio, equipo o facturación. Los docentes deberían tener acceso a las evaluaciones y cursos que necesitan para trabajar.

Usa un rol de visualización cuando alguien solo deba consultar reportes. Revisa los permisos periódicamente y retira accesos que ya no correspondan.$$ , ARRAY['roles','permisos','equipo']),
  ('es-CL', 'equipos-y-colegios', 'como-organizar-evaluaciones-del-colegio', 'Cómo organizar las evaluaciones del colegio', 'Una convención simple para encontrar pruebas y reportes.', $$# Cómo organizar las evaluaciones del colegio

Usa nombres consistentes, por ejemplo: `8B - Matemática - Diagnóstico marzo 2026`. Incluye curso, asignatura y periodo.

Archiva evaluaciones antiguas y evita crear copias con nombres ambiguos. Esta práctica facilita el trabajo de todo el equipo y reduce errores al escanear.$$ , ARRAY['organización','colegio','evaluaciones']),
  ('es-CL', 'problemas-frecuentes', 'la-pagina-no-carga', 'La página no carga', 'Pasos rápidos para recuperar una sesión de TuLector.', $$# La página no carga

Comprueba tu conexión y recarga la página. Si el problema continúa, prueba una ventana privada o un navegador actualizado.

Si solo falla una sección, anota la URL y el mensaje que aparece. Envía esa información a soporte junto con la hora y el dispositivo utilizado.$$ , ARRAY['error','navegador','carga']),
  ('es-CL', 'problemas-frecuentes', 'el-escaneo-es-lento', 'El escaneo es lento', 'Mejora la velocidad sin sacrificar la calidad de lectura.', $$# El escaneo es lento

Usa una superficie plana, buena luz y una cámara limpia. Evita alejar demasiado el celular o moverlo mientras se detectan los marcadores.

Cierra otras aplicaciones que estén usando la cámara. Para cursos grandes, organiza las hojas y separa las que requieren revisión.$$ , ARRAY['lento','rendimiento','cámara']),
  ('es-CL', 'problemas-frecuentes', 'mis-resultados-no-aparecen', 'Mis resultados no aparecen', 'Qué revisar cuando una lectura parece no haberse guardado.', $$# Mis resultados no aparecen

Actualiza la página y confirma que estás en el colegio y evaluación correctos. Revisa también si la hoja quedó en **Revisión manual**.

Si trabajaste sin conexión, espera a recuperar internet y deja la aplicación abierta para sincronizar. Si sigue sin aparecer, contacta a soporte con el código de la evaluación.$$ , ARRAY['resultados','sincronización','offline']),
  ('es-CL', 'problemas-frecuentes', 'el-alumno-no-aparece-en-la-lista', 'El alumno no aparece en la lista', 'Resuelve problemas de curso, identificación y membresía.', $$# El alumno no aparece en la lista

Confirma que el alumno pertenezca al curso y al colegio activo. Revisa posibles diferencias en nombre, identificador o correo.

Si ya escaneaste la hoja, usa la revisión manual para asignarla al estudiante correcto. Evita crear duplicados antes de revisar la búsqueda.$$ , ARRAY['alumno','curso','identificación']),
  ('es-CL', 'seguridad-y-privacidad', 'como-protegemos-los-resultados', 'Cómo protegemos los resultados', 'Buenas prácticas para trabajar con información académica.', $$# Cómo protegemos los resultados

TuLector restringe el acceso a los datos según la cuenta, colegio y permisos asignados. Los resultados no deben compartirse en enlaces públicos ni mediante cuentas genéricas.

Tu equipo también es parte de la seguridad: usa contraseñas individuales, revisa invitaciones y cierra sesiones en dispositivos compartidos.$$ , ARRAY['seguridad','resultados','datos']),
  ('es-CL', 'seguridad-y-privacidad', 'que-datos-no-debo-enviar-a-soporte', 'Qué datos no debo enviar a soporte', 'Obtén ayuda sin exponer información sensible.', $$# Qué datos no debo enviar a soporte

Nunca envíes contraseñas, códigos de recuperación, números completos de tarjeta ni tokens privados.

Si necesitas compartir una captura, oculta RUT, correos de estudiantes y cualquier dato que no sea necesario. Incluye el mensaje de error y la URL para que podamos investigar.$$ , ARRAY['privacidad','soporte','seguridad']),
  ('es-CL', 'seguridad-y-privacidad', 'como-revocar-el-acceso-de-un-usuario', 'Cómo revocar el acceso de un usuario', 'Retira rápidamente el acceso de una persona que ya no pertenece al equipo.', $$# Cómo revocar el acceso de un usuario

Desde la administración del colegio abre la lista de integrantes, busca a la persona y revoca su membresía o invitación pendiente.

Hazlo cuando alguien deja la institución o cambia de función. Luego revisa los enlaces compartidos y exportaciones que esa persona pudiera conservar.$$ , ARRAY['acceso','equipo','privacidad']),
  ('es-MX', 'primeros-pasos', 'como-empezar-en-tulector-mx', 'Cómo empezar en TuLector', 'Crea una evaluación, imprime hojas y corrige tu primer grupo.', $$# Cómo empezar en TuLector

Entra al dashboard, crea una evaluación y define el número de preguntas y opciones. Después genera las hojas, completa la clave y escanea una muestra pequeña.

Cuando confirmes que el resultado es correcto, continúa con el resto del grupo. Trabajar primero con una muestra te ayuda a detectar errores de impresión o configuración.$$ , ARRAY['inicio','evaluación','dashboard']),
  ('es-MX', 'escaneo-y-correccion', 'como-escanear-hojas-en-tulector-mx', 'Cómo escanear hojas de respuesta', 'Usa la cámara del celular para leer respuestas de tus estudiantes.', $$# Cómo escanear hojas de respuesta

Selecciona la evaluación y apunta la cámara a la hoja completa. Mantén visibles los marcadores de las esquinas, usa luz pareja y evita reflejos.

Si una hoja queda en revisión, sepárala para resolverla después y continúa con las hojas que sí fueron reconocidas.$$ , ARRAY['escanear','cámara','hojas']),
  ('es-MX', 'resultados-y-cuenta', 'como-exportar-resultados-en-tulector-mx', 'Cómo exportar resultados', 'Descarga una planilla para analizar las respuestas del grupo.', $$# Cómo exportar resultados

Abre la evaluación, selecciona **Resultados** y usa la opción **Exportar**. Filtra por grupo o estudiante antes de descargar.

Revisa que la clave y el curso sean correctos. No compartas la planilla en canales públicos si contiene nombres o identificadores.$$ , ARRAY['exportar','resultados','Excel']),
  ('es-MX', 'cuenta-y-acceso', 'olvide-mi-contrasena-en-tulector', 'Olvidé mi contraseña', 'Recupera tu acceso usando el correo de tu cuenta.', $$# Olvidé mi contraseña

Selecciona **¿Olvidaste tu contraseña?** en la pantalla de acceso y revisa tu correo. También verifica la carpeta de spam.

Si no recibes el mensaje, crea un ticket desde Soporte indicando el correo de la cuenta. Nunca compartas tu contraseña.$$ , ARRAY['contraseña','acceso','cuenta']),
  ('es-MX', 'problemas-frecuentes', 'mis-resultados-no-aparecen-en-tulector', 'Mis resultados no aparecen', 'Revisa colegio, evaluación y sincronización antes de solicitar ayuda.', $$# Mis resultados no aparecen

Confirma que estás viendo el colegio y evaluación correctos. Revisa si la hoja quedó en revisión manual y espera la sincronización si trabajaste sin conexión.

Si el problema continúa, envía a soporte el código de evaluación, fecha y dispositivo utilizado.$$ , ARRAY['resultados','sincronización','soporte'])
)
INSERT INTO public.faq_articles (category_id, locale, slug, title, excerpt, body_md, tags, status, published, published_at, reading_minutes)
SELECT c.id, x.locale, x.slug, x.title, x.excerpt, x.body_md, x.tags, 'published', true, now(), 3
FROM content x
JOIN public.faq_categories c ON c.locale = x.locale AND c.slug = x.category_slug
ON CONFLICT (locale, slug) DO NOTHING;

NOTIFY pgrst, 'reload schema';
