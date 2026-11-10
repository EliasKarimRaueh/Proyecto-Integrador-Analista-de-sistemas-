
import { Op } from 'sequelize';
import type { Transaction, WhereOptions } from 'sequelize';

import sequelize from '../config/database.js';

import BaseRepository from './BaseRepository.js';
import DetalleCompraRepository from './detalleCompraRepository.js';
import MovimientoStockRepository from './movimientoStockRepository.js';
import CuentaProveedorRepository from './cuentaProveedorRepository.js';

import type PedidoRepository from './pedidoRepository.js';
import DetallePedido from '../models/DetallePedido.js';

import Producto from '../models/Producto.js';
import Compra from '../models/Compra.js';
import DetalleCompra from '../models/DetalleCompra.js';
import Proveedor from '../models/Proveedor.js';
import CuentaProveedor from '../models/CuentaProveedor.js';
import Recepcion from '../models/Recepcion.js';


import ProductoRepository from './productoRepository.js';

class CompraRepository extends BaseRepository<Compra> {

    private detalleCompraRepository: DetalleCompraRepository;
    private movimientoStockRepository: MovimientoStockRepository;
    private cuentaProveedorRepository: CuentaProveedorRepository;
    private productoRepository: ProductoRepository;

    private pedidoRepository?: PedidoRepository;

    constructor(
        detalleCompraRepository: DetalleCompraRepository,
        movimientoStockRepository: MovimientoStockRepository,
        cuentaProveedorRepository: CuentaProveedorRepository,
        productoRepository: ProductoRepository
    ) {
        super(Compra);

        this.detalleCompraRepository = detalleCompraRepository;
        this.movimientoStockRepository = movimientoStockRepository;
        this.cuentaProveedorRepository = cuentaProveedorRepository;
        this.productoRepository = productoRepository;
    }

    /**
     * Inyecta PedidoRepository una vez construidos ambos repositorios.
     *
     * Permite resolver la dependencia circular sin modificar
     * PedidoRepository.
     */
    setPedidoRepository(
        pedidoRepository: PedidoRepository
    ): void {
        this.pedidoRepository = pedidoRepository;
    }

    private obtenerPedidoRepository(): PedidoRepository {
        if (!this.pedidoRepository) {
            throw new Error(
                'PedidoRepository no fue configurado en CompraRepository.'
            );
        }

        return this.pedidoRepository;
    }

    // =========================
    // BÚSQUEDAS
    // =========================

    async buscarPorId(
        id: number,
        transaction?: Transaction
    ): Promise<Compra | null> {

        return await this.findById(id, transaction);
    }

