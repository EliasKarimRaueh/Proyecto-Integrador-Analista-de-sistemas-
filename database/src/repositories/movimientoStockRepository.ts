import type { Transaction, WhereOptions } from 'sequelize';

import sequelize from '../config/database.js';
import BaseRepository from './BaseRepository.js';
import MovimientoStock from '../models/MovimientoStock.js';
import Producto from '../models/Producto.js';

class MovimientoStockRepository extends BaseRepository<MovimientoStock> {

    constructor() {
        super(MovimientoStock);
    }

    // =========================
    // BÚSQUEDAS
    // =========================

    /**
     * Consulta los movimientos de stock de forma paginada.
     *
     * Todos los filtros son opcionales.
     */
    async consultarMovimientos(
        page: number,
        limit: number,
        productoId?: number,
        tipo?: 'INGRESO' | 'EGRESO',
        ventaId?: number,
        compraId?: number,
        transaction?: Transaction
    ): Promise<{ rows: MovimientoStock[]; count: number }> {

        const where: WhereOptions<MovimientoStock> = {};

        if (productoId !== undefined) {
            where.productoId = productoId;
        }

        if (tipo !== undefined) {
            where.tipo = tipo;
        }

        if (ventaId !== undefined) {
            where.ventaId = ventaId;
        }

        if (compraId !== undefined) {
            where.compraId = compraId;
        }

        return await this.findAllBy(
            where,
            page,
            limit,
            'fechaHora',
            'DESC',
            transaction
        );
    }

    /**
     * Busca un movimiento específico por producto y número de movimiento.
     */
    async findByProductoAndNumero(
        productoId: number,
        numeroMovimiento: number,
        transaction?: Transaction
    ): Promise<MovimientoStock | null> {

        return await this.findBy(
            {
                productoId,
                numeroMovimiento
            },
            transaction
        );
    }

    /**
     * Obtiene el último movimiento registrado para un producto.
     */
    async findUltimoMovimiento(
        productoId: number,
        transaction?: Transaction
    ): Promise<MovimientoStock | null> {

        const resultado = await this.findAllBy(
            { productoId },
            1,
            1,
            'numeroMovimiento',
            'DESC',
            transaction
        );

        return resultado.rows[0] ?? null;
    }

    // =========================
    // INGRESO DE STOCK
    // =========================

    /**
     * Registra un ingreso de stock.
     *
     * Si se recibe una transacción externa, se utiliza esa transacción.
     * Si no se recibe, se crea una nueva transacción.
     */
    async registrarIngreso(
        productoId: number,
        cantidad: number,
        usuarioId: number,
        motivo: string | null = null,
        compraId: number | null = null,
        transaction?: Transaction
    ): Promise<MovimientoStock> {

        if (transaction) {
            return await this.registrarMovimiento(
                productoId,
                'INGRESO',
                cantidad,
                usuarioId,
                motivo,
                null,
                compraId,
                transaction
            );
        }

        return await sequelize.transaction(async transaction => {
            return await this.registrarMovimiento(
                productoId,
                'INGRESO',
                cantidad,
                usuarioId,
                motivo,
                null,
                compraId,
                transaction
            );
        });
    }

    // =========================
    // EGRESO DE STOCK
    // =========================

    /**
     * Registra un egreso de stock.
     *
     * Si se recibe una transacción externa, se utiliza esa transacción.
     * Si no se recibe, se crea una nueva transacción.
     */
    async registrarEgreso(
        productoId: number,
        cantidad: number,
        usuarioId: number,
        motivo: string | null = null,
        ventaId: number | null = null,
        transaction?: Transaction
    ): Promise<MovimientoStock> {

        if (transaction) {
            return await this.registrarMovimiento(
                productoId,
                'EGRESO',
                cantidad,
                usuarioId,
                motivo,
                ventaId,
                null,
                transaction
            );
        }

        return await sequelize.transaction(async transaction => {
            return await this.registrarMovimiento(
                productoId,
                'EGRESO',
                cantidad,
                usuarioId,
                motivo,
                ventaId,
                null,
                transaction
            );
        });
    }

    // =========================
    // MERMA
    // =========================

    /**
     * Registra una merma.
     *
     * La merma siempre representa un egreso y utiliza
     * el motivo fijo "MERMA".
     */
    async registrarMerma(
        productoId: number,
        cantidad: number,
        usuarioId: number,
        transaction?: Transaction
    ): Promise<MovimientoStock> {

        return await this.registrarEgreso(
            productoId,
            cantidad,
            usuarioId,
            'MERMA',
            null,
            transaction
        );
    }

    // =========================
    // PÉRDIDA DE MERCADERÍA
    // =========================

    /**
     * Registra una pérdida de mercadería.
     *
     * La pérdida siempre representa un egreso y utiliza
     * el motivo fijo "PERDIDA_MERCADERIA".
     */
    async registrarPerdida(
        productoId: number,
        cantidad: number,
        usuarioId: number,
        transaction?: Transaction
    ): Promise<MovimientoStock> {

        return await this.registrarEgreso(
            productoId,
            cantidad,
            usuarioId,
            'PERDIDA_MERCADERIA',
            null,
            transaction
        );
    }

    // =========================
    // AJUSTE DE STOCK
    // =========================

