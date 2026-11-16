import ProductoRepository from 'polleria-database/repositories/productoRepository';
import ProductoProveedorRepository from 'polleria-database/repositories/productoProveedorRepository';
import { estadoStock } from './operaciones.js';
import { calcularCantidadSugerida, calcularFaltante } from './comprasCalculos.js';
export { crearCompra as registrarCompra, consultarCompras as listarCompras, consultarCompra as detalleCompra } from './circuitoAbastecimiento.js';
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
