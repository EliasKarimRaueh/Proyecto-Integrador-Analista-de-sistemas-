import type { Transaction } from 'sequelize';

import BaseRepository from './BaseRepository.js';
import Proveedor from '../models/Proveedor.js';

class ProveedorRepository extends BaseRepository<Proveedor> {

    constructor() {
        super(Proveedor);
    }

    // =========================
    // BÚSQUEDAS
    // =========================

    async findByName(
        nombre: string,
        transaction?: Transaction
    ): Promise<Proveedor | null> {

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
        nombre: string,
        transaction?: Transaction
    ): Promise<Proveedor | null> {

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
        nombre: string,
        transaction?: Transaction
    ): Promise<Proveedor | null> {

        const proveedor = await this.findByName(
            nombre,
            transaction
        );

        if (!proveedor) {
            return null;
        }

        return await this.deleteById(
            proveedor.id,
            transaction
        );
    }
}

export default ProveedorRepository;