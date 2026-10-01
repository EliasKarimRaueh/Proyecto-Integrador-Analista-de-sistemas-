import sequelize from '../config/database.js';
import '../relationships/relationships.js';

import {
    describe,
    test,
    expect,
    beforeAll,
    afterAll,
    jest
} from '@jest/globals';

import Venta from '../models/Venta.js';
import DetalleVenta from '../models/DetalleVenta.js';
import MovimientoStock from '../models/MovimientoStock.js';
import Producto from '../models/Producto.js';

import VentaRepository from '../repositories/ventaRepository.js';
import DetalleVentaRepository from '../repositories/detalleVentaRepository.js';
import MovimientoStockRepository from '../repositories/movimientoStockRepository.js';

import type { Transaction } from 'sequelize';

jest.setTimeout(30000);

// ============================================================
// CONFIGURACIÓN
// ============================================================

const ventaRepository = new VentaRepository();
const detalleVentaRepository = new DetalleVentaRepository();
const movimientoStockRepository = new MovimientoStockRepository();

const USUARIO_ID = 1;

// Productos utilizados por el seed.
// Se utiliza principalmente el producto 1 para las pruebas
// porque conocemos su stock inicial/final.
const PRODUCTO_ID = 1;

// ============================================================
// FUNCIONES AUXILIARES
// ============================================================

/**
 * Muestra en consola el inicio de una prueba.
 */
function logTest(nombre: string): void {
    console.log('\n============================================================');
    console.log(`TEST: ${nombre}`);
    console.log('============================================================');
}

/**
 * Muestra que una prueba terminó correctamente.
 */
function logOk(mensaje: string): void {
    console.log(`✅ ${mensaje}`);
}

/**
 * Muestra un error antes de que Jest lo informe.
 */
function logError(mensaje: string, error: unknown): void {
    console.error(`❌ ${mensaje}`);

    if (error instanceof Error) {
        console.error(`   ${error.message}`);
    }
    else {
        console.error(error);
    }
}

/**
 * Obtiene el stock actual de un producto.
 */
async function obtenerStock(productoId: number): Promise<number> {

    const producto = await Producto.findByPk(productoId);

    if (!producto) {
        throw new Error(
            `No existe el producto ${productoId}.`
        );
    }

    return Number(producto.stockActual);
}

// ============================================================
// PREPARACIÓN
// ============================================================

beforeAll(async () => {

    console.log('\n');
    console.log('############################################################');
    console.log('# TESTS DE VENTA, DETALLE DE VENTA Y MOVIMIENTO DE STOCK #');
    console.log('############################################################');

    await sequelize.authenticate();

    console.log('✅ Conexión a la base de datos establecida.');

    // Nos aseguramos de que las tablas existan.
    // NO utilizamos force: true porque no queremos borrar los datos.
    await sequelize.sync();

    console.log('✅ Tablas verificadas.');
});

// ============================================================
// FINALIZACIÓN
// ============================================================

afterAll(async () => {

    console.log('\n');
    console.log('############################################################');
    console.log('# FINALIZANDO TESTS                                       #');
    console.log('############################################################');

    await sequelize.close();

    console.log('✅ Conexión cerrada.');
});

// ============================================================
// MOVIMIENTO STOCK
// ============================================================

