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

    async findByName(nombre: string): Promise<TipoProducto | null> {
        return await this.findBy({ nombre });
    }

    async getProductos(nombreTipoProducto: string): Promise<Producto[]> {

        const tipoProducto = await this.findByName(nombreTipoProducto);

        if (!tipoProducto) {
            return [];
        }

        return await this.productoRepository.findAllBy(
            { tipoProductoId: tipoProducto.id }
        ).then(resultado => resultado.rows);
    }

    async getProductosActivos(
        nombreTipoProducto: string
    ): Promise<Producto[]> {

        const tipoProducto = await this.findByName(nombreTipoProducto);

        if (!tipoProducto) {
            return [];
        }

        return await this.productoRepository.findAllBy(
            {
                tipoProductoId: tipoProducto.id,
                activo: true
            }
        ).then(resultado => resultado.rows);
    }

    async findProductosName(
        nombreTipoProducto: string
    ): Promise<string[]> {

        const productos = await this.getProductos(nombreTipoProducto);

        return productos.map(producto => producto.nombre);
    }

    async findProductosNameActivos(
        nombreTipoProducto: string
    ): Promise<string[]> {

        const productos = await this.getProductosActivos(
            nombreTipoProducto
        );

        return productos.map(producto => producto.nombre);
    }

    async countProductos(nombreTipoProducto: string): Promise<number> {

        const tipoProducto = await this.findByName(nombreTipoProducto);

        if (!tipoProducto) {
            return 0;
        }

        return await this.productoRepository.count({
            tipoProductoId: tipoProducto.id
        });
    }

    async countProductosActivos(
        nombreTipoProducto: string
    ): Promise<number> {

        const tipoProducto = await this.findByName(nombreTipoProducto);

        if (!tipoProducto) {
            return 0;
        }

        return await this.productoRepository.count({
            tipoProductoId: tipoProducto.id,
            activo: true
        });
    }

    async updateNombre(
        id: number,
        nombre: string
    ): Promise<TipoProducto | null> {

        return await this.updateById(id, { nombre });
    }

    async deleteByName(nombre: string): Promise<TipoProducto | null> {

        const tipoProducto = await this.findByName(nombre);

        if (!tipoProducto) {
            return null;
        }

        return await this.deleteById(tipoProducto.id);
    }
}

export default TipoProductoRepository;