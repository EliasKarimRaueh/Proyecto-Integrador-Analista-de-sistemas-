import sequelize from '../config/database.js';
import '../relationships/relationships.js';
import { migrateComprasSprint4 } from '../migrations/comprasSprint4.js';
import { migrateRecepcionConformidad } from '../migrations/recepcionConformidad.js';

import {
    describe,
    test,
    expect,
    beforeAll,
    afterAll,
    jest
} from '@jest/globals';

import type { Transaction } from 'sequelize';

import PedidoRepository from '../repositories/pedidoRepository.js';
import DetallePedidoRepository from '../repositories/detallePedidoRepository.js';
import CompraRepository from '../repositories/compraRepository.js';
import DetalleCompraRepository from '../repositories/detalleCompraRepository.js';
import CuentaProveedorRepository from '../repositories/cuentaProveedorRepository.js';
import RecepcionRepository from '../repositories/recepcionRepository.js';
import DetalleRecepcionRepository from '../repositories/detalleRecepcionRepository.js';
import MovimientoStockRepository from '../repositories/movimientoStockRepository.js';
import ProductoRepository from '../repositories/productoRepository.js';

jest.setTimeout(30000);

// Guardia: estos tests escriben en la base apuntada por DATABASE_URL.
// Solo se ejecutan cuando RUN_DB_TESTS=true, para no tocar la base compartida.
const RUN_DB_TESTS = process.env.RUN_DB_TESTS === 'true';
const describeDb = RUN_DB_TESTS ? describe : describe.skip;
const testDb = RUN_DB_TESTS ? test : test.skip;

const PROVEEDOR_ID = 1;
const PRODUCTO_ID = 1;

const productos = new ProductoRepository();
const detallesPedido = new DetallePedidoRepository(productos);
const detallesCompra = new DetalleCompraRepository(productos);
const movimientos = new MovimientoStockRepository();
const cuentas = new CuentaProveedorRepository();
const compras = new CompraRepository(
    detallesCompra,
    movimientos,
    cuentas,
    productos
);
const pedidos = new PedidoRepository(detallesPedido, compras);
compras.setPedidoRepository(pedidos);
const recepciones = new RecepcionRepository();
const detallesRecepcion = new DetalleRecepcionRepository();

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
    if (!RUN_DB_TESTS) return;

    await sequelize.authenticate();
    await sequelize.sync();
    await migrateComprasSprint4();
    await migrateRecepcionConformidad();
});

afterAll(async () => {
    if (!RUN_DB_TESTS) return;

    await sequelize.close();
});

describeDb('COMPRAS SPRINT 4', () => {

    testDb('la migración es idempotente', async () => {
        await expect(migrateComprasSprint4()).resolves.toBeUndefined();
    });

    testDb('registra pedido, compra y recepción con stock en una transacción', async () => {
        await conRollback(async transaction => {

            const pedido = await pedidos.crear({
                proveedorId: PROVEEDOR_ID,
                estado: 'REALIZADO',
                totalEstimado: '100.00'
            }, transaction);

            await detallesPedido.crearMuchos([{
                pedidoId: pedido.id,
                numeroItem: 1,
                productoId: PRODUCTO_ID,
                nombre: 'Producto de prueba',
                unidadPedido: 'KILOS',
                cantidad: 2,
                importeUnitario: 50,
                costoEstimado: '50.00',
                subtotal: 100
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
                numeroItem: 1,
                productoId: PRODUCTO_ID,
                nombre: 'Producto de prueba',
                unidadCompra: 'KILOS',
                cantidad: 2,
                importeUnitario: 50,
                subtotal: 100
            }], transaction);

            await pedidos.actualizarEstado(pedido.id, 'REALIZADO', transaction);

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

    testDb('descuenta de la cuenta lo no recibido y salda la cuenta', async () => {
        await conRollback(async transaction => {

            const compra = await compras.crear({
                proveedorId: PROVEEDOR_ID,
                estado: 'RECIBIDA',
                total: 100
            }, transaction);

            const cuenta = await cuentas.crear({
                proveedorId: PROVEEDOR_ID,
                compraId: compra.id,
                importePendiente: 100,
                estado: 'PAGO PENDIENTE'
            }, transaction);

            const ajustada = await cuentas.descontarPorNoRecibido(cuenta.id, 40, transaction);
            expect(Number(ajustada!.importePendiente)).toBe(60);
            expect(ajustada!.estado).toBe('PAGO PENDIENTE');

            const saldada = await cuentas.descontarPorNoRecibido(cuenta.id, 60, transaction);
            expect(Number(saldada!.importePendiente)).toBe(0);
            expect(saldada!.estado).toBe('PAGADO');

            await expect(cuentas.descontarPorNoRecibido(cuenta.id, 10, transaction)).rejects.toThrow();
        });
    });

    testDb('lista pedidos y recepciones con filtros', async () => {
        await conRollback(async transaction => {

            const pedido = await pedidos.crear({
                proveedorId: PROVEEDOR_ID,
                estado: 'REALIZADO',
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
                { proveedorId: PROVEEDOR_ID, estado: 'REALIZADO' },
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
