import { Op } from 'sequelize';
import type { Transaction } from 'sequelize';

import BaseRepository from './BaseRepository.js';
import Oferta from '../models/Oferta.js';

class OfertaRepository extends BaseRepository<Oferta> {

    constructor() {
        super(Oferta);
    }

    // =========================
    // BÚSQUEDAS
    // =========================

    /**
     * Primera oferta que coincide con el nombre. ofertas.nombre no
     * tiene índice único, así que si hay dos con el mismo nombre
     * devuelve la más antigua.
     */
    async findByName(
        nombre: string,
        transaction?: Transaction
    ): Promise<Oferta | null> {
        return await this.findBy(
            { nombre },
            transaction
        );
    }

    async findByIdActivo(
        id: number,
        transaction?: Transaction
    ): Promise<Oferta | null> {

        const oferta = await this.findById(
            id,
            transaction
        );

        if (!oferta || !oferta.activo) {
            return null;
        }

        return oferta;
    }

    async findAllActivos(
        page = 1,
        limit = 10,
        orderBy = 'id',
        orderDirection: 'ASC' | 'DESC' = 'ASC',
        transaction?: Transaction
    ) {
        return await this.findAllBy(
            { activo: true },
            page,
            limit,
            orderBy,
            orderDirection,
            transaction
        );
    }

    // =========================
    // VIGENCIA
    // =========================

    /**
     * Ofertas que están dentro de su ventana de fechas en la fecha
     * indicada. No dadas de baja y con fechaInicio <= fecha <= fechaFin.
     */
    async findVigentes(
        fecha: Date = new Date(),
        page = 1,
        limit = 10,
        orderBy = 'fechaInicio',
        orderDirection: 'ASC' | 'DESC' = 'DESC',
        transaction?: Transaction
    ) {
        const where = {
            activo: true,
            [Op.and]: [
                { fechaInicio: { [Op.lte]: fecha } },
                { fechaFin: { [Op.gte]: fecha } }
            ]
        };

        return await this.findAllBy(
            where,
            page,
            limit,
            orderBy,
            orderDirection,
            transaction
        );
    }

    async findTodasVigentes(
        fecha: Date = new Date(),
        transaction?: Transaction
    ): Promise<Oferta[]> {

        return await this.model.findAll({
            where: {
                activo: true,
                [Op.and]: [
                    { fechaInicio: { [Op.lte]: fecha } },
                    { fechaFin: { [Op.gte]: fecha } }
                ]
            },
            order: [['fechaInicio', 'DESC']],
            transaction
        });
    }

    // =========================
    // MODIFICACIONES
    // =========================

    async updateNombre(
        id: number,
        nombre: string,
        transaction?: Transaction
    ): Promise<Oferta | null> {
        return await this.updateById(
            id,
            { nombre },
            transaction
        );
    }

    async updateDescripcion(
        id: number,
        descripcion: string | null,
        transaction?: Transaction
    ): Promise<Oferta | null> {
        return await this.updateById(
            id,
            { descripcion },
            transaction
        );
    }

    async updateVigencia(
        id: number,
        fechaInicio: Date,
        fechaFin: Date,
        transaction?: Transaction
    ): Promise<Oferta | null> {
        return await this.updateById(
            id,
            { fechaInicio, fechaFin },
            transaction
        );
    }

    // =========================
    // BAJA LÓGICA
    // =========================

    async deleteByName(
        nombre: string,
        transaction?: Transaction
    ): Promise<Oferta | null> {

        const oferta = await this.findByName(
            nombre,
            transaction
        );

        if (!oferta) {
            return null;
        }

        return await this.deleteById(
            oferta.id,
            transaction
        );
    }
}

export default OfertaRepository;