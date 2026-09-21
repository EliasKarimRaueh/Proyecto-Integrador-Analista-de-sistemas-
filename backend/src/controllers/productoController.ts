import { type Request, type Response } from 'express';
import ProductoRepository from '../../../database/src/repositories/productoRepository.js';
import TipoProductoRepository from '../../../database/src/repositories/tipoProductoRepository.js';

const productoRepository = new ProductoRepository();
const tipoProductoRepository = new TipoProductoRepository();

function toTitleCase(value: string) {
  return value.toLocaleLowerCase('es').replace(/(^|\s)\S/g, letter => letter.toLocaleUpperCase('es'));
}

export const getProductos = async (_req: Request, res: Response) => {
  try {
    const [{ rows: productos }, { rows: tiposProducto }] = await Promise.all([
      productoRepository.findAll(1, 1000, 'id', 'ASC'),
      tipoProductoRepository.findAll(1, 1000, 'id', 'ASC'),
    ]);

    const tiposPorId = new Map(tiposProducto.map(tipo => [tipo.id, toTitleCase(tipo.nombre)]));
    const response = productos.map(producto => ({
      id: String(producto.id),
      code: `PRO-${String(producto.id).padStart(3, '0')}`,
      name: toTitleCase(producto.nombre),
      category: tiposPorId.get(producto.tipoProductoId) ?? 'Sin categoría',
      unit: producto.unidadVenta === 'KILOS' ? 'kg' : 'unidad',
      description: `Stock actual: ${producto.stockActual}`,
      active: producto.activo,
    }));

    res.status(200).json(response);
  } catch (error) {
    console.error('Error al obtener los productos desde la base de datos:', error);
    res.status(500).json({ message: 'Error al obtener los productos' });
  }
};
