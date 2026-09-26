import { Op } from 'sequelize';

import BaseRepository from './BaseRepository.js';
import Precio from '../models/Precio.js';
import sequelize from '../config/database.js';

class PrecioRepository extends BaseRepository<Precio> {

    constructor() {
        super(Precio);
    }

    // =========================
    // VIGENCIA
    // =========================

    async findAbierto(productoId: number): Promise<Precio | null> {
        return await this.findBy({
            productoId,
            fechaHasta: null,
            fechaBaja: null
        });
    }

    async findVigente(
        productoId: number,
        fecha: Date = new Date()
    ): Promise<Precio | null> {

        const precios = await this.model.findAll({
            where: {
                productoId,
                activo: true,
                [Op.and]: [
                    { fechaDesde: { [Op.lte]: fecha } },
                    {
                        [Op.or]: [
                            { fechaHasta: null },
                            { fechaHasta: { [Op.gt]: fecha } }
                        ]
                    }
                ]
            },
            order: [['fechaDesde', 'DESC']]
        });

        return precios[0] ?? null;
    }

    async findHistorial(
        productoId: number,
        page = 1,
        limit = 10
    ): Promise<Precio[]> {

        const resultado = await this.findAllBy(
            { productoId },
            page,
            limit,
            'fechaDesde',
            'DESC'
        );

        return resultado.rows;
    }

    async findByProducto(
        productoId: number,
        page = 1,
        limit = 10,
        orderBy = 'fechaDesde',
        orderDirection: 'ASC' | 'DESC' = 'DESC'
    ) {
        return await this.findAllBy(
            { productoId },
            page,
            limit,
            orderBy,
            orderDirection
        );
    }

    async findAllVigentes(
        productoIds: number[],
        fecha: Date = new Date()
    ): Promise<Precio[]> {

        if (productoIds.length === 0) {
            return [];
        }

        return await this.model.findAll({
            where: {
                productoId: { [Op.in]: productoIds },
                activo: true,
                [Op.and]: [
                    { fechaDesde: { [Op.lte]: fecha } },
                    {
                        [Op.or]: [
                            { fechaHasta: null },
                            { fechaHasta: { [Op.gt]: fecha } }
                        ]
                    }
                ]
            },
            order: [['productoId', 'ASC']]
        });
    }

    // =========================
    // ALTA CON HISTÓRICO
    // =========================

    /**
     * Registra un precio nuevo para el producto. Cierra en la misma
     * transacción cualquier precio que estuviera abierto y deja el
     * nuevo como el único vigente.
     */
    async registrarPrecio(
        productoId: number,
        precioMinorista: string,
        precioMayorista: string | null = null,
        fechaDesde: Date = new Date()
    ): Promise<Precio> {

        return await sequelize.transaction(async transaction => {

            await this.model.update(
                { fechaHasta: fechaDesde },
                {
                    where: {
                        productoId,
                        fechaHasta: null,
                        fechaBaja: null
                    },
                    // Sin validate: Sequelize arma una instancia
                    // sintética solo con fechaHasta y le aplica el
                    // defaultValue de fechaDesde, haciendo que el
                    // validador de vigencia compare contra NOW().
                    validate: false,
                    transaction
                }
            );

            return await this.model.create(
                {
                    productoId,
                    precioMinorista,
                    precioMayorista,
                    fechaDesde
                },
                { transaction }
            );
        });
    }

    async cerrarVigencia(
        id: number,
        fechaHasta: Date = new Date()
    ): Promise<Precio | null> {
        return await this.updateById(id, { fechaHasta });
    }

    // =========================
    // MODIFICACIONES
    // =========================

    async updatePrecios(
        id: number,
        precioMinorista: string,
        precioMayorista: string | null = null
    ): Promise<Precio | null> {
        return await this.updateById(id, {
            precioMinorista,
            precioMayorista
        });
    }
}

export default PrecioRepository;
