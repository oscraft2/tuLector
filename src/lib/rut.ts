export function normalizeRut(input: string) {
  return input.replace(/\./g, "").replace(/\s/g, "").toUpperCase();
}

export function computeRutDV(body: string) {
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const expectedNumber = 11 - (sum % 11);
  return expectedNumber === 11 ? "0" : expectedNumber === 10 ? "K" : String(expectedNumber);
}

export function canonicalRut(input: string | null | undefined): string | null {
  if (!input) return null;
  const compact = normalizeRut(input).replace(/-/g, "");
  const match = compact.match(/^(\d{7,8})([0-9K])$/);
  if (!match) return null;
  const [, body, dv] = match;
  if (computeRutDV(body) !== dv) return null;
  return `${body}${dv}`;
}

export function sameCanonicalRut(a: string | null | undefined, b: string | null | undefined) {
  const left = canonicalRut(a);
  const right = canonicalRut(b);
  return left !== null && left === right;
}

export function validateRut(input: string) {
  return canonicalRut(input) !== null;
}
