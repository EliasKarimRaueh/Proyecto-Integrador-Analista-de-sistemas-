
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

import type { Transaction } from 'sequelize';

import Compra from '../models/Compra.js';
import CuentaProveedor from '../models/CuentaProveedor.js';
import Pago from '../models/Pago.js';
import PagoPorCuenta from '../models/PagoPorCuenta.js';

import CompraRepository from '../repositories/compraRepository.js';
import CuentaProveedorRepository from '../repositories/cuentaProveedorRepository.js';
import PagoRepository from '../repositories/pagoRepository.js';
import PagoPorCuentaRepository from '../repositories/pagoPorCuentaRepository.js';

jest.setTimeout(30000);

// ============================================================
// CONFIGURACIÓN
// ============================================================

const compraRepository = new CompraRepository();
const cuentaProveedorRepository = new CuentaProveedorRepository();
const pagoRepository = new PagoRepository();
const pagoPorCuentaRepository = new PagoPorCuentaRepository();

const PROVEEDOR_ID = 1;

const comprasCreadas: number[] = [];
const cuentasCreadas: number[] = [];
const pagosCreados: number[] = [];

const aplicacionesCreadas: Array<{
    pagoId: number;
    cuentaId: number;
}> = [];

// ============================================================
// FUNCIONES AUXILIARES
// ============================================================

function logTest(nombre: string): void {
    console.log('\n============================================================');
    console.log(`TEST: ${nombre}`);
    console.log('============================================================');
}

function logOk(mensaje: string): void {
    console.log(`✅ ${mensaje}`);
}

function logError(mensaje: string, error: unknown): void {
    console.error(`❌ ${mensaje}`);

    if (error instanceof Error) {
        console.error(`   ${error.message}`);
    } else {
        console.error(error);
    }
}

async function ejecutarConRollback(
    callback: (transaction: Transaction) => Promise<void>
): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
        await callback(transaction);
    } catch (error) {
        logError('Falló la prueba.', error);
        throw error;
    } finally {
        try {
            await transaction.rollback();
        } catch {
            // La transacción pudo haber finalizado previamente.
        }
    }
}

// ============================================================
// PREPARACIÓN
// ============================================================

beforeAll(async () => {
    console.log('\n');
    console.log('############################################################');
    console.log('# TESTS DE REPOSITORIOS FINANCIEROS                         #');
    console.log('############################################################');

    await sequelize.authenticate();

    console.log('✅ Conexión a la base de datos establecida.');

    await sequelize.sync();

    console.log('✅ Tablas verificadas.');

    const proveedorExiste = await sequelize.models.Proveedor.findByPk(
        PROVEEDOR_ID
    );

    if (!proveedorExiste) {
        throw new Error(
            `No existe el proveedor ${PROVEEDOR_ID}. ` +
            'Verificá que los seeders se hayan ejecutado.'
        );
    }
});

// ============================================================
// LIMPIEZA Y FINALIZACIÓN
// ============================================================

afterAll(async () => {
    console.log('\n');
    console.log('############################################################');
    console.log('# LIMPIEZA Y FINALIZACIÓN                                  #');
    console.log('############################################################');

    for (const aplicacion of aplicacionesCreadas) {
        await PagoPorCuenta.destroy({
            where: {
                pagoId: aplicacion.pagoId,
                cuentaId: aplicacion.cuentaId
            }
        });
    }

    if (pagosCreados.length > 0) {
        await Pago.destroy({
            where: {
                id: pagosCreados
            }
        });
    }

    if (cuentasCreadas.length > 0) {
        await CuentaProveedor.destroy({
            where: {
                id: cuentasCreadas
            }
        });
    }

    if (comprasCreadas.length > 0) {
        await Compra.destroy({
            where: {
                id: comprasCreadas
            }
        });
    }

    await sequelize.close();

    console.log('✅ Limpieza finalizada y conexión cerrada.');
});

// ============================================================
// COMPRA
// ============================================================

describe('COMPRA', () => {
    test('Crear y buscar una compra por ID', async () => {
        logTest('Crear y buscar compra');

        const compra = await compraRepository.crear({
            proveedorId: PROVEEDOR_ID,
            fechaHora: new Date(),
            total: 12500
        });

        comprasCreadas.push(compra.id);

        expect(compra).toBeDefined();
        expect(compra.id).toBeGreaterThan(0);
        expect(compra.proveedorId).toBe(PROVEEDOR_ID);
        expect(Number(compra.total)).toBe(12500);

        const encontrada = await compraRepository.buscarPorId(compra.id);

        expect(encontrada).not.toBeNull();
        expect(encontrada!.id).toBe(compra.id);
        expect(Number(encontrada!.total)).toBe(12500);

        logOk('La compra fue creada y encontrada correctamente.');
    });

    test('Actualizar una compra existente', async () => {
        logTest('Actualizar compra');

        const compra = await compraRepository.crear({
            proveedorId: PROVEEDOR_ID,
            fechaHora: new Date(),
            total: 1000
        });

        comprasCreadas.push(compra.id);

        await compraRepository.actualizar(compra.id, {
            total: 2500
        });

        const actualizada = await compraRepository.buscarPorId(compra.id);

        expect(actualizada).not.toBeNull();
        expect(Number(actualizada!.total)).toBe(2500);

        logOk('La compra fue actualizada correctamente.');
    });

    test('Buscar compras por proveedor', async () => {
        logTest('Buscar compras por proveedor');

        const resultado =
            await compraRepository.buscarPorProveedor(PROVEEDOR_ID);

        expect(resultado).toBeDefined();

        const registros = Array.isArray(resultado)
            ? resultado
            : (resultado as { rows?: Compra[] }).rows;

        expect(Array.isArray(registros)).toBe(true);

        logOk('La búsqueda de compras por proveedor respondió correctamente.');
    });
});