    /**
     * Ajusta el stock actual de un producto a un valor objetivo.
     *
     * Si el stock objetivo es mayor al actual, se registra un INGRESO.
     * Si es menor, se registra un EGRESO.
     * Si ambos valores son iguales, no se genera ningún movimiento.
     */
    async ajustarStock(
        productoId: number,
        stockObjetivo: number,
        usuarioId: number,
        motivo: string | null = 'AJUSTE',
        transaction?: Transaction
    ): Promise<MovimientoStock | null> {

        if (transaction) {
            return await this.ajustarStockInterno(
                productoId,
                stockObjetivo,
                usuarioId,
                motivo,
                transaction
            );
        }

        return await sequelize.transaction(async transaction => {
            return await this.ajustarStockInterno(
                productoId,
                stockObjetivo,
                usuarioId,
                motivo,
                transaction
            );
        });
    }

    // =========================
    // MÉTODOS INTERNOS
    // =========================

    /**
     * Registra un movimiento y actualiza el stock del producto
     * dentro de la misma transacción.
     */
    private async registrarMovimiento(
        productoId: number,
        tipo: 'INGRESO' | 'EGRESO',
        cantidad: number,
        usuarioId: number,
        motivo: string | null,
        ventaId: number | null,
        compraId: number | null,
        transaction: Transaction
    ): Promise<MovimientoStock> {

        if (!Number.isFinite(cantidad) || cantidad <= 0) {
            throw new Error(
                'La cantidad del movimiento debe ser mayor que cero.'
            );
        }

        // Bloqueamos el producto para evitar modificaciones
        // concurrentes sobre su stock.
        const producto = await Producto.findByPk(
            productoId,
            {
                transaction,
                lock: transaction.LOCK.UPDATE
            }
        );

        if (!producto) {
            throw new Error(
                `No existe el producto con id ${productoId}.`
            );
        }

        if (!producto.activo) {
            throw new Error(
                'No se puede modificar el stock de un producto inactivo.'
            );
        }

        const cantInicial = producto.stockActual;

        const cantFinal =
            tipo === 'INGRESO'
                ? cantInicial + cantidad
                : cantInicial - cantidad;

        // Si margenStock es null no existe una restricción
        // sobre cuánto puede caer el stock.
        if (
            producto.margenStock !== null &&
            cantFinal < -producto.margenStock
        ) {
            throw new Error(
                `El movimiento dejaría el stock en ${cantFinal}, ` +
                `superando el margen de stock permitido ` +
                `(${producto.margenStock}).`
            );
        }

        const numeroMovimiento =
            await this.getSiguienteNumeroMovimiento(
                productoId,
                transaction
            );

        // Actualizamos el stock del producto.
        await producto.update(
            {
                stockActual: cantFinal
            },
            {
                transaction
            }
        );

        // Registramos el movimiento utilizando la misma transacción.
        return await this.create(
            {
                productoId,
                numeroMovimiento,
                ventaId,
                compraId,
                tipo,
                cantInicial,
                cantMovimiento: cantidad,
                cantFinal,
                fechaHora: new Date(),
                usuarioId,
                motivo
            },
            {
                transaction
            }
        );
    }

    /**
     * Obtiene el siguiente número de movimiento para un producto.
     *
     * El número es secuencial por producto.
     *
     * El producto debe encontrarse bloqueado dentro de la transacción
     * antes de llamar a este método para evitar condiciones de carrera.
     */
    private async getSiguienteNumeroMovimiento(
        productoId: number,
        transaction: Transaction
    ): Promise<number> {

        const ultimoMovimiento = await MovimientoStock.findOne(
            {
                where: {
                    productoId
                },
                order: [
                    ['numeroMovimiento', 'DESC']
                ],
                transaction
            }
        );

        return ultimoMovimiento
            ? ultimoMovimiento.numeroMovimiento + 1
            : 1;
    }

    /**
     * Implementación interna del ajuste de stock.
     */
    private async ajustarStockInterno(
        productoId: number,
        stockObjetivo: number,
        usuarioId: number,
        motivo: string | null,
        transaction: Transaction
    ): Promise<MovimientoStock | null> {

        if (!Number.isFinite(stockObjetivo)) {
            throw new Error('El stock objetivo debe ser finito.');
        }
        const producto = await Producto.findByPk(
            productoId,
            {
                transaction,
                lock: transaction.LOCK.UPDATE
            }
        );

        if (!producto) {
            throw new Error(
                `No existe el producto con id ${productoId}.`
            );
        }

        if (!producto.activo) {
            throw new Error(
                'No se puede modificar el stock de un producto inactivo.'
            );
        }

        const stockActual = producto.stockActual;

        // Si margenStock es null no existe restricción.
        if (
            producto.margenStock !== null &&
            stockObjetivo < -producto.margenStock
        ) {
            throw new Error(
                `El stock objetivo (${stockObjetivo}) supera ` +
                `el margen de stock permitido ` +
                `(${producto.margenStock}).`
            );
        }

        // No hay nada que ajustar.
        if (stockObjetivo === stockActual) {
            return null;
        }

        const tipo =
            stockObjetivo > stockActual
                ? 'INGRESO'
                : 'EGRESO';

        const cantidad =
            Math.abs(stockObjetivo - stockActual);

        const numeroMovimiento =
            await this.getSiguienteNumeroMovimiento(
                productoId,
                transaction
            );

        // Actualizamos el stock.
        await producto.update(
            {
                stockActual: stockObjetivo
            },
            {
                transaction
            }
        );

        // Registramos el ajuste como movimiento.
        return await this.create(
            {
                productoId,
                numeroMovimiento,
                ventaId: null,
                compraId: null,
                tipo,
                cantInicial: stockActual,
                cantMovimiento: cantidad,
                cantFinal: stockObjetivo,
                fechaHora: new Date(),
                usuarioId,
                motivo
            },
            {
                transaction
            }
        );
    }
}

export default MovimientoStockRepository;
