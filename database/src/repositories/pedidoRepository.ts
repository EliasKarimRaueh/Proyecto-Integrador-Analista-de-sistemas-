
import { Op } from 'sequelize';
import type { Transaction, WhereOptions } from 'sequelize';

import sequelize from '../config/database.js';

import BaseRepository from './BaseRepository.js';
import DetallePedidoRepository from './detallePedidoRepository.js';
import CompraRepository from './compraRepository.js';
import Producto from '../models/Producto.js';
import ProductoDiaPedido from '../models/ProductoDiaPedido.js';
import DiaPedido from '../models/DiaPedido.js';
import ProductoProveedor from '../models/ProductoProveedor.js';

import Pedido from '../models/Pedido.js';
import DetallePedido from '../models/DetallePedido.js';
import Proveedor from '../models/Proveedor.js';
import Compra from '../models/Compra.js';


type FiltrosPedido = {
    proveedorId?: number;
    estado?: string;
    desde?: Date;
    hasta?: Date;
};

type MotivoNecesidadReposicion =
    | 'DIA_PEDIDO'
    | 'STOCK_MINIMO';

type ProductoNecesidadReposicion = {
    producto: Producto;
    motivos: MotivoNecesidadReposicion[];
};

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

    /**
     * Busca los productos que necesitan reposición.
     *
     * Considera dos criterios independientes:
     *
     * 1. Productos cuyo día de pedido coincide con el día actual.
     * 2. Productos cuyo stock actual es igual o inferior al stock mínimo.
     *
     * Si un producto cumple ambos criterios, se incluye una sola vez
     * indicando ambos motivos.
     *
    * Permite filtrar opcionalmente por proveedor asociado.
    */
    async buscarNecesidadesReposicion(
        proveedorId?: number,
        fecha: Date = new Date(),
        transaction?: Transaction
    ): Promise<ProductoNecesidadReposicion[]> {

        // Obtener el día actual.
        const dias: DiaPedido['nombre'][] = [
            'Domingo',
            'Lunes',
            'Martes',
            'Miércoles',
            'Jueves',
            'Viernes',
            'Sábado'
        ];

        const diaActual = dias[fecha.getDay()];

        // Obtener todos los productos activos.
        const productos = await Producto.findAll({
            where: {
                activo: true
            },
            transaction
        });

        // Si se especifica un proveedor, filtrar por sus productos asociados.
        let productosProveedor = new Set<number>();

        if (proveedorId !== undefined) {

            const proveedor = await Proveedor.findOne({
                where: {
                    id: proveedorId,
                    activo: true
                },
                transaction
            });

            if (!proveedor) {
                throw new Error('No se encontró un proveedor activo.');
            }

            const relaciones = await ProductoProveedor.findAll({
                where: {
                    proveedorId,
                    activo: true
                },
                transaction
            });

            productosProveedor = new Set(
                relaciones.map(relacion => relacion.productoId)
            );
        }

        // Aplicar el filtro por proveedor si corresponde.
        const productosFiltrados = proveedorId === undefined
            ? productos
            : productos.filter(
                producto => productosProveedor.has(producto.id)
            );

        // Obtener el registro del día actual.
        const diaPedido = await DiaPedido.findOne({
            where: {
                nombre: diaActual,
                activo: true
            },
            transaction
        });

        // Obtener los productos asociados al día actual.
        let productosDelDia = new Set<number>();

        if (diaPedido) {

            const relacionesDia = await ProductoDiaPedido.findAll({
                where: {
                    diaPedidoId: diaPedido.id,
                    activo: true
                },
                transaction
            });

            productosDelDia = new Set(
                relacionesDia.map(relacion => relacion.productoId)
            );
        }

        // Consolidar las necesidades sin duplicar productos.
        const resultado = new Map<number, ProductoNecesidadReposicion>();

        for (const producto of productosFiltrados) {

            const motivos: MotivoNecesidadReposicion[] = [];

            // Criterio 1: día de pedido.
            if (productosDelDia.has(producto.id)) {
                motivos.push('DIA_PEDIDO');
            }

            // Criterio 2: stock igual o inferior al mínimo.
            if (
                producto.stockMinimo !== null &&
                producto.stockActual <= producto.stockMinimo
            ) {
                motivos.push('STOCK_MINIMO');
            }

            // Incorporar solamente productos que cumplan al menos un criterio.
            if (motivos.length > 0) {
                resultado.set(producto.id, {
                    producto,
                    motivos
                });
            }
        }

        return Array.from(resultado.values());
    }

    async crear(
        datos: Partial<Pedido>,
        transaction?: Transaction
    ): Promise<Pedido> {

        return await this.create(
            datos,
            { transaction }
        );
    }

    async buscarPorId(
        id: number,
        transaction?: Transaction
    ): Promise<Pedido | null> {

        return await this.model.findByPk(id, {
            transaction,
            include: [
                { model: Proveedor, as: 'proveedor' }
            ]
        });
    }

    async buscarPorIdConBloqueo(
        id: number,
        transaction: Transaction
    ): Promise<Pedido | null> {

        return await this.model.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });
    }

    async buscarDetalle(
        id: number,
        transaction?: Transaction
    ): Promise<Pedido | null> {

        return await this.model.findByPk(id, {
            transaction,
            include: [
                { model: Proveedor, as: 'proveedor' },
                {
                    model: DetallePedido,
                    as: 'detalles',
                    include: [
                        { model: Producto, as: 'producto' }
                    ]
                }
            ]
        });
    }

    async listar(
        filtros: FiltrosPedido,
        page = 1,
        limit = 50,
        transaction?: Transaction
    ) {

        const where: WhereOptions<Pedido> = {};

        if (filtros.proveedorId !== undefined) {
            where.proveedorId = filtros.proveedorId;
        }

        if (filtros.estado !== undefined) {
            where.estado = filtros.estado as Pedido['estado'];
        }

        if (filtros.desde && filtros.hasta) {
            where.fechaHora = {
                [Op.between]: [filtros.desde, filtros.hasta]
            };
        } else if (filtros.desde) {
            where.fechaHora = { [Op.gte]: filtros.desde };
        } else if (filtros.hasta) {
            where.fechaHora = { [Op.lte]: filtros.hasta };
        }

        return await this.model.findAndCountAll({
            where,
            include: [
                { model: Proveedor, as: 'proveedor' },
                { model: Compra, as: 'compra' }
            ],
            order: [['fechaHora', 'DESC']],
            offset: (page - 1) * limit,
            limit,
            transaction
        });
    }

    async actualizarEstado(
        id: number,
        estado: Pedido['estado'],
        transaction?: Transaction
    ): Promise<Pedido | null> {

        return await this.updateById(
            id,
            { estado },
            transaction
        );
    }

}

export default PedidoRepository;
