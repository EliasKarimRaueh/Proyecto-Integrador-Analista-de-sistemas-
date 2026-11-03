import { Op } from 'sequelize';
import type { Transaction } from 'sequelize';

import sequelize from '../config/database.js';
import BaseRepository from './BaseRepository.js';
import Producto from '../models/Producto.js';
import Proveedor from '../models/Proveedor.js';
import ProductoProveedor from '../models/ProductoProveedor.js';
import ProductoProveedorRepository from './productoProveedorRepository.js';

class ProductoRepository extends BaseRepository<Producto> {

    constructor() {
        super(Producto);
    }

    // =========================
    // BÚSQUEDAS
    // =========================

    async findByName(
        nombre: string,
        transaction?: Transaction
    ): Promise<Producto | null> {

        return await this.findBy(
            { nombre },
            transaction
        );
    }

    async findByNameActivos(
        nombre: string,
        transaction?: Transaction
    ): Promise<Producto | null> {

        return await this.findBy(
            {
                nombre,
                activo: true
            },
            transaction
        );
    }

    async findByIdActivos(
        id: number,
        transaction?: Transaction
    ): Promise<Producto | null> {

        const producto = await this.findById(
            id,
            transaction
        );

        if (!producto || !producto.activo) {
            return null;
        }

        return producto;
    }

    async findByTipoProducto(
        tipoProductoId: number,
        transaction?: Transaction
    ): Promise<Producto[]> {

        const resultado = await this.findAllBy(
            {
                tipoProductoId
            },
            1,
            10,
            'id',
            'ASC',
            transaction
        );

        return resultado.rows;
    }

    async findByTipoProductoActivos(
        tipoProductoId: number,
        transaction?: Transaction
    ): Promise<Producto[]> {

        const resultado = await this.findAllBy(
            {
                tipoProductoId,
                activo: true
            },
            1,
            10,
            'id',
            'ASC',
            transaction
        );

        return resultado.rows;
    }

    async findByUnidadCompra(
        unidadCompra: Producto['unidadCompra'],
        transaction?: Transaction
    ): Promise<Producto[]> {

        const resultado = await this.findAllBy(
            {
                unidadCompra
            },
            1,
            10,
            'id',
            'ASC',
            transaction
        );

        return resultado.rows;
    }

    async findByUnidadVenta(
        unidadVenta: Producto['unidadVenta'],
        transaction?: Transaction
    ): Promise<Producto[]> {

        const resultado = await this.findAllBy(
            {
                unidadVenta
            },
            1,
            10,
            'id',
            'ASC',
            transaction
        );

        return resultado.rows;
    }

    async findByTipoReposicion(
        tipoReposicion: Producto['tipoReposicion'],
        transaction?: Transaction
    ): Promise<Producto[]> {

        const resultado = await this.findAllBy(
            {
                tipoReposicion
            },
            1,
            10,
            'id',
            'ASC',
            transaction
        );

        return resultado.rows;
    }

    async findByStockBajo(
        transaction?: Transaction
    ): Promise<Producto[]> {

        const resultado = await this.findAllBy(
            {
                tipoReposicion: 'stockMinimo',
                activo: true
            },
            1,
            10,
            'id',
            'ASC',
            transaction
        );

        return resultado.rows.filter(
            producto =>
                producto.stockMinimo !== null &&
                producto.stockActual <= producto.stockMinimo
        );
    }

    async findByStockNegativo(
        transaction?: Transaction
    ): Promise<Producto[]> {

        const resultado = await this.findAllBy(
            {
                activo: true
            },
            1,
            10,
            'id',
            'ASC',
            transaction
        );

        return resultado.rows.filter(
            producto =>
                producto.stockActual < 0
        );
    }

    async buscarParaReposicion(
        opciones: {
            proveedorId?: number;
            incluirProximos?: boolean;
            q?: string;
            page: number;
            limit: number;
        },
        transaction?: Transaction
    ) {

        const where: any = {
            activo: true,
            stockMinimo: { [Op.ne]: null }
        };

        if (opciones.q) {
            where[Op.or] = [
                { codigo: { [Op.iLike]: `%${opciones.q}%` } },
                { nombre: { [Op.iLike]: `%${opciones.q}%` } }
            ];
        }

        if (opciones.proveedorId !== undefined) {
            const relaciones = await ProductoProveedor.findAll({
                where: {
                    proveedorId: opciones.proveedorId,
                    activo: true
                },
                attributes: ['productoId'],
                transaction
            });

            const ids = relaciones.map(relacion => relacion.productoId);

            if (ids.length === 0) {
                return { rows: [], count: 0 };
            }

            where.id = { [Op.in]: ids };
        }

        where[Op.and] = [
            opciones.incluirProximos
                ? sequelize.where(
                    sequelize.col('stockActual'),
                    Op.lte,
                    sequelize.literal('"stockMinimo" * 1.2')
                )
                : sequelize.where(
                    sequelize.col('stockActual'),
                    Op.lte,
                    sequelize.col('stockMinimo')
                )
        ];

        return await this.model.findAndCountAll({
            where,
            order: [['stockActual', 'ASC'], ['nombre', 'ASC']],
            offset: (opciones.page - 1) * opciones.limit,
            limit: opciones.limit,
            transaction
        });
    }

