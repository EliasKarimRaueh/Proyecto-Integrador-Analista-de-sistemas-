// backend/src/controllers/ofertaController.ts
import { type Request, type Response } from 'express';
import OfertaRepository from 'polleria-database/repositories/ofertaRepository';
import OfertaProductoRepository from 'polleria-database/repositories/ofertaProductoRepository';
import ProductoRepository from 'polleria-database/repositories/productoRepository';
import {
  esObjeto, fail, ok, parseFecha, parseId, parseMonto, parsePaginacion, texto,
  sendDatabaseError, type Resultado,
} from './controllerHelpers.js';

const ofertaRepository = new OfertaRepository();
const ofertaProductoRepository = new OfertaProductoRepository();
const productoRepository = new ProductoRepository();

type OfertaInput = {
  nombre?: unknown;
  descripcion?: unknown;
  fechaInicio?: unknown;
  fechaFin?: unknown;
  productos?: unknown;
};

type OfertaUpdateInput = {
  nombre?: unknown;
  descripcion?: unknown;
  fechaInicio?: unknown;
  fechaFin?: unknown;
};

type ItemProducto = { productoId: number; precioOferta: string };

type StoredOferta = NonNullable<Awaited<ReturnType<typeof ofertaRepository.findById>>>;

function presentOferta(oferta: StoredOferta) {
  const hoy = new Date();
  const vigente =
    oferta.activo &&
    oferta.fechaInicio <= hoy &&
    oferta.fechaFin >= hoy;

  return {
    id: String(oferta.id),
    nombre: oferta.nombre,
    descripcion: oferta.descripcion,
    fechaInicio: oferta.fechaInicio,
    fechaFin: oferta.fechaFin,
    vigente,
    activo: oferta.activo,
    fechaBaja: oferta.fechaBaja,
  };
}

function presentDetalle(
  oferta: StoredOferta,
  productos: { producto: { id: number; codigo: string; nombre: string; unidadVenta: string; stockActual: number }; relacion: { precioOferta: string; activo: boolean } }[]
) {
  return {
    ...presentOferta(oferta),
    productos: productos.map(({ producto, relacion }) => ({
      productoId: String(producto.id),
      codigo: producto.codigo,
      nombre: producto.nombre,
      unidadVenta: producto.unidadVenta,
      stockActual: producto.stockActual,
      precioOferta: relacion.precioOferta,
      activo: relacion.activo,
    })),
  };
}

/**
 * Valida el array de productos del cuerpo. Detecta duplicados antes de
 * tocar la base, porque un producto repetido solo se manifestaría como
 * un error de índice único y volvería la respuesta un 500.
 */
function validarProductos(valor: unknown): Resultado<ItemProducto[]> {

  if (!Array.isArray(valor)) {
    return fail('El campo productos debe ser un arreglo.');
  }

  if (valor.length === 0) {
    return fail('La oferta debe tener al menos un producto.');
  }

  if (valor.length > 200) {
    return fail('La oferta no puede tener más de 200 productos.');
  }

  const items: ItemProducto[] = [];
  const vistos = new Set<number>();

  for (let i = 0; i < valor.length; i++) {

    const crudo = valor[i];

    if (!esObjeto(crudo)) {
      return fail(`El producto en la posición ${i} no es un objeto válido.`);
    }

    const productoId = parseId(crudo.productoId, `El productoId en la posición ${i}`);
    if (!productoId.ok) { return fail(productoId.error); }

    const precioOferta = parseMonto(crudo.precioOferta, `el precioOferta del producto en la posición ${i}`);
    if (!precioOferta.ok) { return fail(precioOferta.error); }

    if (vistos.has(productoId.value)) {
      return fail(`El producto ${productoId.value} está repetido en la lista.`);
    }

    vistos.add(productoId.value);
    items.push({ productoId: productoId.value, precioOferta: precioOferta.value });
  }

  return ok(items);
}

async function cargarDetalle(ofertaId: number) {
  const [oferta, productos] = await Promise.all([
    ofertaRepository.findById(ofertaId),
    ofertaProductoRepository.listarDetalleProductos(ofertaId),
  ]);

  if (!oferta) {
    return null;
  }

  return presentDetalle(oferta, productos);
}

