export class ErrorOperacion extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function objeto(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ErrorOperacion('Se esperaba un objeto.');
  return value as Record<string, unknown>;
}
export function numero(value: unknown, campo: string, cero = false): number {
  if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '') throw new ErrorOperacion(`${campo} debe ser numérico.`);
  const n = Number(value);
  if (!Number.isFinite(n) || (cero ? n < 0 : n <= 0)) throw new ErrorOperacion(`${campo} no es válido.`);
  return n;
}
export function id(value: unknown, campo = 'id'): number {
  const n = numero(value, campo);
  if (!Number.isSafeInteger(n) || n > 2147483647) throw new ErrorOperacion(`${campo} debe ser un entero válido.`);
  return n;
}
