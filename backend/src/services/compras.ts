import sequelize from 'polleria-database/config/database';
import CompraRepository from 'polleria-database/repositories/compraRepository';
import CuentaProveedorRepository from 'polleria-database/repositories/cuentaProveedorRepository';
import DetalleCompraRepository from 'polleria-database/repositories/detalleCompraRepository';
import PedidoRepository from '../../../database/src/repositories/pedidoRepository.js';
import DetallePedidoRepository from '../../../database/src/repositories/detallePedidoRepository.js';
import ProductoRepository from 'polleria-database/repositories/productoRepository';
import ProductoProveedorRepository from 'polleria-database/repositories/productoProveedorRepository';
import ProveedorRepository from 'polleria-database/repositories/proveedorRepository';
import MovimientoStockRepository from 'polleria-database/repositories/movimientoStockRepository';
import { ErrorOperacion, estadoStock, objeto, numero, id, validarCantidad } from './operaciones.js';
import {
  calcularCantidadSugerida,
  calcularFaltante,
  calcularSubtotal,
  calcularTotal,
  convertirCantidadBase,
  convertirCostoUnitario,
  validarDetallesConPedido
} from './comprasCalculos.js';

// Repositorio base de productos
const productos = new ProductoRepository();

// Repositorios de detalles
const detallesCompras = new DetalleCompraRepository(productos);
const detallesPedidos = new DetallePedidoRepository(productos);


// Repositorios independientes
const movimientosStock = new MovimientoStockRepository();
const cuentas = new CuentaProveedorRepository();

// CompraRepository
const compras = new CompraRepository(
  detallesCompras,
  movimientosStock,
  cuentas,
  productos
);

// PedidoRepository
const pedidos = new PedidoRepository(
  detallesPedidos,
  compras
);

// Otros repositorios
const relaciones = new ProductoProveedorRepository();
const proveedores = new ProveedorRepository();

// Resolver dependencia circular
compras.setPedidoRepository(pedidos);


const TIPOS_COMPROBANTE = ['FACTURA', 'REMITO', 'OTRO'] as const;

function textoOpcional(value: unknown, campo: string, maximo: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new ErrorOperacion(`${campo} debe ser texto.`);
  const texto = value.trim();
  if (texto.length > maximo) throw new ErrorOperacion(`${campo} admite hasta ${maximo} caracteres.`);
  return texto || null;
}

function textoObligatorio(value: unknown, campo: string, maximo: number): string {
  const texto = textoOpcional(value, campo, maximo);
  if (texto === null) throw new ErrorOperacion(`${campo} es obligatorio.`);
  return texto;
}

function fecha(value: unknown, mensajeError: string = 'La fecha de la compra no es válida.'): Date {
  if (value === undefined || value === null || value === '') return new Date();
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    const ahora = new Date();
    const [anio, mes, dia] = value.trim().split('-').map(Number);
    if (mes < 1 || mes > 12) {
      throw new ErrorOperacion(mensajeError);
    }
    const resultado = new Date(ahora);
    resultado.setFullYear(anio, mes - 1, dia);
    if (Number.isNaN(resultado.getTime()) || resultado.getDate() !== dia) {
      throw new ErrorOperacion(mensajeError);
    }
    return resultado;
  }
  const resultado = new Date(String(value));
  if (Number.isNaN(resultado.getTime())) throw new ErrorOperacion(mensajeError);
  return resultado;
}

type LineaCompra = {
  productoId: number;
  nombre: string;
  unidadVenta: string;
  cantidadBase: number;
  costoUnitario: string;
  subtotal: string;
  presentacion: string | null;
  cantidadPresentacion: number | null;
  factorConversion: number | null;
};

