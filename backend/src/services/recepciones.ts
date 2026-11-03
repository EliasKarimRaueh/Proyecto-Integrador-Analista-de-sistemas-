import sequelize from 'polleria-database/config/database';
import CompraRepository from 'polleria-database/repositories/compraRepository';
import DetalleCompraRepository from 'polleria-database/repositories/detalleCompraRepository';
import DetalleRecepcionRepository from 'polleria-database/repositories/detalleRecepcionRepository';
import MovimientoStockRepository from 'polleria-database/repositories/movimientoStockRepository';
import PedidoCompraRepository from 'polleria-database/repositories/pedidoCompraRepository';
import ProductoRepository from 'polleria-database/repositories/productoRepository';
import RecepcionRepository from 'polleria-database/repositories/recepcionRepository';
import { ErrorOperacion, objeto, numero, id } from './operaciones.js';
import {
  convertirCantidadBase,
  convertirCostoUnitario,
  validarDiferenciaRecepcion
} from './comprasCalculos.js';

const PRESENTACIONES = ['UNIDAD', 'KILOS', 'CAJON', 'CAJA', 'BOLSA', 'BULTO'] as const;

const compras = new CompraRepository();
const detallesCompras = new DetalleCompraRepository();
const detallesRecepciones = new DetalleRecepcionRepository();
const movimientos = new MovimientoStockRepository();
const pedidos = new PedidoCompraRepository();
const productos = new ProductoRepository();
const recepciones = new RecepcionRepository();

function textoOpcional(value: unknown, campo: string, maximo: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new ErrorOperacion(`${campo} debe ser texto.`);
  const texto = value.trim();
  if (texto.length > maximo) throw new ErrorOperacion(`${campo} admite hasta ${maximo} caracteres.`);
  return texto || null;
}

function fecha(value: unknown): Date {
  if (value === undefined) return new Date();
  const resultado = new Date(String(value));
  if (Number.isNaN(resultado.getTime())) throw new ErrorOperacion('La fecha de la recepción no es válida.');
  return resultado;
}

function presentacionPorDefecto(unidadCompra: string): typeof PRESENTACIONES[number] {
  const mapa: Record<string, typeof PRESENTACIONES[number]> = {
    KILOS: 'KILOS',
    UNIDADES: 'UNIDAD',
    CAJONES: 'CAJON',
    CAJAS: 'CAJA',
    BOLSAS: 'BOLSA',
    BULTOS: 'BULTO'
  };
  return mapa[unidadCompra] ?? 'UNIDAD';
}

type LineaRecepcion = {
  productoId: number;
  presentacion: typeof PRESENTACIONES[number];
  cantidadPresentacion: number;
  factorConversion: number;
  cantidadBase: number;
  costoUnitario: string;
};

