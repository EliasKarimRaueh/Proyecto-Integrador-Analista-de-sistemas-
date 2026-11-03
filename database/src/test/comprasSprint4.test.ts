import sequelize from '../config/database.js';
import '../relationships/relationships.js';
import { migrateComprasSprint4 } from '../migrations/comprasSprint4.js';

import {
    describe,
    test,
    expect,
    beforeAll,
    afterAll,
    jest
} from '@jest/globals';

import type { Transaction } from 'sequelize';

import PedidoCompraRepository from '../repositories/pedidoCompraRepository.js';
import DetallePedidoCompraRepository from '../repositories/detallePedidoCompraRepository.js';
import CompraRepository from '../repositories/compraRepository.js';
import DetalleCompraRepository from '../repositories/detalleCompraRepository.js';
import RecepcionRepository from '../repositories/recepcionRepository.js';
import DetalleRecepcionRepository from '../repositories/detalleRecepcionRepository.js';
import MovimientoStockRepository from '../repositories/movimientoStockRepository.js';
import ProductoRepository from '../repositories/productoRepository.js';

jest.setTimeout(30000);

const PROVEEDOR_ID = 1;
const PRODUCTO_ID = 1;

const pedidos = new PedidoCompraRepository();
const detallesPedido = new DetallePedidoCompraRepository();
const compras = new CompraRepository();
const detallesCompra = new DetalleCompraRepository();
const recepciones = new RecepcionRepository();
const detallesRecepcion = new DetalleRecepcionRepository();
const movimientos = new MovimientoStockRepository();
const productos = new ProductoRepository();

async function conRollback(
    callback: (transaction: Transaction) => Promise<void>
): Promise<void> {

    const transaction = await sequelize.transaction();

    try {
        await callback(transaction);
    } finally {
        await transaction.rollback();
    }
}

beforeAll(async () => {
    await sequelize.authenticate();
    await sequelize.sync();
    await migrateComprasSprint4();
});

afterAll(async () => {
    await sequelize.close();
});

describe('COMPRAS SPRINT 4', () => {

    test('la migración es idempotente', async () => {
        await expect(migrateComprasSprint4()).resolves.toBeUndefined();
    });

    test('registra pedido, compra y recepción con stock en una transacción', async () => {
        await conRollback(async transaction => {

            const pedido = await pedidos.crear({
                proveedorId: PROVEEDOR_ID,
                estado: 'PENDIENTE',
                totalEstimado: '100.00'
            }, transaction);

            await detallesPedido.crearMuchos([{
                pedidoId: pedido.id,
                productoId: PRODUCTO_ID,
                cantidad: 2,
                costoEstimado: '50.00',
                subtotal: '100.00'
            }], transaction);

            const compra = await compras.crear({
                proveedorId: PROVEEDOR_ID,
                pedidoId: pedido.id,
                tipoComprobante: 'FACTURA',
                numeroComprobante: `T-${Date.now()}`,
                estado: 'PENDIENTE_RECEPCION',
                total: 100
            }, transaction);

            await detallesCompra.crearMuchos([{
                compraId: compra.id,
                productoId: PRODUCTO_ID,
                cantidad: 2,
                costoUnitario: '50.00',
                subtotal: '100.00'
            }], transaction);

            await pedidos.actualizarEstado(pedido.id, 'FACTURADO', transaction);

            const existente = await recepciones.buscarPorCompra(compra.id, transaction);
            expect(existente).toBeNull();

            const recepcion = await recepciones.crear({
                compraId: compra.id,
                pedidoId: pedido.id,
                proveedorId: PROVEEDOR_ID,
                usuarioId: 1
            }, transaction);

            await detallesRecepcion.crearMuchos([{
                recepcionId: recepcion.id,
                productoId: PRODUCTO_ID,
                presentacion: 'KILOS',
                cantidadPresentacion: 2,
                factorConversion: 1,
                cantidadBase: 2,
                costoUnitario: '50.00'
            }], transaction);

            const producto = await productos.findById(PRODUCTO_ID, transaction);
            const stockInicial = Number(producto!.stockActual);

            const movimiento = await movimientos.registrarIngreso(
                PRODUCTO_ID,
                2,
                1,
                'RECEPCION',
                compra.id,
                transaction,
                recepcion.id
            );

            expect(movimiento.recepcionId).toBe(recepcion.id);

            await productos.updateCosto(PRODUCTO_ID, '50.00', transaction);
            await compras.actualizar(compra.id, { estado: 'RECIBIDA' }, transaction);
            await pedidos.actualizarEstado(pedido.id, 'RECIBIDO', transaction);

            await producto!.reload({ transaction });
            expect(Number(producto!.stockActual)).toBe(stockInicial + 2);
            expect(producto!.costoActual).toBe('50.00');

            const pedidoCompleto = await pedidos.buscarDetalle(pedido.id, transaction);
            expect(pedidoCompleto!.estado).toBe('RECIBIDO');
            expect((pedidoCompleto as unknown as { detalles: unknown[] }).detalles).toHaveLength(1);

            const compraCompleta = await compras.buscarDetalleCompleto(compra.id, transaction);
            expect(compraCompleta!.estado).toBe('RECIBIDA');
            expect((compraCompleta as unknown as { detalles: unknown[] }).detalles).toHaveLength(1);
            expect((compraCompleta as unknown as { recepcion: unknown }).recepcion).not.toBeNull();

            const filtradas = await compras.listarConFiltros(
                { proveedorId: PROVEEDOR_ID, estado: 'RECIBIDA' },
                1,
                50,
                transaction
            );
            expect(filtradas.rows.some(row => row.id === compra.id)).toBe(true);
        });
    });

    test('lista pedidos y recepciones con filtros', async () => {
        await conRollback(async transaction => {

            const pedido = await pedidos.crear({
                proveedorId: PROVEEDOR_ID,
                estado: 'PENDIENTE',
                totalEstimado: '10.00'
            }, transaction);

            const compra = await compras.crear({
                proveedorId: PROVEEDOR_ID,
                estado: 'RECIBIDA',
                total: 10
            }, transaction);

            const recepcion = await recepciones.crear({
                compraId: compra.id,
                proveedorId: PROVEEDOR_ID,
                usuarioId: 1
            }, transaction);

            const pedidosFiltrados = await pedidos.listar(
                { proveedorId: PROVEEDOR_ID, estado: 'PENDIENTE' },
                1,
                50,
                transaction
            );
            expect(pedidosFiltrados.rows.some(row => row.id === pedido.id)).toBe(true);

            const recepcionesFiltradas = await recepciones.listar(
                { compraId: compra.id },
                1,
                50,
                transaction
            );
            expect(recepcionesFiltradas.rows.some(row => row.id === recepcion.id)).toBe(true);

            const detalle = await recepciones.buscarPorId(recepcion.id, transaction);
            expect((detalle as unknown as { compra: { id: number } }).compra.id).toBe(compra.id);
            expect((detalle as unknown as { detalles: unknown[] }).detalles).toEqual([]);
        });
    });
});
