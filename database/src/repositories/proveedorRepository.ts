import { Op } from 'sequelize';
import type { Transaction, WhereOptions } from 'sequelize';

import BaseRepository from './BaseRepository.js';
import Proveedor from '../models/Proveedor.js';
import Pago from '../models/Pago.js';
import Producto from '../models/Producto.js';

import CompraRepository from './compraRepository.js';
import CuentaProveedorRepository from './cuentaProveedorRepository.js';
import ProductoProveedorRepository from './productoProveedorRepository.js';

type FiltroEstadoCuenta = 'TODAS' | 'PAGADO' | 'NO_PAGADO';

class ProveedorRepository extends BaseRepository<Proveedor> {

    private compraRepository: CompraRepository;
    private cuentaProveedorRepository: CuentaProveedorRepository;

    constructor() {
        super(Proveedor);

        this.compraRepository = new CompraRepository();
        this.cuentaProveedorRepository = new CuentaProveedorRepository();
    }

    // =========================
    // CREACIÓN
    // =========================

    async crear(
        datos: Partial<Proveedor>,
        transaction?: Transaction
    ): Promise<Proveedor> {

        return await this.create(
            datos,
            { transaction }
        );
    }

    // =========================
    // BÚSQUEDAS
    // =========================

    /**
     * Busca un proveedor por su clave primaria.
     */
    async buscarPorId(
        id: number,
        transaction?: Transaction
    ): Promise<Proveedor | null> {

        return await this.findById(
            id,
            transaction
        );
    }

    /**
     * Busca todos los proveedores sin paginación.
     */
    async buscarTodos(
        orderBy = 'id',
        orderDirection: 'ASC' | 'DESC' = 'ASC',
        transaction?: Transaction
    ): Promise<Proveedor[]> {

        return await Proveedor.findAll({
            order: [[orderBy, orderDirection]],
            transaction
        });
    }

    /**
     * Busca proveedores con paginación.
     */
    async listarPaginados(
        page = 1,
        limit = 10,
        orderBy = 'id',
        orderDirection: 'ASC' | 'DESC' = 'ASC',
        transaction?: Transaction
    ) {

        return await this.findAll(
            page,
            limit,
            orderBy,
            orderDirection,
            transaction
        );
    }

    /**
     * Busca un proveedor por nombre exacto.
     * Se conserva para mantener compatibilidad con el código existente.
     */
    async findByName(
        nombre: string,
        transaction?: Transaction
    ): Promise<Proveedor | null> {

        return await this.findBy(
            { nombre },
            transaction
        );
    }

    /**
     * Busca proveedores cuyo nombre contenga el texto recibido.
     * La búsqueda no distingue mayúsculas y minúsculas.
     */
    async buscarPorNombre(
        nombre: string,
        page = 1,
        limit = 10,
        orderBy = 'nombre',
        orderDirection: 'ASC' | 'DESC' = 'ASC',
        transaction?: Transaction
    ) {

        return await this.findAllBy(
            {
                nombre: {
                    [Op.iLike]: `%${nombre}%`
                }
            } as WhereOptions<Proveedor>,
            page,
            limit,
            orderBy,
            orderDirection,
            transaction
        );
    }

    /**
     * Busca un proveedor por CUIL exacto.
     */
    async buscarPorCuil(
        cuil: string,
        transaction?: Transaction
    ): Promise<Proveedor | null> {

        return await this.findBy(
            { cuil },
            transaction
        );
    }

    /**
     * Busca proveedores según su estado de actividad.
     */
    async buscarPorEstado(
        activo: boolean,
        page = 1,
        limit = 10,
        orderBy = 'id',
        orderDirection: 'ASC' | 'DESC' = 'ASC',
        transaction?: Transaction
    ) {

        return await this.findAllBy(
            { activo } as WhereOptions<Proveedor>,
            page,
            limit,
            orderBy,
            orderDirection,
            transaction
        );
    }

    /**
     * Busca proveedores según tengan habilitada o no
     * la cuenta corriente.
     */
    async buscarPorCuentaCorriente(
        ctaCte: boolean,
        page = 1,
        limit = 10,
        orderBy = 'id',
        orderDirection: 'ASC' | 'DESC' = 'ASC',
        transaction?: Transaction
    ) {

        return await this.findAllBy(
            { ctaCte } as WhereOptions<Proveedor>,
            page,
            limit,
            orderBy,
            orderDirection,
            transaction
        );
    }

