import CuentaProveedorRepository from 'polleria-database/repositories/cuentaProveedorRepository';
import ProveedorRepository from 'polleria-database/repositories/proveedorRepository';
import { ErrorOperacion, id } from './operaciones.js';

const cuentas = new CuentaProveedorRepository();
const proveedores = new ProveedorRepository();

type FiltroEstadoCuenta = 'TODAS' | 'PAGADO' | 'NO_PAGADO';

function parseEstado(valor: unknown): FiltroEstadoCuenta {
  const texto = valor === undefined ? 'TODAS' : String(valor).toUpperCase();
  if (texto !== 'TODAS' && texto !== 'PAGADO' && texto !== 'NO_PAGADO') {
    throw new ErrorOperacion('El filtro estado debe ser TODAS, PAGADO o NO_PAGADO.');
  }
  return texto;
}

export async function listarCuentas(
  page: number,
  limit: number,
  proveedorId: number | undefined,
  estado: FiltroEstadoCuenta
) {
  if (proveedorId !== undefined) {
    return await cuentas.buscarPorProveedor(proveedorId, estado, page, limit);
  }
  if (estado === 'TODAS') {
    return await cuentas.listarPaginados(page, limit);
  }
  const filas = await cuentas.buscarTodas();
  const filtradas = filas.filter(c => (estado === 'PAGADO' ? c.estado === 'PAGADO' : c.estado !== 'PAGADO'));
  return { count: filtradas.length, rows: filtradas.slice((page - 1) * limit, (page - 1) * limit + limit) };
}

export async function detalleCuenta(cuentaId: number) {
  const cuenta = await cuentas.buscarPorId(cuentaId);
  if (!cuenta) throw new ErrorOperacion('Cuenta corriente no encontrada.', 404);
  const pagos = await cuentas.buscarPagosAplicados(cuentaId);
  return { cuenta, pagos };
}

export async function saldoProveedor(proveedorId: number) {
  const proveedor = await proveedores.buscarPorId(proveedorId);
  if (!proveedor) throw new ErrorOperacion('Proveedor no encontrado.', 404);

  const filas = await cuentas.buscarTodas();
  const propias = filas.filter(c => c.proveedorId === proveedorId);

  let pendiente = 0;
  let pagoParcial = 0;
  let pagado = 0;

  for (const cuenta of propias) {
    const importe = Number(cuenta.importePendiente);
    if (cuenta.estado === 'PAGADO') pagado += 1;
    else if (cuenta.estado === 'PAGO PARCIAL') pagoParcial += 1;
    if (cuenta.estado !== 'PAGADO') pendiente += importe;
  }

  return {
    proveedorId,
    proveedor: proveedor.nombre,
    totalPendiente: Number(pendiente.toFixed(2)),
    cuentas: {
      total: propias.length,
      pagadas: pagado,
      parciales: pagoParcial,
      pendientes: propias.length - pagado - pagoParcial
    }
  };
}

export function parseProveedorId(valor: unknown): number | undefined {
  return valor === undefined ? undefined : id(valor, 'proveedorId');
}

export { parseEstado };
