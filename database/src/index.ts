import sequelize from './config/database.js';
import Producto from './models/Producto.js';
import TipoProducto from './models/TipoProducto.js';
import DiaPedido from './models/DiaPedido.js';
import ProductoDiaPedido from './models/ProductoDiaPedido.js';
import Proveedor from './models/Proveedor.js';
import ProductoProveedor from './models/ProductoProveedor.js';
import productoRepository from './repositories/productoRepository.js';
import { ValidationError } from 'sequelize';
import './relantionships/relationships.js';

export {
    sequelize,
    Producto,
    TipoProducto,
    DiaPedido,
    ProductoDiaPedido,
    Proveedor,
    ProductoProveedor,
    productoRepository,
    ValidationError
};