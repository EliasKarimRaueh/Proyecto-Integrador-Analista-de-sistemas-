import type { Transaction } from 'sequelize';

import BaseRepository from './BaseRepository.js';
import DetallePedidoCompra from '../models/DetallePedidoCompra.js';
import Producto from '../models/Producto.js';

class DetallePedidoCompraRepository extends BaseRepository<DetallePedidoCompra> {

    constructor() {
        super(DetallePedidoCompra);
    }

    async crear(
        datos: Partial<DetallePedidoCompra>,
        transaction?: Transaction
    ): Promise<DetallePedidoCompra> {

        return await this.create(
            datos,
            { transaction }
        );
    }

    async crearMuchos(
        datos: Partial<DetallePedidoCompra>[],
        transaction?: Transaction
    ): Promise<DetallePedidoCompra[]> {

        return await this.model.bulkCreate(
            datos as never[],
            { transaction }
        );
    }

    async buscarPorPedido(
        pedidoId: number,
        transaction?: Transaction
    ): Promise<DetallePedidoCompra[]> {

        return await this.model.findAll({
            where: { pedidoId },
            include: [
                { model: Producto, as: 'producto' }
            ],
            order: [['id', 'ASC']],
            transaction
        });
    }
}

export default DetallePedidoCompraRepository;
