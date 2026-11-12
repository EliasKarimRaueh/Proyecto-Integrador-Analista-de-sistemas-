import BaseRepository from './BaseRepository.js';

import DetalleCompra from '../models/DetalleCompra.js';
import Producto from '../models/Producto.js';
import DetallePedido from '../models/DetallePedido.js';
import Compra from '../models/Compra.js';

import ProductoRepository from './productoRepository.js';
import ProductoProveedorRepository from './productoProveedorRepository.js';

import type { Transaction } from 'sequelize';

class DetalleCompraRepository extends BaseRepository<DetalleCompra> {

    private productoRepository: ProductoRepository;
    private productoProveedorRepository: ProductoProveedorRepository;

    constructor(productoRepository: ProductoRepository) {
        super(DetalleCompra);

        this.productoRepository = productoRepository;
        this.productoProveedorRepository = new ProductoProveedorRepository();
    }

    // =========================
    // DATOS DEL PRODUCTO
    // =========================

    async obtenerDatosProducto(
        compraId: number,
        productoId: number,
        transaction?: Transaction
    ) {
        const compra = await Compra.findByPk(compraId, {
            transaction
        });

        if (!compra) {
            throw new Error('No se encontró la compra indicada.');
        }

        const relacion = await this.productoProveedorRepository.findByRelation(
            productoId,
            compra.proveedorId,
            transaction
        );

        if (!relacion || !relacion.activo) {
            throw new Error(
                'El producto no está asociado a este proveedor o su relación está inactiva.'
            );
        }

        const producto = await this.productoRepository.findByIdActivos(
            productoId,
            transaction
        );

        if (!producto) {
            throw new Error(
                'No se encontró el producto o se encuentra inactivo.'
            );
        }

        return {
            productoId: producto.id,
            nombre: producto.nombre,
            importeUnitario: Number(producto.costoActual),
            unidadPredeterminada: producto.unidadCompra,
            unidadesDisponibles: [
                producto.unidadCompra,
                producto.unidadVenta
            ]
        };
    }

    // =========================
    // CREACIÓN
    // =========================

    async crear(
        datos: Partial<DetalleCompra>,
        transaction?: Transaction
    ): Promise<DetalleCompra> {

        return await this.create(
            datos,
            { transaction }
        );
    }

    async crearMuchos(
        datos: Partial<DetalleCompra>[],
        transaction?: Transaction
    ): Promise<DetalleCompra[]> {

        return await this.model.bulkCreate(
            datos as never[],
            { transaction }
        );
    }

    /**
     * Crea un detalle manualmente dentro de una compra.
     *
     * El nombre se obtiene del producto.
     * La unidad predeterminada es unidadCompra.
     * El subtotal se calcula automáticamente.
     */
    async createDetalle(
        compraId: number,
        productoId: number,
        cantidad: number,
        transaction: Transaction,
        unidadCompra?: string,
        importeUnitario?: number
    ): Promise<DetalleCompra> {

        if (cantidad <= 0) {
            throw new Error('La cantidad debe ser mayor que cero.');
        }

        const compra = await Compra.findByPk(compraId, {
            transaction
        });

        if (!compra) {
            throw new Error('No se encontró la compra indicada.');
        }

        const relacion = await this.productoProveedorRepository.findByRelation(
            productoId,
            compra.proveedorId,
            transaction
        );

        if (!relacion || !relacion.activo) {
            throw new Error(
                'El producto no está asociado a este proveedor o su relación está inactiva.'
            );
        }

        const producto = await this.productoRepository.findByIdActivos(
            productoId,
            transaction
        );

        if (!producto) {
            throw new Error(
                'No se encontró el producto o se encuentra inactivo.'
            );
        }

        const precio = importeUnitario ?? Number(producto.costoActual);

        if (!Number.isFinite(precio) || precio < 0) {
            throw new Error(
                'El importe unitario debe ser un número válido no negativo.'
            );
        }

        const unidadSeleccionada = unidadCompra ?? producto.unidadCompra;

        const unidadesPermitidas = [
            producto.unidadCompra,
            producto.unidadVenta
        ];

        if (!unidadesPermitidas.includes(unidadSeleccionada as never)) {
            throw new Error(
                'La unidad seleccionada no es válida para este producto.'
            );
        }

        const ultimoDetalle = await DetalleCompra.findOne({
            where: { compraId },
            order: [['numeroItem', 'DESC']],
            transaction
        });

        const numeroItem = ultimoDetalle
            ? ultimoDetalle.numeroItem + 1
            : 1;

        const subtotal = Number(
            (cantidad * precio).toFixed(2)
        );

        const detalle = await this.create(
            {
                compraId,
                numeroItem,
                cantidad,
                unidadCompra: unidadSeleccionada,
                productoId,
                nombre: producto.nombre,
                importeUnitario: precio,
                subtotal,
                pedidoId: null,
                numeroItemPedido: null
            },
            { transaction }
        );

        await this.actualizarTotalCompra(compraId, transaction);

        return detalle;
    }