    /**
    * Verifica si un proveedor tiene al menos un pago
    * con saldo pendiente de aplicación.
    *
    * @param proveedorId - ID del proveedor.
    * @param transaction - Transacción opcional de Sequelize.
    * @returns true si tiene pagos pendientes; false en caso contrario.
    */
    async tienePagosPendientes(
        proveedorId: number,
        transaction?: Transaction
    ): Promise<boolean> {
        const pago = await Pago.findOne({
            where: {
                proveedorId,
                importePendiente: {
                    [Op.gt]: 0
                }
            },
            transaction
        });

        return pago !== null;
    }

    /**
    * Busca todos los pagos de un proveedor que tengan
    * un saldo pendiente de aplicación mayor que cero.
    *
    * @param proveedorId - ID del proveedor.
    * @param transaction - Transacción opcional de Sequelize.
    * @returns Lista de pagos pendientes de aplicación.
    */
    async buscarPagosPendientes(
        proveedorId: number,
        transaction?: Transaction
    ): Promise<Pago[]> {
        return await Pago.findAll({
            where: {
                proveedorId,
                importePendiente: {
                    [Op.gt]: 0
                }
            },
            order: [['fechaHora', 'ASC']],
            transaction
        });
    }

    /**
    * Busca los productos asociados a un proveedor,
    * delegando la consulta a ProductoProveedorRepository.
    *
    * @param proveedorId - ID del proveedor.
    * @param productoProveedorRepository - Repositorio de relaciones producto-proveedor.
    * @param transaction - Transacción opcional de Sequelize.
    * @returns Lista de productos asociados al proveedor.
    */
    async buscarProductos(
        proveedorId: number,
        productoProveedorRepository: ProductoProveedorRepository,
        transaction?: Transaction
    ): Promise<Producto[]> {
        return await productoProveedorRepository.getProductos(
            proveedorId,
            transaction
        );
    }

    // =========================
    // ACTUALIZACIONES
    // =========================

    /**
     * Actualiza los datos de un proveedor por su PK.
     */
    async actualizar(
        id: number,
        datos: Partial<Proveedor>,
        transaction?: Transaction
    ): Promise<Proveedor | null> {

        return await this.updateById(
            id,
            datos,
            transaction
        );
    }

    /**
     * Actualiza únicamente el nombre.
     * Se conserva para mantener compatibilidad con el código existente.
     */
    async updateNombre(
        id: number,
        nombre: string,
        transaction?: Transaction
    ): Promise<Proveedor | null> {

        return await this.updateById(
            id,
            { nombre },
            transaction
        );
    }

    // =========================
    // BAJA LÓGICA
    // =========================

    /**
     * Da de baja lógicamente un proveedor por su PK.
     */
    async eliminar(
        id: number,
        transaction?: Transaction
    ): Promise<Proveedor | null> {

        return await this.deleteById(
            id,
            transaction
        );
    }

    /**
     * Da de baja lógicamente un proveedor por nombre exacto.
     * Se conserva para mantener compatibilidad con el código existente.
     */
    async deleteByName(
        nombre: string,
        transaction?: Transaction
    ): Promise<Proveedor | null> {

        const proveedor = await this.findByName(
            nombre,
            transaction
        );

        if (!proveedor) {
            return null;
        }

        return await this.deleteById(
            proveedor.id,
            transaction
        );
    }

    // =========================
    // COMPRAS RELACIONADAS
    // =========================

    /**
     * Busca las compras de un proveedor.
     * La consulta se delega a CompraRepository.
     */
    async buscarComprasPorProveedor(
        proveedorId: number,
        page = 1,
        limit = 10,
        orderBy = 'fechaHora',
        orderDirection: 'ASC' | 'DESC' = 'DESC',
        transaction?: Transaction
    ) {

        return await this.compraRepository.buscarPorProveedor(
            proveedorId,
            page,
            limit,
            orderBy,
            orderDirection,
            transaction
        );
    }

    // =========================
    // CUENTAS CORRIENTES RELACIONADAS
    // =========================

    /**
     * Busca las cuentas corrientes de un proveedor.
     *
     * Filtros:
     * - TODAS: incluye todos los estados.
     * - PAGADO: incluye únicamente las cuentas pagadas.
     * - NO_PAGADO: incluye cuentas pendientes y parcialmente pagadas.
     *
     * La consulta se delega a CuentaProveedorRepository.
     */
    async buscarCuentasProveedor(
        proveedorId: number,
        estado: FiltroEstadoCuenta = 'TODAS',
        page = 1,
        limit = 10,
        orderBy = 'id',
        orderDirection: 'ASC' | 'DESC' = 'ASC',
        transaction?: Transaction
    ) {

        return await this.cuentaProveedorRepository.buscarPorProveedor(
            proveedorId,
            estado,
            page,
            limit,
            orderBy,
            orderDirection,
            transaction
        );
    }
}

export default ProveedorRepository;