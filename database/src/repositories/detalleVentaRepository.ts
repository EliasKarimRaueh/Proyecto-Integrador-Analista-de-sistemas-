import type { Transaction } from 'sequelize';

import BaseRepository from './BaseRepository.js';
import DetalleVenta from '../models/DetalleVenta.js';
import ProductoRepository from './productoRepository.js';
import PrecioRepository from './precioRepository.js';
import OfertaRepository from './ofertaRepository.js';
import OfertaProductoRepository from './ofertaProductoRepository.js';

/**
* Este repositorio hereda los métodos genéricos del CRUD
* definidos en BaseRepository.
*
* Solo se implementan aquí las operaciones específicas
* de DetalleVenta.
*/

class DetalleVentaRepository extends BaseRepository<DetalleVenta> {

    private productoRepository: ProductoRepository;
    private precioRepository: PrecioRepository;
    private ofertaRepository: OfertaRepository;
    private ofertaProductoRepository: OfertaProductoRepository;

    constructor() {
        super(DetalleVenta);

        this.productoRepository = new ProductoRepository();
        this.precioRepository = new PrecioRepository();
        this.ofertaRepository = new OfertaRepository();
        this.ofertaProductoRepository = new OfertaProductoRepository();
    }


    // =========================
    // CREAR Y REGISTRAR
    // =========================

    /**
    * Crea un detalle de venta.
    *
    * El detalle debe corresponder exactamente a un producto o a una oferta.
    *
    * El número de item se genera automáticamente tomando el último
    * número utilizado dentro de la venta y sumándole uno.
    *
    * Para un producto, el importe unitario se obtiene del precio vigente,
    * pudiendo utilizarse el precio minorista o mayorista.
    *
    * Para una oferta, el importe unitario se obtiene sumando los
    * precioOferta de los productos que componen la oferta.
    *
    * El nombre, importe unitario y subtotal se obtienen/calculan
    * internamente.
    */
    async createDetalle(
        ventaId: number,
        cantidad: number,
        productoId?: number,
        ofertaId?: number,
        tipoPrecio: 'MINORISTA' | 'MAYORISTA' = 'MINORISTA',
        transaction?: Transaction
    ): Promise<DetalleVenta> {

        // Debe indicarse exactamente uno: producto u oferta.
        if (
            (productoId === undefined && ofertaId === undefined) ||
            (productoId !== undefined && ofertaId !== undefined)
        ) {
            throw new Error(
                'El detalle de venta debe corresponder a un producto o a una oferta, pero no a ambos.'
            );
        }

        // Buscar el último número de item utilizado en la venta.
        const ultimoDetalle = await this.model.findOne({
            where: { ventaId },
            order: [['numeroItem', 'DESC']],
            transaction
        });

        const numeroItem = ultimoDetalle
            ? ultimoDetalle.numeroItem + 1
            : 1;

        let nombre: string;
        let importeUnitario: number;

        // =========================
        // PRODUCTO
        // =========================

        if (productoId !== undefined) {

            const producto = await this.productoRepository.findById(
                productoId,
                transaction
            );

            if (!producto) {
                throw new Error(
                    `No existe el producto con id ${productoId}.`
                );
            }

            const precios = await this.precioRepository.findAllVigentes(
                [productoId],
                new Date(),
                transaction
            );

            if (precios.length === 0) {
                throw new Error(
                    `El producto ${productoId} no posee un precio vigente.`
                );
            }

            const precio = precios[0];

            if (tipoPrecio === 'MINORISTA') {

                importeUnitario = Number(precio.precioMinorista);

            } else {

                if (precio.precioMayorista === null) {
                    throw new Error(
                        `El producto ${productoId} no posee un precio mayorista vigente.`
                    );
                }

                importeUnitario = Number(precio.precioMayorista);
            }

            nombre = producto.nombre;

        // =========================
        // OFERTA
        // =========================

        } else {

            const oferta = await this.ofertaRepository.findByIdActivo(
            ofertaId!,
            transaction
            );

            if (!oferta) {
                throw new Error(
                    `No existe una oferta activa con id ${ofertaId}.`
                );
            }

            importeUnitario =
                await this.ofertaProductoRepository.getPrecioOferta(
                    ofertaId!,
                    transaction
                );

            nombre = oferta.nombre;
        }

        // =========================
        // SUBTOTAL
        // =========================

        const subtotal = cantidad * importeUnitario;

        return super.create(
            {
                ventaId,
                numeroItem,
                cantidad,
                productoId: productoId ?? null,
                ofertaId: ofertaId ?? null,
                nombre,
                importeUnitario,
                subtotal
            },
            { transaction }
        );
    }

    // =========================
    // BÚSQUEDAS
    // =========================

    /**
     * Busca un detalle específico de una venta.
     */
    async findByVentaAndNumeroItem(
        ventaId: number,
        numeroItem: number,
        transaction?: Transaction
    ): Promise<DetalleVenta | null> {

        return this.findBy(
            {
                ventaId,
                numeroItem
            },
            transaction
        );
    }

    /**
     * Busca todos los detalles pertenecientes a una venta.
     *
     * La consulta es paginada.
     */
    async findAllByVenta(
        ventaId: number,
        transaction?: Transaction
    ): Promise<DetalleVenta[]> {

        return DetalleVenta.findAll({
            where: { ventaId },
            order: [['numeroItem', 'ASC']],
            transaction
        });
    }

    /**
     * Cuenta la cantidad de detalles pertenecientes a una venta.
     */
    async countByVenta(
        ventaId: number,
        transaction?: Transaction
    ): Promise<number> {

        return this.count(
            { ventaId },
            transaction
        );
    }
}

export default DetalleVentaRepository;