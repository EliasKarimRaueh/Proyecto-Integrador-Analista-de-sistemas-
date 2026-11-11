import { centavos, importe } from './dinero.js';
import { ErrorOperacion } from './operaciones.js';

const MAXIMO_CENTAVOS = 9999999999n;
const PRECISION_STOCK = 3;

export function redondearCantidad(valor: number): number {
  return Number(valor.toFixed(PRECISION_STOCK));
}

export function calcularSubtotal(cantidad: number, costoUnitario: string | number): string {
  const subtotal = centavos(cantidad, costoUnitario);
  if (subtotal > MAXIMO_CENTAVOS) throw new ErrorOperacion('El subtotal supera el máximo permitido.');
  return importe(subtotal);
}

export function calcularTotal(subtotales: string[]): string {
  const total = subtotales.reduce((suma, subtotal) => suma + centavos(1, subtotal), 0n);
  if (total > MAXIMO_CENTAVOS) throw new ErrorOperacion('El total supera el máximo permitido.');
  return importe(total);
}

export function calcularFaltante(stockActual: number, stockMinimo: number | null): number {
  if (stockMinimo === null) return 0;
  return redondearCantidad(Math.max(0, stockMinimo - stockActual));
}

export function calcularCantidadSugerida(faltante: number, factorConversion: number): number {
  if (!Number.isFinite(factorConversion) || factorConversion <= 0) {
    throw new ErrorOperacion('El factor de conversión debe ser positivo.');
  }
  if (faltante <= 0) return 0;
  return redondearCantidad(Math.ceil(faltante / factorConversion) * factorConversion);
}

export function convertirCantidadBase(cantidadPresentacion: number, factorConversion: number): number {
  if (!Number.isFinite(cantidadPresentacion) || cantidadPresentacion <= 0) {
    throw new ErrorOperacion('La cantidad recibida debe ser positiva.');
  }
  if (!Number.isFinite(factorConversion) || factorConversion <= 0) {
    throw new ErrorOperacion('El factor de conversión debe ser positivo.');
  }
  return redondearCantidad(cantidadPresentacion * factorConversion);
}

export function convertirCostoUnitario(costoPresentacion: number, factorConversion: number): string {
  if (!Number.isFinite(costoPresentacion) || costoPresentacion < 0) {
    throw new ErrorOperacion('El costo de la presentación no es válido.');
  }
  if (!Number.isFinite(factorConversion) || factorConversion <= 0) {
    throw new ErrorOperacion('El factor de conversión debe ser positivo.');
  }
  return (Math.round((costoPresentacion * 100) / factorConversion) / 100).toFixed(2);
}

export function puedeCancelarPedido(estado: string): boolean {
  return estado === 'REALIZADO';
}

export function validarDiferenciaRecepcion(
  cantidadComprada: number,
  cantidadRecibida: number,
  observaciones: string | null
) {
  const diferencia = Math.abs(redondearCantidad(cantidadComprada) - redondearCantidad(cantidadRecibida));
  if (diferencia > 0.001 && !observaciones) {
    throw new ErrorOperacion('La recepción tiene diferencias y requiere una observación.');
  }
}