describe('MOVIMIENTO STOCK', () => {

    test('Registrar ingreso', async () => {

        logTest('Registrar ingreso');

        let transaction: Transaction | undefined;

        try {

            const stockInicial =
                await obtenerStock(PRODUCTO_ID);

            console.log(
                `Stock inicial: ${stockInicial}`
            );

            transaction =
                await sequelize.transaction();

            const movimiento =
                await movimientoStockRepository.registrarIngreso(
                    PRODUCTO_ID,
                    5,
                    USUARIO_ID,
                    'TEST_INGRESO',
                    null,
                    transaction
                );

            expect(movimiento).toBeDefined();

            expect(movimiento.productoId)
                .toBe(PRODUCTO_ID);

            expect(movimiento.tipo)
                .toBe('INGRESO');

            expect(Number(movimiento.cantInicial))
                .toBe(stockInicial);

            expect(Number(movimiento.cantMovimiento))
                .toBe(5);

            expect(Number(movimiento.cantFinal))
                .toBe(stockInicial + 5);

            const stockDurante =
                await obtenerStock(PRODUCTO_ID);

            expect(stockDurante)
                .toBe(stockInicial + 5);

            console.log(
                `Stock después del ingreso: ${stockDurante}`
            );

            await transaction.rollback();

            logOk(
                'El ingreso actualizó correctamente el stock y el movimiento.'
            );

        }
        catch (error) {

            logError(
                'Falló el registro de ingreso.',
                error
            );

            if (transaction) {
                await transaction.rollback();
            }

            throw error;
        }
    });

    // ------------------------------------------------------------
    // EGRESO
    // ------------------------------------------------------------

    test('Registrar egreso', async () => {

        logTest('Registrar egreso');

        let transaction: Transaction | undefined;

        try {

            const stockInicial =
                await obtenerStock(PRODUCTO_ID);

            transaction =
                await sequelize.transaction();

            const movimiento =
                await movimientoStockRepository.registrarEgreso(
                    PRODUCTO_ID,
                    2,
                    USUARIO_ID,
                    'TEST_EGRESO',
                    null,
                    transaction
                );

            expect(movimiento).toBeDefined();

            expect(movimiento.tipo)
                .toBe('EGRESO');

            expect(Number(movimiento.cantInicial))
                .toBe(stockInicial);

            expect(Number(movimiento.cantMovimiento))
                .toBe(2);

            expect(Number(movimiento.cantFinal))
                .toBe(stockInicial - 2);

            const stockDurante =
                await obtenerStock(PRODUCTO_ID);

            expect(stockDurante)
                .toBe(stockInicial - 2);

            await transaction.rollback();

            logOk(
                'El egreso actualizó correctamente el stock y el movimiento.'
            );

        }
        catch (error) {

            logError(
                'Falló el registro de egreso.',
                error
            );

            if (transaction) {
                await transaction.rollback();
            }

            throw error;
        }
    });

    // ------------------------------------------------------------
    // CANTIDAD CERO / NEGATIVA
    // ------------------------------------------------------------

    test('No permite registrar un movimiento con cantidad cero', async () => {

        logTest('Validación de cantidad cero');

        await expect(
            movimientoStockRepository.registrarEgreso(
                PRODUCTO_ID,
                0,
                USUARIO_ID
            )
        ).rejects.toThrow(
            'La cantidad del movimiento debe ser mayor que cero.'
        );

        logOk(
            'La cantidad cero fue correctamente rechazada.'
        );
    });

    test('No permite registrar un movimiento con cantidad negativa', async () => {

        logTest('Validación de cantidad negativa');

        await expect(
            movimientoStockRepository.registrarEgreso(
                PRODUCTO_ID,
                -5,
                USUARIO_ID
            )
        ).rejects.toThrow(
            'La cantidad del movimiento debe ser mayor que cero.'
        );

        logOk(
            'La cantidad negativa fue correctamente rechazada.'
        );
    });

    // ------------------------------------------------------------
    // MERMA
    // ------------------------------------------------------------

    test('Registrar merma', async () => {

        logTest('Registrar merma');

        let transaction: Transaction | undefined;

        try {

            const stockInicial =
                await obtenerStock(PRODUCTO_ID);

            transaction =
                await sequelize.transaction();

            const movimiento =
                await movimientoStockRepository.registrarMerma(
                    PRODUCTO_ID,
                    1,
                    USUARIO_ID,
                    transaction
                );

            expect(movimiento.tipo)
                .toBe('EGRESO');

            expect(movimiento.motivo)
                .toBe('MERMA');

            expect(Number(movimiento.cantFinal))
                .toBe(stockInicial - 1);

            await transaction.rollback();

            logOk(
                'La merma fue registrada correctamente.'
            );

        }
        catch (error) {

            logError(
                'Falló el registro de merma.',
                error
            );

            if (transaction) {
                await transaction.rollback();
            }

            throw error;
        }
    });

    // ------------------------------------------------------------
    // PÉRDIDA
    // ------------------------------------------------------------

    test('Registrar pérdida de mercadería', async () => {

        logTest('Registrar pérdida de mercadería');

        let transaction: Transaction | undefined;

        try {

            const stockInicial =
                await obtenerStock(PRODUCTO_ID);

            transaction =
                await sequelize.transaction();

            const movimiento =
                await movimientoStockRepository.registrarPerdida(
                    PRODUCTO_ID,
                    1,
                    USUARIO_ID,
                    transaction
                );

            expect(movimiento.tipo)
                .toBe('EGRESO');

            expect(movimiento.motivo)
                .toBe('PERDIDA_MERCADERIA');

            expect(Number(movimiento.cantFinal))
                .toBe(stockInicial - 1);

            await transaction.rollback();

            logOk(
                'La pérdida fue registrada correctamente.'
            );

        }
        catch (error) {

            logError(
                'Falló el registro de pérdida.',
                error
            );

            if (transaction) {
                await transaction.rollback();
            }

            throw error;
        }
    });

    // ------------------------------------------------------------
    // AJUSTE DE STOCK - INGRESO
    // ------------------------------------------------------------

    test('Ajustar stock hacia arriba genera un ingreso', async () => {

        logTest('Ajuste de stock hacia arriba');

        let transaction: Transaction | undefined;

        try {

            const stockInicial =
                await obtenerStock(PRODUCTO_ID);

            transaction =
                await sequelize.transaction();

            const movimiento =
                await movimientoStockRepository.ajustarStock(
                    PRODUCTO_ID,
                    stockInicial + 10,
                    USUARIO_ID,
                    'TEST_AJUSTE',
                    transaction
                );

            expect(movimiento).not.toBeNull();

            expect(movimiento!.tipo)
                .toBe('INGRESO');

            expect(Number(movimiento!.cantMovimiento))
                .toBe(10);

            expect(Number(movimiento!.cantFinal))
                .toBe(stockInicial + 10);

            await transaction.rollback();

            logOk(
                'El ajuste hacia arriba generó correctamente un ingreso.'
            );

        }
        catch (error) {

            logError(
                'Falló el ajuste hacia arriba.',
                error
            );

            if (transaction) {
                await transaction.rollback();
            }

            throw error;
        }
    });

    // ------------------------------------------------------------
    // AJUSTE DE STOCK - EGRESO
    // ------------------------------------------------------------

    test('Ajustar stock hacia abajo genera un egreso', async () => {

        logTest('Ajuste de stock hacia abajo');

        let transaction: Transaction | undefined;

        try {

            const stockInicial =
                await obtenerStock(PRODUCTO_ID);

            transaction =
                await sequelize.transaction();

            const movimiento =
                await movimientoStockRepository.ajustarStock(
                    PRODUCTO_ID,
                    stockInicial - 10,
                    USUARIO_ID,
                    'TEST_AJUSTE',
                    transaction
                );

            expect(movimiento).not.toBeNull();

            expect(movimiento!.tipo)
                .toBe('EGRESO');

            expect(Number(movimiento!.cantMovimiento))
                .toBe(10);

            expect(Number(movimiento!.cantFinal))
                .toBe(stockInicial - 10);

            await transaction.rollback();

            logOk(
                'El ajuste hacia abajo generó correctamente un egreso.'
            );

        }
        catch (error) {

            logError(
                'Falló el ajuste hacia abajo.',
                error
            );

            if (transaction) {
                await transaction.rollback();
            }

            throw error;
        }
    });

    // ------------------------------------------------------------
    // AJUSTE SIN CAMBIO
    // ------------------------------------------------------------

    test('Ajustar stock al mismo valor no genera movimiento', async () => {

        logTest('Ajuste sin cambio de stock');

        const stockInicial =
            await obtenerStock(PRODUCTO_ID);

        const movimiento =
            await movimientoStockRepository.ajustarStock(
                PRODUCTO_ID,
                stockInicial,
                USUARIO_ID,
                'TEST_SIN_CAMBIO'
            );

        expect(movimiento)
            .toBeNull();

        const stockFinal =
            await obtenerStock(PRODUCTO_ID);

        expect(stockFinal)
            .toBe(stockInicial);

        logOk(
            'El ajuste sin cambios no generó movimiento.'
        );
    });

    // ------------------------------------------------------------
    // BÚSQUEDA
    // ------------------------------------------------------------

    test('Buscar último movimiento de un producto', async () => {

        logTest('Buscar último movimiento');

        const movimiento =
            await movimientoStockRepository.findUltimoMovimiento(
                PRODUCTO_ID
            );

        expect(movimiento).not.toBeNull();

        expect(movimiento!.productoId)
            .toBe(PRODUCTO_ID);

        console.log(
            `Último movimiento: #${movimiento!.numeroMovimiento}`
        );

        logOk(
            'El último movimiento fue encontrado correctamente.'
        );
    });

    // ------------------------------------------------------------
    // BÚSQUEDA POR PRODUCTO Y NÚMERO
    // ------------------------------------------------------------

    test('Buscar movimiento por producto y número', async () => {

        logTest('Buscar movimiento específico');

        const ultimo =
            await movimientoStockRepository.findUltimoMovimiento(
                PRODUCTO_ID
            );

        expect(ultimo).not.toBeNull();

        const movimiento =
            await movimientoStockRepository.findByProductoAndNumero(
                PRODUCTO_ID,
                ultimo!.numeroMovimiento
            );

        expect(movimiento).not.toBeNull();

        expect(movimiento!.id)
            .toBe(ultimo!.id);

        logOk(
            'El movimiento específico fue encontrado correctamente.'
        );
    });

    // ------------------------------------------------------------
    // PAGINACIÓN
    // ------------------------------------------------------------

    test('Consultar movimientos de forma paginada', async () => {

        logTest('Consulta paginada de movimientos');

        const resultado =
            await movimientoStockRepository.consultarMovimientos(
                1,
                10,
                PRODUCTO_ID
            );

        expect(resultado).toHaveProperty('rows');
        expect(resultado).toHaveProperty('count');

        expect(Array.isArray(resultado.rows))
            .toBe(true);

        expect(resultado.count)
            .toBeGreaterThan(0);

        console.log(
            `Movimientos encontrados: ${resultado.count}`
        );

        logOk(
            'La consulta paginada funciona correctamente.'
        );
    });
});

