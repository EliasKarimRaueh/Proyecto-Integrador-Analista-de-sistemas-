import { Op } from 'sequelize';
import type { Transaction, WhereOptions } from 'sequelize';

import BaseRepository from './BaseRepository.js';
import Compra from '../models/Compra.js';
import DetalleCompra from '../models/DetalleCompra.js';
import Recepcion from '../models/Recepcion.js';
import Proveedor from '../models/Proveedor.js';
import CuentaProveedor from '../models/CuentaProveedor.js';

class CompraRepository extends BaseRepository<Compra> {

    constructor() {
        super(Compra);
    }

    // =========================
    // BÚSQUEDAS
    // =========================

    /**
     * Busca una compra por su clave primaria.
     */
    async buscarPorId(
        id: number,
        transaction?: Transaction
    ): Promise<Compra | null> {

        return await this.findById(
            id,
            transaction
        );
    }

    async buscarPorIdConBloqueo(
        id: number,
        transaction: Transaction
    ): Promise<Compra | null> {

        return await Compra.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });
    }

    async buscarDetalleCompleto(
        id: number,
        transaction?: Transaction
    ): Promise<Compra | null> {

        return await Compra.findByPk(id, {
            transaction,
            include: [
                { model: Proveedor, as: 'proveedor' },
                { model: CuentaProveedor, as: 'cuentaProveedor' },
                { model: Recepcion, as: 'recepcion' },
                {
                    model: DetalleCompra,
                    as: 'detalles'
                }
            ]
        });
    }

    async listarConFiltros(
        filtros: {
            proveedorId?: number;
            estado?: string;
            desde?: Date;
            hasta?: Date;
        },
        page = 1,
        limit = 50,
        transaction?: Transaction
    ) {

        const where: WhereOptions<Compra> = {};

        if (filtros.proveedorId !== undefined) {
            where.proveedorId = filtros.proveedorId;
        }

        if (filtros.estado !== undefined) {
            where.estado = filtros.estado as Compra['estado'];
        }

        if (filtros.desde && filtros.hasta) {
            where.fechaHora = {
                [Op.between]: [filtros.desde, filtros.hasta]
            };
        } else if (filtros.desde) {
            where.fechaHora = { [Op.gte]: filtros.desde };
        } else if (filtros.hasta) {
            where.fechaHora = { [Op.lte]: filtros.hasta };
        }

        return await Compra.findAndCountAll({
            where,
            include: [
                { model: Proveedor, as: 'proveedor' },
                { model: Recepcion, as: 'recepcion' }
            ],
            order: [['fechaHora', 'DESC']],
            offset: (page - 1) * limit,
            limit,
            transaction
        });
    }

    /**
     * Busca todas las compras sin aplicar paginaci��n.
     */
    async buscarTodas(
        orderBy = 'fechaHora',
        orderDirection: 'ASC' | 'DESC' = 'DESC',
        transaction?: Transaction
    ): Promise<Compra[]> {

        return await Compra.findAll({
            order: [[orderBy, orderDirection]],
            transaction
        });
    }

    /**
     * Busca compras de un proveedor determinado.
     * Los resultados se devuelven paginados.
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
            { proveedorId } as WhereOptions<Compra>,
            page,
            limit,
            orderBy,
            orderDirection,
            transaction
        );
    }

    /**
     * Busca compras realizadas dentro de un rango de fechas,
     * incluyendo los extremos del intervalo.
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
            } as WhereOptions<Compra>,
            page,
            limit,
            orderBy,
            orderDirection,
            transaction
        );
    }

    /**
     * Busca compras de un proveedor dentro de un rango de fechas,
     * incluyendo los extremos del intervalo.
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
            } as WhereOptions<Compra>,
            page,
            limit,
            orderBy,
            orderDirection,
            transaction
        );
    }

    // =========================
    // CREACIÓN
    // =========================

    /**
     * Registra una nueva compra.
     */
    async crear(
        datos: Partial<Compra>,
        transaction?: Transaction
    ): Promise<Compra> {

        return await this.create(
            datos,
            { transaction }
        );
    }

    // =========================
    // ACTUALIZACIONES
    // =========================

    /**
     * Modifica una compra existente por su clave primaria.
     * Devuelve null si la compra no existe.
     */
    async actualizar(
        id: number,
        datos: Partial<Compra>,
        transaction?: Transaction
    ): Promise<Compra | null> {

        return await this.updateById(
            id,
            datos,
            transaction
        );
    }
}

export default CompraRepository;