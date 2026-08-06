-- Fija, por ensayo, cuantos recuadros de "reverso" (preguntas de desarrollo)
-- caben por pagina fisica -- ver docs de la investigacion del bug "3 hojas
-- DIA" (sesion 2026-08-05). El codigo OMR de la hoja NO tiene espacio para
-- codificar esto (solo guarda page/pagesTotal), asi que tanto imprimir como
-- leer dependian de una constante global (OPEN_BOXES_PER_PAGE en
-- src/lib/sheet_generator.ts) que puede cambiar entre el momento en que una
-- hoja fisica se imprimio y el momento en que se escanea, produciendo
-- recortes desalineados. Esta columna congela esa regla por ensayo desde su
-- creacion.
--
-- NULL = ensayo creado ANTES de esta migracion -> se interpreta en el codigo
-- como el valor historico real con el que se imprimio (LEGACY_OPEN_BOXES_PER_PAGE
-- = 4 en src/lib/sheet_generator.ts), nunca como el valor vigente actual.
-- Migración ADITIVA, sin backfill: NULL ya es el comportamiento legacy correcto.

ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS open_boxes_per_page INTEGER;
