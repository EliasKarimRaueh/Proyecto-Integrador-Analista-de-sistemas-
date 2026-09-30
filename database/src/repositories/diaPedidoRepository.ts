import type { Transaction } from 'sequelize';

import BaseRepository from './BaseRepository.js';
import DiaPedido from '../models/DiaPedido.js';

class DiaPedidoRepository extends BaseRepository<DiaPedido> {

    constructor() {
        super(DiaPedido);
    }

    // =========================
    // BÚSQUEDAS
    // =========================

    async findByName(
        nombre: DiaPedido['nombre'],
        transaction?: Transaction
    ): Promise<DiaPedido | null> {

        return await this.findBy(
            { nombre },
            transaction
        );
    }

    // =========================
    // ACTUALIZACIONES
    // =========================

    async updateNombre(
        id: number,
        nombre: DiaPedido['nombre'],
        transaction?: Transaction
    ): Promise<DiaPedido | null> {

        return await this.updateById(
            id,
            { nombre },
            transaction
        );
    }

    // =========================
    // BAJA LÓGICA
    // =========================

    async deleteByName(
        nombre: DiaPedido['nombre'],
        transaction?: Transaction
    ): Promise<DiaPedido | null> {

        const diaPedido = await this.findByName(
            nombre,
            transaction
        );

        if (!diaPedido) {
            return null;
        }

        return await this.deleteById(
            diaPedido.id,
            transaction
        );
    }
}

export default DiaPedidoRepository;