async function normalizarLineas(value: unknown, proveedorId: number, transaction: import('sequelize').Transaction) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new ErrorOperacion('Debe indicar entre 1 y 100 detalles.');
  }

  const lineas: LineaCompra[] = [];

  for (const item of value) {
    const detalle = objeto(item);
    const productoId = id(detalle.productoId, 'productoId');
    const producto = await productos.findById(productoId, transaction);
    if (!producto || !producto.activo) {
      throw new ErrorOperacion(`Producto ${productoId} no encontrado o inactivo.`, 404);
    }

    const relacion = await relaciones.findByRelation(productoId, proveedorId, transaction);
    if (!relacion || !relacion.activo) {
      throw new ErrorOperacion(`El producto ${productoId} no está asociado al proveedor.`);
    }

    if (lineas.some(linea => linea.productoId === productoId)) {
      throw new ErrorOperacion('No se puede repetir el mismo producto en la compra.');
    }

    const factorConversion = detalle.factorConversion === undefined
      ? producto.factorConversion
      : numero(detalle.factorConversion, 'factorConversion');

    const cantidadBase = detalle.cantidad === undefined
      ? convertirCantidadBase(numero(detalle.cantidadPresentacion, 'cantidadPresentacion'), factorConversion)
      : numero(detalle.cantidad, 'cantidad');
    validarCantidad(producto, cantidadBase);

    let costoUnitario: string;
    if (detalle.costoUnitario !== undefined) {
      costoUnitario = numero(detalle.costoUnitario, 'costoUnitario', true).toFixed(2);
    } else if (detalle.costoPresentacion !== undefined) {
      costoUnitario = convertirCostoUnitario(
        numero(detalle.costoPresentacion, 'costoPresentacion', true),
        factorConversion
      );
    } else {
      throw new ErrorOperacion('Cada detalle requiere costoUnitario o costoPresentacion.');
    }

    lineas.push({
      productoId,
      nombre: producto.nombre,
      unidadVenta: producto.unidadVenta,
      cantidadBase,
      costoUnitario,
      subtotal: calcularSubtotal(cantidadBase, costoUnitario),
      presentacion: textoOpcional(detalle.presentacion, 'presentacion', 20),
      cantidadPresentacion: detalle.cantidadPresentacion === undefined
        ? null
        : numero(detalle.cantidadPresentacion, 'cantidadPresentacion'),
      factorConversion: detalle.cantidadPresentacion === undefined
        ? null
        : factorConversion
    });
  }

  return lineas;
}

