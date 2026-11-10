import { Op } from 'sequelize';
import type { Transaction, WhereOptions } from 'sequelize';

import BaseRepository from './BaseRepository.js';
import Recepcion from '../models/Recepcion.js';
import Compra from '../models/Compra.js';
import Pedido from '../models/Pedido.js';
import Proveedor from '../models/Proveedor.js';
import DetalleRecepcion from '../models/DetalleRecepcion.js';
import MovimientoStock from '../models/MovimientoStock.js';
import Producto from '../models/Producto.js';

type FiltrosRecepcion = {
    compraId?: number;
    proveedorId?: number;
    desde?: Date;
    hasta?: Date;
};

class RecepcionRepository extends BaseRepository<Recepcion> {

    constructor() {
        super(Recepcion);
    }

    async crear(
        datos: Partial<Recepcion>,
        transaction?: Transaction
    ): Promise<Recepcion> {

        return await this.create(
            datos,
            { transaction }
        );
    }

    async buscarPorCompra(
        compraId: number,
        transaction?: Transaction
    ): Promise<Recepcion | null> {

        return await this.model.findOne({
            where: { compraId },
            transaction
        });
    }

    async buscarPorId(
        id: number,
        transaction?: Transaction
    ): Promise<Recepcion | null> {

        return await this.model.findByPk(id, {
            transaction,
            include: [
                { model: Compra, as: 'compra' },
                { model: Proveedor, as: 'proveedor' },
                { model: Pedido, as: 'pedido' },
                {
                    model: DetalleRecepcion,
                    as: 'detalles',
                    include: [
                        { model: Producto, as: 'producto' }
                    ]
                },
                {
                    model: MovimientoStock,
                    as: 'movimientosStock',
                    include: [
                        { model: Producto, as: 'producto' }
                    ]
                }
            ]
        });
    }

    async listar(
        filtros: FiltrosRecepcion,
        page = 1,
        limit = 50,
        transaction?: Transaction
    ) {

        const where: WhereOptions<Recepcion> = {};

        if (filtros.compraId !== undefined) {
            where.compraId = filtros.compraId;
        }

        if (filtros.proveedorId !== undefined) {
            where.proveedorId = filtros.proveedorId;
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
                { model: Compra, as: 'compra' },
                { model: Proveedor, as: 'proveedor' }
            ],
            order: [['fechaHora', 'DESC']],
            offset: (page - 1) * limit,
            limit,
            transaction
        });
    }
}

export default RecepcionRepository;
