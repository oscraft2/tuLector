import assert from "node:assert/strict";
import test from "node:test";
import { normalizeNationalId, validateNationalIdFormat, resolveCountryIdFormat } from "./national_id";

test("normalizeNationalId limpia puntos, guiones y espacios, y sube a mayuscula", () => {
  assert.equal(normalizeNationalId("12.345.678-5"), "123456785");
  assert.equal(normalizeNationalId("12345678-k"), "12345678K");
  assert.equal(normalizeNationalId("123456789-09"), "12345678909");
});

test("validateNationalIdFormat acepta RUT chileno bien formado", () => {
  assert.equal(validateNationalIdFormat("12345678-5", "CL"), true);
  assert.equal(validateNationalIdFormat("12345678-K", "CL"), true);
});

test("validateNationalIdFormat rechaza RUT sin guion o con largo invalido", () => {
  assert.equal(validateNationalIdFormat("123456785", "CL"), false);
  assert.equal(validateNationalIdFormat("123-5", "CL"), false);
});

test("validateNationalIdFormat acepta DNI argentino (sin digito verificador)", () => {
  assert.equal(validateNationalIdFormat("20345678", "AR"), true);
  assert.equal(validateNationalIdFormat("2034567", "AR"), true); // 7 digitos, valido
  assert.equal(validateNationalIdFormat("203456", "AR"), false); // 6 digitos, invalido
});

test("validateNationalIdFormat acepta CPF brasileno con guion", () => {
  assert.equal(validateNationalIdFormat("123456789-09", "BR"), true);
  assert.equal(validateNationalIdFormat("12345678909", "BR"), false); // falta el guion
});

test("validateNationalIdFormat pais sin regex conocido exige largo minimo", () => {
  assert.equal(validateNationalIdFormat("1234567", "BO"), true);
  assert.equal(validateNationalIdFormat("12", "BO"), false);
});

test("validateNationalIdFormat rechaza pais desconocido o ID vacio", () => {
  assert.equal(validateNationalIdFormat("12345678-5", "ZZ"), false);
  assert.equal(validateNationalIdFormat("", "CL"), false);
});

test("resolveCountryIdFormat encuentra por codigo case-insensitive", () => {
  assert.equal(resolveCountryIdFormat("cl")?.idLabel, "RUT");
  assert.equal(resolveCountryIdFormat("br")?.idLabel, "CPF");
  assert.equal(resolveCountryIdFormat("zz"), undefined);
});
