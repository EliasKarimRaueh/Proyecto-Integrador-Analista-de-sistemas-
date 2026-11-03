import BaseRepository from './BaseRepository.js';

import DetallePedido from '../models/DetallePedido.js';
import Pedido from '../models/Pedido.js';

import ProductoRepository from './productoRepository.js';
import ProductoProveedorRepository from './productoProveedorRepository.js';

import type { Transaction } from 'sequelize';

class DetallePedidoRepository extends BaseRepository<DetallePedido> {

    private productoRepository: ProductoRepository;
    private productoProveedorRepository: ProductoProveedorRepository;

    /**
     * Inicializa el repositorio de detalles de pedido.
     *
     * Recibe ProductoRepository para consultar los datos de los productos
     * que se incorporan a los pedidos.
     *
     * @param productoRepository Repositorio encargado de consultar productos.
     */
    constructor(productoRepository: ProductoRepository) {
        super(DetallePedido);

        this.productoRepository = productoRepository;
        this.productoProveedorRepository = new ProductoProveedorRepository();
    }


    // =========================
    // DATOS DEL PRODUCTO
    // =========================

    /**
     * Obtiene los datos necesarios para agregar un producto a un pedido.
     *
     * Consulta el producto activo y devuelve su nombre, precio de costo,
     * unidad habitual de compra y unidad de venta.
     *
     * La unidad de compra se establece como unidad predeterminada.
     * La unidad de venta se ofrece como alternativa.
     *
     * Estos datos pueden utilizarse para completar los campos de la
     * interfaz cuando el usuario selecciona un producto.
     *
     * @param productoId Identificador del producto seleccionado.
     * @param transaction Transacción opcional de Sequelize.
     * @returns Datos del producto y las unidades disponibles.
     * @throws Error si el producto no existe o no está activo.
     */
    async obtenerDatosProducto(
        productoId: number,
        transaction?: Transaction
    ) {

        const producto = await this.productoRepository.findByIdActivos(
            productoId,
            transaction
        );

        if (!producto) {
            throw new Error('No se encontró el producto o se encuentra inactivo.');
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

    /**
     * Crea un nuevo detalle dentro de un pedido.
     *
     * Obtiene desde ProductoRepository el nombre, el costo actual y las
     * unidades disponibles del producto.
     *
     * El nombre siempre se toma de la base de datos y no puede ser
     * especificado ni modificado desde esta operación.
     *
     * El importe unitario toma por defecto el costo actual del producto,
     * aunque puede recibirse otro valor si el usuario lo modificó.
     *
     * La unidad de pedido toma por defecto la unidad de compra del producto.
     * También puede seleccionarse su unidad de venta.
     *
     * La cantidad es ingresada por el usuario y el subtotal se calcula
     * automáticamente multiplicando cantidad por importe unitario.
     *
     * Finalmente, obtiene el siguiente numeroItem disponible, crea el
     * detalle y actualiza el total del pedido.
     *
     * Solo permite agregar detalles a pedidos en estado REALIZADO.
     *
     * @param pedidoId Identificador del pedido.
     * @param productoId Identificador del producto seleccionado.
     * @param cantidad Cantidad solicitada.
     * @param transaction Transacción en la que se ejecutará la operación.
     * @param unidadPedido Unidad seleccionada. Por defecto, unidadCompra.
     * @param importeUnitario Precio unitario modificado. Por defecto, costoActual.
     * @returns El detalle de pedido creado.
     */
    async createDetalle(
        pedidoId: number,
        productoId: number,
        cantidad: number,
        transaction: Transaction,
        unidadPedido?: string,
        importeUnitario?: number
    ): Promise<DetallePedido> {

        if (cantidad <= 0) {
            throw new Error('La cantidad debe ser mayor que cero.');
        }

        const pedido = await Pedido.findByPk(pedidoId, {
            transaction
        });

        if (!pedido) {
            throw new Error('No se encontró el pedido indicado.');
        }

        if (pedido.estado !== 'REALIZADO') {
            throw new Error('Solo se pueden agregar detalles a pedidos realizados.');
        }

        const relacion = await this.productoProveedorRepository.findByRelation(
            productoId,
            pedido.proveedorId,
            transaction
        );

        if (!relacion || !relacion.activo) {
            throw new Error(
                'El producto no está asociado a este proveedor o su relación está inactiva.'
            );
        }

        // Obtener los datos actualizados del producto.
        const producto = await this.productoRepository.findByIdActivos(
            productoId,
            transaction
        );

        if (!producto) {
            throw new Error('No se encontró el producto o se encuentra inactivo.');
        }

        // El nombre siempre se obtiene del producto.
        const nombre = producto.nombre;

        // Si no se especificó un precio, se utiliza el costo actual.
        const precio = importeUnitario ?? Number(producto.costoActual);

        if (!Number.isFinite(precio) || precio < 0) {
            throw new Error('El importe unitario debe ser un número válido no negativo.');
        }

        // La unidad predeterminada es unidadCompra.
        const unidadSeleccionada = unidadPedido ?? producto.unidadCompra;

        // Solo se permite unidadCompra o unidadVenta.
        const unidadesPermitidas = [
            producto.unidadCompra,
            producto.unidadVenta
        ];

        if (!unidadesPermitidas.includes(unidadSeleccionada as never)) {
            throw new Error('La unidad seleccionada no es válida para este producto.');
        }

        // Obtener el último número de ítem del pedido.
        const ultimoDetalle = await DetallePedido.findOne({
            where: { pedidoId },
            order: [['numeroItem', 'DESC']],
            transaction
        });

        const numeroItem = ultimoDetalle
            ? ultimoDetalle.numeroItem + 1
            : 1;

        // Calcular subtotal automáticamente.
        const subtotal = Number(
            (cantidad * precio).toFixed(2)
        );

        const detalle = await this.create(
            {
                pedidoId,
                numeroItem,
                cantidad,
                productoId,
                nombre,
                unidadPedido: unidadSeleccionada,
                importeUnitario: precio,
                subtotal
            },
            { transaction }
        );

        await this.actualizarTotalPedido(pedidoId, transaction);

        return detalle;
    }

    // =========================
    // BÚSQUEDAS
    // =========================

    /**
     * Busca un detalle específico dentro de un pedido mediante su clave
     * primaria compuesta: pedidoId y numeroItem.
     *
     * @param pedidoId Identificador del pedido.
     * @param numeroItem Número de ítem dentro del pedido.
     * @param transaction Transacción opcional de Sequelize.
     * @returns El detalle encontrado o null si no existe.
     */
    async findByPedidoAndNumeroItem(
        pedidoId: number,
        numeroItem: number,
        transaction?: Transaction
    ): Promise<DetallePedido | null> {

        return await this.findBy(
            { pedidoId, numeroItem },
            transaction
        );
    }

    /**
     * Obtiene todos los detalles de un pedido ordenados por numeroItem.
     *
     * @param pedidoId Identificador del pedido.
     * @param transaction Transacción opcional de Sequelize.
     * @returns Listado de detalles del pedido.
     */
    async findAllByPedido(
        pedidoId: number,
        transaction?: Transaction
    ): Promise<DetallePedido[]> {

        return await DetallePedido.findAll({
            where: { pedidoId },
            order: [['numeroItem', 'ASC']],
            transaction
        });
    }

    /**
     * Cuenta la cantidad de detalles asociados a un pedido.
     *
     * @param pedidoId Identificador del pedido.
     * @param transaction Transacción opcional de Sequelize.
     * @returns Cantidad de detalles del pedido.
     */
    async countByPedido(
        pedidoId: number,
        transaction?: Transaction
    ): Promise<number> {

        return await this.count(
            { pedidoId },
            transaction
        );
    }

    // =========================
    // ACTUALIZACIONES
    // =========================

    /**
     * Modifica un detalle de un pedido existente.
     *
     * Permite modificar exclusivamente cantidad, unidadPedido e
     * importeUnitario. No permite modificar pedidoId, productoId ni nombre.
     *
     * Valida que la unidad seleccionada corresponda a la unidad de compra
     * o de venta del producto asociado.
     *
     * Recalcula automáticamente el subtotal y actualiza el total del pedido.
     * Solo permite modificar pedidos en estado REALIZADO.
     *
     * @param pedidoId Identificador del pedido.
     * @param numeroItem Número de ítem que se desea modificar.
     * @param datos Datos modificables del detalle.
     * @param transaction Transacción en la que se ejecutará la operación.
     * @returns El detalle actualizado.
     */
    async updateDetalle(
        pedidoId: number,
        numeroItem: number,
        datos: {
            cantidad?: number;
            unidadPedido?: string;
            importeUnitario?: number;
        },
        transaction: Transaction
    ): Promise<DetallePedido> {

        const pedido = await Pedido.findByPk(pedidoId, {
            transaction
        });

        if (!pedido) {
            throw new Error('No se encontró el pedido indicado.');
        }

        if (pedido.estado !== 'REALIZADO') {
            throw new Error('Solo se pueden modificar detalles de pedidos realizados.');
        }

        const detalle = await this.findByPedidoAndNumeroItem(
            pedidoId,
            numeroItem,
            transaction
        );

        if (!detalle) {
            throw new Error('No se encontró el detalle indicado.');
        }

        const producto = await this.productoRepository.findByIdActivos(
            detalle.productoId!,
            transaction
        );

        if (!producto) {
            throw new Error('No se encontró el producto o se encuentra inactivo.');
        }

        const cantidad = datos.cantidad ?? Number(detalle.cantidad);

        const precio = datos.importeUnitario
            ?? Number(detalle.importeUnitario);

        const unidad = datos.unidadPedido ?? detalle.unidadPedido;

        if (cantidad <= 0) {
            throw new Error('La cantidad debe ser mayor que cero.');
        }

        if (!Number.isFinite(precio) || precio < 0) {
            throw new Error('El importe unitario debe ser un número válido no negativo.');
        }

        const unidadesPermitidas = [
            producto.unidadCompra,
            producto.unidadVenta
        ];

        if (!unidadesPermitidas.includes(unidad as never)) {
            throw new Error('La unidad seleccionada no es válida para este producto.');
        }

        const subtotal = Number(
            (cantidad * precio).toFixed(2)
        );

        await detalle.update(
            {
                cantidad,
                unidadPedido: unidad,
                importeUnitario: precio,
                subtotal
            },
            { transaction }
        );

        await this.actualizarTotalPedido(pedidoId, transaction);

        return detalle;
    }

    // =========================
    // ELIMINACIÓN
    // =========================

    /**
     * Elimina físicamente un detalle de un pedido.
     *
     * Solo permite eliminar detalles de pedidos en estado REALIZADO.
     * Después de eliminarlo, recalcula el total del pedido.
     *
     * @param pedidoId Identificador del pedido.
     * @param numeroItem Número de ítem que se desea eliminar.
     * @param transaction Transacción en la que se ejecutará la operación.
     * @returns true si se eliminó el detalle o false si no existía.
     */
    async deleteDetalle(
        pedidoId: number,
        numeroItem: number,
        transaction: Transaction
    ): Promise<boolean> {

        const pedido = await Pedido.findByPk(pedidoId, {
            transaction
        });

        if (!pedido) {
            throw new Error('No se encontró el pedido indicado.');
        }

        if (pedido.estado !== 'REALIZADO') {
            throw new Error('Solo se pueden eliminar detalles de pedidos realizados.');
        }

        const detalle = await this.findByPedidoAndNumeroItem(
            pedidoId,
            numeroItem,
            transaction
        );

        if (!detalle) {
            return false;
        }

        await detalle.destroy({ transaction });

        await this.actualizarTotalPedido(pedidoId, transaction);

        return true;
    }

    // =========================
    // TOTAL DEL PEDIDO
    // =========================

    /**
     * Recalcula el total de un pedido sumando los subtotales de sus detalles.
     *
     * Actualiza el atributo total del pedido. Si no tiene detalles,
     * establece el total en cero.
     *
     * @param pedidoId Identificador del pedido.
     * @param transaction Transacción opcional de Sequelize.
     * @returns Total recalculado del pedido.
     */
    async actualizarTotalPedido(
        pedidoId: number,
        transaction?: Transaction
    ): Promise<number> {

        const total = await DetallePedido.sum('subtotal', {
            where: { pedidoId },
            transaction
        });

        const totalCalculado = Number(
            (total ?? 0).toFixed(2)
        );

        await Pedido.update(
            { total: totalCalculado },
            {
                where: { id: pedidoId },
                transaction
            }
        );

        return totalCalculado;
    }
}

export default DetallePedidoRepository;