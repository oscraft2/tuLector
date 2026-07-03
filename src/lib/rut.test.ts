import assert from "node:assert/strict";
import test from "node:test";
import { canonicalRut, sameCanonicalRut } from "./rut";

test("canonicalRut normaliza RUT chileno valido a cuerpo mas DV", () => {
  assert.equal(canonicalRut("17.517.808-2"), "175178082");
  assert.equal(canonicalRut("17517808-2"), "175178082");
  assert.equal(canonicalRut("175178082"), "175178082");
});

test("canonicalRut normaliza DV k a mayuscula", () => {
  assert.equal(canonicalRut("12.345.670-k"), "12345670K");
  assert.equal(canonicalRut("12345670K"), "12345670K");
});

test("canonicalRut retorna null para nulos e IDs no-RUT", () => {
  assert.equal(canonicalRut(null), null);
  assert.equal(canonicalRut(undefined), null);
  assert.equal(canonicalRut("ALUMNO-001"), null);
  assert.equal(canonicalRut("1234"), null);
  assert.equal(canonicalRut("17.517.808-3"), null);
});

test("sameCanonicalRut matchea paper escaneado con alumno registrado en otro formato", () => {
  const studentRut = "17.517.808-2";
  const scannedCode = "17517808-2";

  assert.equal(sameCanonicalRut(studentRut, scannedCode), true);
});
