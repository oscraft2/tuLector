# Ficha de Google Play — TuLector

## Título de la app (30 caracteres máx.)
```
TuLector - Corrige pruebas
```
(26 caracteres)

## Descripción breve (80 caracteres máx.)
```
Escanea hojas de respuesta con la cámara y corrige pruebas al instante.
```
(72 caracteres)

## Descripción completa (4000 caracteres máx.)
```
TuLector es la forma más rápida de corregir pruebas de alternativas: escanea
las hojas de respuesta con la cámara del celular y obtén resultados al
instante, sin planillas ni corrección manual.

CÓMO FUNCIONA
1. Crea el ensayo con su clave de respuestas desde la app o la web.
2. Imprime la hoja de respuestas (se genera automáticamente).
3. Escanea cada hoja con la cámara — el lector detecta las respuestas y
   calcula el puntaje al instante.
4. Revisa resultados por alumno, por curso y por pregunta.

PARA QUIÉN ES
Pensado para profesores, colegios y preuniversitarios en Chile y
Latinoamérica que aplican pruebas de alternativas (personalizadas, tipo PAES
o tipo SIMCE) y necesitan corregir rápido, sin depender de un lector óptico
físico.

QUÉ INCLUYE LA APP
• Escaneo con cámara — motor de lectura óptica propio, sin hardware adicional
• Gestión de ensayos — crea pruebas, define la clave y el tipo de evaluación
• Resultados — puntaje y logro por alumno y por ensayo, al toque
• Gestión de alumnos — busca y agrega alumnos desde el teléfono
• Modo offline — si escaneas sin conexión, se sincroniza solo al recuperar
  internet
• Una sola cuenta — la misma sesión funciona en la app y en el navegador

PLANES Y FACTURACIÓN
TuLector funciona con un plan de cuota de lecturas por colegio. La compra o
actualización del plan se realiza desde tulector.app en cualquier navegador;
dentro de la app puedes ver tu plan actual y tu historial de facturas.

Más información y soporte: https://tulector.app
```

## Categoría
Educación

## Etiquetas / palabras clave sugeridas
corrección de pruebas, lector óptico, hojas de respuesta, escáner de
pruebas, OMR, evaluación educativa, PAES, SIMCE, gestión escolar

## Ícono de la app
`icon-512.png` (512×512, ya generado)

## Gráfico de portada (feature graphic)
`feature-graphic-1024x500.png` (ya generado)

## Capturas de pantalla (teléfono)
En orden sugerido de presentación:
1. `01-login.png` — Login (Google + correo)
2. `02-menu.png` — Menú principal (Escanear / Resultados / Alumnos / Mi plan)
3. `03-escanear.png` — Selección de ensayo para escanear
4. `04-resultados.png` — Resultados por ensayo
5. `05-alumnos.png` — Gestión de alumnos

Cumplen el mínimo de Google Play (2 capturas) y están dentro del rango de
aspecto aceptado (9:16, formato teléfono). Faltan capturas de tablet/7" y
10" si se quiere soporte de tablet — opcional, no bloqueante.

## Clasificación de contenido
Cuestionario "Content rating" de Play Console — la app no tiene contenido
generado por usuarios visible públicamente, ni violencia, ni contenido para
adultos. Categoría esperada: PEGI 3 / Todos.

## Data Safety (obligatorio, sensible — completar con cuidado)
Datos recolectados: correo electrónico (login), nombre (perfil), datos que
el propio colegio ingresa (alumnos, resultados de pruebas — no son datos
personales de terceros ajenos a la relación contractual del colegio).
Ninguno se comparte con terceros para publicidad. Sin advertising ID (ver
tarea de AD_ID ya removida del manifest).

## Política de privacidad / Términos
Ya publicados en el sitio:
- https://tulector.app/privacy
- https://tulector.app/terms
(tulector.cl NO resuelve — dominio sin registrar/configurar. Usar tulector.app,
que sirve la misma app y ya es el dominio de contacto en la política interna.)

## Eliminar cuenta (obligatorio Google y Apple) — RESUELTO
Ya implementado: botón "Eliminar mi cuenta" en Configuración
(`/dashboard/settings`, reusable desde la app vía el ícono de engranaje del
menú nativo). Borra el perfil y las membresías, elimina el usuario de
Supabase Auth, y redirige a `/account-deleted`. Los datos del colegio
(ensayos, alumnos, resultados) no se borran — son de la institución.
La política de privacidad ya referenciaba este derecho y el canal
`/data-request` para solicitudes por correo, cumpliendo también el
requisito de Google de tener una vía accesible sin necesidad de instalar la
app.
