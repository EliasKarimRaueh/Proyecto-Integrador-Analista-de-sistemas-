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

    async findByRelation(
        productoId: number,
        diaPedidoId: number
    ): Promise<ProductoDiaPedido | null> {

        return await this.findBy({
            productoId,
            diaPedidoId
        });
    }

    async existsRelation(
        productoId: number,
        diaPedidoId: number
    ): Promise<boolean> {

        const relacion = await this.findByRelation(
            productoId,
            diaPedidoId
        );

        return relacion !== null;
    }

    async getDiasPedido(
        productoId: number
    ): Promise<DiaPedido[]> {

        const relaciones = await this.model.findAll({
            where: { productoId }
        });

        const diasPedido: DiaPedido[] = [];

        for (const relacion of relaciones) {

            const diaPedido =
                await this.diaPedidoRepository.findById(
                    relacion.diaPedidoId
                );

            if (diaPedido) {
                diasPedido.push(diaPedido);
            }
        }

        return diasPedido;
    }

    async getDiasPedidoActivos(
        productoId: number
    ): Promise<DiaPedido[]> {

        const relaciones = await this.model.findAll({
            where: {
                productoId,
                activo: true
            }
        });

        const diasPedido: DiaPedido[] = [];

        for (const relacion of relaciones) {

            const diaPedido =
                await this.diaPedidoRepository.findById(
                    relacion.diaPedidoId
                );

            if (diaPedido && diaPedido.activo) {
                diasPedido.push(diaPedido);
            }
        }

        return diasPedido;
    }

    async findDiasPedidoName(
        productoId: number
    ): Promise<string[]> {

        const diasPedido =
            await this.getDiasPedido(productoId);

        return diasPedido.map(
            diaPedido => diaPedido.nombre
        );
    }

    async findDiasPedidoNameActivos(
        productoId: number
    ): Promise<string[]> {

        const diasPedido =
            await this.getDiasPedidoActivos(productoId);

        return diasPedido.map(
            diaPedido => diaPedido.nombre
        );
    }

    async countDiasPedido(
        productoId: number
    ): Promise<number> {

        const diasPedido =
            await this.getDiasPedido(productoId);

        return diasPedido.length;
    }

    async countDiasPedidoActivos(
        productoId: number
    ): Promise<number> {

        const diasPedido =
            await this.getDiasPedidoActivos(productoId);

        return diasPedido.length;
    }

    async getProductos(
        diaPedidoId: number
    ): Promise<Producto[]> {

        const relaciones = await this.model.findAll({
            where: { diaPedidoId }
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

    async getProductosActivos(
        diaPedidoId: number
    ): Promise<Producto[]> {

        const relaciones = await this.model.findAll({
            where: {
                diaPedidoId,
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

    async findProductosName(
        diaPedidoId: number
    ): Promise<string[]> {

        const productos =
            await this.getProductos(diaPedidoId);

        return productos.map(
            producto => producto.nombre
        );
    }

    async findProductosNameActivos(
        diaPedidoId: number
    ): Promise<string[]> {

        const productos =
            await this.getProductosActivos(diaPedidoId);

        return productos.map(
            producto => producto.nombre
        );
    }

    async countProductos(
        diaPedidoId: number
    ): Promise<number> {

        const productos =
            await this.getProductos(diaPedidoId);

        return productos.length;
    }

    async countProductosActivos(
        diaPedidoId: number
    ): Promise<number> {

        const productos =
            await this.getProductosActivos(diaPedidoId);

        return productos.length;
    }

    async updateRelation(
        productoId: number,
        diaPedidoId: number,
        data: Partial<ProductoDiaPedido>
    ): Promise<ProductoDiaPedido | null> {

        return await this.updateBy(
            {
                productoId,
                diaPedidoId
            },
            data
        );
    }

    async activateRelation(
        productoId: number,
        diaPedidoId: number
    ): Promise<ProductoDiaPedido | null> {

        return await this.updateBy(
            {
                productoId,
                diaPedidoId
            },
            {
                activo: true,
                fechaBaja: null
            }
        );
    }

    async deleteRelation(
        productoId: number,
        diaPedidoId: number
    ): Promise<ProductoDiaPedido | null> {

        return await this.deleteBy({
            productoId,
            diaPedidoId
        });
    }
}

export default ProductoDiaPedidoRepository;