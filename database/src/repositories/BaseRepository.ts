import { Model, ModelStatic, WhereOptions } from 'sequelize';

class BaseRepository<T extends Model> {

    protected model: ModelStatic<T>;

    constructor(model: ModelStatic<T>) {
        this.model = model;
    }

    async findById(id: number): Promise<T | null> {
        return await this.model.findByPk(id);
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

    async create(data: Partial<T>): Promise<T> {
        return await this.model.create(data as any);
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
}

export default BaseRepository;