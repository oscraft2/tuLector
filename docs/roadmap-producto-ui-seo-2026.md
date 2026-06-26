# TuLector: fases de producto, UI y SEO 2026

## Norte del producto

TuLector debe ser una plataforma de correccion y analisis de ensayos para colegios,
preuniversitarios y docentes. La web administra cuentas, cursos, alumnos, ensayos,
puntajes, reportes y exportaciones. La app movil lee hojas por camara y sincroniza
resultados con la misma cuenta.

La referencia comercial puede ser la categoria de ZipGrade, pero la implementacion,
layout, motor OMR, interfaz y marca deben ser propios y clean-room.

## Principios de UI

- Fondo blanco, texto grafito y estructura sobria.
- Estetica institucional educativa, no landing generica ni estilo IA.
- Tipografia sugerida: Source Sans 3 o Noto Sans con fallback a Segoe UI.
- Paleta base: blanco `#ffffff`, gris `#f6f7f9`, borde `#e2e6ea`, texto `#111827`.
- Primario TuLector: azul profundo `#123a5a`.
- Exito/sincronizacion: verde `#168a5b`.
- Error/accion destructiva: rojo `#c62828`.
- Nada de logos oficiales del Mineduc, DEMRE o PAES sin autorizacion.
- Branding institucional configurable: logo, nombre, membrete, colores y footer de reportes.

## Fase 0: base legal, seguridad y marca

Objetivo: dejar el proyecto listo para construir sin deuda critica.

Tareas:
- Retirar referencias descompiladas del repo de implementacion.
- Endurecer `scan_logs` con auth, Storage privado y RLS por usuario/organizacion.
- Definir nombre, logo, paleta, tipografia, tono y footer institucional.
- Crear layout base web con header, sidebar, footer y rutas privadas.
- Preparar metadata SEO global y texto legal de independencia.

Criterio de hecho:
- No existen logs publicos con imagenes.
- La web tiene identidad visual consistente.
- El producto no sugiere aval oficial no autorizado.

## Fase 1: cuenta sincronizada web + app

Objetivo: una sola cuenta TuLector para administrar y escanear.

Tareas:
- Supabase Auth para web y movil.
- Organizaciones, miembros y roles: owner, admin, teacher, assistant, viewer.
- Pantalla de cuenta de usuario.
- Pantalla de institucion.
- Sesiones activas y cierre remoto.
- Perfil de sincronizacion movil.

Criterio de hecho:
- Un usuario inicia sesion en web y app con la misma cuenta.
- La app ve las instituciones y permisos del usuario.

## Fase 2: administracion academica

Objetivo: administrar cursos, alumnos y estructura chilena inicial.

Tareas:
- CRUD de cursos.
- CRUD/importacion de alumnos por CSV/Excel.
- Campos: RUN opcional, ID interno, curso, apoderado opcional, estado.
- Asignaturas y niveles chilenos.
- Busqueda y filtros.
- Exportacion de alumnos.

Criterio de hecho:
- Un profesor carga un curso completo y puede usarlo en un ensayo.

## Fase 3: ensayos y hojas OMR

Objetivo: crear ensayos imprimibles y corregibles.

Tareas:
- Crear ensayo.
- Clave de respuestas.
- Versiones/Formas A-B-C.
- Preguntas anuladas y respuestas multiples permitidas.
- Ejes/habilidades por pregunta.
- Generador de hoja PDF con layout TuLector v2.
- ID de alumno, ID de ensayo, version y trazabilidad.

Criterio de hecho:
- Se crea un ensayo, se imprime una hoja y la app reconoce a que ensayo pertenece.

## Fase 4: lectura OMR real

Objetivo: pasar de fixture sintetico a lectura confiable de hojas impresas.

Tareas:
- Dataset real con fotos impresas.
- Deteccion efectiva de 12 anclas.
- Warp bilinear.
- Timing parcial con interpolacion.
- Clasificador propio entrenado.
- Rechazo por baja confianza.
- Revision manual de respuestas dudosas.

Criterio de hecho:
- Precision aceptable en aula con luz normal, sombras leves, lapiz tenue y skew moderado.

## Fase 5: resultados, analisis y exportacion

Objetivo: entregar valor pedagogico, no solo lectura de burbujas.

Tareas:
- Resultados por alumno.
- Resultado por curso.
- Analisis por pregunta.
- Distractores mas elegidos.
- Ejes/habilidades.
- Ranking, promedio, mediana y dispersion.
- Exportar Excel, CSV y PDF.
- Reporte individual y reporte institucional.

Criterio de hecho:
- El profesor puede corregir y entregar resultados accionables en menos de una clase.

## Fase 6: conversion de puntajes

Objetivo: posicionar TuLector como lector de ensayos con puntajes equivalentes.

Tareas:
- Motor de escalas versionadas.
- Nota chilena 1.0 a 7.0 configurable.
- Puntaje bruto a puntaje equivalente.
- Tablas importables por ensayo, anio, prueba e institucion.
- Escalas por asignatura.
- Simulacion de resultados y cortes internos.

Criterio de hecho:
- Un preuniversitario carga su tabla y obtiene puntajes equivalentes automaticamente.

## Fase 7: SEO 2026 y crecimiento organico

Objetivo: capturar demanda de profesores, colegios y preuniversitarios.

Tareas tecnicas:
- App Router con metadata por ruta.
- `sitemap.xml`, `robots.txt`, canonical y Open Graph.
- Paginas rapidas, accesibles y con Core Web Vitals controlados.
- Schema.org: `SoftwareApplication`, `Organization`, `FAQPage`, `Article`.
- Landing por caso de uso: profesores, colegios, preuniversitarios.
- Landing por pais: Chile primero, luego Colombia, Peru, Mexico, Brasil.
- Blog/recursos con contenido experto, no contenido generico.
- Glosario: OMR, correccion de ensayos, puntaje bruto, puntaje equivalente, PAES, rubricas, analisis por distractor.

Clusters SEO iniciales Chile:
- lector de ensayos
- corregir pruebas automaticamente
- lector de hojas de respuestas
- correccion de pruebas con celular
- software para corregir ensayos
- analisis de resultados escolares
- convertir puntaje bruto a nota
- puntaje equivalente ensayos
- hojas de respuesta imprimibles
- plataforma para preuniversitarios

Criterio de hecho:
- La web indexa paginas comerciales y educativas con contenido propio.
- Cada modulo importante tiene una pagina explicativa publica y una ruta privada de producto.

## Fase 8: LATAM y Brasil

Objetivo: internacionalizar sin reescribir el producto.

Tareas:
- i18n es-CL, es-LATAM y pt-BR.
- Formatos regionales de documento, moneda y fecha.
- Escalas por pais.
- Landing y SEO por pais.
- Branding institucional por mercado.
- Preparar modulo Brasil para simulados y ENEM sin prometer TRI hasta tener datos.

Criterio de hecho:
- Chile y Brasil pueden convivir con la misma arquitectura y distintos perfiles de escala.

## Primer bloque para programar

1. Crear layout privado SaaS.
2. Crear cuenta de usuario.
3. Crear institucion y roles.
4. Migrar `scan_logs` a modelo seguro.
5. Crear CRUD de cursos y alumnos.
6. Crear flujo ensayo -> hoja -> escaneo -> resultado.
