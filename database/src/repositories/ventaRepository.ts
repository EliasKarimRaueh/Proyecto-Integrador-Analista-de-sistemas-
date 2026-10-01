import sequelize from '../config/database.js';
import { Op } from 'sequelize';
import type { Transaction } from 'sequelize';

import BaseRepository from './BaseRepository.js';
import Venta from '../models/Venta.js';
import DetalleVenta from '../models/DetalleVenta.js';
import DetalleVentaRepository from './detalleVentaRepository.js';
import MovimientoStockRepository from './movimientoStockRepository.js';
import OfertaProductoRepository from './ofertaProductoRepository.js';

class VentaRepository extends BaseRepository<Venta> {

    private detalleVentaRepository: DetalleVentaRepository;
    private movimientoStockRepository: MovimientoStockRepository;
    private ofertaProductoRepository: OfertaProductoRepository;

    constructor() {
        super(Venta);

        this.detalleVentaRepository = new DetalleVentaRepository();
        this.movimientoStockRepository = new MovimientoStockRepository();
        this.ofertaProductoRepository = new OfertaProductoRepository();
    }

    // =========================
    // BÚSQUEDAS
    // =========================

    /**
     * Cuenta las ventas.
     *
     * Sin fechas, devuelve la cantidad total de ventas.
     *
     * Si se especifica fechaDesde y/o fechaHasta, cuenta únicamente
     * las ventas que se encuentran dentro del período indicado.
     *
     * Las fechas límite se consideran incluidas en la búsqueda.
     */
    async countVentas(
        fechaDesde?: Date,
        fechaHasta?: Date,
        transaction?: Transaction
    ): Promise<number> {

        const where: any = {};

        if (fechaDesde || fechaHasta) {
            where.fechaHora = {};

            if (fechaDesde) {
                where.fechaHora[Op.gte] = fechaDesde;
            }

            if (fechaHasta) {
                where.fechaHora[Op.lte] = fechaHasta;
            }
        }

        return this.count(where, transaction);
    }

    /**
     * Busca una venta específica junto con todos sus detalles asociados.
     *
     * Los detalles son obtenidos mediante DetalleVentaRepository,
     * utilizando findAllByVenta(), por lo que no se aplica paginación
     * a los detalles de la venta.
     */
    async findVentaConDetalles(
        id: number,
        transaction?: Transaction
    ): Promise<{
        venta: Venta | null;
        detalles: DetalleVenta[];
    }> {

        const venta = await this.findById(id, transaction);

        if (!venta) {
            return {
                venta: null,
                detalles: []
            };
        }

        const detalles =
            await this.detalleVentaRepository.findAllByVenta(
                id,
                transaction
            );

        return {
            venta,
            detalles
        };
    }

    /**
     * Busca todas las ventas de forma paginada.
     *
     * Si no se especifican fechas, devuelve todas las ventas.
     *
     * fechaDesde y fechaHasta permiten limitar la búsqueda a un
     * período determinado. Ambas fechas son incluidas dentro del
     * período de búsqueda.
     *
     * incluirDetalles permite obtener, además de cada venta,
     * todos sus detalles asociados. Los detalles son obtenidos
     * mediante DetalleVentaRepository y no se encuentran paginados.
     */
    async findAllVentas(
        page: number = 1,
        limit: number = 10,
        fechaDesde?: Date,
        fechaHasta?: Date,
        incluirDetalles: boolean = false,
        transaction?: Transaction
    ): Promise<{
        rows: Array<{
            venta: Venta;
            detalles?: DetalleVenta[];
        }>;
        count: number;
    }> {

        const where: any = {};

        if (fechaDesde || fechaHasta) {
            where.fechaHora = {};

            if (fechaDesde) {
                where.fechaHora[Op.gte] = fechaDesde;
            }

            if (fechaHasta) {
                where.fechaHora[Op.lte] = fechaHasta;
            }
        }

        const resultado = await this.findAllBy(
            where,
            page,
            limit,
            'fechaHora',
            'DESC',
            transaction
        );

        if (!incluirDetalles) {
            return {
                rows: resultado.rows.map(venta => ({ venta })),
                count: resultado.count
            };
        }

        const rows = await Promise.all(
            resultado.rows.map(async venta => ({
                venta,
                detalles: await this.detalleVentaRepository.findAllByVenta(
                    venta.id,
                    transaction
                )
            }))
        );

        return {
            rows,
            count: resultado.count
        };
    }

    // =========================
    // ACTUALIZAR TOTAL
    // =========================

    /**
    * Recalcula y actualiza el total de una venta
    * a partir de los subtotales de todos sus detalles.
    * Util para la visualizacion del importe de la venta
    * a medida que se agregan detalles
    */
    async actualizarTotal(
        ventaId: number,
        transaction?: Transaction
    ): Promise<Venta> {

        const detalles = await this.detalleVentaRepository.findAllByVenta(
            ventaId,
            transaction
        );

        const total = detalles.reduce(
            (acumulado, detalle) => acumulado + Number(detalle.subtotal),
            0
        );

        const venta = await this.findById(ventaId, transaction);

        if (venta === null) {
            throw new Error(
                `No existe la venta con id ${ventaId}.`
            );
        }

        await venta.update(
            { total },
            { transaction }
        );

        return venta;
    }

