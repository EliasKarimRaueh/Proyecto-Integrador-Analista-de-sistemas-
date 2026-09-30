import type { Transaction } from 'sequelize';

import BaseRepository from './BaseRepository.js';
import ProductoDiaPedido from '../models/ProductoDiaPedido.js';
import Producto from '../models/Producto.js';
import DiaPedido from '../models/DiaPedido.js';

import ProductoRepository from './productoRepository.js';
import DiaPedidoRepository from './diaPedidoRepository.js';

class ProductoDiaPedidoRepository
    extends BaseRepository<ProductoDiaPedido> {

    private productoRepository: ProductoRepository;
    private diaPedidoRepository: DiaPedidoRepository;

    constructor() {
        super(ProductoDiaPedido);

        this.productoRepository = new ProductoRepository();
        this.diaPedidoRepository = new DiaPedidoRepository();
    }

    // =========================
    // RELACIONES
    // =========================

    async findByRelation(
        productoId: number,
        diaPedidoId: number,
        transaction?: Transaction
    ): Promise<ProductoDiaPedido | null> {

        return await this.findBy(
            {
                productoId,
                diaPedidoId
            },
            transaction
        );
    }

    async existsRelation(
        productoId: number,
        diaPedidoId: number,
        transaction?: Transaction
    ): Promise<boolean> {

        const relacion = await this.findByRelation(
            productoId,
            diaPedidoId,
            transaction
        );

        return relacion !== null;
    }

    // =========================
    // DÍAS DE PEDIDO
    // =========================

    async getDiasPedido(
        productoId: number,
        transaction?: Transaction
    ): Promise<DiaPedido[]> {

        const relaciones = await this.model.findAll({
            where: { productoId },
            transaction
        });

        const diasPedido: DiaPedido[] = [];

        for (const relacion of relaciones) {

            const diaPedido =
                await this.diaPedidoRepository.findById(
                    relacion.diaPedidoId,
                    transaction
                );

            if (diaPedido) {
                diasPedido.push(diaPedido);
            }
        }

        return diasPedido;
    }

    async getDiasPedidoActivos(
        productoId: number,
        transaction?: Transaction
    ): Promise<DiaPedido[]> {

        const relaciones = await this.model.findAll({
            where: {
                productoId,
                activo: true
            },
            transaction
        });

        const diasPedido: DiaPedido[] = [];

        for (const relacion of relaciones) {

            const diaPedido =
                await this.diaPedidoRepository.findById(
                    relacion.diaPedidoId,
                    transaction
                );

            if (diaPedido && diaPedido.activo) {
                diasPedido.push(diaPedido);
            }
        }

        return diasPedido;
    }

    async findDiasPedidoName(
        productoId: number,
        transaction?: Transaction
    ): Promise<string[]> {

        const diasPedido =
            await this.getDiasPedido(
                productoId,
                transaction
            );

        return diasPedido.map(
            diaPedido => diaPedido.nombre
        );
    }

    async findDiasPedidoNameActivos(
        productoId: number,
        transaction?: Transaction
    ): Promise<string[]> {

        const diasPedido =
            await this.getDiasPedidoActivos(
                productoId,
                transaction
            );

        return diasPedido.map(
            diaPedido => diaPedido.nombre
        );
    }

    async countDiasPedido(
        productoId: number,
        transaction?: Transaction
    ): Promise<number> {

        const diasPedido =
            await this.getDiasPedido(
                productoId,
                transaction
            );

        return diasPedido.length;
    }

    async countDiasPedidoActivos(
        productoId: number,
        transaction?: Transaction
    ): Promise<number> {

        const diasPedido =
            await this.getDiasPedidoActivos(
                productoId,
                transaction
            );

        return diasPedido.length;
    }

    // =========================
    // PRODUCTOS
    // =========================

    async getProductos(
        diaPedidoId: number,
        transaction?: Transaction
    ): Promise<Producto[]> {

        const relaciones = await this.model.findAll({
            where: { diaPedidoId },
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
        diaPedidoId: number,
        transaction?: Transaction
    ): Promise<Producto[]> {

        const relaciones = await this.model.findAll({
            where: {
                diaPedidoId,
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
        diaPedidoId: number,
        transaction?: Transaction
    ): Promise<string[]> {

        const productos =
            await this.getProductos(
                diaPedidoId,
                transaction
            );

        return productos.map(
            producto => producto.nombre
        );
    }

    async findProductosNameActivos(
        diaPedidoId: number,
        transaction?: Transaction
    ): Promise<string[]> {

        const productos =
            await this.getProductosActivos(
                diaPedidoId,
                transaction
            );

        return productos.map(
            producto => producto.nombre
        );
    }

    async countProductos(
        diaPedidoId: number,
        transaction?: Transaction
    ): Promise<number> {

        const productos =
            await this.getProductos(
                diaPedidoId,
                transaction
            );

        return productos.length;
    }

    async countProductosActivos(
        diaPedidoId: number,
        transaction?: Transaction
    ): Promise<number> {

        const productos =
            await this.getProductosActivos(
                diaPedidoId,
                transaction
            );

        return productos.length;
    }

    // =========================
    // ACTUALIZACIONES
    // =========================

    async updateRelation(
        productoId: number,
        diaPedidoId: number,
        data: Partial<ProductoDiaPedido>,
        transaction?: Transaction
    ): Promise<ProductoDiaPedido | null> {

        return await this.updateBy(
            {
                productoId,
                diaPedidoId
            },
            data,
            transaction
        );
    }

    async activateRelation(
        productoId: number,
        diaPedidoId: number,
        transaction?: Transaction
    ): Promise<ProductoDiaPedido | null> {

        return await this.updateBy(
            {
                productoId,
                diaPedidoId
            },
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

    async deleteRelation(
        productoId: number,
        diaPedidoId: number,
        transaction?: Transaction
    ): Promise<ProductoDiaPedido | null> {

        return await this.deleteBy(
            {
                productoId,
                diaPedidoId
            },
            transaction
        );
    }
}

export default ProductoDiaPedidoRepository;