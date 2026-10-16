import { Op } from 'sequelize';
import type { Transaction, WhereOptions } from 'sequelize';

import sequelize from '../config/database.js';
import BaseRepository from './BaseRepository.js';
import PagoPorCuenta from '../models/PagoPorCuenta.js';
import Pago from '../models/Pago.js';
import CuentaProveedor from '../models/CuentaProveedor.js';
import Compra from '../models/Compra.js';
import CuentaProveedorRepository from './cuentaProveedorRepository.js';

class PagoPorCuentaRepository extends BaseRepository<PagoPorCuenta> {
    private cuentaProveedorRepository: CuentaProveedorRepository;

    constructor() {
        super(PagoPorCuenta);
        this.cuentaProveedorRepository = new CuentaProveedorRepository();
    }

    /**
     * Crear una aplicación entre un pago y una cuenta corriente.
     */
    async crear(
        datos: Partial<PagoPorCuenta>,
        transaction?: Transaction
    ): Promise<PagoPorCuenta> {
        return await this.create(datos, { transaction });
    }

    /**
     * Actualizar una aplicación identificada por su clave primaria compuesta.
     */
    async actualizar(
        pagoId: number,
        cuentaId: number,
        datos: Omit<
            Partial<PagoPorCuenta>,
            'pagoId' | 'cuentaId'
        >,
        transaction?: Transaction
    ): Promise<PagoPorCuenta | null> {
        const aplicacion = await this.buscarPorPagoYCuenta(
            pagoId,
            cuentaId,
            transaction
        );

        if (!aplicacion) {
            return null;
        }

        await PagoPorCuenta.update(datos, {
            where: { pagoId, cuentaId },
            transaction
        });

        return await this.buscarPorPagoYCuenta(
            pagoId,
            cuentaId,
            transaction
        );
    }

    /**
     * Buscar todas las aplicaciones de un pago.
     */
    async buscarPorPago(
        pagoId: number,
        transaction?: Transaction
    ): Promise<PagoPorCuenta[]> {
        return await PagoPorCuenta.findAll({
            where: { pagoId },
            order: [['fechaHora', 'ASC']],
            transaction
        });
    }

    /**
     * Buscar todas las aplicaciones asociadas a una cuenta.
     */
    async buscarPorCuenta(
        cuentaId: number,
        transaction?: Transaction
    ): Promise<PagoPorCuenta[]> {
        return await PagoPorCuenta.findAll({
            where: { cuentaId },
            order: [['fechaHora', 'ASC']],
            transaction
        });
    }

    /**
     * Buscar una aplicación por las dos claves.
     */
    async buscarPorPagoYCuenta(
        pagoId: number,
        cuentaId: number,
        transaction?: Transaction
    ): Promise<PagoPorCuenta | null> {
        return await PagoPorCuenta.findOne({
            where: { pagoId, cuentaId },
            transaction
        });
    }

    /**
     * Obtener todas las aplicaciones sin paginación.
     */
    async buscarTodas(
        orderBy = 'fechaHora',
        orderDirection: 'ASC' | 'DESC' = 'DESC',
        transaction?: Transaction
    ): Promise<PagoPorCuenta[]> {
        return await PagoPorCuenta.findAll({
            order: [[orderBy, orderDirection]],
            transaction
        });
    }

    /**
     * Obtener aplicaciones con paginación.
     */
    async listarPaginados(
        page = 1,
        limit = 10,
        orderBy = 'fechaHora',
        orderDirection: 'ASC' | 'DESC' = 'DESC',
        transaction?: Transaction
    ) {
        return await this.findAll(
            page,
            limit,
            orderBy,
            orderDirection,
            transaction
        );
    }

    /**
     * Buscar aplicaciones de un proveedor.
     */
    async buscarPorProveedor(
        proveedorId: number,
        page = 1,
        limit = 10,
        orderBy = 'fechaHora',
        orderDirection: 'ASC' | 'DESC' = 'DESC',
        transaction?: Transaction
    ) {
        const offset = (page - 1) * limit;

        return await PagoPorCuenta.findAndCountAll({
            include: [
                {
                    model: CuentaProveedor,
                    as: 'cuentaProveedor',
                    where: { proveedorId },
                    attributes: []
                }
            ],
            order: [[orderBy, orderDirection]],
            limit,
            offset,
            transaction
        });
    }

