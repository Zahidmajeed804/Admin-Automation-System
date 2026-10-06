// Mirrors backend/src/utils/phone.js — keep the two in step. Spaces, dashes, dots and
// brackets are ignored and +92 / 0092 / 92 become a leading 0, so "+92 300-1234567"
// and "0300 1234567" are the same number.
export function normalizePhone(raw) {
  let p = String(raw ?? "").trim().replace(/[\s\-().]/g, "");
  if (!p) return "";
  if (p.startsWith("+92")) p = `0${p.slice(3)}`;
  else if (p.startsWith("0092")) p = `0${p.slice(4)}`;
  else if (p.startsWith("92") && p.length === 12) p = `0${p.slice(2)}`;
  return p;
}

// An optional "+" and 7–15 digits once normalized.
export const isValidPhone = (raw) => /^\+?\d{7,15}$/.test(normalizePhone(raw));
