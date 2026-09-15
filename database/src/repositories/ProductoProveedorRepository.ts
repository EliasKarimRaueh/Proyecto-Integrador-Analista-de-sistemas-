import BaseRepository from './BaseRepository.js';
import ProductoProveedor from '../models/ProductoProveedor.js';
import Producto from '../models/Producto.js';
import Proveedor from '../models/Proveedor.js';

import ProductoRepository from './productoRepository.js';
import ProveedorRepository from './proveedorRepository.js';

class ProductoProveedorRepository
    extends BaseRepository<ProductoProveedor> {

    private productoRepository: ProductoRepository;
    private proveedorRepository: ProveedorRepository;

    constructor() {
        super(ProductoProveedor);

        this.productoRepository = new ProductoRepository();
        this.proveedorRepository = new ProveedorRepository();
    }

    async findByRelation(
        productoId: number,
        proveedorId: number
    ): Promise<ProductoProveedor | null> {

        return await this.findBy({
            productoId,
            proveedorId
        });
    }

    async existsRelation(
        productoId: number,
        proveedorId: number
    ): Promise<boolean> {

        const relacion = await this.findByRelation(
            productoId,
            proveedorId
        );

        return relacion !== null;
    }

    async getProveedores(
        productoId: number
    ): Promise<Proveedor[]> {

        const relaciones = await this.model.findAll({
            where: { productoId }
        });

        const proveedores: Proveedor[] = [];

        for (const relacion of relaciones) {

            const proveedor =
                await this.proveedorRepository.findById(
                    relacion.proveedorId
                );

            if (proveedor) {
                proveedores.push(proveedor);
            }
        }

        return proveedores;
    }

    async getProveedoresActivos(
        productoId: number
    ): Promise<Proveedor[]> {

        const relaciones = await this.model.findAll({
            where: {
                productoId,
                activo: true
            }
        });

        const proveedores: Proveedor[] = [];

        for (const relacion of relaciones) {

            const proveedor =
                await this.proveedorRepository.findById(
                    relacion.proveedorId
                );

            if (proveedor && proveedor.activo) {
                proveedores.push(proveedor);
            }
        }

        return proveedores;
    }

    async findProveedoresName(
        productoId: number
    ): Promise<string[]> {

        const proveedores = await this.getProveedores(productoId);

        return proveedores.map(
            proveedor => proveedor.nombre
        );
    }

    async findProveedoresNameActivos(
        productoId: number
    ): Promise<string[]> {

        const proveedores =
            await this.getProveedoresActivos(productoId);

        return proveedores.map(
            proveedor => proveedor.nombre
        );
    }

    async countProveedores(
        productoId: number
    ): Promise<number> {

        const proveedores =
            await this.getProveedores(productoId);

        return proveedores.length;
    }

    async countProveedoresActivos(
        productoId: number
    ): Promise<number> {

        const proveedores =
            await this.getProveedoresActivos(productoId);

        return proveedores.length;
    }

    async getProductos(
        proveedorId: number
    ): Promise<Producto[]> {

        const relaciones = await this.model.findAll({
            where: { proveedorId }
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
        proveedorId: number
    ): Promise<Producto[]> {

        const relaciones = await this.model.findAll({
            where: {
                proveedorId,
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
        proveedorId: number
    ): Promise<string[]> {

        const productos =
            await this.getProductos(proveedorId);

        return productos.map(
            producto => producto.nombre
        );
    }

    async findProductosNameActivos(
        proveedorId: number
    ): Promise<string[]> {

        const productos =
            await this.getProductosActivos(proveedorId);

        return productos.map(
            producto => producto.nombre
        );
    }

    async countProductos(
        proveedorId: number
    ): Promise<number> {

        const productos =
            await this.getProductos(proveedorId);

        return productos.length;
    }

    async countProductosActivos(
        proveedorId: number
    ): Promise<number> {

        const productos =
            await this.getProductosActivos(proveedorId);

        return productos.length;
    }

    async updateRelation(
        productoId: number,
        proveedorId: number,
        data: Partial<ProductoProveedor>
    ): Promise<ProductoProveedor | null> {

        return await this.updateBy(
            {
                productoId,
                proveedorId
            },
            data
        );
    }

    async activateRelation(
        productoId: number,
        proveedorId: number
    ): Promise<ProductoProveedor | null> {

        return await this.updateBy(
            {
                productoId,
                proveedorId
            },
            {
                activo: true,
                fechaBaja: null
            }
        );
    }

    async deleteRelation(
        productoId: number,
        proveedorId: number
    ): Promise<ProductoProveedor | null> {

        return await this.deleteBy({
            productoId,
            proveedorId
        });
    }
}

export default ProductoProveedorRepository;