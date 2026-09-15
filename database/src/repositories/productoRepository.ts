import BaseRepository from './BaseRepository.js';
import Producto from '../models/Producto.js';

class ProductoRepository extends BaseRepository<Producto> {

    constructor() {
        super(Producto);
    }

    // =========================
    // BÚSQUEDAS
    // =========================

    async findByName(nombre: string): Promise<Producto | null> {
        return await this.findBy({ nombre });
    }

    async findByNameActivos(nombre: string): Promise<Producto | null> {
        return await this.findBy({
            nombre,
            activo: true
        });
    }

    async findByIdActivos(id: number): Promise<Producto | null> {
        const producto = await this.findById(id);

        if (!producto || !producto.activo) {
            return null;
        }

        return producto;
    }

    async findByTipoProducto(
        tipoProductoId: number
    ): Promise<Producto[]> {

        const resultado = await this.findAllBy({
            tipoProductoId
        });

        return resultado.rows;
    }

    async findByTipoProductoActivos(
        tipoProductoId: number
    ): Promise<Producto[]> {

        const resultado = await this.findAllBy({
            tipoProductoId,
            activo: true
        });

        return resultado.rows;
    }

    async findByUnidadCompra(
        unidadCompra: Producto['unidadCompra']
    ): Promise<Producto[]> {

        const resultado = await this.findAllBy({
            unidadCompra
        });

        return resultado.rows;
    }

    async findByUnidadVenta(
        unidadVenta: Producto['unidadVenta']
    ): Promise<Producto[]> {

        const resultado = await this.findAllBy({
            unidadVenta
        });

        return resultado.rows;
    }

    async findByTipoReposicion(
        tipoReposicion: Producto['tipoReposicion']
    ): Promise<Producto[]> {

        const resultado = await this.findAllBy({
            tipoReposicion
        });

        return resultado.rows;
    }

    async findByStockBajo(): Promise<Producto[]> {

        const resultado = await this.findAllBy({
            tipoReposicion: 'stockMinimo',
            activo: true
        });

        return resultado.rows.filter(
            producto =>
                producto.stockMinimo !== null &&
                producto.stockActual <= producto.stockMinimo
        );
    }

    async findByStockNegativo(): Promise<Producto[]> {

        const resultado = await this.findAllBy({
            activo: true
        });

        return resultado.rows.filter(
            producto => producto.stockActual < 0
        );
    }

    async findAllActivos(
        page = 1,
        limit = 10,
        orderBy = 'id',
        orderDirection: 'ASC' | 'DESC' = 'ASC'
    ) {
        return await this.findAllBy(
            { activo: true },
            page,
            limit,
            orderBy,
            orderDirection
        );
    }

    // =========================
    // ACTUALIZACIONES
    // =========================

    async updateNombre(
        id: number,
        nombre: string
    ): Promise<Producto | null> {
        return await this.updateById(id, { nombre });
    }

    async updateTipoProducto(
        id: number,
        tipoProductoId: number
    ): Promise<Producto | null> {
        return await this.updateById(id, { tipoProductoId });
    }

    async updateUnidadCompra(
        id: number,
        unidadCompra: Producto['unidadCompra']
    ): Promise<Producto | null> {
        return await this.updateById(id, { unidadCompra });
    }

    async updateUnidadVenta(
        id: number,
        unidadVenta: Producto['unidadVenta']
    ): Promise<Producto | null> {
        return await this.updateById(id, { unidadVenta });
    }

    async updateFactorConversion(
        id: number,
        factorConversion: number
    ): Promise<Producto | null> {
        return await this.updateById(id, { factorConversion });
    }

    async updateStock(
        id: number,
        stockActual: number
    ): Promise<Producto | null> {
        return await this.updateById(id, { stockActual });
    }

    async updateCosto(
        id: number,
        costoActual: string
    ): Promise<Producto | null> {
        return await this.updateById(id, { costoActual });
    }

    async updateReposicion(
        id: number,
        tipoReposicion: Producto['tipoReposicion'],
        stockMinimo: number | null
    ): Promise<Producto | null> {
        return await this.updateById(id, {
            tipoReposicion,
            stockMinimo
        });
    }

    // =========================
    // OPERACIONES DE STOCK
    // =========================

    async incrementStock(
        id: number,
        cantidad: number
    ): Promise<Producto | null> {

        const producto = await this.findById(id);

        if (!producto) {
            return null;
        }

        await producto.increment('stockActual', {
            by: cantidad
        });

        return await producto.reload();
    }

    async decrementStock(
        id: number,
        cantidad: number
    ): Promise<Producto | null> {

        const producto = await this.findById(id);

        if (!producto) {
            return null;
        }

        await producto.decrement('stockActual', {
            by: cantidad
        });

        return await producto.reload();
    }

    // =========================
    // BAJA LÓGICA
    // =========================

    async deleteByName(nombre: string): Promise<Producto | null> {

        const producto = await this.findByName(nombre);

        if (!producto) {
            return null;
        }

        return await this.deleteById(producto.id);
    }
}

export default ProductoRepository;