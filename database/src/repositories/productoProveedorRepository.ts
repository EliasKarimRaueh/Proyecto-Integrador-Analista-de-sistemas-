import type { Transaction } from 'sequelize';

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

    // =========================
    // RELACIONES
    // =========================

    async findByRelation(
        productoId: number,
        proveedorId: number,
        transaction?: Transaction
    ): Promise<ProductoProveedor | null> {

        return await this.findBy(
            {
                productoId,
                proveedorId
            },
            transaction
        );
    }

    async existsRelation(
        productoId: number,
        proveedorId: number,
        transaction?: Transaction
    ): Promise<boolean> {

        const relacion = await this.findByRelation(
            productoId,
            proveedorId,
            transaction
        );

        return relacion !== null;
    }

    // =========================
    // PROVEEDORES
    // =========================

    async getProveedores(
        productoId: number,
        transaction?: Transaction
    ): Promise<Proveedor[]> {

        const relaciones = await this.model.findAll({
            where: { productoId },
            transaction
        });

        const proveedores: Proveedor[] = [];

        for (const relacion of relaciones) {

            const proveedor =
                await this.proveedorRepository.findById(
                    relacion.proveedorId,
                    transaction
                );

            if (proveedor) {
                proveedores.push(proveedor);
            }
        }

        return proveedores;
    }

    async getProveedoresActivos(
        productoId: number,
        transaction?: Transaction
    ): Promise<Proveedor[]> {

        const relaciones = await this.model.findAll({
            where: {
                productoId,
                activo: true
            },
            transaction
        });

        const proveedores: Proveedor[] = [];

        for (const relacion of relaciones) {

            const proveedor =
                await this.proveedorRepository.findById(
                    relacion.proveedorId,
                    transaction
                );

            if (proveedor && proveedor.activo) {
                proveedores.push(proveedor);
            }
        }

        return proveedores;
    }

    async findProveedoresName(
        productoId: number,
        transaction?: Transaction
    ): Promise<string[]> {

        const proveedores =
            await this.getProveedores(
                productoId,
                transaction
            );

        return proveedores.map(
            proveedor => proveedor.nombre
        );
    }

    async findProveedoresNameActivos(
        productoId: number,
        transaction?: Transaction
    ): Promise<string[]> {

        const proveedores =
            await this.getProveedoresActivos(
                productoId,
                transaction
            );

        return proveedores.map(
            proveedor => proveedor.nombre
        );
    }

    async countProveedores(
        productoId: number,
        transaction?: Transaction
    ): Promise<number> {

        const proveedores =
            await this.getProveedores(
                productoId,
                transaction
            );

        return proveedores.length;
    }

    async countProveedoresActivos(
        productoId: number,
        transaction?: Transaction
    ): Promise<number> {

        const proveedores =
            await this.getProveedoresActivos(
                productoId,
                transaction
            );

        return proveedores.length;
    }

    // =========================
    // PRODUCTOS
    // =========================

    async getProductos(
        proveedorId: number,
        transaction?: Transaction
    ): Promise<Producto[]> {

        const relaciones = await this.model.findAll({
            where: { proveedorId },
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
        proveedorId: number,
        transaction?: Transaction
    ): Promise<Producto[]> {

        const relaciones = await this.model.findAll({
            where: {
                proveedorId,
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
        proveedorId: number,
        transaction?: Transaction
    ): Promise<string[]> {

        const productos =
            await this.getProductos(
                proveedorId,
                transaction
            );

        return productos.map(
            producto => producto.nombre
        );
    }

    async findProductosNameActivos(
        proveedorId: number,
        transaction?: Transaction
    ): Promise<string[]> {

        const productos =
            await this.getProductosActivos(
                proveedorId,
                transaction
            );

        return productos.map(
            producto => producto.nombre
        );
    }

    async countProductos(
        proveedorId: number,
        transaction?: Transaction
    ): Promise<number> {

        const productos =
            await this.getProductos(
                proveedorId,
                transaction
            );

        return productos.length;
    }

    async countProductosActivos(
        proveedorId: number,
        transaction?: Transaction
    ): Promise<number> {

        const productos =
            await this.getProductosActivos(
                proveedorId,
                transaction
            );

        return productos.length;
    }

    // =========================
    // ACTUALIZACIONES
    // =========================

    async updateRelation(
        productoId: number,
        proveedorId: number,
        data: Partial<ProductoProveedor>,
        transaction?: Transaction
    ): Promise<ProductoProveedor | null> {

        return await this.updateBy(
            {
                productoId,
                proveedorId
            },
            data,
            transaction
        );
    }

    async activateRelation(
        productoId: number,
        proveedorId: number,
        transaction?: Transaction
    ): Promise<ProductoProveedor | null> {

        return await this.updateBy(
            {
                productoId,
                proveedorId
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
        proveedorId: number,
        transaction?: Transaction
    ): Promise<ProductoProveedor | null> {

        return await this.deleteBy(
            {
                productoId,
                proveedorId
            },
            transaction
        );
    }
}

export default ProductoProveedorRepository;