import type { Transaction } from 'sequelize';

import BaseRepository from './BaseRepository.js';
import DetalleRecepcion from '../models/DetalleRecepcion.js';
import Producto from '../models/Producto.js';

class DetalleRecepcionRepository extends BaseRepository<DetalleRecepcion> {

    constructor() {
        super(DetalleRecepcion);
    }

    async crear(
        datos: Partial<DetalleRecepcion>,
        transaction?: Transaction
    ): Promise<DetalleRecepcion> {

        return await this.create(
            datos,
            { transaction }
        );
    }

    async crearMuchos(
        datos: Partial<DetalleRecepcion>[],
        transaction?: Transaction
    ): Promise<DetalleRecepcion[]> {

        return await this.model.bulkCreate(
            datos as never[],
            { transaction }
        );
    }

    async buscarPorRecepcion(
        recepcionId: number,
        transaction?: Transaction
    ): Promise<DetalleRecepcion[]> {

        return await this.model.findAll({
            where: { recepcionId },
            include: [
                { model: Producto, as: 'producto' }
            ],
            order: [['id', 'ASC']],
            transaction
        });
    }
}

export default DetalleRecepcionRepository;
