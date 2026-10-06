// Phone numbers are stored in one form so the same number always matches, however
// it was typed: spaces, dashes, dots and brackets are dropped, and Pakistani
// international prefixes become the local leading 0 — "+92 300-1234567",
// "0092 300 1234567", "923001234567" and "0300 1234567" are all "03001234567".
// Other countries keep their "+" prefix. Empty input -> undefined (no phone).
export function normalizePhone(raw) {
  if (raw === undefined || raw === null) return undefined;
  let p = String(raw).trim().replace(/[\s\-().]/g, "");
  if (!p) return undefined;
  if (p.startsWith("+92")) p = `0${p.slice(3)}`;
  else if (p.startsWith("0092")) p = `0${p.slice(4)}`;
  else if (p.startsWith("92") && p.length === 12) p = `0${p.slice(2)}`;
  return p;
}

// After normalizing: an optional "+" and 7–15 digits (E.164 allows at most 15).
export const isValidPhone = (raw) => {
  const p = normalizePhone(raw);
  return Boolean(p) && /^\+?\d{7,15}$/.test(p);
};
