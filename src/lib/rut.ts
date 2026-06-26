export function normalizeRut(input: string) {
  return input.replace(/\./g, "").replace(/\s/g, "").toUpperCase();
}

export function validateRut(input: string) {
  const rut = normalizeRut(input);
  const match = rut.match(/^(\d{7,8})-?([0-9K])$/);
  if (!match) return false;
  const [, body, dv] = match;
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const expectedNumber = 11 - (sum % 11);
  const expected = expectedNumber === 11 ? "0" : expectedNumber === 10 ? "K" : String(expectedNumber);
  return expected === dv;
}