// GET /api/ofertas
// Sólo las que no están dadas de baja.
export const getOfertas = async (req: Request, res: Response) => {

  const paginacion = parsePaginacion(req.query as Record<string, unknown>);
  if (!paginacion.ok) { res.status(400).json({ message: paginacion.error }); return; }

  try {
    const { page, limit } = paginacion.value;
    const resultado = await ofertaRepository.findAllActivos(page, limit, 'id', 'DESC');
    res.json(resultado.rows.map(presentOferta));
  } catch (error) {
    sendDatabaseError(res, error, 'No se pudieron leer las ofertas.');
  }
};

// GET /api/ofertas/vigentes
// Sólo las que además están dentro de su ventana de fechas.
export const getOfertasVigentes = async (req: Request, res: Response) => {

  const paginacion = parsePaginacion(req.query as Record<string, unknown>);
  if (!paginacion.ok) { res.status(400).json({ message: paginacion.error }); return; }

  try {
    const { page, limit } = paginacion.value;
    const resultado = await ofertaRepository.findVigentes(new Date(), page, limit, 'id', 'DESC');
    res.json(resultado.rows.map(presentOferta));
  } catch (error) {
    sendDatabaseError(res, error, 'No se pudieron leer las ofertas vigentes.');
  }
};

// GET /api/ofertas/productos/:productoId
// Ofertas vigentes de un producto, con el precio que tiene en cada una.
export const getOfertasDeProducto = async (req: Request, res: Response) => {

  const id = parseId(req.params.productoId, 'El identificador del producto');
  if (!id.ok) { res.status(400).json({ message: id.error }); return; }

  try {
    const soloVigentes = req.query.vigentes !== 'false';
    const detalle = await ofertaProductoRepository.listarDetalleOfertas(id.value, soloVigentes);

    res.json(detalle.map(({ oferta, relacion }) => ({
      ...presentOferta(oferta),
      productoId: id.value,
      precioOferta: relacion.precioOferta,
    })));
  } catch (error) {
    sendDatabaseError(res, error, 'No se pudieron leer las ofertas del producto.');
  }
};

// GET /api/ofertas/:id
// Oferta con el detalle de sus productos y precios.
export const getOferta = async (req: Request, res: Response) => {

  const id = parseId(req.params.id, 'El identificador de la oferta');
  if (!id.ok) { res.status(400).json({ message: id.error }); return; }

  try {
    const detalle = await cargarDetalle(id.value);
    if (!detalle) { res.status(404).json({ message: 'Oferta no encontrada.' }); return; }
    res.json(detalle);
  } catch (error) {
    sendDatabaseError(res, error, 'No se pudo leer la oferta.');
  }
};

// POST /api/ofertas
// Crea la oferta y todas sus relaciones en una sola transacción.
export const createOferta = async (req: Request, res: Response) => {

  const body = req.body as OfertaInput;

  const nombre = texto(body.nombre);
  if (nombre.length < 1 || nombre.length > 50) {
    res.status(400).json({ message: 'El nombre debe tener entre 1 y 50 caracteres.' });
    return;
  }

  const descripcion = body.descripcion === undefined || body.descripcion === null
    ? null
    : texto(body.descripcion);

  if (descripcion !== null && descripcion.length > 300) {
    res.status(400).json({ message: 'La descripción admite hasta 300 caracteres.' });
    return;
  }

  const fechaInicio = parseFecha(body.fechaInicio, 'fechaInicio');
  if (!fechaInicio.ok) { res.status(400).json({ message: fechaInicio.error }); return; }

  const fechaFin = parseFecha(body.fechaFin, 'fechaFin');
  if (!fechaFin.ok) { res.status(400).json({ message: fechaFin.error }); return; }

  if (fechaFin.value <= fechaInicio.value) {
    res.status(400).json({ message: 'La fecha de fin debe ser posterior a la fecha de inicio.' });
    return;
  }

  const productos = validarProductos(body.productos);
  if (!productos.ok) { res.status(400).json({ message: productos.error }); return; }

  try {
    // Los productos se validan antes de abrir la transacción para
    // devolver un 404 claro en vez de un error de clave foránea.
    const existentes = await productoRepository.findByIds(
      productos.value.map(item => item.productoId)
    );

    const idsExistentes = new Set(existentes.filter(p => p.activo).map(p => p.id));
    const faltantes = productos.value.filter(item => !idsExistentes.has(item.productoId));

    if (faltantes.length > 0) {
      res.status(404).json({
        message: `Los productos ${faltantes.map(item => item.productoId).join(', ')} no existen o están dados de baja.`,
      });
      return;
    }

    const { oferta } = await ofertaProductoRepository.crearOfertaConProductos(
      {
        nombre,
        descripcion,
        fechaInicio: fechaInicio.value,
        fechaFin: fechaFin.value,
      },
      productos.value
    );

    const detalle = await cargarDetalle(oferta.id);
    res.status(201).json(detalle ?? presentOferta(oferta));
  } catch (error) {
    sendDatabaseError(res, error, 'No se pudo crear la oferta.');
  }
};