    /**
     * Genera un detalle de compra copiando los datos de un detalle de pedido.
     *
     * Conserva la referencia al detalle original.
     */
    async crearDesdePedido(
        compraId: number,
        detallePedido: DetallePedido,
        transaction: Transaction
    ): Promise<DetalleCompra> {

        const compra = await Compra.findByPk(compraId, {
            transaction
        });

        if (!compra) {
            throw new Error('No se encontró la compra indicada.');
        }

        if (compra.pedidoId !== detallePedido.pedidoId) {
            throw new Error(
                'El detalle de pedido no corresponde al pedido asociado a la compra.'
            );
        }

        const productoId = detallePedido.productoId;

        if (productoId == null) {
            throw new Error(
                'El detalle del pedido no tiene un producto asociado.'
            );
        }

        const relacion = await this.productoProveedorRepository.findByRelation(
            productoId,
            compra.proveedorId,
            transaction
        );

        if (!relacion || !relacion.activo) {
            throw new Error(
                'El producto no está asociado a este proveedor o su relación está inactiva.'
            );
        }

        const producto = await this.productoRepository.findByIdActivos(
            productoId,
            transaction
        );

        if (!producto) {
            throw new Error(
                'No se encontró el producto o se encuentra inactivo.'
            );
        }

        const detalleExistente = await DetalleCompra.findOne({
            where: {
                compraId,
                pedidoId: detallePedido.pedidoId,
                numeroItemPedido: detallePedido.numeroItem
            },
            transaction
        });

        if (detalleExistente) {
            throw new Error(
                'El detalle del pedido ya fue incorporado a esta compra.'
            );
        }

        const cantidad = Number(detallePedido.cantidad);
        const precio = Number(detallePedido.importeUnitario);

        const subtotal = Number(
            (cantidad * precio).toFixed(2)
        );

        const ultimoDetalle = await DetalleCompra.findOne({
            where: { compraId },
            order: [['numeroItem', 'DESC']],
            transaction
        });

        const numeroItem = ultimoDetalle
            ? ultimoDetalle.numeroItem + 1
            : 1;

        const detalle = await this.create(
            {
                compraId,
                numeroItem,
                cantidad,
                unidadCompra: detallePedido.unidadPedido,
                productoId: producto.id,
                nombre: producto.nombre,
                importeUnitario: precio,
                subtotal,
                pedidoId: detallePedido.pedidoId,
                numeroItemPedido: detallePedido.numeroItem,
                presentacion: detallePedido.presentacion ?? null,
                cantidadPresentacion: detallePedido.cantidadPresentacion ?? null,
                factorConversion: detallePedido.factorConversion ?? null
            },
            { transaction }
        );

        await this.actualizarTotalCompra(compraId, transaction);

        return detalle;
    }

    // =========================
    // BÚSQUEDAS
    // =========================

    async findByCompraAndNumeroItem(
        compraId: number,
        numeroItem: number,
        transaction?: Transaction
    ): Promise<DetalleCompra | null> {

        return await this.findBy(
            { compraId, numeroItem },
            transaction
        );
    }

