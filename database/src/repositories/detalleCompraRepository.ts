import type { Transaction } from 'sequelize';

import BaseRepository from './BaseRepository.js';
import DetalleCompra from '../models/DetalleCompra.js';
import Producto from '../models/Producto.js';

class DetalleCompraRepository extends BaseRepository<DetalleCompra> {

    constructor() {
        super(DetalleCompra);
    }

    async crear(
        datos: Partial<DetalleCompra>,
        transaction?: Transaction
    ): Promise<DetalleCompra> {

        return await this.create(
            datos,
            { transaction }
        );
    }

    async crearMuchos(
        datos: Partial<DetalleCompra>[],
        transaction?: Transaction
    ): Promise<DetalleCompra[]> {

        return await this.model.bulkCreate(
            datos as never[],
            { transaction }
        );
    }

    async buscarPorCompra(
        compraId: number,
        transaction?: Transaction
    ): Promise<DetalleCompra[]> {

        return await this.model.findAll({
            where: { compraId },
            include: [
                { model: Producto, as: 'producto' }
            ],
            order: [['id', 'ASC']],
            transaction
        });
    }
}

export default DetalleCompraRepository;
