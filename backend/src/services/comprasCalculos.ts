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
  const diferencia = redondearCantidad(
    Math.abs(redondearCantidad(cantidadComprada) - redondearCantidad(cantidadRecibida))
  );
  if (diferencia > 0.001 && !observaciones) {
    throw new ErrorOperacion('La recepción tiene diferencias y requiere una observación.');
  }
}

export function validarDetallesConPedido(
  lineasCompra: Array<{ productoId: number; cantidadBase: number }>,
  detallesPedido: Array<{ productoId: number | null; cantidad: number | string }>
): void {
  const detallePedidoMap = new Map<number, number>();
  for (const dp of detallesPedido) {
    if (dp.productoId === null || dp.productoId === undefined) {
      throw new ErrorOperacion('El pedido contiene un detalle sin producto asociado.');
    }
    detallePedidoMap.set(dp.productoId, redondearCantidad(Number(dp.cantidad)));
  }

  const lineasCompraMap = new Map<number, number>();
  for (const linea of lineasCompra) {
    lineasCompraMap.set(linea.productoId, redondearCantidad(linea.cantidadBase));
  }

  for (const linea of lineasCompra) {
    if (!detallePedidoMap.has(linea.productoId)) {
      throw new ErrorOperacion(`El producto ${linea.productoId} no pertenece al pedido.`);
    }
  }

  for (const dp of detallesPedido) {
    if (dp.productoId !== null && !lineasCompraMap.has(dp.productoId)) {
      throw new ErrorOperacion(`Falta el producto ${dp.productoId} solicitado en el pedido.`);
    }
  }

  for (const dp of detallesPedido) {
    if (dp.productoId !== null) {
      const cantidadCompra = lineasCompraMap.get(dp.productoId)!;
      const cantidadPedido = detallePedidoMap.get(dp.productoId)!;
      if (redondearCantidad(Math.abs(cantidadCompra - cantidadPedido)) > 0.001) {
        throw new ErrorOperacion(
          `La cantidad del producto ${dp.productoId} (${cantidadCompra}) no coincide con la solicitada en el pedido (${cantidadPedido}).`
        );
      }
    }
  }
}
