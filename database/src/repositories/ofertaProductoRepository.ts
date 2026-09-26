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
    // RELACIÓN
    // =========================

    async findByOfertaProducto(
        ofertaId: number,
        productoId: number
    ): Promise<OfertaProducto | null> {
        return await this.findBy({ ofertaId, productoId });
    }

    async existsOfertaProducto(
        ofertaId: number,
        productoId: number
    ): Promise<boolean> {

        const relacion = await this.findByOfertaProducto(
            ofertaId,
            productoId
        );

        return relacion !== null;
    }

    // =========================
    // PRODUCTOS DE UNA OFERTA
    // =========================

    async getProductos(ofertaId: number): Promise<Producto[]> {

        const relaciones = await this.model.findAll({
            where: { ofertaId }
        });

        const productos: Producto[] = [];

        for (const relacion of relaciones) {

            const producto =
                await this.productoRepository.findById(
                    relacion.productoId
                );

            if (producto) {
                productos.push(producto);
            }
        }

        return productos;
    }

    async getProductosActivos(ofertaId: number): Promise<Producto[]> {

        const relaciones = await this.model.findAll({
            where: {
                ofertaId,
                activo: true
            }
        });

        const productos: Producto[] = [];

        for (const relacion of relaciones) {

            const producto =
                await this.productoRepository.findById(
                    relacion.productoId
                );

            if (producto && producto.activo) {
                productos.push(producto);
            }
        }

        return productos;
    }

    async findProductosName(ofertaId: number): Promise<string[]> {

        const productos = await this.getProductos(ofertaId);

        return productos.map(producto => producto.nombre);
    }

    async countProductos(ofertaId: number): Promise<number> {

        const productos = await this.getProductos(ofertaId);

        return productos.length;
    }

    // =========================
    // ALTA COMPUESTA
    // =========================

    /**
     * Crea una oferta y todas sus filas de ofertas_productos en una
     * sola transacción. Si un producto falla, no queda ni la oferta
     * ni las relaciones que ya se hubieran insertado.
     */
    async crearOfertaConProductos(
        datos: {
            nombre: string;
            descripcion: string | null;
            fechaInicio: Date;
            fechaFin: Date;
        },
        items: { productoId: number; precioOferta: string }[]
    ): Promise<{ oferta: Oferta; relaciones: OfertaProducto[] }> {

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
                            precioOferta: item.precioOferta
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
        soloActivos = false
    ): Promise<{ producto: Producto; relacion: OfertaProducto }[]> {

        const relaciones = await this.model.findAll({
            where: soloActivos
                ? { ofertaId, activo: true }
                : { ofertaId },
            order: [['id', 'ASC']]
        });

        if (relaciones.length === 0) {
            return [];
        }

        const productos = await this.productoRepository.findByIds(
            relaciones.map(relacion => relacion.productoId)
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

    async getOfertas(productoId: number): Promise<Oferta[]> {

        const relaciones = await this.model.findAll({
            where: { productoId }
        });

        const ofertas: Oferta[] = [];

        for (const relacion of relaciones) {

            const oferta =
                await this.ofertaRepository.findById(
                    relacion.ofertaId
                );

            if (oferta) {
                ofertas.push(oferta);
            }
        }

        return ofertas;
    }

    async getOfertasActivas(productoId: number): Promise<Oferta[]> {

        const relaciones = await this.model.findAll({
            where: {
                productoId,
                activo: true
            }
        });

        const ofertas: Oferta[] = [];

        for (const relacion of relaciones) {

            const oferta =
                await this.ofertaRepository.findByIdActivo(
                    relacion.ofertaId
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
        fecha: Date = new Date()
    ): Promise<Oferta[]> {

        const relaciones = await this.model.findAll({
            where: {
                productoId,
                activo: true
            }
        });

        if (relaciones.length === 0) {
            return [];
        }

        const ofertasVigentes =
            await this.ofertaRepository.findTodasVigentes(fecha);

        const idsVigentes = new Set(
            ofertasVigentes.map(oferta => oferta.id)
        );

        const ofertas: Oferta[] = [];

        for (const relacion of relaciones) {

            if (idsVigentes.has(relacion.ofertaId)) {

                const oferta =
                    await this.ofertaRepository.findById(
                        relacion.ofertaId
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
        fecha: Date = new Date()
    ): Promise<{ oferta: Oferta; relacion: OfertaProducto }[]> {

        const relaciones = await this.model.findAll({
            where: { productoId, activo: true },
            order: [['ofertaId', 'ASC']]
        });

        if (relaciones.length === 0) {
            return [];
        }

        const vigentes = soloVigentes
            ? await this.ofertaRepository.findTodasVigentes(fecha)
            : await this.ofertaRepository.findAll(
                1, 1000, 'id', 'ASC'
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
        precioOferta: string
    ): Promise<OfertaProducto | null> {
        return await this.updateBy(
            { ofertaId, productoId },
            { precioOferta }
        );
    }

    async activateOfertaProducto(
        ofertaId: number,
        productoId: number
    ): Promise<OfertaProducto | null> {
        return await this.updateBy(
            { ofertaId, productoId },
            {
                activo: true,
                fechaBaja: null
            }
        );
    }

    // =========================
    // BAJA LÓGICA
    // =========================

    async deleteByOfertaProducto(
        ofertaId: number,
        productoId: number
    ): Promise<OfertaProducto | null> {
        return await this.deleteBy({ ofertaId, productoId });
    }
}

export default OfertaProductoRepository;
