import Producto from '../models/Producto.js';
import BaseRepository from './BaseRepository.js';

export const productoRepository = new BaseRepository<Producto>(Producto);

export default productoRepository;