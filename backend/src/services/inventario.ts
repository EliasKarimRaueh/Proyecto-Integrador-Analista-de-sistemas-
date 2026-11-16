import sequelize from 'polleria-database/config/database';
import Producto from 'polleria-database/models/Producto';
import MovimientoStockRepository from 'polleria-database/repositories/movimientoStockRepository';
import { ErrorOperacion, id, numero, objeto } from './validacion.js';

export async function registrarInventario(body: unknown) {
  const b = objeto(body), usuarioId = id(b.usuarioId ?? 1);
  if (!Array.isArray(b.productos) || !b.productos.length || b.productos.length > 10000) throw new ErrorOperacion('Indicá entre 1 y 10000 productos.');
  const motivo = typeof b.motivo === 'string' ? b.motivo.trim() : '';
  if (motivo.length < 5 || motivo.length > 200) throw new ErrorOperacion('Indicá un motivo de entre 5 y 200 caracteres.');
  const lineas = b.productos.map(item => {
    const p = objeto(item);
    const stockEsperado = Number(p.stockEsperado);
    if ((typeof p.stockEsperado !== 'number' && typeof p.stockEsperado !== 'string') || String(p.stockEsperado).trim() === '' || !Number.isFinite(stockEsperado)) throw new ErrorOperacion('Stock de referencia inválido.');
    return { productoId: id(p.productoId), stockEsperado, stockContado: numero(p.stockContado, 'Stock contado', true) };
  });
  if (new Set(lineas.map(p => p.productoId)).size !== lineas.length) throw new ErrorOperacion('Hay productos repetidos.');
  return sequelize.transaction(async transaction => {
    const productos = await Producto.findAll({ where: { activo: true }, order: [['id', 'ASC']], transaction, lock: transaction.LOCK.UPDATE });
    if (productos.length !== lineas.length || productos.some(p => !lineas.some(l => l.productoId === p.id))) throw new ErrorOperacion('Cambió el catálogo de productos. Volvé a abrir el inventario.', 409);
    for (const p of productos) {
      const linea = lineas.find(l => l.productoId === p.id)!;
      if (Math.abs(p.stockActual - linea.stockEsperado) > 1e-6) throw new ErrorOperacion(`Cambió el stock de ${p.nombre} durante el conteo. Revisá las existencias y volvé a abrir el inventario.`, 409);
      const valor = linea.stockContado;
      if (valor > 1000000 || Math.abs(valor * 1000 - Math.round(valor * 1000)) > 1e-6 || p.unidadVenta === 'UNIDADES' && !Number.isSafeInteger(valor)) throw new ErrorOperacion(`Cantidad inválida para ${p.nombre}: unidades enteras o kilos con hasta tres decimales.`);
    }
    const repositorio = new MovimientoStockRepository(), movimientos = [];
    for (const p of productos) {
      const linea = lineas.find(l => l.productoId === p.id)!;
      if (Math.abs(p.stockActual - linea.stockContado) < 1e-6) continue;
      movimientos.push(await repositorio.ajustarStock(p.id, linea.stockContado, usuarioId, `INVENTARIO: ${motivo}`, transaction));
    }
    return { productosContados: productos.length, ajustes: movimientos.length, movimientos };
  });
}
