import BaseRepository from './BaseRepository.js';
import DiaPedido from '../models/DiaPedido.js';

class DiaPedidoRepository extends BaseRepository<DiaPedido> {

    constructor() {
        super(DiaPedido);
    }

    async findByName(
        nombre: DiaPedido['nombre']
    ): Promise<DiaPedido | null> {

        return await this.findBy({ nombre });
    }

    async updateNombre(
        id: number,
        nombre: DiaPedido['nombre']
    ): Promise<DiaPedido | null> {

        return await this.updateById(id, { nombre });
    }

    async deleteByName(
        nombre: DiaPedido['nombre']
    ): Promise<DiaPedido | null> {

        const diaPedido = await this.findByName(nombre);

        if (!diaPedido) {
            return null;
        }

        return await this.deleteById(diaPedido.id);
    }
}

export default DiaPedidoRepository;