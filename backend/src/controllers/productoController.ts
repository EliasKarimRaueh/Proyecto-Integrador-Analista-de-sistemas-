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

type ResumenImagen = { url: string; nombre: string; bytes: number } | null;

/**
 * La API nunca manda los bytes: solo la URL para pedirlos por separado. Armar
 * la respuesta con los metadatos alcanza para pintar el catálogo entero sin
 * descargar un solo archivo.
 */
function resumenImagen(id: number, nombre: string | null, bytes: number | null): ResumenImagen {
  if (!nombre || bytes === null) {
    return null;
  }
  return { url: `/api/productos/${id}/imagen`, nombre, bytes };
}

function presentProduct(product: StoredProduct, category: string, imagen: ResumenImagen = null) {
  return {
    id: String(product.id), code: product.codigo, name: product.nombre, category,
    unit: product.unidadVenta === 'KILOS' ? 'kg' : 'unidad',
    description: product.descripcion, active: product.activo, imagen,
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
    res.json(rows.map(product => presentProduct(
      product,
      categoriesById.get(product.tipoProductoId) ?? 'Fresco',
      resumenImagen(product.id, product.imagenNombre, product.imagenBytes)
    )));
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
      // Los cuatro campos van juntos porque hay un CHECK en la base; ver
      // ProductoRepository.guardarImagen.
      ...(req.foto ? {
        imagen: req.foto.bytes, imagenNombre: req.foto.nombre,
        imagenMime: req.foto.mime, imagenBytes: req.foto.bytes.length,
      } : {})
    });
    res.status(201).json(presentProduct(
      product,
      input.category,
      req.foto ? resumenImagen(product.id, req.foto.nombre, req.foto.bytes.length) : null
    ));
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

    // La foto se resuelve aparte del resto de los campos para que guardar el
    // nombre no escriba los bytes de nuevo. Sin archivo y sin quitar, se deja
    // como está; el producto que volvió trae la metadata que ya tenía.
    const quiereQuitar = req.body?.quitarFoto === true
      || req.body?.quitarFoto === '1'
      || req.body?.quitarFoto === 'true';

    let imagen = resumenImagen(id, product.imagenNombre, product.imagenBytes);

    // Si viene archivo, gana sobre quitar: elegir una foto nueva es la acción
    // más explícita de las dos.
    if (req.foto) {
      await productoRepository.guardarImagen(id, req.foto);
      imagen = resumenImagen(id, req.foto.nombre, req.foto.bytes.length);
    } else if (quiereQuitar) {
      await productoRepository.quitarImagen(id);
      imagen = null;
    }

    res.json(presentProduct(product, input.category, imagen));
  } catch (error) { sendDatabaseError(res, error); }
};

export const obtenerImagenProducto = async (req: Request, res: Response) => {
  const id = parseId(req, res);
  if (id === null) return;
  try {
    const producto = await productoRepository.descargarImagen(id);
    // El CHECK de la base garantiza que si hay bytes hay metadata, pero el
    // mime se valida igual para no mandarle un Content-Type vacío al cliente.
    if (!producto?.imagen || !producto.imagenMime) {
      res.status(404).json({ message: 'Este producto no tiene foto.' });
      return;
    }
    res.setHeader('Content-Type', producto.imagenMime);
    res.setHeader('Content-Length', String(producto.imagen.length));
    // La URL no cambia cuando se reemplaza la foto, así que sin esto el
    // navegador seguiría mostrando la anterior desde su caché.
    res.setHeader('Cache-Control', 'no-store');
    res.send(producto.imagen);
  } catch (error) { sendDatabaseError(res, error); }
};

export const deactivateProducto = async (req: Request, res: Response) => {
  const id = parseId(req, res);
  if (id === null) return;
  try {
    const product = await productoRepository.deleteById(id);
    if (!product) { res.status(404).json({ message: 'Producto no encontrado.' }); return; }
    const categoriesById = await getCategoryMap();
    res.json(presentProduct(
      product,
      categoriesById.get(product.tipoProductoId) ?? 'Fresco',
      resumenImagen(product.id, product.imagenNombre, product.imagenBytes)
    ));
  } catch (error) { sendDatabaseError(res, error); }
};
