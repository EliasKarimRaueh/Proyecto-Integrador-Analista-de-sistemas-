import sequelize from 'polleria-database/config/database';
import CompraRepository from 'polleria-database/repositories/compraRepository';
import DetalleCompraRepository from 'polleria-database/repositories/detalleCompraRepository';
import DetalleRecepcionRepository from 'polleria-database/repositories/detalleRecepcionRepository';
import MovimientoStockRepository from 'polleria-database/repositories/movimientoStockRepository';
import PedidoRepository from '../../../database/src/repositories/pedidoRepository.js';
import ProductoRepository from 'polleria-database/repositories/productoRepository';
import RecepcionRepository from 'polleria-database/repositories/recepcionRepository';
import DetallePedidoRepository from '../../../database/src/repositories/detallePedidoRepository.js';
import CuentaProveedorRepository from 'polleria-database/repositories/cuentaProveedorRepository';
import { ErrorOperacion, objeto, numero, id, validarCantidad } from './operaciones.js';
import {
  convertirCostoUnitario,
  redondearCantidad
} from './comprasCalculos.js';
import { centavos, importe } from './dinero.js';

const PRESENTACIONES = ['UNIDAD', 'KILOS', 'CAJON', 'CAJA', 'BOLSA', 'BULTO'] as const;

const productos = new ProductoRepository();

const detallesCompras = new DetalleCompraRepository(productos);
const detallesPedidos = new DetallePedidoRepository(productos);

const movimientos = new MovimientoStockRepository();
const cuentas = new CuentaProveedorRepository();

const compras = new CompraRepository(
  detallesCompras,
  movimientos,
  cuentas,
  productos
);

const pedidos = new PedidoRepository(
  detallesPedidos,
  compras
);

compras.setPedidoRepository(pedidos);

const detallesRecepciones = new DetalleRecepcionRepository();
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

type DetalleCompraDatos = {
  importeUnitario?: string | number | null;
  costoUnitario?: string | number | null;
};

function costoUnitarioCompra(detalle: DetalleCompraDatos): number {
  const valor = Number(detalle.importeUnitario ?? detalle.costoUnitario ?? 0);
  return Number.isFinite(valor) ? valor : 0;
}

