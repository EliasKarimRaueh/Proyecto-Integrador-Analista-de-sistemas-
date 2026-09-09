import Producto from '../models/Producto.js';
import TipoProducto from '../models/TipoProducto.js';
import DiaPedido from '../models/DiaPedido.js';
import ProductoDiaPedido from '../models/ProductoDiaPedido.js';
import Proveedor from '../models/Proveedor.js';
import ProductoProveedor from '../models/ProductoProveedor.js';

// TipoProducto 1 ─── N Producto ────────────────────────────────────

TipoProducto.hasMany(Producto, {
    foreignKey: 'tipoProductoId',
    as: 'productos'
});

Producto.belongsTo(TipoProducto, {
    foreignKey: 'tipoProductoId',
    as: 'tipoProducto'
});


// Producto N ─── M DiaPedido ─────────────────────────────────────

// Producto 1 ─── N ProductoDiaPedido

Producto.hasMany(ProductoDiaPedido, {
    foreignKey: 'productoId',
    as: 'diasPedido'
});

ProductoDiaPedido.belongsTo(Producto, {
    foreignKey: 'productoId',
    as: 'producto'
});


// DiaPedido 1 ─── N ProductoDiaPedido

DiaPedido.hasMany(ProductoDiaPedido, {
    foreignKey: 'diaPedidoId',
    as: 'productos'
});

ProductoDiaPedido.belongsTo(DiaPedido, {
    foreignKey: 'diaPedidoId',
    as: 'diaPedido'
});


// Producto N ─── M Proveedor ─────────────────────────────────────────────
// Producto 1 ─── N ProductoProveedor

Producto.hasMany(ProductoProveedor, {
    foreignKey: 'productoId',
    as: 'proveedores'
});

ProductoProveedor.belongsTo(Producto, {
    foreignKey: 'productoId',
    as: 'producto'
});


// Proveedor 1 ─── N ProductoProveedor

Proveedor.hasMany(ProductoProveedor, {
    foreignKey: 'proveedorId',
    as: 'productos'
});

ProductoProveedor.belongsTo(Proveedor, {
    foreignKey: 'proveedorId',
    as: 'proveedor'
});