    async findAllActivos(
        page = 1,
        limit = 10,
        orderBy = 'id',
        orderDirection: 'ASC' | 'DESC' = 'ASC',
        transaction?: Transaction
    ) {

        return await this.findAllBy(
            {
                activo: true
            },
            page,
            limit,
            orderBy,
            orderDirection,
            transaction
        );
    }

    /**
    * Busca los proveedores asociados a un producto,
    * delegando la consulta a ProductoProveedorRepository.
    *
    * @param productoId - ID del producto.
    * @param productoProveedorRepository - Repositorio de relaciones producto-proveedor.
    * @param transaction - Transacción opcional de Sequelize.
    * @returns Lista de proveedores asociados al producto.
    */
    async buscarProveedores(
        productoId: number,
        productoProveedorRepository: ProductoProveedorRepository,
        transaction?: Transaction
    ): Promise<Proveedor[]> {
        return await productoProveedorRepository.getProveedores(
            productoId,
            transaction
        );
    }

    // =========================
    // ACTUALIZACIONES
    // =========================

    async updateNombre(
        id: number,
        nombre: string,
        transaction?: Transaction
    ): Promise<Producto | null> {

        return await this.updateById(
            id,
            { nombre },
            transaction
        );
    }

    async updateTipoProducto(
        id: number,
        tipoProductoId: number,
        transaction?: Transaction
    ): Promise<Producto | null> {

        return await this.updateById(
            id,
            { tipoProductoId },
            transaction
        );
    }

    async updateUnidadCompra(
        id: number,
        unidadCompra: Producto['unidadCompra'],
        transaction?: Transaction
    ): Promise<Producto | null> {

        return await this.updateById(
            id,
            { unidadCompra },
            transaction
        );
    }

    async updateUnidadVenta(
        id: number,
        unidadVenta: Producto['unidadVenta'],
        transaction?: Transaction
    ): Promise<Producto | null> {

        return await this.updateById(
            id,
            { unidadVenta },
            transaction
        );
    }

    async updateFactorConversion(
        id: number,
        factorConversion: number,
        transaction?: Transaction
    ): Promise<Producto | null> {

        return await this.updateById(
            id,
            { factorConversion },
            transaction
        );
    }

    async updateStock(
        id: number,
        stockActual: number,
        transaction?: Transaction
    ): Promise<Producto | null> {

        return await this.updateById(
            id,
            { stockActual },
            transaction
        );
    }

    async updateCosto(
        id: number,
        costoActual: string,
        transaction?: Transaction
    ): Promise<Producto | null> {

        return await this.updateById(
            id,
            { costoActual },
            transaction
        );
    }

    async updateReposicion(
        id: number,
        tipoReposicion: Producto['tipoReposicion'],
        stockMinimo: number | null,
        transaction?: Transaction
    ): Promise<Producto | null> {

        return await this.updateById(
            id,
            {
                tipoReposicion,
                stockMinimo
            },
            transaction
        );
    }

    // =========================
    // OPERACIONES DE STOCK
    // =========================

    async incrementStock(
        id: number,
        cantidad: number,
        transaction?: Transaction
    ): Promise<Producto | null> {

        const producto = await this.findById(
            id,
            transaction
        );

        if (!producto) {
            return null;
        }

        await producto.increment(
            'stockActual',
            {
                by: cantidad,
                transaction
            }
        );

        return await producto.reload({
            transaction
        });
    }

    async decrementStock(
        id: number,
        cantidad: number,
        transaction?: Transaction
    ): Promise<Producto | null> {

        const producto = await this.findById(
            id,
            transaction
        );

        if (!producto) {
            return null;
        }

        await producto.decrement(
            'stockActual',
            {
                by: cantidad,
                transaction
            }
        );

        return await producto.reload({
            transaction
        });
    }

    // =========================
    // BAJA LÓGICA
    // =========================

    async deleteByName(
        nombre: string,
        transaction?: Transaction
    ): Promise<Producto | null> {

        const producto = await this.findByName(
            nombre,
            transaction
        );

        if (!producto) {
            return null;
        }

        return await this.deleteById(
            producto.id,
            transaction
        );
    }
}

export default ProductoRepository;