import { Op } from 'sequelize';

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
    async findByName(nombre: string): Promise<Oferta | null> {
        return await this.findBy({ nombre });
    }

    async findByIdActivo(id: number): Promise<Oferta | null> {

        const oferta = await this.findById(id);

        if (!oferta || !oferta.activo) {
            return null;
        }

        return oferta;
    }

    async findAllActivos(
        page = 1,
        limit = 10,
        orderBy = 'id',
        orderDirection: 'ASC' | 'DESC' = 'ASC'
    ) {
        return await this.findAllBy(
            { activo: true },
            page,
            limit,
            orderBy,
            orderDirection
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
        orderDirection: 'ASC' | 'DESC' = 'DESC'
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
            orderDirection
        );
    }

    async findTodasVigentes(
        fecha: Date = new Date()
    ): Promise<Oferta[]> {

        return await this.model.findAll({
            where: {
                activo: true,
                [Op.and]: [
                    { fechaInicio: { [Op.lte]: fecha } },
                    { fechaFin: { [Op.gte]: fecha } }
                ]
            },
            order: [['fechaInicio', 'DESC']]
        });
    }

    // =========================
    // MODIFICACIONES
    // =========================

    async updateNombre(
        id: number,
        nombre: string
    ): Promise<Oferta | null> {
        return await this.updateById(id, { nombre });
    }

    async updateDescripcion(
        id: number,
        descripcion: string | null
    ): Promise<Oferta | null> {
        return await this.updateById(id, { descripcion });
    }

    async updateVigencia(
        id: number,
        fechaInicio: Date,
        fechaFin: Date
    ): Promise<Oferta | null> {
        return await this.updateById(id, { fechaInicio, fechaFin });
    }

    // =========================
    // BAJA LÓGICA
    // =========================

    async deleteByName(nombre: string): Promise<Oferta | null> {

        const oferta = await this.findByName(nombre);

        if (!oferta) {
            return null;
        }

        return await this.deleteById(oferta.id);
    }
}

export default OfertaRepository;
