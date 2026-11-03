
import { Op } from 'sequelize';
import type { Transaction, WhereOptions } from 'sequelize';

import BaseRepository from './BaseRepository.js';

import Producto from '../models/Producto.js';

import Compra from '../models/Compra.js';
import DetalleCompra from '../models/DetalleCompra.js';
import Recepcion from '../models/Recepcion.js';
import Proveedor from '../models/Proveedor.js';
import CuentaProveedor from '../models/CuentaProveedor.js';

class CompraRepository extends BaseRepository<Compra> {

    constructor() { super(Compra); }

    // =========================
    // BÚSQUEDAS
    // =========================

    async buscarPorId(
        id: number,
        transaction?: Transaction
    ): Promise<Compra | null> {

        return await this.findById(id, transaction);
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
                    as: 'detalles',
                    include: [{ model: Producto, as: 'producto' }]
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

    async findCompraConDetalles(
        compraId: number,
        transaction?: Transaction
    ): Promise<Compra | null> {

        return await Compra.findByPk(compraId, {
            include: [
                {
                    model: DetalleCompra,
                    as: 'detalles',
                    include: [{ model: Producto, as: 'producto' }]
                }
            ],
            transaction
        });
    }

    // Los servicios administran deuda, detalles y stock en una transacción.
    async crear(datos: Partial<Compra>, transaction?: Transaction): Promise<Compra> {
        return this.create(datos, { transaction });
    }
    async actualizar(id: number, datos: Partial<Compra>, transaction?: Transaction): Promise<Compra | null> {
        const compra = await this.findById(id, transaction);
        if (!compra) return null;
        const permitidos: Partial<Compra> = {};
        for (const campo of ['estado', 'numeroComprobante', 'claveOperacion', 'formaPago'] as const) {
            if (datos[campo] !== undefined) Object.assign(permitidos, { [campo]: datos[campo] });
        }
        return compra.update(permitidos, { transaction });
    }
}
export default CompraRepository;
