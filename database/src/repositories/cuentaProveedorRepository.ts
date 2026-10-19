
import { Op } from 'sequelize';
import type { Transaction, WhereOptions } from 'sequelize';

import BaseRepository from './BaseRepository.js';
import CuentaProveedor from '../models/CuentaProveedor.js';
import PagoPorCuenta from '../models/PagoPorCuenta.js';

type EstadoCuentaProveedor =
    | 'PAGO PENDIENTE'
    | 'PAGO PARCIAL'
    | 'PAGADO';

type FiltroEstadoCuenta = 'TODAS' | 'PAGADO' | 'NO_PAGADO';

class CuentaProveedorRepository extends BaseRepository<CuentaProveedor> {
    constructor() {
        super(CuentaProveedor);
    }

    /**
     * Crear una cuenta corriente asociada a una compra y un proveedor.
     */
    async crear(
        datos: Partial<CuentaProveedor>,
        transaction?: Transaction
    ): Promise<CuentaProveedor> {
        return await this.create(datos, { transaction });
    }

    /**
     * Actualizar los campos de una cuenta corriente por PK.
     */
    async actualizar(
        id: number,
        datos: Omit<Partial<CuentaProveedor>, 'id'>,
        transaction?: Transaction
    ): Promise<CuentaProveedor | null> {
        return await this.updateById(id, datos, transaction);
    }

    /**
     * Buscar una cuenta corriente por su clave primaria.
     */
    async buscarPorId(
        id: number,
        transaction?: Transaction
    ): Promise<CuentaProveedor | null> {
        return await this.findById(id, transaction);
    }

    /**
     * Obtener todas las cuentas corrientes sin paginación.
     */
    async buscarTodas(
        orderBy = 'id',
        orderDirection: 'ASC' | 'DESC' = 'ASC',
        transaction?: Transaction
    ): Promise<CuentaProveedor[]> {
        return await CuentaProveedor.findAll({
            order: [[orderBy, orderDirection]],
            transaction
        });
    }

