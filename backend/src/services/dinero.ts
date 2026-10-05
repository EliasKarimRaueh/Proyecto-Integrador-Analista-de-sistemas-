// Opera sobre dígitos decimales para evitar errores como 1.005 -> 1.00.
function decimal(value: string | number): { entero: bigint; escala: number } {
  const [base, exponente = '0'] = String(value).toLowerCase().split('e');
  const [parteEntera, fraccion = ''] = base!.split('.');
  const escala = fraccion.length - Number(exponente);
  const entero = BigInt(parteEntera! + fraccion);
  return escala < 0 ? { entero: entero * 10n ** BigInt(-escala), escala: 0 } : { entero, escala };
}
export function centavos(cantidad: number, precio: string | number): bigint {
  const a = decimal(cantidad), b = decimal(precio);
  const producto = a.entero * b.entero;
  const escala = a.escala + b.escala;
  if (escala <= 2) return producto * 10n ** BigInt(2 - escala);
  const divisor = 10n ** BigInt(escala - 2);
  return (producto + divisor / 2n) / divisor;
}
export function importe(cents: bigint): string {
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}