export async function registrarCompra(body: unknown) {
  const b = objeto(body);
  const proveedorId = id(b.proveedorId, 'proveedorId');
  const tipoComprobante = String(b.tipoComprobante ?? '').toUpperCase();
  if (!TIPOS_COMPROBANTE.includes(tipoComprobante as never)) {
    throw new ErrorOperacion('El tipo de comprobante no es válido.');
  }
  const numeroComprobante = textoObligatorio(b.numeroComprobante, 'numeroComprobante', 50);
  const pedidoId = b.pedidoId === undefined ? undefined : id(b.pedidoId, 'pedidoId');
  const fechaHora = fecha(b.fechaHora);
  const observaciones = textoOpcional(b.observaciones, 'observaciones', 300);

  const proveedor = await proveedores.buscarPorId(proveedorId);
  if (!proveedor) throw new ErrorOperacion('Proveedor no encontrado.', 404);
  if (!proveedor.activo) throw new ErrorOperacion('El proveedor está inactivo.');
  if (!proveedor.ctaCte) throw new ErrorOperacion('El proveedor debe tener cuenta corriente habilitada.', 409);

  return await sequelize.transaction(async transaction => {
    let detallesPedido: Awaited<ReturnType<typeof detallesPedidos.buscarPorPedido>> | undefined;

    if (pedidoId !== undefined) {
      const pedido = await pedidos.buscarPorIdConBloqueo(pedidoId, transaction);
      if (!pedido) throw new ErrorOperacion('Pedido no encontrado.', 404);
      if (pedido.proveedorId !== proveedorId) {
        throw new ErrorOperacion('El pedido pertenece a otro proveedor.');
      }
      if (pedido.estado !== 'REALIZADO') {
        throw new ErrorOperacion('El pedido ya no está disponible para registrar una compra.', 409);
      }

      const compraExistente = await compras.findBy({ pedidoId }, transaction);
      if (compraExistente) {
        throw new ErrorOperacion('El pedido ya tiene una compra registrada.', 409);
      }

      detallesPedido = await detallesPedidos.buscarPorPedido(pedidoId, transaction);
      if (!detallesPedido || detallesPedido.length === 0) {
        throw new ErrorOperacion('El pedido no tiene detalles registrados.', 409);
      }
    }

    const lineas = await normalizarLineas(b.detalles, proveedorId, transaction);

    if (detallesPedido) {
      validarDetallesConPedido(lineas, detallesPedido);
    }

    const total = calcularTotal(lineas.map(linea => linea.subtotal));

    const compra = await compras.crear({
      proveedorId,
      pedidoId: pedidoId ?? null,
      tipoComprobante,
      numeroComprobante,
      estado: 'PENDIENTE_RECEPCION',
      formaPago: 'A CUENTA',
      observaciones,
      fechaHora,
      total: total as unknown as number
    } as never, transaction);

    const mapaDetallePedido = detallesPedido
      ? new Map(
          detallesPedido
            .filter((dp): dp is typeof dp & { productoId: number } => dp.productoId !== null)
            .map(dp => [dp.productoId, dp])
        )
      : null;

    const detalles = await detallesCompras.crearMuchos(
      lineas.map((linea, indice) => ({
        compraId: compra.id,
        numeroItem: indice + 1,
        pedidoId: pedidoId ?? null,
        numeroItemPedido: mapaDetallePedido?.get(linea.productoId)?.numeroItem ?? null,
        productoId: linea.productoId,
        nombre: linea.nombre,
        unidadCompra: linea.unidadVenta,
        cantidad: linea.cantidadBase,
        importeUnitario: linea.costoUnitario as unknown as string,
        subtotal: linea.subtotal as unknown as string,
        presentacion: linea.presentacion,
        cantidadPresentacion: linea.cantidadPresentacion,
        factorConversion: linea.factorConversion
      })) as never[],
      transaction
    );

    const cuenta = await cuentas.crear({
      proveedorId,
      compraId: compra.id,
      importePendiente: total as unknown as number,
      estado: 'PAGO PENDIENTE'
    } as never, transaction);

    return { compra, detalles, cuenta, observaciones };
  });
}

export async function listarReposicion(
  page: number,
  limit: number,
  proveedorId?: number,
  incluirProximos = false,
  q?: string,
  soloHabitual = false
) {
  const resultado = await productos.buscarParaReposicion({
    proveedorId,
    incluirProximos,
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

export async function listarCompras(
  page: number,
  limit: number,
  proveedorId?: number,
  desde?: Date,
  hasta?: Date,
  estado?: string
) {
  if (estado !== undefined && !['PENDIENTE_RECEPCION', 'RECIBIDA'].includes(estado)) throw new ErrorOperacion('El estado de la compra no es válido.');
  return await compras.listarConFiltros({ proveedorId, estado, desde, hasta }, page, limit);
}

export async function detalleCompra(compraId: number) {
  const compra = await compras.buscarDetalleCompleto(compraId);
  if (!compra) throw new ErrorOperacion('Compra no encontrada.', 404);
  const detalle = compra as unknown as {
    cuentaProveedor?: unknown;
    recepcion?: { detalles?: Array<{ productoId: number; cantidadBase: number }> } | null;
    detalles?: Array<{ productoId: number; importeUnitario: string | number }>;
  };

  let totalRecibido: string | null = null;
  if (detalle.recepcion) {
    const aceptadoPorProducto = new Map(
      (detalle.recepcion.detalles ?? []).map(d => [d.productoId, Number(d.cantidadBase)])
    );
    totalRecibido = calcularTotal(
      (detalle.detalles ?? []).map(d =>
        calcularSubtotal(aceptadoPorProducto.get(d.productoId) ?? 0, d.importeUnitario)
      )
    );
  }

  return { compra, cuenta: detalle.cuentaProveedor ?? null, totalRecibido };
}
