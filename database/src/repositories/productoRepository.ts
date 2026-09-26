import { Op } from 'sequelize';
import type { WhereOptions } from 'sequelize';
import BaseRepository from './BaseRepository.js';
import Producto from '../models/Producto.js';

/**
 * Los bytes de la foto quedan fuera de toda lectura de productos. Sin esto, el
 * catálogo baja la imagen de cada fila con solo abrirlo.
 *
 * Sequelize no tiene una opción de "excluir columna por defecto", así que el
 * filtro va explícito en las cinco lecturas base. Con esas cinco alcanza:
 * todos los métodos derivados de más abajo (findByNombre, findAllActivos,
 * findByStockBajo, findByIdActivos...) pasan por alguna de ellas.
 * Para leer los bytes hay que pedirlo a propósito con descargarImagen().
 */
const SIN_BYTES = { exclude: ['imagen'] };

class ProductoRepository extends BaseRepository<Producto> {

    constructor() {
        super(Producto);
    }

    // =========================
    // LECTURAS SIN LOS BYTES
    // =========================

    async findById(id: number): Promise<Producto | null> {
        return await this.model.findByPk(id, { attributes: SIN_BYTES });
    }

    async findBy(keys: WhereOptions<Producto>): Promise<Producto | null> {
        return await this.model.findOne({ where: keys, attributes: SIN_BYTES });
    }

    async findByIds(ids: number[]): Promise<Producto[]> {

        if (ids.length === 0) {
            return [];
        }

        return await this.model.findAll({
            where: { id: { [Op.in]: ids } } as WhereOptions<Producto>,
            attributes: SIN_BYTES
        });
    }

    async findAllBy(
        where: WhereOptions<Producto>,
        page = 1,
        limit = 10,
        orderBy = 'id',
        orderDirection: 'ASC' | 'DESC' = 'ASC'
    ) {
        const offset = (page - 1) * limit;

        return await this.model.findAndCountAll({
            where,
            limit,
            offset,
            order: [[orderBy, orderDirection]],
            attributes: SIN_BYTES
        });
    }

    async findAll(
        page = 1,
        limit = 10,
        orderBy = 'id',
        orderDirection: 'ASC' | 'DESC' = 'ASC'
    ) {
        const offset = (page - 1) * limit;

        return await this.model.findAndCountAll({
            limit,
            offset,
            order: [[orderBy, orderDirection]],
            attributes: SIN_BYTES
        });
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
    // FOTOS
    // =========================

    /**
     * Metadatos de la foto sin los bytes. Es lo que necesitan el alta, la
     * edición y el listado: alcanzan para armar la respuesta de la API sin
     * descargar el archivo.
     */
    async obtenerMetadatosImagen(id: number) {
        const producto = await this.model.findByPk(id, {
            attributes: ['id', 'imagenNombre', 'imagenMime', 'imagenBytes']
        });

        if (!producto || producto.imagenBytes === null) {
            return null;
        }

        return {
            nombre: producto.imagenNombre,
            mime: producto.imagenMime,
            bytes: producto.imagenBytes
        };
    }

    /**
     * Única forma de leer los bytes. descargarImagen() es el único consumidor y
     * lo pide a propósito, porque es el único lugar donde el archivo cruza la
     * red. Ver defaultAttributes en el modelo.
     */
    async descargarImagen(id: number) {
        return await this.model.findByPk(id, {
            attributes: ['id', 'imagen', 'imagenNombre', 'imagenMime', 'imagenBytes']
        });
    }

    /**
     * Los cuatro campos se escriben juntos porque hay un CHECK en la base que
     * rechaza la metadata sin bytes. Encapsularlo acá evita que un futuro
     * guardado escriba solo `imagen` y reviente la restricción con un 500.
     */
    async guardarImagen(
        id: number,
        imagen: { bytes: Buffer; nombre: string; mime: string }
    ): Promise<Producto | null> {

        return await this.updateById(id, {
            imagen: imagen.bytes,
            imagenNombre: imagen.nombre,
            imagenMime: imagen.mime,
            imagenBytes: imagen.bytes.length
        });
    }

    async quitarImagen(id: number): Promise<Producto | null> {
        return await this.updateById(id, {
            imagen: null,
            imagenNombre: null,
            imagenMime: null,
            imagenBytes: null
        });
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