// ============================================================
// CUENTA DE PROVEEDOR
// ============================================================

describe('CUENTA DE PROVEEDOR', () => {
    test('Crear y buscar una cuenta por ID', async () => {
        logTest('Crear y buscar cuenta de proveedor');

        const compra = await compraRepository.crear({
            proveedorId: PROVEEDOR_ID,
            fechaHora: new Date(),
            total: 8000
        });

        comprasCreadas.push(compra.id);

        const cuenta = await cuentaProveedorRepository.crear({
            proveedorId: PROVEEDOR_ID,
            compraId: compra.id,
            importePendiente: 8000,
            estado: 'PAGO PENDIENTE'
        });

        cuentasCreadas.push(cuenta.id);

        expect(cuenta).toBeDefined();
        expect(cuenta.id).toBeGreaterThan(0);
        expect(cuenta.proveedorId).toBe(PROVEEDOR_ID);
        expect(cuenta.compraId).toBe(compra.id);
        expect(Number(cuenta.importePendiente)).toBe(8000);
        expect(cuenta.estado).toBe('PAGO PENDIENTE');

        const encontrada =
            await cuentaProveedorRepository.buscarPorId(cuenta.id);

        expect(encontrada).not.toBeNull();
        expect(encontrada!.id).toBe(cuenta.id);

        logOk('La cuenta fue creada y encontrada correctamente.');
    });

    test('Buscar cuentas por compra', async () => {
        logTest('Buscar cuentas por compra');

        const compra = await compraRepository.crear({
            proveedorId: PROVEEDOR_ID,
            fechaHora: new Date(),
            total: 4200
        });

        comprasCreadas.push(compra.id);

        const cuenta = await cuentaProveedorRepository.crear({
            proveedorId: PROVEEDOR_ID,
            compraId: compra.id,
            importePendiente: 4200,
            estado: 'PAGO PENDIENTE'
        });

        cuentasCreadas.push(cuenta.id);

        const encontrada =
        await cuentaProveedorRepository.buscarPorCompra(compra.id);

        expect(encontrada).not.toBeNull();
        expect(encontrada!.id).toBe(cuenta.id);
        expect(encontrada!.compraId).toBe(compra.id);

        logOk('La cuenta fue encontrada por su compra.');
    });

    test('Actualizar saldo y estado de una cuenta', async () => {
        logTest('Actualizar saldo y estado');

        const compra = await compraRepository.crear({
            proveedorId: PROVEEDOR_ID,
            fechaHora: new Date(),
            total: 6000
        });

        comprasCreadas.push(compra.id);

        const cuenta = await cuentaProveedorRepository.crear({
            proveedorId: PROVEEDOR_ID,
            compraId: compra.id,
            importePendiente: 6000,
            estado: 'PAGO PENDIENTE'
        });

        cuentasCreadas.push(cuenta.id);

        await cuentaProveedorRepository.actualizarSaldoYEstado(
            cuenta.id,
            2000
        );

        const actualizada =
            await cuentaProveedorRepository.buscarPorId(cuenta.id);

        expect(actualizada).not.toBeNull();
        expect(Number(actualizada!.importePendiente)).toBe(4000);
        expect(actualizada!.estado).toBe('PAGO PARCIAL');

        logOk('El saldo y el estado de la cuenta se actualizaron correctamente.');
    });
});

// ============================================================
// PAGO
// ============================================================

describe('PAGO', () => {
    test('Crear y buscar un pago por ID', async () => {
        logTest('Crear y buscar pago');

        const pago = await pagoRepository.crear({
            proveedorId: PROVEEDOR_ID,
            fechaHora: new Date(),
            importe: 3500,
            importePendiente: 3500
        });

        pagosCreados.push(pago.id);

        expect(pago).toBeDefined();
        expect(pago.id).toBeGreaterThan(0);
        expect(pago.proveedorId).toBe(PROVEEDOR_ID);
        expect(Number(pago.importe)).toBe(3500);
        expect(Number(pago.importePendiente)).toBe(3500);

        const encontrado = await pagoRepository.buscarPorId(pago.id);

        expect(encontrado).not.toBeNull();
        expect(encontrado!.id).toBe(pago.id);

        logOk('El pago fue creado y encontrado correctamente.');
    });

    test('Buscar pagos por proveedor', async () => {
        logTest('Buscar pagos por proveedor');

        const resultado =
            await pagoRepository.buscarPorProveedor(PROVEEDOR_ID);

        expect(resultado).toBeDefined();

        const registros = Array.isArray(resultado)
            ? resultado
            : (resultado as { rows?: Pago[] }).rows;

        expect(Array.isArray(registros)).toBe(true);

        logOk('La búsqueda de pagos por proveedor respondió correctamente.');
    });
});

