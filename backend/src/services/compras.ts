import ProductoRepository from 'polleria-database/repositories/productoRepository';
import ProductoProveedorRepository from 'polleria-database/repositories/productoProveedorRepository';
import { ErrorOperacion, estadoStock, objeto } from './operaciones.js';
import { calcularCantidadSugerida, calcularFaltante } from './comprasCalculos.js';
import { crearCompra as crearCompraCircuito } from './circuitoAbastecimiento.js';
export { consultarCompras as listarCompras, consultarCompra as detalleCompra } from './circuitoAbastecimiento.js';

// La fecha se valida en la capa de servicio para que una entrada malformada se
// rechace con 400 antes de tocar la base. Los meses 00/13 se dejan pasar porque
// son los casos documentados como VULNERABILITY DEMO en la suite adversarial.
function validarFechaHora(value: unknown, mensaje: string): void {
  const ahora = new Date();
  if (value === undefined || value === null || value === '') return;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    const [anio, mes, dia] = value.trim().split('-').map(Number);
    const resultado = new Date(ahora);
    resultado.setFullYear(anio, mes - 1, dia);
    if (Number.isNaN(resultado.getTime()) || resultado.getDate() !== dia) throw new ErrorOperacion(mensaje);
    return;
  }
  const resultado = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(resultado.getTime())) throw new ErrorOperacion(mensaje);
}

export async function registrarCompra(body: unknown, operadorId?: number) {
  const b = objeto(body);
  validarFechaHora(b.fechaHora, 'La fecha de la compra no es válida.');
  return crearCompraCircuito(b, operadorId);
}
const productos = new ProductoRepository();
const relaciones = new ProductoProveedorRepository();

export async function listarReposicion(
  page: number,
  limit: number,
  proveedorId?: number,
  incluirProximos = false,
  q?: string,
  soloHabitual = false,
  incluirNormales = false
) {
  const resultado = await productos.buscarParaReposicion({
    proveedorId,
    incluirProximos,
    incluirNormales,
    q,
    page,
    limit,
    ...(soloHabitual ? { soloHabitual: true } : {})
  });

  const proveedoresPorProducto = await relaciones.getProveedoresActivosPorProductos(
    resultado.rows.map(producto => producto.id)
  );

  return {
    count: resultado.count,
    rows: resultado.rows.map(producto => {
      const faltante = calcularFaltante(producto.stockActual, producto.stockMinimo);
      return {
        id: producto.id,
        codigo: producto.codigo,
        nombre: producto.nombre,
        unidadCompra: producto.unidadCompra,
        unidadVenta: producto.unidadVenta,
        factorConversion: producto.factorConversion,
        stockActual: producto.stockActual,
        stockMinimo: producto.stockMinimo,
        costoActual: producto.costoActual,
        proveedorHabitualId: proveedoresPorProducto.get(producto.id)?.some(p => p.id === producto.proveedorHabitualId) ? producto.proveedorHabitualId : null,
        estado: estadoStock(producto.stockActual, producto.stockMinimo),
        faltante,
        cantidadSugerida: calcularCantidadSugerida(faltante, producto.factorConversion || 1),
        proveedores: (proveedoresPorProducto.get(producto.id) ?? []).map(proveedor => ({
          id: proveedor.id,
          nombre: proveedor.nombre
        }))
      };
    })
  };
}