type LineaRecepcion = {
  productoId: number;
  presentacion: typeof PRESENTACIONES[number];
  cantidadPresentacion: number;
  factorConversion: number;
  cantidadBase: number;
  cantidadRechazadaBase: number;
  cantidadFaltanteBase: number;
  motivo: string | null;
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
    let descuentoCentavos = 0n;

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
        ? (presentacion === 'KILOS' || presentacion === 'UNIDAD' ? 1 : producto.factorConversion)
        : numero(detalle.factorConversion, 'factorConversion');

      const cantidadPresentacion = numero(detalle.cantidadPresentacion, 'cantidadPresentacion', true);
      const cantidadBase = redondearCantidad(cantidadPresentacion * factorConversion);
      const cantidadRechazadaBase = detalle.cantidadRechazadaBase === undefined
        ? 0
        : redondearCantidad(numero(detalle.cantidadRechazadaBase, 'cantidadRechazadaBase', true));

      if (cantidadBase > 0) validarCantidad(producto, cantidadBase);
      if (cantidadRechazadaBase > 0) validarCantidad(producto, cantidadRechazadaBase);
      if ((presentacion === 'KILOS' || presentacion === 'UNIDAD') && factorConversion !== 1) throw new ErrorOperacion('La unidad base requiere factor de conversión 1.');
      if (presentacion === 'KILOS' && producto.unidadVenta === 'UNIDADES' || presentacion === 'UNIDAD' && producto.unidadVenta === 'KILOS') throw new ErrorOperacion('La presentación no coincide con la unidad de venta.');

      const cantidadComprada = redondearCantidad(Number(detalleCompra.cantidad));
      const cantidadFaltanteBase = redondearCantidad(cantidadComprada - cantidadBase - cantidadRechazadaBase);

      if (cantidadFaltanteBase < -0.001) {
        throw new ErrorOperacion(`La cantidad del producto ${productoId} no puede superar la comprada.`);
      }

      const motivoLinea = textoOpcional(detalle.motivo, 'motivo', 200);
      const tieneDiferencia = cantidadRechazadaBase > 0.001 || cantidadFaltanteBase > 0.001;

      if (tieneDiferencia && !motivoLinea && !observaciones) {
        throw new ErrorOperacion('La recepción tiene faltantes o rechazos y requiere un motivo.');
      }

      let costoUnitario: string;
      if (detalle.costoUnitario !== undefined) {
        costoUnitario = numero(detalle.costoUnitario, 'costoUnitario', true).toFixed(2);
      } else if (detalle.costoPresentacion !== undefined) {
        costoUnitario = convertirCostoUnitario(
          numero(detalle.costoPresentacion, 'costoPresentacion', true),
          factorConversion
        );
      } else {
        costoUnitario = String(costoUnitarioCompra(detalleCompra));
      }

      const importeUnitarioCompra = costoUnitarioCompra(detalleCompra);
      const cantidadNoAceptada = redondearCantidad(cantidadRechazadaBase + cantidadFaltanteBase);
      if (cantidadNoAceptada > 0 && Number.isFinite(importeUnitarioCompra) && importeUnitarioCompra > 0) {
        descuentoCentavos += centavos(cantidadNoAceptada, importeUnitarioCompra);
      }

      lineas.push({
        productoId,
        presentacion: presentacion as typeof PRESENTACIONES[number],
        cantidadPresentacion,
        factorConversion,
        cantidadBase,
        cantidadRechazadaBase,
        cantidadFaltanteBase,
        motivo: motivoLinea ?? (tieneDiferencia ? observaciones : null),
        costoUnitario
      });
    }

    const faltantes = detallesCompra.filter(
      detalle => !lineas.some(linea => linea.productoId === detalle.productoId)
    );

    if (faltantes.length > 0) {
      throw new ErrorOperacion('Debe recibir todos los productos de la compra.');
    }

    const conformidad = lineas.some(
      linea => linea.cantidadRechazadaBase > 0.001 || linea.cantidadFaltanteBase > 0.001
    ) ? 'CON_DIFERENCIAS' : 'COMPLETA';

    const recepcion = await recepciones.crear({
      compraId,
      pedidoId: compra.pedidoId,
      proveedorId: compra.proveedorId,
      fechaHora,
      observaciones,
      usuarioId,
      conformidad
    }, transaction);

    const guardados = await detallesRecepciones.crearMuchos(
      lineas.map(linea => ({
        recepcionId: recepcion.id,
        productoId: linea.productoId,
        presentacion: linea.presentacion,
        cantidadPresentacion: linea.cantidadPresentacion,
        factorConversion: linea.factorConversion,
        cantidadBase: linea.cantidadBase,
        cantidadRechazadaBase: linea.cantidadRechazadaBase,
        cantidadFaltanteBase: linea.cantidadFaltanteBase,
        motivo: linea.motivo,
        costoUnitario: linea.costoUnitario as unknown as string
      })) as never[],
      transaction
    );

    const movimientosGuardados = [];
    for (const linea of [...lineas].sort((a, b) => a.productoId - b.productoId)) {
      if (linea.cantidadBase <= 0) continue;
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

    let ajusteAplicadoCentavos = 0n;
    if (descuentoCentavos > 0n) {
      const cuenta = await cuentas.buscarPorCompra(compraId, transaction);
      const pendiente = cuenta ? Number(cuenta.importePendiente) : Number.NaN;
      if (cuenta && Number.isFinite(pendiente) && pendiente > 0) {
        const pendienteCentavos = BigInt(Math.round(pendiente * 100));
        ajusteAplicadoCentavos = pendienteCentavos < descuentoCentavos
          ? pendienteCentavos
          : descuentoCentavos;
        const aDescontar = Number(importe(ajusteAplicadoCentavos));
        if (aDescontar > 0) {
          await cuentas.descontarPorNoRecibido(cuenta.id, aDescontar, transaction);
        }
      }
    }

    await compras.actualizar(compraId, { estado: 'RECIBIDA' }, transaction);
    if (compra.pedidoId !== null) {
      await pedidos.updateById(
        compra.pedidoId,
        {
          estado: 'RECIBIDO',
          fechaHoraRecepcion: recepcion.fechaHora,
          usuarioRecepcion: usuarioId
        },
        transaction
      );
    }

    return {
      recepcion,
      detalles: guardados,
      movimientos: movimientosGuardados,
      conformidad,
      ajusteCuenta: Number(importe(ajusteAplicadoCentavos))
    };
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
