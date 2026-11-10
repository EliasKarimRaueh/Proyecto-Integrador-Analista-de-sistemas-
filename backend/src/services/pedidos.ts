import sequelize from 'polleria-database/config/database';
import PedidoRepository from '../../../database/src/repositories/pedidoRepository.js';
import DetallePedidoRepository from '../../../database/src/repositories/detallePedidoRepository.js';
import ProductoRepository from 'polleria-database/repositories/productoRepository';
import ProductoProveedorRepository from 'polleria-database/repositories/productoProveedorRepository';
import ProveedorRepository from 'polleria-database/repositories/proveedorRepository';
import { ErrorOperacion, objeto, numero, id, validarCantidad } from './operaciones.js';
import { calcularSubtotal, calcularTotal, puedeCancelarPedido } from './comprasCalculos.js';
import DetalleCompraRepository from 'polleria-database/repositories/detalleCompraRepository';
import MovimientoStockRepository from 'polleria-database/repositories/movimientoStockRepository';
import CuentaProveedorRepository from 'polleria-database/repositories/cuentaProveedorRepository';
import CompraRepository from 'polleria-database/repositories/compraRepository';

const ESTADOS_PEDIDO = ['PENDIENTE', 'FACTURADO', 'CANCELADO', 'RECIBIDO'] as const;

const productos = new ProductoRepository();

const detalles = new DetallePedidoRepository(productos);

const detallesCompras = new DetalleCompraRepository(productos);
const movimientosStock = new MovimientoStockRepository();
const cuentas = new CuentaProveedorRepository();

const compras = new CompraRepository(
    detallesCompras,
    movimientosStock,
    cuentas,
    productos
);

const pedidos = new PedidoRepository(detalles, compras);

compras.setPedidoRepository(pedidos);

const relaciones = new ProductoProveedorRepository();
const proveedores = new ProveedorRepository();

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
  if (Number.isNaN(resultado.getTime())) throw new ErrorOperacion('La fecha del pedido no es válida.');
  return resultado;
}

type LineaPedido = {
  productoId: number;
  cantidad: number;
  costoEstimado: string;
  subtotal: string;
};

function lineasPedido(value: unknown): LineaPedido[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new ErrorOperacion('Debe indicar entre 1 y 100 detalles.');
  }

  const lineas = value.map(item => {
    const detalle = objeto(item);
    const productoId = id(detalle.productoId, 'productoId');
    const cantidad = numero(detalle.cantidad, 'cantidad');
    const costoEstimado = numero(detalle.costoEstimado ?? 0, 'costoEstimado', true).toFixed(2);
    return {
      productoId,
      cantidad,
      costoEstimado,
      subtotal: calcularSubtotal(cantidad, costoEstimado)
    };
  });

  if (new Set(lineas.map(linea => linea.productoId)).size !== lineas.length) {
    throw new ErrorOperacion('No se puede repetir el mismo producto en el pedido.');
  }

  return lineas;
}

export async function registrarPedido(body: unknown) {
  const b = objeto(body);
  const proveedorId = id(b.proveedorId, 'proveedorId');
  const observaciones = textoOpcional(b.observaciones, 'observaciones', 300);
  const fechaHora = fecha(b.fechaHora);
  const lineas = lineasPedido(b.detalles);
  const totalEstimado = calcularTotal(lineas.map(linea => linea.subtotal));

  const proveedor = await proveedores.buscarPorId(proveedorId);
  if (!proveedor) throw new ErrorOperacion('Proveedor no encontrado.', 404);
  if (!proveedor.activo) throw new ErrorOperacion('El proveedor está inactivo.');

  return await sequelize.transaction(async transaction => {
    const datosProductos = new Map<number, { nombre: string; unidadVenta: string }>();

    for (const linea of lineas) {
      const producto = await productos.findById(linea.productoId, transaction);
      if (!producto || !producto.activo) {
        throw new ErrorOperacion(`Producto ${linea.productoId} no encontrado o inactivo.`, 404);
      }

      datosProductos.set(linea.productoId, {
        nombre: producto.nombre,
        unidadVenta: producto.unidadVenta
      });

      const relacion = await relaciones.findByRelation(linea.productoId, proveedorId, transaction);
      validarCantidad(producto, linea.cantidad);
      if (!relacion || !relacion.activo) {
        throw new ErrorOperacion(`El producto ${linea.productoId} no está asociado al proveedor.`);
      }
    }

    const pedido = await pedidos.crear({
      proveedorId,
      fechaHora,
      estado: 'PENDIENTE',
      totalEstimado: totalEstimado as unknown as string,
      observaciones
    } as never, transaction);

    const guardados = await detalles.crearMuchos(
      lineas.map((linea, indice) => {
        const producto = datosProductos.get(linea.productoId)!;
        return {
          pedidoId: pedido.id,
          numeroItem: indice + 1,
          productoId: linea.productoId,
          nombre: producto.nombre,
          unidadPedido: producto.unidadVenta,
          cantidad: linea.cantidad,
          importeUnitario: linea.costoEstimado as unknown as string,
          costoEstimado: linea.costoEstimado as unknown as string,
          subtotal: linea.subtotal as unknown as string
        };
      }) as never[],
      transaction
    );

    return { pedido, detalles: guardados };
  });
}

export async function listarPedidos(
  page: number,
  limit: number,
  proveedorId?: number,
  estado?: string,
  desde?: Date,
  hasta?: Date
) {
  if (estado !== undefined && !ESTADOS_PEDIDO.includes(estado as never)) {
    throw new ErrorOperacion('El estado del pedido no es válido.');
  }

  return await pedidos.listar({ proveedorId, estado, desde, hasta }, page, limit);
}

export async function detallePedido(pedidoId: number) {
  const pedido = await pedidos.buscarDetalle(pedidoId);
  if (!pedido) throw new ErrorOperacion('Pedido no encontrado.', 404);
  return pedido;
}

export async function cancelarPedido(pedidoId: number) {
  return await sequelize.transaction(async transaction => {
    const pedido = await pedidos.buscarPorIdConBloqueo(pedidoId, transaction);
    if (!pedido) throw new ErrorOperacion('Pedido no encontrado.', 404);
    if (!puedeCancelarPedido(pedido.estado)) {
      throw new ErrorOperacion('Solo se puede cancelar un pedido pendiente.', 409);
    }

    return await pedidos.actualizarEstado(pedidoId, 'CANCELADO', transaction);
  });
}