    /**
     * Sumar los importes aplicados a un pago.
     */
    async sumarImportesAplicadosPorPago(
        pagoId: number,
        transaction?: Transaction
    ): Promise<number> {
        const total = await PagoPorCuenta.sum('importeAplicado', {
            where: { pagoId },
            transaction
        });

        return Number(total ?? 0);
    }

    /**
     * Sumar los importes aplicados históricamente a una cuenta.
     */
    async sumarImportesAplicadosPorCuenta(
        cuentaId: number,
        transaction?: Transaction
    ): Promise<number> {
        const total = await PagoPorCuenta.sum('importeAplicado', {
            where: { cuentaId },
            transaction
        });

        return Number(total ?? 0);
    }

    /**
     * Aplicar un pago a las cuentas pendientes más antiguas del proveedor.
     *
     * Debe ejecutarse dentro de una transacción activa.
     * El pago conserva cualquier saldo que no pueda aplicarse.
     */
    async aplicarPagoAProveedor(
        pagoId: number,
        transaction: Transaction
    ): Promise<void> {
        if (!transaction) {
            throw new Error(
                'La aplicación del pago requiere una transacción activa.'
            );
        }

        // Bloquear el pago para evitar aplicaciones concurrentes.
        const pago = await Pago.findByPk(pagoId, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!pago) {
            throw new Error('No se encontró el pago indicado.');
        }

        const proveedorId = pago.proveedorId;

        let pagoPendienteCentavos = Math.round(
            Number(pago.importePendiente) * 100
        );

        if (
            !Number.isFinite(pagoPendienteCentavos) ||
            pagoPendienteCentavos < 0
        ) {
            throw new Error(
                'El saldo pendiente del pago no es válido.'
            );
        }

        while (pagoPendienteCentavos > 0) {
            // Buscar la cuenta pendiente más antigua del proveedor.
            const cuenta = await CuentaProveedor.findOne({
                where: {
                    proveedorId,
                    estado: {
                        [Op.in]: ['PAGO PENDIENTE', 'PAGO PARCIAL']
                    }
                },
                include: [
                    {
                        model: Compra,
                        as: 'compra',
                        attributes: ['id', 'fechaHora'],
                        required: true
                    }
                ],
                order: [
                    [{ model: Compra, as: 'compra' }, 'fechaHora', 'ASC'],
                    ['id', 'ASC']
                ],
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            // No quedan cuentas pendientes: conservar el saldo del pago.
            if (!cuenta) {
                break;
            }

            const saldoCuentaCentavos = Math.round(
                Number(cuenta.importePendiente) * 100
            );

            if (
                !Number.isFinite(saldoCuentaCentavos) ||
                saldoCuentaCentavos <= 0
            ) {
                throw new Error(
                    'El saldo pendiente de la cuenta no es válido.'
                );
            }

            // Aplicar el menor entre el pago disponible y la deuda.
            const importeAplicarCentavos = Math.min(
                pagoPendienteCentavos,
                saldoCuentaCentavos
            );

            const importeAplicar = importeAplicarCentavos / 100;

            // Actualizar saldo y estado de la cuenta.
            const cuentaActualizada =
                await this.cuentaProveedorRepository.actualizarSaldoYEstado(
                    cuenta.id,
                    importeAplicar,
                    transaction
                );

            if (!cuentaActualizada) {
                throw new Error(
                    `No se pudo actualizar la cuenta ${cuenta.id}.`
                );
            }

            // Registrar la aplicación del pago a la cuenta.
            await this.crear(
                {
                    pagoId,
                    cuentaId: cuenta.id,
                    importeAplicado: importeAplicar.toFixed(2)
                } as Partial<PagoPorCuenta>,
                transaction
            );

            // Actualizar el saldo pendiente del pago.
            const pagoActualizado = await Pago.findByPk(pagoId, {
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (!pagoActualizado) {
                throw new Error(
                    'No se pudo recuperar el pago durante su aplicación.'
                );
            }

            const saldoPagoActualCentavos = Math.round(
                Number(pagoActualizado.importePendiente) * 100
            );

            if (saldoPagoActualCentavos < importeAplicarCentavos) {
                throw new Error(
                    'El importe aplicado supera el saldo pendiente del pago.'
                );
            }

            const saldoPagoFinal = (
                (saldoPagoActualCentavos - importeAplicarCentavos) / 100
            ).toFixed(2);

            await pagoActualizado.update(
                { importePendiente: saldoPagoFinal },
                { transaction }
            );

            pagoPendienteCentavos =
                saldoPagoActualCentavos - importeAplicarCentavos;
        }
    }
}

export default PagoPorCuentaRepository;