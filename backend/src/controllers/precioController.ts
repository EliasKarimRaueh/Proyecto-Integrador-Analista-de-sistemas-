// backend/src/controllers/precioController.ts
import { type Request, type Response } from 'express';
import PrecioRepository, { ErrorVigenciaPrecio } from 'polleria-database/repositories/precioRepository';
import ProductoRepository from 'polleria-database/repositories/productoRepository';
import {
  parseFecha, parseId, parseMonto, parseMontoOpcional, parsePaginacion,
  sendDatabaseError,
} from './controllerHelpers.js';

const precioRepository = new PrecioRepository();
const productoRepository = new ProductoRepository();

type PrecioInput = {
  productoId?: unknown;
  precioMinorista?: unknown;
  precioMayorista?: unknown;
  fechaDesde?: unknown;
};

type PrecioUpdateInput = {
  precioMinorista?: unknown;
  precioMayorista?: unknown;
};

type StoredPrecio = NonNullable<Awaited<ReturnType<typeof precioRepository.findById>>>;

/**
 * Sequelize devuelve DECIMAL como texto ("1500.00"). Se mantiene
 * como string para no perder precisión; el frontend lo castea.
 */
function presentPrecio(precio: StoredPrecio) {
  return {
    id: String(precio.id),
    productoId: precio.productoId,
    precioMinorista: precio.precioMinorista,
    precioMayorista: precio.precioMayorista,
    fechaDesde: precio.fechaDesde,
    fechaHasta: precio.fechaHasta,
    vigente: precio.fechaHasta === null && precio.activo,
    activo: precio.activo,
    fechaBaja: precio.fechaBaja,
  };
}

async function productoExiste(productoId: number) {
  const producto = await productoRepository.findById(productoId);
  return producto !== null && producto.activo;
}

// GET /api/precios
// Precios de todos los productos en una sola consulta.
//
// Por defecto devuelve el precio vigente de cada producto, que es lo
// que necesita la columna de precios del catálogo: el frontend indexa
// la respuesta por productoId y no tiene que pedir un endpoint por
// fila. Con ?vigente=false devuelve el histórico completo.
export const getPrecios = async (req: Request, res: Response) => {

    const paginacion = parsePaginacion(req.query as Record<string, unknown>);
    if (!paginacion.ok) { res.status(400).json({ message: paginacion.error }); return; }

    try {
        const { page, limit } = paginacion.value;
        const soloVigentes = req.query.vigente !== 'false';
        const resultado = await precioRepository.findGlobales(soloVigentes, page, limit);

        // El índice único garantiza un solo precio abierto por producto,
        // pero si algún precio queda con fechaHasta futura puede haber
        // más de un vigente. Se queda el más reciente para no romper la
        // promesa de "una fila por producto".
        const vistos = new Set<number>();
        const precios = resultado.rows
            .filter(precio => {
                if (!soloVigentes) return true;
                if (vistos.has(precio.productoId)) return false;
                vistos.add(precio.productoId);
                return true;
            });

        res.json(precios.map(presentPrecio));
    } catch (error) {
        sendDatabaseError(res, error, 'No se pudieron leer los precios.');
    }
};

// GET /api/precios/productos/:productoId
// Historial completo de precios del producto, del más nuevo al más viejo.
export const getHistorialPrecios = async (req: Request, res: Response) => {

  const id = parseId(req.params.productoId, 'El identificador del producto');
  if (!id.ok) { res.status(400).json({ message: id.error }); return; }

  const paginacion = parsePaginacion(req.query as Record<string, unknown>);
  if (!paginacion.ok) { res.status(400).json({ message: paginacion.error }); return; }

  try {
    const { page, limit } = paginacion.value;
    const precios = await precioRepository.findHistorial(id.value, page, limit);
    res.json(precios.map(presentPrecio));
  } catch (error) {
    sendDatabaseError(res, error, 'No se pudo leer el historial de precios.');
  }
};

