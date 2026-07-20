import assert from "node:assert/strict";
import test from "node:test";
import { guessColumnMapping, parseDelimitedText, detectDelimiter, rowsFromMapping } from "./student_import";

test("guessColumnMapping reconoce encabezados en español e ingles", () => {
  assert.deepEqual(guessColumnMapping(["rut", "nombre", "curso"]), { rutCol: 0, nameCol: 1, courseCol: 2, gradeCol: -1 });
  assert.deepEqual(guessColumnMapping(["DNI", "Name", "Course", "Grade"]), { rutCol: 0, nameCol: 1, courseCol: 2, gradeCol: 3 });
});

test("guessColumnMapping devuelve -1 para columnas no reconocidas", () => {
  assert.deepEqual(guessColumnMapping(["Columna A", "Columna B"]), { rutCol: -1, nameCol: -1, courseCol: -1, gradeCol: -1 });
});

test("guessColumnMapping NO confunde una columna generica 'ID' con el RUT (bug reportado)", () => {
  // Un colegio real reporto una columna "ID" (id interno, no el identificador
  // nacional) tomada por error como RUT -- "id" se saco de ID_ALIASES por ser
  // demasiado generico. Los alias especificos (documento, dni, etc.) siguen andando.
  assert.equal(guessColumnMapping(["ID", "Nombre", "Curso"]).rutCol, -1);
  assert.equal(guessColumnMapping(["Documento", "Nombre", "Curso"]).rutCol, 0);
});

test("parseDelimitedText respeta comillas y comas dentro de campo", () => {
  const rows = parseDelimitedText('rut,nombre\n12345678-5,"Perez, Ana"');
  assert.deepEqual(rows, [["rut", "nombre"], ["12345678-5", "Perez, Ana"]]);
});

test("detectDelimiter distingue CSV pegado desde Excel (tabs)", () => {
  assert.equal(detectDelimiter("rut\tnombre\tcurso"), "\t");
  assert.equal(detectDelimiter("rut,nombre,curso"), ",");
});

test("rowsFromMapping arma filas segun el mapeo elegido, saltando el header", () => {
  const table = [
    ["Columna A", "Columna B", "Columna C"],
    ["12345678-5", "Ana Perez", "IV Medio A"],
    ["9876543-2", "Juan Soto", "IV Medio B"],
  ];
  const rows = rowsFromMapping(table, { rutCol: 0, nameCol: 1, courseCol: 2, gradeCol: -1 }, true);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { rut: "12345678-5", name: "Ana Perez", course: "IV Medio A", grade: null });
});

test("rowsFromMapping ignora filas completamente vacias", () => {
  const table = [["12345678-5", "Ana", "A"], ["", "", ""]];
  const rows = rowsFromMapping(table, { rutCol: 0, nameCol: 1, courseCol: 2, gradeCol: -1 }, false);
  assert.equal(rows.length, 1);
});