    /**
     * Obtener las cuentas corrientes con paginación.
     */
    async listarPaginados(
        page = 1,
        limit = 10,
        orderBy = 'id',
        orderDirection: 'ASC' | 'DESC' = 'ASC',
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
     * Buscar las cuentas de un proveedor con paginación
     * y filtro opcional de estado:
     *
     * TODAS: todas las cuentas del proveedor.
     * PAGADO: únicamente las cuentas pagadas.
     * NO_PAGADO: cuentas pendientes y parcialmente pagadas.
     */
    async buscarPorProveedor(
        proveedorId: number,
        estado: FiltroEstadoCuenta = 'TODAS',
        page = 1,
        limit = 10,
        orderBy = 'id',
        orderDirection: 'ASC' | 'DESC' = 'ASC',
        transaction?: Transaction
    ) {
        const where: WhereOptions<CuentaProveedor> = {
            proveedorId
        };

        if (estado === 'PAGADO') {
            Object.assign(where, {
                estado: 'PAGADO'
            });
        } else if (estado === 'NO_PAGADO') {
            Object.assign(where, {
                estado: {
                    [Op.in]: ['PAGO PENDIENTE', 'PAGO PARCIAL']
                }
            });
        }

        return await this.findAllBy(
            where,
            page,
            limit,
            orderBy,
            orderDirection,
            transaction
        );
    }

    /**
     * Buscar la cuenta corriente asociada a una compra.
     * Como compraId es único, devuelve una cuenta o null.
     */
    async buscarPorCompra(
        compraId: number,
        transaction?: Transaction
    ): Promise<CuentaProveedor | null> {
        return await this.findBy(
            { compraId },
            transaction
        );
    }

    /**
     * Buscar cuentas corrientes por un estado concreto.
     */
    async buscarPorEstado(
        estado: EstadoCuentaProveedor,
        page = 1,
        limit = 10,
        orderBy = 'id',
        orderDirection: 'ASC' | 'DESC' = 'ASC',
        transaction?: Transaction
    ) {
        return await this.findAllBy(
            { estado } as WhereOptions<CuentaProveedor>,
            page,
            limit,
            orderBy,
            orderDirection,
            transaction
        );
    }

    /**
     * Buscar cuentas pendientes y parcialmente pagadas
     * de un proveedor.
     */
    async buscarPendientesPorProveedor(
        proveedorId: number,
        page = 1,
        limit = 10,
        orderBy = 'id',
        orderDirection: 'ASC' | 'DESC' = 'ASC',
        transaction?: Transaction
    ) {
        return await this.findAllBy(
            {
                proveedorId,
                estado: {
                    [Op.in]: ['PAGO PENDIENTE', 'PAGO PARCIAL']
                }
            } as WhereOptions<CuentaProveedor>,
            page,
            limit,
            orderBy,
            orderDirection,
            transaction
        );
    }

    /**
     * Buscar únicamente las cuentas pagadas de un proveedor.
     */
    async buscarPagadasPorProveedor(
        proveedorId: number,
        page = 1,
        limit = 10,
        orderBy = 'id',
        orderDirection: 'ASC' | 'DESC' = 'ASC',
        transaction?: Transaction
    ) {
        return await this.findAllBy(
            {
                proveedorId,
                estado: 'PAGADO'
            } as WhereOptions<CuentaProveedor>,
            page,
            limit,
            orderBy,
            orderDirection,
            transaction
        );
    }

    /**
     * Descontar un importe del saldo pendiente y actualizar
     * automáticamente el estado de la cuenta.
     *
     * Si el saldo final es cero: PAGADO.
     * Si el saldo final es mayor que cero: PAGO PARCIAL.
     */
    async actualizarSaldoYEstado(
        id: number,
        importeADescontar: number,
        transaction?: Transaction
    ): Promise<CuentaProveedor | null> {
        if (
            !Number.isFinite(importeADescontar) ||
            importeADescontar <= 0
        ) {
            throw new Error(
                'El importe a descontar debe ser un número mayor que cero.'
            );
        }

        const cuenta = await this.buscarPorId(id, transaction);

        if (!cuenta) {
            return null;
        }

        const saldoActual = Number(cuenta.importePendiente);

        if (!Number.isFinite(saldoActual) || saldoActual < 0) {
            throw new Error(
                'El saldo pendiente de la cuenta no es válido.'
            );
        }

        // Trabajar en centavos para reducir errores de precisión.
        const saldoActualCentavos = Math.round(saldoActual * 100);
        const importeCentavos = Math.round(importeADescontar * 100);

        if (importeCentavos <= 0) {
            throw new Error(
                'El importe a descontar debe ser de al menos un centavo.'
            );
        }

        if (importeCentavos > saldoActualCentavos) {
            throw new Error(
                'El importe a descontar no puede superar el saldo pendiente.'
            );
        }

        const saldoFinalCentavos =
            saldoActualCentavos - importeCentavos;

        const importePendiente = saldoFinalCentavos / 100;

        const estado: EstadoCuentaProveedor =
            saldoFinalCentavos === 0
                ? 'PAGADO'
                : 'PAGO PARCIAL';

        return await this.updateById(
            id,
            {
                importePendiente,
                estado
            },
            transaction
        );
    }

    /**
     * Consultar los registros de pagos aplicados a una cuenta.
     * La consulta se realiza directamente sobre el modelo para
     * evitar instanciar PagoPorCuentaRepository y crear un ciclo.
     */
    async buscarPagosAplicados(
        cuentaId: number,
        transaction?: Transaction
    ): Promise<PagoPorCuenta[]> {
        return await PagoPorCuenta.findAll({
            where: { cuentaId },
            order: [['fechaHora', 'ASC']],
            transaction
        });
    }
}

export default CuentaProveedorRepository;