export async function registrarRecepcion(body: unknown) {
  const b = objeto(body);
  const compraId = id(b.compraId, 'compraId');
  const usuarioId = id(b.usuarioId ?? 1, 'usuarioId');
  const fechaHora = fecha(b.fechaHora);
  const observaciones = textoOpcional(b.observaciones, 'observaciones', 300);

  return await sequelize.transaction(async transaction => {
    const compra = await compras.buscarPorIdConBloqueo(compraId, transaction);
    if (!compra) throw new ErrorOperacion('Compra no encontrada.', 404);
    if (compra.estado === 'RECIBIDA') {
      throw new ErrorOperacion('La compra ya fue recibida.', 409);
    }

    const existente = await recepciones.buscarPorCompra(compraId, transaction);
    if (existente) throw new ErrorOperacion('La compra ya tiene una recepción.', 409);

    const detallesCompra = await detallesCompras.buscarPorCompra(compraId, transaction);
    if (detallesCompra.length === 0) {
      throw new ErrorOperacion('La compra no tiene detalles.');
    }

    if (!Array.isArray(b.detalles) || b.detalles.length === 0 || b.detalles.length > 100) {
      throw new ErrorOperacion('Debe indicar entre 1 y 100 detalles.');
    }

    const detallePorProducto = new Map(
      detallesCompra.map(detalle => [detalle.productoId, detalle])
    );
    const lineas: LineaRecepcion[] = [];

    for (const item of b.detalles) {
      const detalle = objeto(item);
      const productoId = id(detalle.productoId, 'productoId');
      const detalleCompra = detallePorProducto.get(productoId);

      if (!detalleCompra) {
        throw new ErrorOperacion(`El producto ${productoId} no pertenece a la compra.`);
      }

      if (lineas.some(linea => linea.productoId === productoId)) {
        throw new ErrorOperacion('No se puede repetir el mismo producto en la recepción.');
      }

      const producto = await productos.findById(productoId, transaction);
      if (!producto || !producto.activo) {
        throw new ErrorOperacion(`Producto ${productoId} no encontrado o inactivo.`, 404);
      }

      const presentacion = String(
        detalle.presentacion ?? presentacionPorDefecto(producto.unidadCompra)
      ).toUpperCase();

      if (!PRESENTACIONES.includes(presentacion as never)) {
        throw new ErrorOperacion('La presentación de la recepción no es válida.');
      }

      const factorConversion = detalle.factorConversion === undefined
        ? producto.factorConversion
        : numero(detalle.factorConversion, 'factorConversion');

      const cantidadPresentacion = numero(detalle.cantidadPresentacion, 'cantidadPresentacion');
      const cantidadBase = convertirCantidadBase(cantidadPresentacion, factorConversion);

      validarDiferenciaRecepcion(Number(detalleCompra.cantidad), cantidadBase, observaciones);

      let costoUnitario: string;
      if (detalle.costoUnitario !== undefined) {
        costoUnitario = numero(detalle.costoUnitario, 'costoUnitario', true).toFixed(2);
      } else if (detalle.costoPresentacion !== undefined) {
        costoUnitario = convertirCostoUnitario(
          numero(detalle.costoPresentacion, 'costoPresentacion', true),
          factorConversion
        );
      } else {
        costoUnitario = String(detalleCompra.costoUnitario);
      }

      lineas.push({
        productoId,
        presentacion: presentacion as typeof PRESENTACIONES[number],
        cantidadPresentacion,
        factorConversion,
        cantidadBase,
        costoUnitario
      });
    }

    const faltantes = detallesCompra.filter(
      detalle => !lineas.some(linea => linea.productoId === detalle.productoId)
    );

    if (faltantes.length > 0) {
      throw new ErrorOperacion('Debe recibir todos los productos de la compra.');
    }

    const recepcion = await recepciones.crear({
      compraId,
      pedidoId: compra.pedidoId,
      proveedorId: compra.proveedorId,
      fechaHora,
      observaciones,
      usuarioId
    }, transaction);

    const guardados = await detallesRecepciones.crearMuchos(
      lineas.map(linea => ({
        recepcionId: recepcion.id,
        productoId: linea.productoId,
        presentacion: linea.presentacion,
        cantidadPresentacion: linea.cantidadPresentacion,
        factorConversion: linea.factorConversion,
        cantidadBase: linea.cantidadBase,
        costoUnitario: linea.costoUnitario as unknown as string
      })) as never[],
      transaction
    );

    const movimientosGuardados = [];
    for (const linea of lineas) {
      movimientosGuardados.push(
        await movimientos.registrarIngreso(
          linea.productoId,
          linea.cantidadBase,
          usuarioId,
          'RECEPCION',
          compraId,
          transaction,
          recepcion.id
        )
      );
      await productos.updateCosto(linea.productoId, linea.costoUnitario, transaction);
    }

    await compras.actualizar(compraId, { estado: 'RECIBIDA' }, transaction);
    if (compra.pedidoId !== null) {
      await pedidos.actualizarEstado(compra.pedidoId, 'RECIBIDO', transaction);
    }

    return { recepcion, detalles: guardados, movimientos: movimientosGuardados };
  });
}

export async function listarRecepciones(
  page: number,
  limit: number,
  compraId?: number,
  proveedorId?: number,
  desde?: Date,
  hasta?: Date
) {
  return await recepciones.listar({ compraId, proveedorId, desde, hasta }, page, limit);
}

export async function detalleRecepcion(recepcionId: number) {
  const recepcion = await recepciones.buscarPorId(recepcionId);
  if (!recepcion) throw new ErrorOperacion('Recepción no encontrada.', 404);
  return recepcion;
}
