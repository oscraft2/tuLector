-- Elimina el trigger de calculo automatico de grade/equivalent_score en papers.
-- Duplicaba (con valores hardcodeados) el calculo que ya hace
-- src/app/api/scan/result/route.ts con calculateGrade() usando la config real
-- del colegio. route.ts es el UNICO INSERT/UPDATE sobre papers en el codigo,
-- por lo tanto es seguro eliminar el trigger sin perder ningun calculo.
DROP TRIGGER IF EXISTS trigger_calculate_paper_results ON papers;
DROP FUNCTION IF EXISTS calculate_paper_results();