    async findAllByCompra(
        compraId: number,
        transaction?: Transaction
    ): Promise<DetalleCompra[]> {

        return await DetalleCompra.findAll({
            where: { compraId },
            order: [['numeroItem', 'ASC']],
            transaction
        });
    }

    async countByCompra(
        compraId: number,
        transaction?: Transaction
    ): Promise<number> {

        return await this.count(
            { compraId },
            transaction
        );
    }

    // =========================
    // ACTUALIZACIONES
    // =========================

    /**
     * Solo permite modificar cantidad, unidad e importe unitario.
     * El producto, nombre y referencia al pedido no se modifican.
     */
    async updateDetalle(
        compraId: number,
        numeroItem: number,
        datos: {
            cantidad?: number;
            unidadCompra?: string;
            importeUnitario?: number;
        },
        transaction: Transaction
    ): Promise<DetalleCompra> {

        const detalle = await this.findByCompraAndNumeroItem(
            compraId,
            numeroItem,
            transaction
        );

        if (!detalle) {
            throw new Error('No se encontró el detalle indicado.');
        }

        const compra = await Compra.findByPk(compraId, {
            transaction
        });

        if (!compra) {
            throw new Error('No se encontró la compra indicada.');
        }

        const producto = await this.productoRepository.findByIdActivos(
            detalle.productoId,
            transaction
        );

        if (!producto) {
            throw new Error(
                'No se encontró el producto o se encuentra inactivo.'
            );
        }

        const cantidad = datos.cantidad ?? Number(detalle.cantidad);

        const precio = datos.importeUnitario
            ?? Number(detalle.importeUnitario);

        const unidad = datos.unidadCompra ?? detalle.unidadCompra;

        if (cantidad <= 0) {
            throw new Error('La cantidad debe ser mayor que cero.');
        }

        if (!Number.isFinite(precio) || precio < 0) {
            throw new Error(
                'El importe unitario debe ser un número válido no negativo.'
            );
        }

        const unidadesPermitidas = [
            producto.unidadCompra,
            producto.unidadVenta
        ];

        if (!unidadesPermitidas.includes(unidad as never)) {
            throw new Error(
                'La unidad seleccionada no es válida para este producto.'
            );
        }

        const subtotal = Number(
            (cantidad * precio).toFixed(2)
        );

        await detalle.update(
            {
                cantidad,
                unidadCompra: unidad,
                importeUnitario: precio,
                subtotal
            },
            { transaction }
        );

        await this.actualizarTotalCompra(compraId, transaction);

        return detalle;
    }

    // =========================
    // ELIMINACIÓN
    // =========================

    async deleteDetalle(
        compraId: number,
        numeroItem: number,
        transaction: Transaction
    ): Promise<boolean> {

        const detalle = await this.findByCompraAndNumeroItem(
            compraId,
            numeroItem,
            transaction
        );

        if (!detalle) {
            return false;
        }

        await detalle.destroy({ transaction });

        await this.actualizarTotalCompra(compraId, transaction);

        return true;
    }

    // =========================
    // TOTAL DE COMPRA
    // =========================

    async actualizarTotalCompra(
        compraId: number,
        transaction?: Transaction
    ): Promise<number> {

        const total = await DetalleCompra.sum('subtotal', {
            where: { compraId },
            transaction
        });

        const totalCalculado = Number(
            (total ?? 0).toFixed(2)
        );

        await Compra.update(
            { total: totalCalculado },
            {
                where: { id: compraId },
                transaction
            }
        );

        return totalCalculado;
    }

    async buscarPorCompra(compraId: number,
        transaction?: Transaction
    ): Promise<DetalleCompra[]> {
        return await this.model.findAll({
            where: { compraId },
            include: [
                { model: Producto, as: 'producto' }
            ],
            order: [['numeroItem', 'ASC']],
            transaction
        });
    }
}

export default DetalleCompraRepository;
