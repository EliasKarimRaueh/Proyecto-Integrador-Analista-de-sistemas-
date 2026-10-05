import type { Transaction } from 'sequelize';

import BaseRepository from './BaseRepository.js';
import OfertaProducto from '../models/OfertaProducto.js';
import Producto from '../models/Producto.js';
import Oferta from '../models/Oferta.js';
import sequelize from '../config/database.js';

import ProductoRepository from './productoRepository.js';
import OfertaRepository from './ofertaRepository.js';

class OfertaProductoRepository
    extends BaseRepository<OfertaProducto> {

    private productoRepository: ProductoRepository;
    private ofertaRepository: OfertaRepository;

    constructor() {
        super(OfertaProducto);

        this.productoRepository = new ProductoRepository();
        this.ofertaRepository = new OfertaRepository();
    }
    // =========================
    // PRECIO TOTAL
    // =========================

    /**
    * Obtiene el precio total de una oferta sumando los precioOferta
    * de todos los productos que la componen.
    */
    async getPrecioOferta(
        ofertaId: number,
        transaction?: Transaction
    ): Promise<number> {

        const relaciones = await this.model.findAll({
            where: { ofertaId },
            transaction
        });

        return relaciones.reduce(
            (total, relacion) => total + Number(relacion.precioOferta),
            0
        );
    }

    
    // =========================
    // RELACIÓN
    // =========================

    async findByOfertaProducto(
        ofertaId: number,
        productoId: number,
        transaction?: Transaction
    ): Promise<OfertaProducto | null> {
        return await this.findBy(
            { ofertaId, productoId },
            transaction
        );
    }

    async existsOfertaProducto(
        ofertaId: number,
        productoId: number,
        transaction?: Transaction
    ): Promise<boolean> {

        const relacion = await this.findByOfertaProducto(
            ofertaId,
            productoId,
            transaction
        );

        return relacion !== null;
    }

    // =========================
    // PRODUCTOS DE UNA OFERTA
    // =========================

    async getProductos(
        ofertaId: number,
        transaction?: Transaction
    ): Promise<Producto[]> {

        const relaciones = await this.model.findAll({
            where: { ofertaId },
            transaction
        });

        const productos: Producto[] = [];

        for (const relacion of relaciones) {

            const producto =
                await this.productoRepository.findById(
                    relacion.productoId,
                    transaction
                );

            if (producto) {
                productos.push(producto);
            }
        }

        return productos;
    }

    async getProductosActivos(
        ofertaId: number,
        transaction?: Transaction
    ): Promise<Producto[]> {

        const relaciones = await this.model.findAll({
            where: {
                ofertaId,
                activo: true
            },
            transaction
        });

        const productos: Producto[] = [];

        for (const relacion of relaciones) {

            const producto =
                await this.productoRepository.findById(
                    relacion.productoId,
                    transaction
                );

            if (producto && producto.activo) {
                productos.push(producto);
            }
        }

        return productos;
    }

    async findProductosName(
        ofertaId: number,
        transaction?: Transaction
    ): Promise<string[]> {

        const productos = await this.getProductos(
            ofertaId,
            transaction
        );

        return productos.map(producto => producto.nombre);
    }

    async countProductos(
        ofertaId: number,
        transaction?: Transaction
    ): Promise<number> {

        const productos = await this.getProductos(
            ofertaId,
            transaction
        );

        return productos.length;
    }

    // =========================
    // ALTA COMPUESTA
    // =========================

    /**
     * Crea una oferta y todas sus filas de ofertas_productos en una
     * sola transacción.
     *
     * Si recibe una transacción externa, utiliza esa transacción y no
     * crea una nueva.
     *
     * Si no recibe una transacción, conserva el comportamiento original:
     * crea su propia transacción.
     *
     * De esta forma puede utilizarse como operación independiente o
     * formar parte de una operación transaccional mayor.
     */
    async crearOfertaConProductos(
        datos: {
            nombre: string;
            descripcion: string | null;
            fechaInicio: Date;
            fechaFin: Date;
        },
        items: { productoId: number; precioOferta: string; cantidad?: number }[],
        transaction?: Transaction
    ): Promise<{ oferta: Oferta; relaciones: OfertaProducto[] }> {

        // =========================
        // TRANSACCIÓN EXTERNA
        // =========================

        if (transaction) {

            const oferta = await this.ofertaRepository.create(
                {
                    nombre: datos.nombre,
                    descripcion: datos.descripcion,
                    fechaInicio: datos.fechaInicio,
                    fechaFin: datos.fechaFin
                },
                { transaction }
            );

            const relaciones: OfertaProducto[] = [];

            for (const item of items) {

                relaciones.push(
                    await this.model.create(
                        {
                            ofertaId: oferta.id,
                            productoId: item.productoId,
                            precioOferta: item.precioOferta, cantidad: item.cantidad ?? 1
                        },
                        { transaction }
                    )
                );
            }

            return { oferta, relaciones };
        }

        // =========================
        // SIN TRANSACCIÓN EXTERNA
        // =========================

        return await sequelize.transaction(async transaction => {

            const oferta = await this.ofertaRepository.create(
                {
                    nombre: datos.nombre,
                    descripcion: datos.descripcion,
                    fechaInicio: datos.fechaInicio,
                    fechaFin: datos.fechaFin
                },
                { transaction }
            );

            const relaciones: OfertaProducto[] = [];

            for (const item of items) {

                relaciones.push(
                    await this.model.create(
                        {
                            ofertaId: oferta.id,
                            productoId: item.productoId,
                            precioOferta: item.precioOferta, cantidad: item.cantidad ?? 1
                        },
                        { transaction }
                    )
                );
            }

            return { oferta, relaciones };
        });
    }

    /**
     * Productos de la oferta con el precio de esa oferta. Son dos
     * consultas (relaciones + productos) en lugar de una por producto.
     */
    async listarDetalleProductos(
        ofertaId: number,
        soloActivos = false,
        transaction?: Transaction
    ): Promise<{ producto: Producto; relacion: OfertaProducto }[]> {

        const relaciones = await this.model.findAll({
            where: soloActivos
                ? { ofertaId, activo: true }
                : { ofertaId },
            order: [['id', 'ASC']],
            transaction
        });

        if (relaciones.length === 0) {
            return [];
        }

        const productos = await this.productoRepository.findByIds(
            relaciones.map(relacion => relacion.productoId),
            transaction
        );

        const porId = new Map(
            productos.map(producto => [producto.id, producto])
        );

        const detalle: {
            producto: Producto;
            relacion: OfertaProducto;
        }[] = [];

        for (const relacion of relaciones) {

            const producto = porId.get(relacion.productoId);

            if (producto) {
                detalle.push({ producto, relacion });
            }
        }

        return detalle;
    }

    // =========================
    // OFERTAS DE UN PRODUCTO
    // =========================

    async getOfertas(
        productoId: number,
        transaction?: Transaction
    ): Promise<Oferta[]> {

        const relaciones = await this.model.findAll({
            where: { productoId },
            transaction
        });

        const ofertas: Oferta[] = [];

        for (const relacion of relaciones) {

            const oferta =
                await this.ofertaRepository.findById(
                    relacion.ofertaId,
                    transaction
                );

            if (oferta) {
                ofertas.push(oferta);
            }
        }

        return ofertas;
    }

    async getOfertasActivas(
        productoId: number,
        transaction?: Transaction
    ): Promise<Oferta[]> {

        const relaciones = await this.model.findAll({
            where: {
                productoId,
                activo: true
            },
            transaction
        });

        const ofertas: Oferta[] = [];

        for (const relacion of relaciones) {

            const oferta =
                await this.ofertaRepository.findByIdActivo(
                    relacion.ofertaId,
                    transaction
                );

            if (oferta) {
                ofertas.push(oferta);
            }
        }

        return ofertas;
    }

    /**
     * Ofertas no dadas de baja que además están dentro de su ventana
     * de fechas. La vigencia se resuelve con OfertaRepository para no
     * duplicar la definición en dos lugares.
     */
    async getOfertasVigentes(
        productoId: number,
        fecha: Date = new Date(),
        transaction?: Transaction
    ): Promise<Oferta[]> {

        const relaciones = await this.model.findAll({
            where: {
                productoId,
                activo: true
            },
            transaction
        });

        if (relaciones.length === 0) {
            return [];
        }

        const ofertasVigentes =
            await this.ofertaRepository.findTodasVigentes(
                fecha,
                transaction
            );

        const idsVigentes = new Set(
            ofertasVigentes.map(oferta => oferta.id)
        );

        const ofertas: Oferta[] = [];

        for (const relacion of relaciones) {

            if (idsVigentes.has(relacion.ofertaId)) {

                const oferta =
                    await this.ofertaRepository.findById(
                        relacion.ofertaId,
                        transaction
                    );

                if (oferta) {
                    ofertas.push(oferta);
                }
            }
        }

        return ofertas;
    }

    // =========================
    // MODIFICACIONES
    // =========================

    /**
     * Ofertas de un producto con el precio que tiene en cada una. Con
     * soloVigentes se filtra por ventana de fechas.
     */
    async listarDetalleOfertas(
        productoId: number,
        soloVigentes = true,
        fecha: Date = new Date(),
        transaction?: Transaction
    ): Promise<{ oferta: Oferta; relacion: OfertaProducto }[]> {

        const relaciones = await this.model.findAll({
            where: { productoId, activo: true },
            order: [['ofertaId', 'ASC']],
            transaction
        });

        if (relaciones.length === 0) {
            return [];
        }

        const vigentes = soloVigentes
            ? await this.ofertaRepository.findTodasVigentes(
                fecha,
                transaction
            )
            : await this.ofertaRepository.findAll(
                1,
                1000,
                'id',
                'ASC',
                transaction
            ).then(r => r.rows);

        const porId = new Map(
            vigentes.map(oferta => [oferta.id, oferta])
        );

        const detalle: {
            oferta: Oferta;
            relacion: OfertaProducto;
        }[] = [];

        for (const relacion of relaciones) {

            const oferta = porId.get(relacion.ofertaId);

            if (oferta) {
                detalle.push({ oferta, relacion });
            }
        }

        return detalle;
    }

    async updatePrecioOferta(
        ofertaId: number,
        productoId: number,
        precioOferta: string,
        transaction?: Transaction,
        cantidad?: number
    ): Promise<OfertaProducto | null> {
        return await this.updateBy(
            { ofertaId, productoId },
            { precioOferta, ...(cantidad === undefined ? {} : { cantidad }) },
            transaction
        );
    }

    async activateOfertaProducto(
        ofertaId: number,
        productoId: number,
        transaction?: Transaction
    ): Promise<OfertaProducto | null> {
        return await this.updateBy(
            { ofertaId, productoId },
            {
                activo: true,
                fechaBaja: null
            },
            transaction
        );
    }

    // =========================
    // BAJA LÓGICA
    // =========================

    async deleteByOfertaProducto(
        ofertaId: number,
        productoId: number,
        transaction?: Transaction
    ): Promise<OfertaProducto | null> {
        return await this.deleteBy(
            { ofertaId, productoId },
            transaction
        );
    }
}

export default OfertaProductoRepository;
