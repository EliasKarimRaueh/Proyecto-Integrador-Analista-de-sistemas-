import BaseRepository from './BaseRepository.js';
import Proveedor from '../models/Proveedor.js';

class ProveedorRepository extends BaseRepository<Proveedor> {

    constructor() {
        super(Proveedor);
    }

    async findByName(nombre: string): Promise<Proveedor | null> {
        return await this.findBy({ nombre });
    }

    async updateNombre(
        id: number,
        nombre: string
    ): Promise<Proveedor | null> {

        return await this.updateById(id, { nombre });
    }

    async deleteByName(nombre: string): Promise<Proveedor | null> {

        const proveedor = await this.findByName(nombre);

        if (!proveedor) {
            return null;
        }

        return await this.deleteById(proveedor.id);
    }
}

export default ProveedorRepository;