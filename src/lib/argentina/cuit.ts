export function validateCUIT(cuit: string): boolean {
  const cleaned = cuit.replace(/[-\s]/g, "");
  if (!/^\d{11}$/.test(cleaned)) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + w * parseInt(cleaned[i]), 0);
  const remainder = sum % 11;
  const verifier = remainder === 0 ? 0 : remainder === 1 ? 9 : 11 - remainder;
  return verifier === parseInt(cleaned[10]);
}

export function formatCUIT(cuit: string): string {
  const cleaned = cuit.replace(/[-\s]/g, "");
  if (cleaned.length !== 11) return cuit;
  return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 10)}-${cleaned.slice(10)}`;
}
