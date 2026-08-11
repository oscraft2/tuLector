/**
 * Niveles escolares que se ofrecen al crear o editar un curso.
 *
 * Estaba duplicado en src/app/dashboard/students/page.tsx y en
 * src/components/native/StudentsFab.tsx (este ultimo con un comentario
 * pidiendo mantenerlos sincronizados a mano). Al mover la gestion de cursos a
 * /dashboard/courses se unifico aca.
 */
export const SCHOOL_GRADES = [
  "1° Básico",
  "2° Básico",
  "3° Básico",
  "4° Básico",
  "5° Básico",
  "6° Básico",
  "7° Básico",
  "8° Básico",
  "I Medio",
  "II Medio",
  "III Medio",
  "IV Medio",
  "Educación Superior",
  "Otro",
] as const;
