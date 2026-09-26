import { Model, Op } from 'sequelize';
import type { CreateOptions, ModelStatic, WhereOptions } from 'sequelize';

class BaseRepository<T extends Model> {

    protected model: ModelStatic<T>;

    constructor(model: ModelStatic<T>) {
        this.model = model;
    }

    async findById(id: number): Promise<T | null> {
        return await this.model.findByPk(id);
    }

    async findAllBy(
        where: WhereOptions<T>,
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
            order: [[orderBy, orderDirection]]
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
            limit: limit,
            offset: offset,
            order: [[orderBy, orderDirection]]
        });
    }

    /**
     * options se reenvía a Sequelize para poder crear dentro de una
     * transacción abierta por otro repositorio ({ transaction }).
     */
    async create(data: Partial<T>, options: CreateOptions<T> = {}): Promise<T> {
        return await this.model.create(data as any, options);
    }

    /**
     * Trae varios registros por id en una sola consulta. Se usa para
     * armar respuestas anidadas sin caer en el N+1 de un findById por
     * cada relación.
     */
    async findByIds(ids: number[]): Promise<T[]> {

        if (ids.length === 0) {
            return [];
        }

        return await this.model.findAll({
            where: { id: { [Op.in]: ids } } as WhereOptions<T>
        });
    }

    async updateById(id: number, data: Partial<T>): Promise<T | null> {

        const registro = await this.findById(id);

        if (!registro) {
            return null;
        }

        await registro.update(data);

        return registro;
    }

    async deleteById(id: number): Promise<T | null> {

        const record = await this.findById(id);

        if (!record) {
            return null;
        }

        await record.update({
            activo: false,
            fechaBaja: new Date()
        } as any);

        return record;
    }

    async findBy(keys: WhereOptions<T>): Promise<T | null> {
        return await this.model.findOne({
            where: keys
        });
    }

    async updateBy(
        keys: WhereOptions<T>,
        data: Partial<T>
    ): Promise<T | null> {

        const record = await this.findBy(keys);

        if (!record) {
            return null;
        }

        await record.update(data);

        return record;
    }

    async deleteBy(keys: WhereOptions<T>): Promise<T | null> {

        const record = await this.findBy(keys);

        if (!record) {
            return null;
        }

        await record.update({
            activo: false,
            fechaBaja: new Date()
        } as any);

        return record;
    }


    async count(where: WhereOptions = {}): Promise<number> {
        return await this.model.count({ where });
    }

}

export default BaseRepository;