// PUT /api/ofertas/:id
// Actualiza sólo los campos que vienen en el cuerpo.
export const updateOferta = async (req: Request, res: Response) => {

  const id = parseId(req.params.id, 'El identificador de la oferta');
  if (!id.ok) { res.status(400).json({ message: id.error }); return; }

  const body = req.body as OfertaUpdateInput;
  const cambios: Record<string, unknown> = {};

  if (body.nombre !== undefined) {
    const nombre = texto(body.nombre);
    if (nombre.length < 1 || nombre.length > 50) {
      res.status(400).json({ message: 'El nombre debe tener entre 1 y 50 caracteres.' });
      return;
    }
    cambios.nombre = nombre;
  }

  if (body.descripcion !== undefined) {
    const descripcion = body.descripcion === null ? null : texto(body.descripcion);
    if (descripcion !== null && descripcion.length > 300) {
      res.status(400).json({ message: 'La descripción admite hasta 300 caracteres.' });
      return;
    }
    cambios.descripcion = descripcion;
  }

  let fechaInicio: Date | null = null;
  let fechaFin: Date | null = null;

  if (body.fechaInicio !== undefined) {
    const fecha = parseFecha(body.fechaInicio, 'fechaInicio');
    if (!fecha.ok) { res.status(400).json({ message: fecha.error }); return; }
    fechaInicio = fecha.value;
    cambios.fechaInicio = fechaInicio;
  }

  if (body.fechaFin !== undefined) {
    const fecha = parseFecha(body.fechaFin, 'fechaFin');
    if (!fecha.ok) { res.status(400).json({ message: fecha.error }); return; }
    fechaFin = fecha.value;
    cambios.fechaFin = fechaFin;
  }

  if (Object.keys(cambios).length === 0) {
    res.status(400).json({ message: 'No se envió ningún campo para actualizar.' });
    return;
  }

  try {
    const actual = await ofertaRepository.findById(id.value);
    if (!actual) { res.status(404).json({ message: 'Oferta no encontrada.' }); return; }

    // La vigencia se valida contra el valor guardado, no contra el
    // cuerpo, para no rechazar una actualización parcial válida.
    const inicio = fechaInicio ?? actual.fechaInicio;
    const fin = fechaFin ?? actual.fechaFin;

    if (fin <= inicio) {
      res.status(400).json({ message: 'La fecha de fin debe ser posterior a la fecha de inicio.' });
      return;
    }

    const actualizada = await ofertaRepository.updateById(id.value, cambios);
    if (!actualizada) { res.status(404).json({ message: 'Oferta no encontrada.' }); return; }

    const detalle = await cargarDetalle(id.value);
    res.json(detalle ?? presentOferta(actualizada));
  } catch (error) {
    sendDatabaseError(res, error, 'No se pudo actualizar la oferta.');
  }
};