// ============================================================
// DETALLE DE VENTA
// ============================================================

describe('DETALLE DE VENTA', () => {

    test('Crear detalle de venta para un producto', async () => {

        logTest('Crear detalle de venta');

        let transaction: Transaction | undefined;

        try {

            // Creamos una venta temporal dentro de la transacción.
            transaction =
                await sequelize.transaction();

            const venta =
                await Venta.create(
                    {
                        fechaHora: new Date(),
                        total: 0
                    },
                    { transaction }
                );

            const detalle =
                await detalleVentaRepository.createDetalle(
                    venta.id,
                    2,
                    PRODUCTO_ID,
                    undefined,
                    'MINORISTA',
                    transaction
                );

            expect(detalle).toBeDefined();

            expect(detalle.ventaId)
                .toBe(venta.id);

            expect(detalle.numeroItem)
                .toBe(1);

            expect(detalle.productoId)
                .toBe(PRODUCTO_ID);

            expect(detalle.ofertaId)
                .toBeNull();

            expect(Number(detalle.cantidad))
                .toBe(2);

            expect(detalle.nombre)
                .toBeTruthy();

            expect(Number(detalle.importeUnitario))
                .toBeGreaterThanOrEqual(0);

            expect(Number(detalle.subtotal))
                .toBe(
                    Number(detalle.cantidad) *
                    Number(detalle.importeUnitario)
                );

            await transaction.rollback();

            logOk(
                'El detalle de venta fue creado correctamente.'
            );

        }
        catch (error) {

            logError(
                'Falló la creación del detalle de venta.',
                error
            );

            if (transaction) {
                await transaction.rollback();
            }

            throw error;
        }
    });

    // ------------------------------------------------------------
    // VARIOS DETALLES
    // ------------------------------------------------------------

    test('Los números de item son secuenciales', async () => {

        logTest('Numeración secuencial de detalles');

        let transaction: Transaction | undefined;

        try {

            transaction =
                await sequelize.transaction();

            const venta =
                await Venta.create(
                    {
                        fechaHora: new Date(),
                        total: 0
                    },
                    { transaction }
                );

            const detalle1 =
                await detalleVentaRepository.createDetalle(
                    venta.id,
                    1,
                    1,
                    undefined,
                    'MINORISTA',
                    transaction
                );

            const detalle2 =
                await detalleVentaRepository.createDetalle(
                    venta.id,
                    1,
                    6,
                    undefined,
                    'MINORISTA',
                    transaction
                );

            const detalle3 =
                await detalleVentaRepository.createDetalle(
                    venta.id,
                    1,
                    4,
                    undefined,
                    'MINORISTA',
                    transaction
                );

            expect(detalle1.numeroItem)
                .toBe(1);

            expect(detalle2.numeroItem)
                .toBe(2);

            expect(detalle3.numeroItem)
                .toBe(3);

            await transaction.rollback();

            logOk(
                'Los números de item son secuenciales.'
            );

        }
        catch (error) {

            logError(
                'Falló la numeración de detalles.',
                error
            );

            if (transaction) {
                await transaction.rollback();
            }

            throw error;
        }
    });

    // ------------------------------------------------------------
    // BÚSQUEDA POR VENTA
    // ------------------------------------------------------------

    test('Buscar todos los detalles de una venta', async () => {

        logTest('Buscar detalles por venta');

        const detalles =
            await detalleVentaRepository.findAllByVenta(1);

        expect(Array.isArray(detalles))
            .toBe(true);

        expect(detalles.length)
            .toBe(3);

        expect(detalles[0].numeroItem)
            .toBe(1);

        expect(detalles[1].numeroItem)
            .toBe(2);

        expect(detalles[2].numeroItem)
            .toBe(3);

        logOk(
            'Los detalles de la venta fueron encontrados correctamente.'
        );
    });
});

