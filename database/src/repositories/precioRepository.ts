import { Op } from 'sequelize';
import type { Transaction, WhereOptions } from 'sequelize';

import BaseRepository from './BaseRepository.js';
import Precio from '../models/Precio.js';
import sequelize from '../config/database.js';

/**
 * El precio nuevo de un producto no puede arrancar antes de que arrancó
 * el que está abierto. Si lo hiciera, el cierre le escribiría al anterior
 * una fechaHasta igual o anterior a su propia fechaDesde, y ese período
 * no tiene duración: el modelo lo rechaza y el historial queda incoherente.
 *
 * El controller lo traduce a 409 porque la salida correcta es "Corregir"
 * (que cambia los montos sin tocar la vigencia) o una fecha posterior.
 */
export class ErrorVigenciaPrecio extends Error {

    constructor(mensaje: string) {
        super(mensaje);
        this.name = 'ErrorVigenciaPrecio';
    }
}

class PrecioRepository extends BaseRepository<Precio> {

    constructor() {
        super(Precio);
    }

    // =========================
    // VIGENCIA
    // =========================

    async findAbierto(
        productoId: number,
        transaction?: Transaction
    ): Promise<Precio | null> {
        return await this.findBy(
            {
                productoId,
                fechaHasta: null,
                fechaBaja: null
            },
            transaction
        );
    }

