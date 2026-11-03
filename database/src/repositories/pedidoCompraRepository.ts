import { Op } from 'sequelize';
import type { Transaction, WhereOptions } from 'sequelize';

import BaseRepository from './BaseRepository.js';
import PedidoCompra from '../models/PedidoCompra.js';
import DetallePedidoCompra from '../models/DetallePedidoCompra.js';
import Producto from '../models/Producto.js';
import Proveedor from '../models/Proveedor.js';

type FiltrosPedido = {
    proveedorId?: number;
    estado?: string;
    desde?: Date;
    hasta?: Date;
};

class PedidoCompraRepository extends BaseRepository<PedidoCompra> {

    constructor() {
        super(PedidoCompra);
    }

    async crear(
        datos: Partial<PedidoCompra>,
        transaction?: Transaction
    ): Promise<PedidoCompra> {

        return await this.create(
            datos,
            { transaction }
        );
    }

    async buscarPorId(
        id: number,
        transaction?: Transaction
    ): Promise<PedidoCompra | null> {

        return await this.model.findByPk(id, {
            transaction,
            include: [
                { model: Proveedor, as: 'proveedor' }
            ]
        });
    }

    async buscarPorIdConBloqueo(
        id: number,
        transaction: Transaction
    ): Promise<PedidoCompra | null> {

        return await this.model.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });
    }

    async buscarDetalle(
        id: number,
        transaction?: Transaction
    ): Promise<PedidoCompra | null> {

        return await this.model.findByPk(id, {
            transaction,
            include: [
                { model: Proveedor, as: 'proveedor' },
                {
                    model: DetallePedidoCompra,
                    as: 'detalles',
                    include: [
                        { model: Producto, as: 'producto' }
                    ]
                }
            ]
        });
    }

    async listar(
        filtros: FiltrosPedido,
        page = 1,
        limit = 50,
        transaction?: Transaction
    ) {

        const where: WhereOptions<PedidoCompra> = {};

        if (filtros.proveedorId !== undefined) {
            where.proveedorId = filtros.proveedorId;
        }

        if (filtros.estado !== undefined) {
            where.estado = filtros.estado as PedidoCompra['estado'];
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

        return await this.model.findAndCountAll({
            where,
            include: [
                { model: Proveedor, as: 'proveedor' }
            ],
            order: [['fechaHora', 'DESC']],
            offset: (page - 1) * limit,
            limit,
            transaction
        });
    }

    async actualizarEstado(
        id: number,
        estado: PedidoCompra['estado'],
        transaction?: Transaction
    ): Promise<PedidoCompra | null> {

        return await this.updateById(
            id,
            { estado },
            transaction
        );
    }
}

export default PedidoCompraRepository;
