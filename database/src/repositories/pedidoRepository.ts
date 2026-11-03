
import { Op } from 'sequelize';
import type { Transaction } from 'sequelize';

import sequelize from '../config/database.js';

import BaseRepository from './BaseRepository.js';
import DetallePedidoRepository from './detallePedidoRepository.js';
import CompraRepository from './compraRepository.js';

import Pedido from '../models/Pedido.js';
import DetallePedido from '../models/DetallePedido.js';
import Proveedor from '../models/Proveedor.js';
import Compra from '../models/Compra.js';

class PedidoRepository extends BaseRepository<Pedido> {
    private detallePedidoRepository: DetallePedidoRepository;
    private compraRepository: CompraRepository;

    constructor(
        detallePedidoRepository: DetallePedidoRepository,
        compraRepository: CompraRepository
    ) {
        super(Pedido);

        this.detallePedidoRepository = detallePedidoRepository;
        this.compraRepository = compraRepository;
    }

    /**
     * Cuenta los pedidos registrados.
     *
     * Permite filtrar por proveedor, estado y rango de fechas.
     */
    async countPedidos(
        proveedorId?: number,
        estado?: Pedido['estado'],
        fechaDesde?: Date,
        fechaHasta?: Date,
        transaction?: Transaction
    ): Promise<number> {
        const where: any = {};

        if (proveedorId !== undefined) {
            where.proveedorId = proveedorId;
        }

        if (estado !== undefined) {
            where.estado = estado;
        }

        if (fechaDesde || fechaHasta) {
            where.fechaHora = {};

            if (fechaDesde) {
                where.fechaHora[Op.gte] = fechaDesde;
            }

            if (fechaHasta) {
                where.fechaHora[Op.lte] = fechaHasta;
            }
        }

        return await this.count(where, transaction);
    }

    /**
     * Obtiene un pedido por su ID, incluyendo sus detalles y proveedor.
     */
    async findPedidoConDetalles(
        pedidoId: number,
        transaction?: Transaction
    ): Promise<Pedido | null> {
        return await Pedido.findByPk(pedidoId, {
            include: [
                {
                    model: DetallePedido,
                    as: 'detalles'
                },
                {
                    model: Proveedor,
                    as: 'proveedor'
                }
            ],
            transaction
        });
    }

    /**
     * Obtiene los pedidos registrados con paginación y filtros opcionales.
     *
     * Permite incluir los detalles de cada pedido cuando se solicita.
     */
    async findAllPedidos(
        page = 1,
        limit = 10,
        proveedorId?: number,
        estado?: Pedido['estado'],
        fechaDesde?: Date,
        fechaHasta?: Date,
        incluirDetalles = false,
        transaction?: Transaction
    ) {
        const where: any = {};

        if (proveedorId !== undefined) {
            where.proveedorId = proveedorId;
        }

        if (estado !== undefined) {
            where.estado = estado;
        }

        if (fechaDesde || fechaHasta) {
            where.fechaHora = {};

            if (fechaDesde) {
                where.fechaHora[Op.gte] = fechaDesde;
            }

            if (fechaHasta) {
                where.fechaHora[Op.lte] = fechaHasta;
            }
        }

        const include: any[] = [
            {
                model: Proveedor,
                as: 'proveedor'
            }
        ];

        if (incluirDetalles) {
            include.push({
                model: DetallePedido,
                as: 'detalles'
            });
        }

        return await Pedido.findAndCountAll({
            where,
            include,
            limit,
            offset: (page - 1) * limit,
            order: [['fechaHora', 'DESC']],
            distinct: true,
            transaction
        });
    }

    /**
     * Actualiza el total de un pedido.
     *
     * Delega el cálculo en DetallePedidoRepository.
     */
    async actualizarTotal(
        pedidoId: number,
        transaction?: Transaction
    ): Promise<void> {
        await this.detallePedidoRepository.actualizarTotalPedido(
            pedidoId,
            transaction
        );
    }