// ============================================================
// PAGO POR CUENTA
// ============================================================

describe('PAGO POR CUENTA', () => {
    test('Buscar aplicaciones de un pago y una cuenta', async () => {
        logTest('Buscar aplicación de pago por pago y cuenta');

        const compra = await compraRepository.crear({
            proveedorId: PROVEEDOR_ID,
            fechaHora: new Date(),
            total: 5000
        });

        comprasCreadas.push(compra.id);

        const cuenta = await cuentaProveedorRepository.crear({
            proveedorId: PROVEEDOR_ID,
            compraId: compra.id,
            importePendiente: 5000,
            estado: 'PAGO PENDIENTE'
        });

        cuentasCreadas.push(cuenta.id);

        const pago = await pagoRepository.crear({
            proveedorId: PROVEEDOR_ID,
            fechaHora: new Date(),
            importe: 1500,
            importePendiente: 1500
        });

        pagosCreados.push(pago.id);

        const aplicacion = await PagoPorCuenta.create({
            pagoId: pago.id,
            cuentaId: cuenta.id,
            fechaHora: new Date(),
            importeAplicado: 1500
        });

        aplicacionesCreadas.push({
            pagoId: pago.id,
            cuentaId: cuenta.id
        });

        expect(aplicacion).toBeDefined();
        expect(aplicacion.pagoId).toBe(pago.id);
        expect(aplicacion.cuentaId).toBe(cuenta.id);
        expect(Number(aplicacion.importeAplicado)).toBe(1500);

        const encontrada =
            await pagoPorCuentaRepository.buscarPorPagoYCuenta(
                pago.id,
                cuenta.id
            );

        expect(encontrada).not.toBeNull();
        expect(encontrada!.pagoId).toBe(pago.id);
        expect(encontrada!.cuentaId).toBe(cuenta.id);
        expect(Number(encontrada!.importeAplicado)).toBe(1500);

        logOk('La aplicación del pago fue encontrada correctamente.');
    });

    test('Sumar importes aplicados a un pago', async () => {
        logTest('Sumar importes aplicados por pago');

        const compra = await compraRepository.crear({
            proveedorId: PROVEEDOR_ID,
            fechaHora: new Date(),
            total: 7000
        });

        comprasCreadas.push(compra.id);

        const cuenta = await cuentaProveedorRepository.crear({
            proveedorId: PROVEEDOR_ID,
            compraId: compra.id,
            importePendiente: 7000,
            estado: 'PAGO PENDIENTE'
        });

        cuentasCreadas.push(cuenta.id);

        const pago = await pagoRepository.crear({
            proveedorId: PROVEEDOR_ID,
            fechaHora: new Date(),
            importe: 3000,
            importePendiente: 3000
        });

        pagosCreados.push(pago.id);

        await PagoPorCuenta.create({
            pagoId: pago.id,
            cuentaId: cuenta.id,
            fechaHora: new Date(),
            importeAplicado: 1000
        });

        aplicacionesCreadas.push({
            pagoId: pago.id,
            cuentaId: cuenta.id
        });

        const suma =
            await pagoPorCuentaRepository.sumarImportesAplicadosPorPago(
                pago.id
            );

        expect(Number(suma)).toBe(1000);

        logOk('La suma de importes aplicados al pago es correcta.');
    });

    test('Sumar importes aplicados a una cuenta', async () => {
        logTest('Sumar importes aplicados por cuenta');

        const compra = await compraRepository.crear({
            proveedorId: PROVEEDOR_ID,
            fechaHora: new Date(),
            total: 9000
        });

        comprasCreadas.push(compra.id);

        const cuenta = await cuentaProveedorRepository.crear({
            proveedorId: PROVEEDOR_ID,
            compraId: compra.id,
            importePendiente: 9000,
            estado: 'PAGO PENDIENTE'
        });

        cuentasCreadas.push(cuenta.id);

        const pago = await pagoRepository.crear({
            proveedorId: PROVEEDOR_ID,
            fechaHora: new Date(),
            importe: 2000,
            importePendiente: 2000
        });

        pagosCreados.push(pago.id);

        await PagoPorCuenta.create({
            pagoId: pago.id,
            cuentaId: cuenta.id,
            fechaHora: new Date(),
            importeAplicado: 1200
        });

        aplicacionesCreadas.push({
            pagoId: pago.id,
            cuentaId: cuenta.id
        });

        const suma =
            await pagoPorCuentaRepository.sumarImportesAplicadosPorCuenta(
                cuenta.id
            );

        expect(Number(suma)).toBe(1200);

        logOk('La suma de importes aplicados a la cuenta es correcta.');
    });
});