// ============================================================
// VENTA
// ============================================================

describe('VENTA', () => {

    // ------------------------------------------------------------
    // INICIAR VENTA
    // ------------------------------------------------------------

    test('Iniciar una venta abre una transacción', async () => {

        logTest('Iniciar venta');

        let transaction: Transaction | undefined;

        try {

            const resultado =
                await ventaRepository.iniciarVenta();

            const venta =
                resultado.venta;

            transaction =
                resultado.transaction;

            expect(venta).toBeDefined();

            expect(venta.id)
                .toBeDefined();

            expect(Number(venta.total))
                .toBe(0);

            expect(venta.fechaHora)
                .toBeDefined();

            expect(transaction)
                .toBeDefined();

            console.log(
                `Venta creada: ${venta.id}`
            );

            await transaction.rollback();

            logOk(
                'La venta fue iniciada correctamente y la transacción quedó abierta.'
            );

        }
        catch (error) {

            logError(
                'Falló el inicio de venta.',
                error
            );

            if (transaction) {
                await transaction.rollback();
            }

            throw error;
        }
    });

    // ------------------------------------------------------------
    // AGREGAR DETALLE + ACTUALIZAR TOTAL
    // ------------------------------------------------------------

    test('Agregar detalle actualiza el total de la venta', async () => {

        logTest('Agregar detalle y actualizar total');

        let transaction: Transaction | undefined;

        try {

            const resultado =
                await ventaRepository.iniciarVenta();

            const venta =
                resultado.venta;

            transaction =
                resultado.transaction;

            const detalle =
                await ventaRepository.agregarDetalle(
                    venta.id,
                    2,
                    transaction,
                    PRODUCTO_ID,
                    undefined,
                    'MINORISTA'
                );

            expect(detalle)
                .toBeDefined();

            const ventaActualizada =
                await Venta.findByPk(
                    venta.id,
                    { transaction }
                );

            expect(ventaActualizada)
                .not.toBeNull();

            expect(
                Number(ventaActualizada!.total)
            ).toBe(
                Number(detalle.subtotal)
            );

            console.log(
                `Total calculado: ${ventaActualizada!.total}`
            );

            await transaction.rollback();

            logOk(
                'El detalle fue agregado y el total se actualizó correctamente.'
            );

        }
        catch (error) {

            logError(
                'Falló agregar detalle/actualizar total.',
                error
            );

            if (transaction) {
                await transaction.rollback();
            }

            throw error;
        }
    });

    // ------------------------------------------------------------
    // VARIOS DETALLES + TOTAL
    // ------------------------------------------------------------

    test('Agregar varios detalles calcula correctamente el total', async () => {

        logTest('Total con varios detalles');

        let transaction: Transaction | undefined;

        try {

            const resultado =
                await ventaRepository.iniciarVenta();

            const venta =
                resultado.venta;

            transaction =
                resultado.transaction;

            const detalle1 =
                await ventaRepository.agregarDetalle(
                    venta.id,
                    1,
                    transaction,
                    1,
                    undefined,
                    'MINORISTA'
                );

            const detalle2 =
                await ventaRepository.agregarDetalle(
                    venta.id,
                    2,
                    transaction,
                    6,
                    undefined,
                    'MINORISTA'
                );

            const detalle3 =
                await ventaRepository.agregarDetalle(
                    venta.id,
                    1,
                    transaction,
                    4,
                    undefined,
                    'MINORISTA'
                );

            const ventaActualizada =
                await Venta.findByPk(
                    venta.id,
                    { transaction }
                );

            expect(ventaActualizada)
                .not.toBeNull();

            const totalEsperado =
                Number(detalle1.subtotal) +
                Number(detalle2.subtotal) +
                Number(detalle3.subtotal);

            expect(
                Number(ventaActualizada!.total)
            ).toBe(totalEsperado);

            console.log(
                `Total esperado: ${totalEsperado}`
            );

            console.log(
                `Total obtenido: ${ventaActualizada!.total}`
            );

            await transaction.rollback();

            logOk(
                'El total con varios detalles es correcto.'
            );

        }
        catch (error) {

            logError(
                'Falló el cálculo del total con varios detalles.',
                error
            );

            if (transaction) {
                await transaction.rollback();
            }

            throw error;
        }
    });

    // ------------------------------------------------------------
    // ROLLBACK DE AGREGAR DETALLE
    // ------------------------------------------------------------

    test('Un error al agregar un detalle no cancela la venta completa', async () => {

        logTest('Rollback del savepoint de agregar detalle');

        let transaction: Transaction | undefined;

        try {

            const resultado =
                await ventaRepository.iniciarVenta();

            const venta =
                resultado.venta;

            transaction =
                resultado.transaction;

            // Primero agregamos un detalle válido.
            await ventaRepository.agregarDetalle(
                venta.id,
                1,
                transaction,
                PRODUCTO_ID,
                undefined,
                'MINORISTA'
            );

            // Intentamos agregar un detalle inválido:
            // producto y oferta simultáneamente.
            await expect(
                ventaRepository.agregarDetalle(
                    venta.id,
                    1,
                    transaction,
                    1,
                    1,
                    'MINORISTA'
                )
            ).rejects.toThrow();

            // La transacción principal debe seguir abierta.
            const ventaDespuesError =
                await Venta.findByPk(
                    venta.id,
                    { transaction }
                );

            expect(ventaDespuesError)
                .not.toBeNull();

            const detalles =
                await detalleVentaRepository.findAllByVenta(
                    venta.id,
                    transaction
                );

            // El primer detalle sigue existiendo.
            expect(detalles.length)
                .toBe(1);

            await transaction.rollback();

            logOk(
                'El error revirtió solamente el intento fallido y mantuvo la venta abierta.'
            );

        }
        catch (error) {

            logError(
                'Falló la prueba de rollback del savepoint.',
                error
            );

            if (transaction) {
                await transaction.rollback();
            }

            throw error;
        }
    });

    // ------------------------------------------------------------
    // CANCELAR VENTA
    // ------------------------------------------------------------

    test('Cancelar venta revierte toda la transacción', async () => {

        logTest('Cancelar venta');

        let transaction: Transaction | undefined;
        let ventaId: number | undefined;

        try {

            const resultado =
                await ventaRepository.iniciarVenta();

            ventaId =
                resultado.venta.id;

            transaction =
                resultado.transaction;

            await ventaRepository.agregarDetalle(
                ventaId,
                1,
                transaction,
                PRODUCTO_ID,
                undefined,
                'MINORISTA'
            );

            await ventaRepository.cancelarVenta(
                transaction
            );

            transaction = undefined;

            const venta =
                await Venta.findByPk(ventaId);

            expect(venta)
                .toBeNull();

            const detalles =
                await detalleVentaRepository.findAllByVenta(
                    ventaId
                );

            expect(detalles.length)
                .toBe(0);

            logOk(
                'La cancelación revirtió la venta y sus detalles.'
            );

        }
        catch (error) {

            logError(
                'Falló la cancelación de venta.',
                error
            );

            if (transaction) {
                await transaction.rollback();
            }

            throw error;
        }
    });
});