    /**
     * Inicia la creación de un pedido.
     *
     * Crea una transacción y registra un pedido en estado REALIZADO.
     * La transacción queda abierta para agregar sus detalles.
     */
    async iniciarPedido(): Promise<{
        pedido: Pedido;
        transaction: Transaction;
    }> {
        const transaction = await sequelize.transaction();

        try {
            const pedido = await this.create(
                {
                    proveedorId: undefined,
                    estado: 'REALIZADO',
                    total: 0
                } as Partial<Pedido>,
                { transaction }
            );

            return {
                pedido,
                transaction
            };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * Agrega un detalle a un pedido dentro de la transacción activa.
     *
     * Delega la creación y validación del detalle en
     * DetallePedidoRepository.
     */
    async agregarDetalle(
        pedidoId: number,
        productoId: number,
        cantidad: number,
        transaction: Transaction,
        unidadPedido?: string,
        importeUnitario?: number
    ): Promise<DetallePedido> {
        return await this.detallePedidoRepository.createDetalle(
            pedidoId,
            productoId,
            cantidad,
            transaction,
            unidadPedido,
            importeUnitario
        );
    }

    /**
     * Confirma la creación de un pedido.
     *
     * Verifica que exista al menos un detalle antes de confirmar
     * la transacción.
     */
    async confirmarPedido(
        pedidoId: number,
        transaction: Transaction
    ): Promise<void> {
        const cantidadDetalles =
            await this.detallePedidoRepository.countByPedido(
                pedidoId,
                transaction
            );

        if (cantidadDetalles === 0) {
            throw new Error(
                'No se puede confirmar un pedido sin detalles.'
            );
        }

        await transaction.commit();
    }

    /**
     * Cancela una operación de creación de pedido todavía no confirmada.
     *
     * Revierte la transacción completa.
     */
    async cancelarPedido(
        transaction: Transaction
    ): Promise<void> {
        await transaction.rollback();
    }

    /**
     * Cancela un pedido previamente confirmado.
     *
     * No elimina el pedido ni sus detalles: únicamente modifica su estado.
     * Si no recibe una transacción, crea una propia.
     */
    async cancelarPedidoRealizado(
        pedidoId: number,
        transaction?: Transaction
    ): Promise<Pedido> {
        const ejecutar = async (tx: Transaction): Promise<Pedido> => {
            const pedido = await this.findById(pedidoId, tx);

            if (!pedido) {
                throw new Error('No se encontró el pedido.');
            }

            if (pedido.estado !== 'REALIZADO') {
                throw new Error(
                    'Solamente se pueden cancelar pedidos en estado REALIZADO.'
                );
            }

            await pedido.update(
                { estado: 'CANCELADO' },
                { transaction: tx }
            );

            return pedido;
        };

        if (transaction) {
            return await ejecutar(transaction);
        }

        return await sequelize.transaction(ejecutar);
    }

    /**
     * Registra la recepción de un pedido.
     *
     * Crea la compra mediante CompraRepository y cambia el estado
     * del pedido a RECIBIDO dentro de la misma transacción.
     *
     * Si no recibe una transacción, administra una propia.
     */
    async registrarRecepcion(
        pedidoId: number,
        datosCompra: Partial<Compra>,
        transaction?: Transaction
    ): Promise<{ pedido: Pedido; compra: Compra }> {
        const ejecutar = async (
            tx: Transaction
        ): Promise<{ pedido: Pedido; compra: Compra }> => {
            const pedido = await this.findById(pedidoId, tx);

            if (!pedido) {
                throw new Error('No se encontró el pedido.');
            }

            if (pedido.estado !== 'REALIZADO') {
                throw new Error(
                    'Solamente se pueden recibir pedidos en estado REALIZADO.'
                );
            }

            const compra = await this.compraRepository.crear(
                datosCompra,
                tx
            );

            await pedido.update(
                { estado: 'RECIBIDO' },
                { transaction: tx }
            );

            return {
                pedido,
                compra
            };
        };

        if (transaction) {
            return await ejecutar(transaction);
        }

        return await sequelize.transaction(ejecutar);
    }
}

export default PedidoRepository;
