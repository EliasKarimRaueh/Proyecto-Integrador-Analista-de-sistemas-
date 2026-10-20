import PagoRepository from 'polleria-database/repositories/pagoRepository';
import PagoPorCuentaRepository from 'polleria-database/repositories/pagoPorCuentaRepository';
import ProveedorRepository from 'polleria-database/repositories/proveedorRepository';
import { ErrorOperacion, objeto, numero, id } from './operaciones.js';

const pagos = new PagoRepository();
const aplicaciones = new PagoPorCuentaRepository();
const proveedores = new ProveedorRepository();

export async function registrarPago(body: unknown) {
  const b = objeto(body);
  const proveedorId = id(b.proveedorId, 'proveedorId');
  const importe = numero(b.importe, 'importe');
  const monto = importe.toFixed(2);

  const proveedor = await proveedores.buscarPorId(proveedorId);
  if (!proveedor) throw new ErrorOperacion('Proveedor no encontrado.', 404);

  const fechaHora = b.fechaHora === undefined ? new Date() : new Date(String(b.fechaHora));
  if (Number.isNaN(fechaHora.getTime())) throw new ErrorOperacion('La fecha del pago no es válida.');

  return await pagos.registrarPagoYAplicar({
    proveedorId,
    importe: monto as unknown as number,
    fechaHora
  } as never);
}

export async function listarPagos(
  page: number,
  limit: number,
  proveedorId: number | undefined,
  desde: Date | undefined,
  hasta: Date | undefined,
  conSaldoPendiente: boolean
) {
  if (conSaldoPendiente) {
    return await pagos.buscarConSaldoPendiente(page, limit);
  }
  if (proveedorId !== undefined && desde && hasta) {
    return await pagos.buscarPorProveedorYFechas(proveedorId, desde, hasta, page, limit);
  }
  if (proveedorId !== undefined) {
    return await pagos.buscarPorProveedor(proveedorId, page, limit);
  }
  if (desde && hasta) {
    return await pagos.buscarPorFechas(desde, hasta, page, limit);
  }
  return await pagos.listarPaginados(page, limit);
}

export async function detallePago(pagoId: number) {
  const pago = await pagos.buscarPorId(pagoId);
  if (!pago) throw new ErrorOperacion('Pago no encontrado.', 404);
  const aplicados = await aplicaciones.buscarPorPago(pagoId);
  return { pago, aplicaciones: aplicados };
}
