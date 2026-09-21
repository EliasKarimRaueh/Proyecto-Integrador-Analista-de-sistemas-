import { type Request, type Response } from 'express';
import ProductoRepository from 'polleria-database/repositories/productoRepository';
import TipoProductoRepository from 'polleria-database/repositories/tipoProductoRepository';

const productoRepository = new ProductoRepository();
const tipoProductoRepository = new TipoProductoRepository();
const categories = ['Fresco', 'Congelado', 'Seco Almacen'] as const;
const units = ['kg', 'unidad'] as const;

type ProductInput = { code?: unknown; name?: unknown; category?: unknown; unit?: unknown; description?: unknown };

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function toTitleCase(value: string) {
  return value.toLocaleLowerCase('es').replace(/(^|\s)\S/g, letter => letter.toLocaleUpperCase('es'));
}

function validateInput(body: ProductInput) {
  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const category = categories.find(item => normalize(item) === normalize(String(body.category ?? '')));
  const unit = units.find(item => item === body.unit);
  if (!/^[A-Z0-9-]{2,20}$/.test(code)) return { error: 'El código debe tener entre 2 y 20 letras, números o guiones.' };
  if (name.length < 2 || name.length > 50) return { error: 'El nombre debe tener entre 2 y 50 caracteres.' };
  if (!category) return { error: 'La categoría no es válida.' };
  if (!unit) return { error: 'La unidad de venta no es válida.' };
  if (description.length > 300) return { error: 'La descripción admite hasta 300 caracteres.' };
  return { value: { code, name, category, unit, description } };
}

async function getCategoryMap() {
  const { rows } = await tipoProductoRepository.findAll(1, 1000, 'id', 'ASC');
  return new Map(rows.map(tipo => [tipo.id, toTitleCase(tipo.nombre)]));
}

async function findOrCreateCategory(category: typeof categories[number]) {
  const { rows } = await tipoProductoRepository.findAll(1, 1000, 'id', 'ASC');
  const existing = rows.find(tipo => normalize(tipo.nombre) === normalize(category));
  return existing ?? tipoProductoRepository.create({ nombre: category.toUpperCase(), activo: true, fechaBaja: null });
}

type StoredProduct = NonNullable<Awaited<ReturnType<typeof productoRepository.findById>>>;

function presentProduct(product: StoredProduct, category: string) {
  return {
    id: String(product.id), code: product.codigo, name: product.nombre, category,
    unit: product.unidadVenta === 'KILOS' ? 'kg' : 'unidad',
    description: product.descripcion, active: product.activo,
  };
}

function parseId(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ message: 'El identificador del producto no es válido.' });
    return null;
  }
  return id;
}

function sendDatabaseError(res: Response, error: unknown) {
  const details = error instanceof Error ? error.message : String(error);
  if (/unique|productos_codigo_unique|codigo/i.test(details)) {
    res.status(409).json({ message: 'Ya existe un producto con ese código.' });
    return;
  }
  console.error('Error al operar sobre productos:', error);
  res.status(500).json({ message: 'No se pudo guardar el producto en la base de datos.' });
}

export const getProductos = async (_req: Request, res: Response) => {
  try {
    const [{ rows }, categoriesById] = await Promise.all([
      productoRepository.findAll(1, 1000, 'id', 'ASC'), getCategoryMap(),
    ]);
    res.json(rows.map(product => presentProduct(product, categoriesById.get(product.tipoProductoId) ?? 'Fresco')));
  } catch (error) { sendDatabaseError(res, error); }
};

export const createProducto = async (req: Request, res: Response) => {
  const parsed = validateInput(req.body as ProductInput);
  if (!parsed.value) { res.status(400).json({ message: parsed.error }); return; }
  try {
    const input = parsed.value;
    const type = await findOrCreateCategory(input.category);
    const product = await productoRepository.create({
      codigo: input.code, nombre: input.name, descripcion: input.description, tipoProductoId: type.id,
      unidadCompra: input.unit === 'kg' ? 'KILOS' : 'UNIDADES',
      unidadVenta: input.unit === 'kg' ? 'KILOS' : 'UNIDADES',
      factorConversion: 1, stockActual: 0, costoActual: '0', activo: true, fechaBaja: null,
      tipoReposicion: 'diario', stockMinimo: null,
    });
    res.status(201).json(presentProduct(product, input.category));
  } catch (error) { sendDatabaseError(res, error); }
};

export const updateProducto = async (req: Request, res: Response) => {
  const id = parseId(req, res);
  if (id === null) return;
  const parsed = validateInput(req.body as ProductInput);
  if (!parsed.value) { res.status(400).json({ message: parsed.error }); return; }
  try {
    const input = parsed.value;
    const type = await findOrCreateCategory(input.category);
    const product = await productoRepository.updateById(id, {
      codigo: input.code, nombre: input.name, descripcion: input.description, tipoProductoId: type.id,
      unidadCompra: input.unit === 'kg' ? 'KILOS' : 'UNIDADES',
      unidadVenta: input.unit === 'kg' ? 'KILOS' : 'UNIDADES',
    });
    if (!product) { res.status(404).json({ message: 'Producto no encontrado.' }); return; }
    res.json(presentProduct(product, input.category));
  } catch (error) { sendDatabaseError(res, error); }
};

export const deactivateProducto = async (req: Request, res: Response) => {
  const id = parseId(req, res);
  if (id === null) return;
  try {
    const product = await productoRepository.deleteById(id);
    if (!product) { res.status(404).json({ message: 'Producto no encontrado.' }); return; }
    const categoriesById = await getCategoryMap();
    res.json(presentProduct(product, categoriesById.get(product.tipoProductoId) ?? 'Fresco'));
  } catch (error) { sendDatabaseError(res, error); }
};