// DELETE /api/ofertas/:id
// Baja lógica de la oferta.
export const desactivarOferta = async (req: Request, res: Response) => {

  const id = parseId(req.params.id, 'El identificador de la oferta');
  if (!id.ok) { res.status(400).json({ message: id.error }); return; }

  try {
    const oferta = await ofertaRepository.deleteById(id.value);
    if (!oferta) { res.status(404).json({ message: 'Oferta no encontrada.' }); return; }
    res.json(presentOferta(oferta));
  } catch (error) {
    sendDatabaseError(res, error, 'No se pudo dar de baja la oferta.');
  }
};

// GET /api/ofertas/:id/productos
export const getProductosDeOferta = async (req: Request, res: Response) => {

  const id = parseId(req.params.id, 'El identificador de la oferta');
  if (!id.ok) { res.status(400).json({ message: id.error }); return; }

  try {
    const oferta = await ofertaRepository.findById(id.value);
    if (!oferta) { res.status(404).json({ message: 'Oferta no encontrada.' }); return; }

    const soloActivos = req.query.activos !== 'false';
    const detalle = await ofertaProductoRepository.listarDetalleProductos(id.value, soloActivos);

    res.json(detalle.map(({ producto, relacion }) => ({
      productoId: String(producto.id),
      codigo: producto.codigo,
      nombre: producto.nombre,
      unidadVenta: producto.unidadVenta,
      stockActual: producto.stockActual,
      precioOferta: relacion.precioOferta,
      activo: relacion.activo,
    })));
  } catch (error) {
    sendDatabaseError(res, error, 'No se pudieron leer los productos de la oferta.');
  }
};

// PUT /api/ofertas/:id/productos/:productoId
// Cambia sólo el precio de la oferta, sin tocar el resto.
export const actualizarPrecioEnOferta = async (req: Request, res: Response) => {

  const ofertaId = parseId(req.params.id, 'El identificador de la oferta');
  if (!ofertaId.ok) { res.status(400).json({ message: ofertaId.error }); return; }

  const productoId = parseId(req.params.productoId, 'El identificador del producto');
  if (!productoId.ok) { res.status(400).json({ message: productoId.error }); return; }

  const precio = parseMonto((req.body as { precioOferta?: unknown }).precioOferta, 'precioOferta');
  if (!precio.ok) { res.status(400).json({ message: precio.error }); return; }

  try {
    const oferta = await ofertaRepository.findByIdActivo(ofertaId.value);
    if (!oferta) { res.status(404).json({ message: 'Oferta no encontrada o dada de baja.' }); return; }

    const relacion = await ofertaProductoRepository.updatePrecioOferta(
      ofertaId.value,
      productoId.value,
      precio.value
    );

    if (!relacion) { res.status(404).json({ message: 'El producto no pertenece a la oferta.' }); return; }

    res.json({
      ofertaId: String(ofertaId.value),
      productoId: productoId.value,
      precioOferta: relacion.precioOferta,
      activo: relacion.activo,
    });
  } catch (error) {
    sendDatabaseError(res, error, 'No se pudo actualizar el precio de la oferta.');
  }
};

// DELETE /api/ofertas/:id/productos/:productoId
// Saca el producto de la oferta con baja lógica.
export const quitarProductoDeOferta = async (req: Request, res: Response) => {

  const ofertaId = parseId(req.params.id, 'El identificador de la oferta');
  if (!ofertaId.ok) { res.status(400).json({ message: ofertaId.error }); return; }

  const productoId = parseId(req.params.productoId, 'El identificador del producto');
  if (!productoId.ok) { res.status(400).json({ message: productoId.error }); return; }

  try {
    const relacion = await ofertaProductoRepository.deleteByOfertaProducto(
      ofertaId.value,
      productoId.value
    );

    if (!relacion) { res.status(404).json({ message: 'El producto no pertenece a la oferta.' }); return; }

    res.json({
      ofertaId: String(ofertaId.value),
      productoId: productoId.value,
      activo: relacion.activo,
      fechaBaja: relacion.fechaBaja,
    });
  } catch (error) {
    sendDatabaseError(res, error, 'No se pudo quitar el producto de la oferta.');
  }
};