// GET /api/precios/productos/:productoId/vigente
// El precio que se aplica hoy. Devuelve 404 en vez de null para que el
// frontend no tenga que distinguir entre "no hay" y "no existe".
export const getPrecioVigente = async (req: Request, res: Response) => {

  const id = parseId(req.params.productoId, 'El identificador del producto');
  if (!id.ok) { res.status(400).json({ message: id.error }); return; }

  try {
    const precio = await precioRepository.findVigente(id.value);
    if (!precio) { res.status(404).json({ message: 'El producto no tiene un precio vigente.' }); return; }
    res.json(presentPrecio(precio));
  } catch (error) {
    sendDatabaseError(res, error, 'No se pudo leer el precio vigente.');
  }
};

// POST /api/precios
// Registra un precio nuevo: cierra el que estaba abierto y deja el
// nuevo como único vigente, todo en una transacción.
export const registrarPrecio = async (req: Request, res: Response) => {

  const body = req.body as PrecioInput;

  const productoId = parseId(body.productoId, 'El producto');
  if (!productoId.ok) { res.status(400).json({ message: productoId.error }); return; }

  const minorista = parseMonto(body.precioMinorista, 'precioMinorista');
  if (!minorista.ok) { res.status(400).json({ message: minorista.error }); return; }

  const mayorista = parseMontoOpcional(body.precioMayorista, 'precioMayorista');
  if (!mayorista.ok) { res.status(400).json({ message: mayorista.error }); return; }

  if (mayorista.value !== null && Number(mayorista.value) > Number(minorista.value)) {
    res.status(400).json({ message: 'El precio mayorista no puede superar al minorista.' });
    return;
  }

  let fechaDesde = new Date();
  if (body.fechaDesde !== undefined) {
    const fecha = parseFecha(body.fechaDesde, 'fechaDesde');
    if (!fecha.ok) { res.status(400).json({ message: fecha.error }); return; }
    fechaDesde = fecha.value;
  }

  try {
    if (!await productoExiste(productoId.value)) {
      res.status(404).json({ message: 'Producto no encontrado.' });
      return;
    }

    const precio = await precioRepository.registrarPrecio(
      productoId.value,
      minorista.value,
      mayorista.value,
      fechaDesde
    );

    res.status(201).json(presentPrecio(precio));
  } catch (error) {
    // No es una falla de base: es la regla de vigencia, y el mensaje
    // dice cuál es la salida correcta.
    if (error instanceof ErrorVigenciaPrecio) {
      res.status(409).json({ message: error.message });
      return;
    }
    sendDatabaseError(res, error, 'No se pudo registrar el precio.');
  }
};

// PUT /api/precios/:id
// Corrige los montos de un precio ya existente sin tocar su vigencia.
// Para cambiar la vigencia hay que registrar un precio nuevo con una
// fecha posterior a la del precio vigente.
export const actualizarPrecio = async (req: Request, res: Response) => {

  const id = parseId(req.params.id, 'El identificador del precio');
  if (!id.ok) { res.status(400).json({ message: id.error }); return; }

  const body = req.body as PrecioUpdateInput;

  const minorista = parseMonto(body.precioMinorista, 'precioMinorista');
  if (!minorista.ok) { res.status(400).json({ message: minorista.error }); return; }

  const mayorista = parseMontoOpcional(body.precioMayorista, 'precioMayorista');
  if (!mayorista.ok) { res.status(400).json({ message: mayorista.error }); return; }

  if (mayorista.value !== null && Number(mayorista.value) > Number(minorista.value)) {
    res.status(400).json({ message: 'El precio mayorista no puede superar al minorista.' });
    return;
  }

  try {
    const precio = await precioRepository.updatePrecios(
      id.value,
      minorista.value,
      mayorista.value
    );

    if (!precio) { res.status(404).json({ message: 'Precio no encontrado.' }); return; }

    res.json(presentPrecio(precio));
  } catch (error) {
    sendDatabaseError(res, error, 'No se pudo actualizar el precio.');
  }
};

// DELETE /api/precios/:id
// Baja lógica del precio.
export const desactivarPrecio = async (req: Request, res: Response) => {

  const id = parseId(req.params.id, 'El identificador del precio');
  if (!id.ok) { res.status(400).json({ message: id.error }); return; }

  try {
    const precio = await precioRepository.deleteById(id.value);
    if (!precio) { res.status(404).json({ message: 'Precio no encontrado.' }); return; }
    res.json(presentPrecio(precio));
  } catch (error) {
    sendDatabaseError(res, error, 'No se pudo dar de baja el precio.');
  }
};
