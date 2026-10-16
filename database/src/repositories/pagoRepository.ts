import { Op } from 'sequelize';
import type { Transaction, WhereOptions } from 'sequelize';

import sequelize from '../config/database.js';
import BaseRepository from './BaseRepository.js';
import Pago from '../models/Pago.js';
import PagoPorCuentaRepository from './pagoPorCuentaRepository.js';

class PagoRepository extends BaseRepository<Pago> {
    private pagoPorCuentaRepository: PagoPorCuentaRepository;

    constructor() {
        super(Pago);
        this.pagoPorCuentaRepository = new PagoPorCuentaRepository();
    }

    /**
     * Crear un pago.
     * El saldo pendiente de aplicar comienza siendo igual al importe.
     */
    async crear(
        datos: Partial<Pago>,
        transaction?: Transaction
    ): Promise<Pago> {
        if (datos.importe === undefined || datos.importe === null) {
            throw new Error('El importe del pago es obligatorio.');
        }

        const importe = Number(datos.importe);

        if (!Number.isFinite(importe) || importe <= 0) {
            throw new Error('El importe del pago debe ser mayor que cero.');
        }

        return await this.create(
            {
                ...datos,
                importePendiente: importe.toFixed(2)
            } as Partial<Pago>,
            { transaction }
        );
    }

    /**
     * Actualizar los campos permitidos de un pago por PK.
     */
    async actualizar(
        id: number,
        datos: Omit<Partial<Pago>, 'id' | 'importePendiente'>,
        transaction?: Transaction
    ): Promise<Pago | null> {
        return await this.updateById(id, datos, transaction);
    }

    /**
     * Buscar un pago por su clave primaria.
     */
    async buscarPorId(
        id: number,
        transaction?: Transaction
    ): Promise<Pago | null> {
        return await this.findById(id, transaction);
    }

    /**
     * Obtener todos los pagos sin paginación.
     */
    async buscarTodas(
        orderBy = 'fechaHora',
        orderDirection: 'ASC' | 'DESC' = 'DESC',
        transaction?: Transaction
    ): Promise<Pago[]> {
        return await Pago.findAll({
            order: [[orderBy, orderDirection]],
            transaction
        });
    }

    /**
     * Obtener pagos con paginación.
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
     * Buscar los pagos de un proveedor.
     */
    async buscarPorProveedor(
        proveedorId: number,
        page = 1,
        limit = 10,
        orderBy = 'fechaHora',
        orderDirection: 'ASC' | 'DESC' = 'DESC',
        transaction?: Transaction
    ) {
        return await this.findAllBy(
            { proveedorId } as WhereOptions<Pago>,
            page,
            limit,
            orderBy,
            orderDirection,
            transaction
        );
    }

    /**
     * Buscar pagos dentro de un rango de fechas.
     */
    async buscarPorFechas(
        fechaDesde: Date,
        fechaHasta: Date,
        page = 1,
        limit = 10,
        orderBy = 'fechaHora',
        orderDirection: 'ASC' | 'DESC' = 'DESC',
        transaction?: Transaction
    ) {
        return await this.findAllBy(
            {
                fechaHora: {
                    [Op.between]: [fechaDesde, fechaHasta]
                }
            } as WhereOptions<Pago>,
            page,
            limit,
            orderBy,
            orderDirection,
            transaction
        );
    }

    /**
     * Buscar pagos de un proveedor dentro de un rango de fechas.
     */
    async buscarPorProveedorYFechas(
        proveedorId: number,
        fechaDesde: Date,
        fechaHasta: Date,
        page = 1,
        limit = 10,
        orderBy = 'fechaHora',
        orderDirection: 'ASC' | 'DESC' = 'DESC',
        transaction?: Transaction
    ) {
        return await this.findAllBy(
            {
                proveedorId,
                fechaHora: {
                    [Op.between]: [fechaDesde, fechaHasta]
                }
            } as WhereOptions<Pago>,
            page,
            limit,
            orderBy,
            orderDirection,
            transaction
        );
    }

    /**
     * Buscar pagos cuyo saldo pendiente de aplicar sea mayor que cero.
     */
    async buscarConSaldoPendiente(
        page = 1,
        limit = 10,
        orderBy = 'fechaHora',
        orderDirection: 'ASC' | 'DESC' = 'ASC',
        transaction?: Transaction
    ) {
        return await this.findAllBy(
            {
                importePendiente: {
                    [Op.gt]: 0
                }
            } as WhereOptions<Pago>,
            page,
            limit,
            orderBy,
            orderDirection,
            transaction
        );
    }

    /**
     * Descontar un importe del saldo pendiente de un pago.
     * No permite que el saldo resultante sea negativo.
     */
    async actualizarSaldoPendiente(
        id: number,
        importeADescontar: number,
        transaction?: Transaction
    ): Promise<Pago | null> {
        if (
            !Number.isFinite(importeADescontar) ||
            importeADescontar <= 0
        ) {
            throw new Error(
                'El importe a descontar debe ser mayor que cero.'
            );
        }

        const pago = await Pago.findByPk(id, {
            transaction,
            ...(transaction
                ? { lock: transaction.LOCK.UPDATE }
                : {})
        });

        if (!pago) {
            return null;
        }

        const saldoActualCentavos = Math.round(
            Number(pago.importePendiente) * 100
        );

        const importeCentavos = Math.round(
            importeADescontar * 100
        );

        if (
            !Number.isFinite(saldoActualCentavos) ||
            saldoActualCentavos < 0
        ) {
            throw new Error(
                'El saldo pendiente del pago no es válido.'
            );
        }

        if (importeCentavos <= 0) {
            throw new Error(
                'El importe a descontar debe ser de al menos un centavo.'
            );
        }

        if (importeCentavos > saldoActualCentavos) {
            throw new Error(
                'El importe a descontar supera el saldo pendiente del pago.'
            );
        }

        const saldoFinal = (
            (saldoActualCentavos - importeCentavos) / 100
        ).toFixed(2);

        return await this.updateById(
            id,
            { importePendiente: saldoFinal } as Partial<Pago>,
            transaction
        );
    }

    /**
     * Obtener los pagos asociados a una cuenta corriente.
     */
    async buscarPagosPorCuenta(
        cuentaId: number,
        transaction?: Transaction
    ) {
        return await this.pagoPorCuentaRepository.buscarPorCuenta(
            cuentaId,
            transaction
        );
    }

    /**
     * Registrar un pago y aplicar su importe a las cuentas pendientes
     * del proveedor dentro de una única transacción.
     *
     * Si ocurre un error, se revierten el pago y sus aplicaciones.
     */
    async registrarPagoYAplicar(
        datos: Partial<Pago>
    ): Promise<Pago> {
        return await sequelize.transaction(async (transaction) => {
            const pago = await this.crear(datos, transaction);

            await this.pagoPorCuentaRepository.aplicarPagoAProveedor(
                pago.id,
                transaction
            );

            const pagoActualizado = await this.buscarPorId(
                pago.id,
                transaction
            );

            if (!pagoActualizado) {
                throw new Error(
                    'No se pudo recuperar el pago registrado.'
                );
            }

            return pagoActualizado;
        });
    }
}

export default PagoRepository;