    async findVigente(
        productoId: number,
        fecha: Date = new Date(),
        transaction?: Transaction
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
            order: [['fechaDesde', 'DESC']],
            transaction
        });

        return precios[0] ?? null;
    }

    async findHistorial(
        productoId: number,
        page = 1,
        limit = 10,
        transaction?: Transaction
    ): Promise<Precio[]> {

        const resultado = await this.findAllBy(
            { productoId },
            page,
            limit,
            'fechaDesde',
            'DESC',
            transaction
        );

        return resultado.rows;
    }

    /**
     * Lista precios de todos los productos, no de uno.
     *
     * Con vigente=true devuelve como máximo una fila por producto (el
     * precio que se aplica hoy), que es lo que necesita la columna de
     * precios del catálogo sin caer en un request por fila. Sin el
     * filtro devuelve el histórico completo de los productos que no
     * están dados de baja.
     */
    async findGlobales(
        vigente = false,
        page = 1,
        limit = 100,
        transaction?: Transaction
    ) {

        // Un precio vigente tiene que haber arrancado, no estar dado de
        // baja y no tener fecha de cierre vencida.
        const where = vigente
            ? {
                activo: true,
                [Op.and]: [
                    { fechaDesde: { [Op.lte]: new Date() } },
                    {
                        [Op.or]: [
                            { fechaHasta: null },
                            { fechaHasta: { [Op.gt]: new Date() } }
                        ]
                    }
                ]
            }
            : { activo: true };

        return await this.model.findAndCountAll({
            where: where as WhereOptions<Precio>,
            limit,
            offset: (page - 1) * limit,
            // Primero por producto y después del más nuevo al más
            // viejo, para que el vigente de cada uno quede arriba.
            order: [['productoId', 'ASC'], ['fechaDesde', 'DESC']],
            transaction
        });
    }

    async findByProducto(
        productoId: number,
        page = 1,
        limit = 10,
        orderBy = 'fechaDesde',
        orderDirection: 'ASC' | 'DESC' = 'DESC',
        transaction?: Transaction
    ) {
        return await this.findAllBy(
            { productoId },
            page,
            limit,
            orderBy,
            orderDirection,
            transaction
        );
    }

    async findAllVigentes(
        productoIds: number[],
        fecha: Date = new Date(),
        transaction?: Transaction
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
            order: [['productoId', 'ASC']],
            transaction
        });
    }

    // =========================
    // ALTA CON HISTÓRICO
    // =========================

    /**
     * Registra un precio nuevo para el producto.
     *
     * Si recibe una transacción externa, todas las operaciones se ejecutan
     * dentro de ella y no se crea una transacción nueva.
     *
     * Si no recibe una transacción, mantiene el comportamiento original:
     * crea y administra su propia transacción.
     *
     * El nuevo precio tiene que empezar después de que empezó el abierto.
     * El bloqueo evita que dos altas simultáneas pasen las dos la
     * comprobación; el índice parcial de un solo precio abierto por
     * producto sigue siendo la última red de seguridad.
     */
    async registrarPrecio(
        productoId: number,
        precioMinorista: string,
        precioMayorista: string | null = null,
        fechaDesde: Date = new Date(),
        transaction?: Transaction
    ): Promise<Precio> {

        // =========================
        // TRANSACCIÓN EXTERNA
        // =========================

        if (transaction) {

            const abierto = await this.model.findOne({
                where: {
                    productoId,
                    fechaHasta: null,
                    fechaBaja: null
                },
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (
                abierto !== null &&
                fechaDesde.getTime() <= abierto.fechaDesde.getTime()
            ) {
                throw new ErrorVigenciaPrecio(
                    `Este producto ya tiene un precio vigente desde el ${abierto.fechaDesde.toISOString().slice(0, 10)}. ` +
                    'Usá "Corregir" para cambiar el importe de hoy, o registrá el precio nuevo con una fecha posterior.'
                );
            }

            await this.model.update(
                { fechaHasta: fechaDesde },
                {
                    where: {
                        productoId,
                        fechaHasta: null,
                        fechaBaja: null
                    },
                    // validate: false es obligatorio acá, no una comodidad.
                    // Model.update arma una instancia sintética con solo
                    // fechaHasta y le aplica el defaultValue de fechaDesde,
                    // o sea NOW, así que el validador de vigencia del modelo
                    // compara contra el momento de la escritura y no contra
                    // la fecha desde real de la fila: rechaza cualquier
                    // cierre, incluso el primer precio de un producto.
                    // El validador del modelo no puede juzgar esta
                    // sentencia; la regla real es la comprobación de arriba.
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
        }

        // =========================
        // SIN TRANSACCIÓN EXTERNA
        // =========================

        return await sequelize.transaction(async transaction => {

            const abierto = await this.model.findOne({
                where: {
                    productoId,
                    fechaHasta: null,
                    fechaBaja: null
                },
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (
                abierto !== null &&
                fechaDesde.getTime() <= abierto.fechaDesde.getTime()
            ) {
                throw new ErrorVigenciaPrecio(
                    `Este producto ya tiene un precio vigente desde el ${abierto.fechaDesde.toISOString().slice(0, 10)}. ` +
                    'Usá "Corregir" para cambiar el importe de hoy, o registrá el precio nuevo con una fecha posterior.'
                );
            }

            await this.model.update(
                { fechaHasta: fechaDesde },
                {
                    where: {
                        productoId,
                        fechaHasta: null,
                        fechaBaja: null
                    },
                    // validate: false es obligatorio acá, no una comodidad.
                    // Model.update arma una instancia sintética con solo
                    // fechaHasta y le aplica el defaultValue de fechaDesde,
                    // o sea NOW, así que el validador de vigencia del modelo
                    // compara contra el momento de la escritura y no contra
                    // la fecha desde real de la fila: rechaza cualquier
                    // cierre, incluso el primer precio de un producto.
                    // El validador del modelo no puede juzgar esta
                    // sentencia; la regla real es la comprobación de arriba.
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
        fechaHasta: Date = new Date(),
        transaction?: Transaction
    ): Promise<Precio | null> {
        return await this.updateById(
            id,
            { fechaHasta },
            transaction
        );
    }

    // =========================
    // MODIFICACIONES
    // =========================

    async updatePrecios(
        id: number,
        precioMinorista: string,
        precioMayorista: string | null = null,
        transaction?: Transaction
    ): Promise<Precio | null> {
        return await this.updateById(
            id,
            {
                precioMinorista,
                precioMayorista
            },
            transaction
        );
    }
}

export default PrecioRepository;