    // =========================
    // FUNCIONES AUXILIARES PARA LA TRANSACCION DE LA VENTA
    //=========================

    /**
    * Inicia una nueva venta.
    *
    * Abre una transacción que permanecerá abierta mientras
    * el usuario agrega los detalles de la venta.
    *
    * La venta se crea dentro de esa transacción con total 0.
    *
    * Si la creación falla, se hace rollback de la transacción.
    *
    * La transacción queda a cargo del gestor, que deberá:
    * - confirmarla mediante confirmarVenta()
    * - o cancelarla mediante cancelarVenta()
    */
    async iniciarVenta(): Promise<{
        venta: Venta;
        transaction: Transaction;
    }> {
        const transaction = await sequelize.transaction();

        try {
            const venta = await Venta.create(
                {
                    fechaHora: new Date(),
                    total: 0
                },
                {
                    transaction
                }
            );

            return {
                venta,
                transaction
            };

        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
    * Agrega un detalle a una venta existente y actualiza su total.
    *
    * Utiliza un savepoint dentro de la transacción principal para que,
    * si falla la creación del detalle o la actualización del total,
    * solamente se revierta esta operación.
    *
    * La transacción principal permanece abierta para que el usuario
    * pueda corregir el error e intentar nuevamente.
    */
    async agregarDetalle(
        ventaId: number,
        cantidad: number,
        transaction: Transaction,
        productoId?: number,
        ofertaId?: number,
        tipoPrecio: 'MINORISTA' | 'MAYORISTA' = 'MINORISTA',

    ): Promise<DetalleVenta> {

        return await sequelize.transaction(
            { transaction },
            async (savepoint) => {

                const detalle =
                    await this.detalleVentaRepository.createDetalle(
                        ventaId,
                        cantidad,
                        productoId,
                        ofertaId,
                        tipoPrecio,
                        savepoint
                    );

                await this.actualizarTotal(
                    ventaId,
                    savepoint
                );

                return detalle;
            }
        );
    }

    /**
    * Cancela una venta en proceso.
    *
    * Hace rollback de la transacción principal, eliminando
    * todos los cambios realizados durante el armado de la venta,
    * incluyendo la Venta y sus DetalleVenta.
    */
    async cancelarVenta(
        transaction: Transaction
    ): Promise<void> {

        await transaction.rollback();
    }

    /**
    * Confirma una venta que se encuentra en una transacción abierta.
    *
    * Recorre todos los detalles de la venta y registra los egresos
    * correspondientes en el stock.
    *
    * Si el detalle corresponde a un producto, registra un único
    * movimiento de egreso por la cantidad vendida.
    *
    * Si el detalle corresponde a una oferta, obtiene todos los
    * productos que componen la oferta y registra un movimiento
    * de egreso por cada producto, calculando la cantidad según
    * la cantidad de unidades vendidas de la oferta.
    *
    * Todos los movimientos utilizan la misma transacción recibida.
    *
    * Si todas las operaciones finalizan correctamente, se hace
    * commit de la transacción.
    *
    * Si alguna operación falla, se hace rollback de toda la venta.
    */
    async confirmarVenta(
        ventaId: number,
        usuarioId: number,
        transaction: Transaction
    ): Promise<Venta> {

        try {

            // Buscamos todos los detalles de la venta.
            const detalles =
                await this.detalleVentaRepository.findAllByVenta(
                    ventaId,
                    transaction
                );

            // Procesamos cada detalle de la venta.
            for (const detalle of detalles) {

                // =========================
                // DETALLE DE PRODUCTO
                // =========================

                if (detalle.productoId !== null) {

                    await this.movimientoStockRepository.registrarEgreso(
                        detalle.productoId,
                        detalle.cantidad,
                        usuarioId,
                        null,
                        ventaId,
                        transaction
                    );
                }

                // =========================
                // DETALLE DE OFERTA
                // =========================

                else if (detalle.ofertaId !== null) {

                    const productosOferta =
                        await this.ofertaProductoRepository.listarDetalleProductos(
                            detalle.ofertaId,
                            true,
                            transaction
                        );

                    for (const item of productosOferta) {

                        const cantidadMovimiento =
                            detalle.cantidad * item.relacion.cantidad;

                        await this.movimientoStockRepository.registrarEgreso(
                            item.producto.id,
                            cantidadMovimiento,
                            usuarioId,
                            null,
                            ventaId,
                            transaction
                        );
                    }
                }
            }

            // Buscamos nuevamente la venta para devolver
            // la instancia actualizada dentro de la transacción.
            const venta = await Venta.findByPk(
                ventaId,
                {
                    transaction
                }
            );

            if (!venta) {
                throw new Error(
                    `No existe la venta con id ${ventaId}.`
                );
            }

            // Todo salió correctamente.
            // Confirmamos definitivamente la venta.
            await transaction.commit();

            return venta;

        } catch (error) {

            // Si algo falla, se revierte toda la transacción.
            // Esto elimina la Venta, sus DetalleVenta y cualquier
            // movimiento de stock generado durante esta operación.
            await transaction.rollback();

            throw error;
        }
    }
}

export default VentaRepository;