    async buscarPorIdConBloqueo(
        id: number,
        transaction: Transaction
    ): Promise<Compra | null> {

        return await Compra.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });
    }

    async buscarDetalleCompleto(
        id: number,
        transaction?: Transaction
    ): Promise<Compra | null> {

        return await Compra.findByPk(id, {
            transaction,
            include: [
                { model: Proveedor, as: 'proveedor' },
                { model: CuentaProveedor, as: 'cuentaProveedor' },
                { model: Recepcion, as: 'recepcion' },
                {
                    model: DetalleCompra,
                    as: 'detalles',
                    include: [{ model: Producto, as: 'producto' }]
                }
            ]
        });
    }

    async listarConFiltros(
        filtros: {
            proveedorId?: number;
            estado?: string;
            desde?: Date;
            hasta?: Date;
        },
        page = 1,
        limit = 50,
        transaction?: Transaction
    ) {

        const where: WhereOptions<Compra> = {};

        if (filtros.proveedorId !== undefined) {
            where.proveedorId = filtros.proveedorId;
        }

        if (filtros.estado !== undefined) {
            where.estado = filtros.estado as Compra['estado'];
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

        return await Compra.findAndCountAll({
            where,
            include: [
                { model: Proveedor, as: 'proveedor' },
                { model: Recepcion, as: 'recepcion' }
            ],
            order: [['fechaHora', 'DESC']],
            offset: (page - 1) * limit,
            limit,
            transaction
        });
    }

    /**
<<<<<<< HEAD
     * Busca todas las compras sin aplicar paginacion.
=======
     * Busca todas las compras sin aplicar paginaci��n.
>>>>>>> snapshot-github
     */
    async buscarTodas(
        orderBy = 'fechaHora',
        orderDirection: 'ASC' | 'DESC' = 'DESC',
        transaction?: Transaction
    ): Promise<Compra[]> {

        return await Compra.findAll({
            order: [[orderBy, orderDirection]],
            transaction
        });
    }

    async buscarPorProveedor(
        proveedorId: number,
        page = 1,
        limit = 10,
        orderBy = 'fechaHora',
        orderDirection: 'ASC' | 'DESC' = 'DESC',
        transaction?: Transaction
    ) {

        return await this.findAllBy(
            { proveedorId } as WhereOptions<Compra>,
            page,
            limit,
            orderBy,
            orderDirection,
            transaction
        );
    }

    async buscarPorFechas(
        fechaDesde: Date,
        fechaHasta: Date,
        page = 1,
        limit = 10,
        orderBy = 'fechaHora',
        orderDirection: 'ASC' | 'DESC' = 'DESC',
        transaction?: Transaction
    ) {

        return await this.findAllBy(
            {
                fechaHora: {
                    [Op.between]: [fechaDesde, fechaHasta]
                }
            } as WhereOptions<Compra>,
            page,
            limit,
            orderBy,
            orderDirection,
            transaction
        );
    }

    async buscarPorProveedorYFechas(
        proveedorId: number,
        fechaDesde: Date,
        fechaHasta: Date,
        page = 1,
        limit = 10,
        orderBy = 'fechaHora',
        orderDirection: 'ASC' | 'DESC' = 'DESC',
        transaction?: Transaction
    ) {

        return await this.findAllBy(
            {
                proveedorId,
                fechaHora: {
                    [Op.between]: [fechaDesde, fechaHasta]
                }
            } as WhereOptions<Compra>,
            page,
            limit,
            orderBy,
            orderDirection,
            transaction
        );
    }

    async findCompraConDetalles(
        compraId: number,
        transaction?: Transaction
    ): Promise<Compra | null> {

        return await Compra.findByPk(compraId, {
            include: [
                {
                    model: DetalleCompra,
                    as: 'detalles',
                    include: [{ model: Producto, as: 'producto' }]
                }
            ],
            transaction
        });
    }

    // =========================
    // INICIO Y CREACIÓN
    // =========================

    /**
     * Inicia una compra directa.
     *
     * Abre una transacción que permanece activa para agregar,
     * modificar o eliminar detalles antes de confirmar.
     */
    async iniciarCompra(
        datos: Partial<Compra>
    ): Promise<{
        compra: Compra;
        transaction: Transaction;
    }> {

        if (datos.pedidoId != null) {
            throw new Error(
                'Las compras asociadas a un pedido deben generarse mediante registrarRecepcion().'
            );
        }

        const transaction = await sequelize.transaction();

        try {
            const compra = await this.crear(
                datos,
                transaction
            );

            return {
                compra,
                transaction
            };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * Crea una compra.
     *
     * Si tiene pedidoId, copia proveedor, total y detalles del pedido.
     * Solo toma de los datos recibidos formaPago, numeroComprobante
     * y claveOperacion.
     *
     * Si no tiene pedidoId, crea una compra directa.
     */
    async crearAlternativa(
        datos: Partial<Compra>,
        transaction?: Transaction
    ): Promise<Compra> {

        if (datos.pedidoId == null) {
            return await this.create(
                datos,
                { transaction }
            );
        }

        const pedidoRepository = this.obtenerPedidoRepository();

        const pedido = await pedidoRepository.findPedidoConDetalles(
            datos.pedidoId,
            transaction
        );

        if (!pedido) {
            throw new Error('No se encontró el pedido indicado.');
        }

        if (pedido.estado !== 'REALIZADO') {
            throw new Error(
                'Solamente se pueden generar compras a partir de pedidos REALIZADO.'
            );
        }

        if (!datos.formaPago) {
            throw new Error(
                'Debe especificarse la forma de pago de la compra.'
            );
        }

        const compra = await this.create(
            {
                proveedorId: pedido.proveedorId,
                pedidoId: pedido.id,
                total: Number(pedido.total),
                formaPago: datos.formaPago,
                numeroComprobante: datos.numeroComprobante ?? null,
                claveOperacion: datos.claveOperacion ?? null
            },
            { transaction }
        );

        const detalles = await this.detalleCompraRepository.findAllByCompra(
            compra.id,
            transaction
        );

        if (detalles.length > 0) {
            throw new Error(
                'La compra ya tiene detalles asociados y no puede volver a copiar los del pedido.'
            );
        }

        const detallesPedido = await DetallePedido.findAll({
            where: { pedidoId: pedido.id },
            order: [['numeroItem', 'ASC']],
            transaction
        });

        for (const detallePedido of detallesPedido) {
            await this.detalleCompraRepository.crearDesdePedido(
                compra.id,
                detallePedido,
                transaction!
            );
        }

        await this.detalleCompraRepository.actualizarTotalCompra(
            compra.id,
            transaction
        );

        return compra;
    }

    // =========================
    // DETALLES
    // =========================

    async agregarDetalle(
        compraId: number,
        productoId: number,
        cantidad: number,
        transaction: Transaction,
        unidadCompra?: string,
        importeUnitario?: number
    ): Promise<DetalleCompra> {

        return await this.detalleCompraRepository.createDetalle(
            compraId,
            productoId,
            cantidad,
            transaction,
            unidadCompra,
            importeUnitario
        );
    }

    // =========================
    // ACTUALIZACIONES
    // =========================

    /**
     * Actualiza datos permitidos de una compra.
     *
     * El proveedor, pedido y total no pueden modificarse manualmente.
     * El total se calcula desde los detalles.
     */
    async actualizarAlternativa(
        id: number,
        datos: Partial<Compra>,
        transaction?: Transaction
    ): Promise<Compra | null> {

        const compra = await this.findById(id, transaction);

        if (!compra) {
            return null;
        }

        const datosPermitidos: Partial<Compra> = {};

        if (datos.formaPago !== undefined) {
            datosPermitidos.formaPago = datos.formaPago;
        }

        if (datos.numeroComprobante !== undefined) {
            datosPermitidos.numeroComprobante = datos.numeroComprobante;
        }

        if (datos.claveOperacion !== undefined) {
            datosPermitidos.claveOperacion = datos.claveOperacion;
        }

        await compra.update(
            datosPermitidos,
            { transaction }
        );

        return compra;
    }

    // =========================
    // CONFIRMACIÓN
    // =========================

    /**
     * Confirma una compra.
     *
     * Registra los ingresos de stock, genera la cuenta corriente
     * si la forma de pago es A CUENTA y actualiza el pedido asociado.
     *
     * La transacción se confirma al finalizar.
     */
    async confirmarCompra(
        compraId: number,
        usuarioId: number,
        transaction: Transaction
    ): Promise<Compra> {

        try {
            const compra = await this.findById(
                compraId,
                transaction
            );

            if (!compra) {
                throw new Error('No se encontró la compra indicada.');
            }

            const detalles = await this.detalleCompraRepository.findAllByCompra(
                compraId,
                transaction
            );

            if (detalles.length === 0) {
                throw new Error(
                    'No se puede confirmar una compra sin detalles.'
                );
            }

            // Registrar cada ingreso de stock.
            for (const detalle of detalles) {

                const producto = await this.productoRepository.findByIdActivos(
                    detalle.productoId,
                    transaction
                );

                if (!producto) {
                    throw new Error(
                        `El producto ${detalle.productoId} no existe o está inactivo.`
                    );
                }

                const unidadRecibida = detalle.unidadCompra;

                let cantidadIngreso: number;

                if (unidadRecibida === producto.unidadCompra) {

                    cantidadIngreso =
                        Number(detalle.cantidad) *
                        Number(producto.factorConversion);

                } else if (unidadRecibida === producto.unidadVenta) {

                    cantidadIngreso = Number(detalle.cantidad);

                } else {
                    throw new Error(
                        `La unidad ${unidadRecibida} no es válida para el producto ${producto.nombre}.`
                    );
                }

                if (
                    !Number.isFinite(cantidadIngreso) ||
                    cantidadIngreso <= 0
                ) {
                    throw new Error(
                        `La cantidad de ingreso calculada para ${producto.nombre} no es válida.`
                    );
                }

                await this.movimientoStockRepository.registrarIngreso(
                    producto.id,
                    cantidadIngreso,
                    usuarioId,
                    `Ingreso por compra N.º ${compra.id}`,
                    compra.id,
                    transaction
                );
            }

            // Crear cuenta corriente únicamente para compras A CUENTA.
            if (compra.formaPago === 'A CUENTA') {

                await this.cuentaProveedorRepository.crear(
                    {
                        proveedorId: compra.proveedorId,
                        compraId: compra.id,
                        importePendiente: Number(compra.total),
                        estado: 'PAGO PENDIENTE'
                    },
                    transaction
                );
            }

            // Actualizar el pedido asociado, si corresponde.
            if (compra.pedidoId != null) {

                const pedidoRepository = this.obtenerPedidoRepository();

                const pedido = await pedidoRepository.findById(
                    compra.pedidoId,
                    transaction
                );

                if (!pedido) {
                    throw new Error(
                        'No se encontró el pedido asociado a la compra.'
                    );
                }

                if (pedido.estado === 'CANCELADO') {
                    throw new Error(
                        'No se puede confirmar una compra asociada a un pedido cancelado.'
                    );
                }

                if (pedido.estado === 'REALIZADO') {
                    await pedidoRepository.updateById(
                        pedido.id,
                        { estado: 'RECIBIDO' },
                        transaction
                    );
                }
            }

            await transaction.commit();

            return compra;

        } catch (error) {

            await transaction.rollback();

            throw error;
        }
    }

    // =========================
    // CANCELACIÓN
    // =========================

    /**
     * Cancela una compra cuya transacción todavía está abierta.
     */
    async cancelarCompra(
        transaction: Transaction
    ): Promise<void> {
        await transaction.rollback();
    }
 //------------------------------------------------------------------------------------
 // De aca para abajo esta lo que agregaron ustedes, usar lo que sea de mayor utilidad
//-------------------------------------------------------------------------------------


    // Los servicios administran deuda, detalles y stock en una transacción.
    async crear(datos: Partial<Compra>, transaction?: Transaction): Promise<Compra> {
        return this.create(datos, { transaction });
    }
    async actualizar(id: number, datos: Partial<Compra>, transaction?: Transaction): Promise<Compra | null> {
        const compra = await this.findById(id, transaction);
        if (!compra) return null;
        const permitidos: Partial<Compra> = {};
        for (const campo of ['estado', 'numeroComprobante', 'claveOperacion', 'formaPago'] as const) {
            if (datos[campo] !== undefined) Object.assign(permitidos, { [campo]: datos[campo] });
        }
        return compra.update(permitidos, { transaction });
    }
}
export default CompraRepository;
