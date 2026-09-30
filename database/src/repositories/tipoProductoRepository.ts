import type { Transaction } from 'sequelize';

import BaseRepository from './BaseRepository.js';
import TipoProducto from '../models/TipoProducto.js';
import Producto from '../models/Producto.js';
import ProductoRepository from './productoRepository.js';

class TipoProductoRepository extends BaseRepository<TipoProducto> {

    private productoRepository: ProductoRepository;

    constructor() {
        super(TipoProducto);

        this.productoRepository = new ProductoRepository();
    }

    // =========================
    // BÚSQUEDAS
    // =========================

    async findByName(
        nombre: string,
        transaction?: Transaction
    ): Promise<TipoProducto | null> {

        return await this.findBy(
            { nombre },
            transaction
        );
    }

    // =========================
    // PRODUCTOS
    // =========================

    async getProductos(
        nombreTipoProducto: string,
        transaction?: Transaction
    ): Promise<Producto[]> {

        const tipoProducto = await this.findByName(
            nombreTipoProducto,
            transaction
        );

        if (!tipoProducto) {
            return [];
        }

        return await this.productoRepository.findAllBy(
            { tipoProductoId: tipoProducto.id },
            1,
            10,
            'id',
            'ASC',
            transaction
        ).then(resultado => resultado.rows);
    }

    async getProductosActivos(
        nombreTipoProducto: string,
        transaction?: Transaction
    ): Promise<Producto[]> {

        const tipoProducto = await this.findByName(
            nombreTipoProducto,
            transaction
        );

        if (!tipoProducto) {
            return [];
        }

        return await this.productoRepository.findAllBy(
            {
                tipoProductoId: tipoProducto.id,
                activo: true
            },
            1,
            10,
            'id',
            'ASC',
            transaction
        ).then(resultado => resultado.rows);
    }

    async findProductosName(
        nombreTipoProducto: string,
        transaction?: Transaction
    ): Promise<string[]> {

        const productos = await this.getProductos(
            nombreTipoProducto,
            transaction
        );

        return productos.map(producto => producto.nombre);
    }

    async findProductosNameActivos(
        nombreTipoProducto: string,
        transaction?: Transaction
    ): Promise<string[]> {

        const productos = await this.getProductosActivos(
            nombreTipoProducto,
            transaction
        );

        return productos.map(producto => producto.nombre);
    }

    // =========================
    // CONTEOS
    // =========================

    async countProductos(
        nombreTipoProducto: string,
        transaction?: Transaction
    ): Promise<number> {

        const tipoProducto = await this.findByName(
            nombreTipoProducto,
            transaction
        );

        if (!tipoProducto) {
            return 0;
        }

        return await this.productoRepository.count(
            {
                tipoProductoId: tipoProducto.id
            },
            transaction
        );
    }

    async countProductosActivos(
        nombreTipoProducto: string,
        transaction?: Transaction
    ): Promise<number> {

        const tipoProducto = await this.findByName(
            nombreTipoProducto,
            transaction
        );

        if (!tipoProducto) {
            return 0;
        }

        return await this.productoRepository.count(
            {
                tipoProductoId: tipoProducto.id,
                activo: true
            },
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
    ): Promise<TipoProducto | null> {

        return await this.updateById(
            id,
            { nombre },
            transaction
        );
    }

    // =========================
    // BAJA LÓGICA
    // =========================

    async deleteByName(
        nombre: string,
        transaction?: Transaction
    ): Promise<TipoProducto | null> {

        const tipoProducto = await this.findByName(
            nombre,
            transaction
        );

        if (!tipoProducto) {
            return null;
        }

        return await this.deleteById(
            tipoProducto.id,
            transaction
        );
    }
}

export default TipoProductoRepository;