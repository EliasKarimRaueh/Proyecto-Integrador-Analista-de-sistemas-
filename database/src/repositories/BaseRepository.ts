import { Model, Op } from 'sequelize';
import type {
    CreateOptions,
    ModelStatic,
    WhereOptions,
    Transaction
} from 'sequelize';

class BaseRepository<T extends Model> {

    protected model: ModelStatic<T>;

    constructor(model: ModelStatic<T>) {
        this.model = model;
    }

    // =========================
    // BÚSQUEDAS
    // =========================

    async findById(
        id: number,
        transaction?: Transaction
    ): Promise<T | null> {

        return await this.model.findByPk(id, {
            transaction
        });
    }

    async findAllBy(
        where: WhereOptions<T>,
        page = 1,
        limit = 10,
        orderBy = 'id',
        orderDirection: 'ASC' | 'DESC' = 'ASC',
        transaction?: Transaction
    ) {
        const offset = (page - 1) * limit;

        return await this.model.findAndCountAll({
            where,
            limit,
            offset,
            order: [[orderBy, orderDirection]],
            transaction
        });
    }

    async findAll(
        page = 1,
        limit = 10,
        orderBy = 'id',
        orderDirection: 'ASC' | 'DESC' = 'ASC',
        transaction?: Transaction
    ) {
        const offset = (page - 1) * limit;

        return await this.model.findAndCountAll({
            limit,
            offset,
            order: [[orderBy, orderDirection]],
            transaction
        });
    }

    async findBy(
        keys: WhereOptions<T>,
        transaction?: Transaction
    ): Promise<T | null> {

        return await this.model.findOne({
            where: keys,
            transaction
        });
    }
    /**
     * Trae varios registros por id en una sola consulta. Se usa para
     * armar respuestas anidadas sin caer en el N+1 de un findById por
     * cada relación.
     */
    async findByIds(
        ids: number[],
        transaction?: Transaction
    ): Promise<T[]> {

        if (ids.length === 0) {
            return [];
        }

        return await this.model.findAll({
            where: {
                id: {
                    [Op.in]: ids
                }
            } as WhereOptions<T>,
            transaction
        });
    }

    // =========================
    // CREACIÓN
    // =========================

    /**
     * options se reenvía a Sequelize para poder crear dentro de una
     * transacción abierta por otro repositorio ({ transaction }).
     */
    async create(
        data: Partial<T>,
        options: CreateOptions<T> = {}
    ): Promise<T> {

        return await this.model.create(
            data as any,
            options
        );
    }

    // =========================
    // ACTUALIZACIONES
    // =========================

    async updateById(
        id: number,
        data: Partial<T>,
        transaction?: Transaction
    ): Promise<T | null> {

        const registro = await this.findById(
            id,
            transaction
        );

        if (!registro) {
            return null;
        }

        await registro.update(
            data,
            { transaction }
        );

        return registro;
    }

    async updateBy(
        keys: WhereOptions<T>,
        data: Partial<T>,
        transaction?: Transaction
    ): Promise<T | null> {

        const record = await this.findBy(
            keys,
            transaction
        );

        if (!record) {
            return null;
        }

        await record.update(
            data,
            { transaction }
        );

        return record;
    }

    // =========================
    // BAJA LÓGICA
    // =========================

    async deleteById(
        id: number,
        transaction?: Transaction
    ): Promise<T | null> {

        const record = await this.findById(
            id,
            transaction
        );

        if (!record) {
            return null;
        }

        await record.update(
            {
                activo: false,
                fechaBaja: new Date()
            } as any,
            { transaction }
        );

        return record;
    }

    async deleteBy(
        keys: WhereOptions<T>,
        transaction?: Transaction
    ): Promise<T | null> {

        const record = await this.findBy(
            keys,
            transaction
        );

        if (!record) {
            return null;
        }

        await record.update(
            {
                activo: false,
                fechaBaja: new Date()
            } as any,
            { transaction }
        );

        return record;
    }

    // =========================
    // CONTADORES
    // =========================

    async count(
        where: WhereOptions = {},
        transaction?: Transaction
    ): Promise<number> {

        return await this.model.count({
            where,
            transaction
        });
    }
}

export default BaseRepository;