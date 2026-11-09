/**
 * Validador oficial de RUT Chileno (SII Módulo 11)
 * Idéntico al estándar usado en boletos-la
 */

export function computeRutDv(bodyDigits: string): string {
  if (!bodyDigits || typeof bodyDigits !== "string") {
    return "";
  }
  const clean = bodyDigits.replace(/\D/g, "");
  if (!clean) return "";

  let sum = 0;
  let weight = 2;

  for (let i = clean.length - 1; i >= 0; i--) {
    sum += parseInt(clean[i], 10) * weight;
    weight = weight === 7 ? 2 : weight + 1;
  }

  const remainder = 11 - (sum % 11);
  if (remainder === 11) return "0";
  if (remainder === 10) return "K";
  return String(remainder);
}

export function cleanRut(rawRut: string): string {
  if (!rawRut || typeof rawRut !== "string") return "";
  return rawRut.trim().replace(/[\.\s\-]/g, "").toUpperCase();
}

export function validateChileanRut(rawRut: string): boolean {
  if (!rawRut || typeof rawRut !== "string") return false;

  const clean = cleanRut(rawRut);
  if (!/^\d{7,8}[0-9K]$/.test(clean)) {
    return false;
  }

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);

  const bodyNum = parseInt(body, 10);
  if (isNaN(bodyNum) || bodyNum < 1000000 || bodyNum > 99999999) {
    return false;
  }

  // Rechazar RUTs con dígitos repetidos (e.g. 11111111-1)
  if (/^(\d)\1+$/.test(body)) {
    return false;
  }

  const expectedDv = computeRutDv(body);
  return expectedDv === dv;
}

export function formatChileanRut(rawRut: string): string {
  if (!rawRut || typeof rawRut !== "string") return "";

  const clean = cleanRut(rawRut);
  if (clean.length < 2) return clean;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formattedBody}-${dv}`;
}

export function formatCLP(amount: number): string {
  return `$${Math.round(amount || 0).toLocaleString("es-CL")} CLP`;
}

