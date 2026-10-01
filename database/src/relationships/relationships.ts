import Producto from '../models/Producto.js';
import TipoProducto from '../models/TipoProducto.js';
import DiaPedido from '../models/DiaPedido.js';
import ProductoDiaPedido from '../models/ProductoDiaPedido.js';
import Proveedor from '../models/Proveedor.js';
import ProductoProveedor from '../models/ProductoProveedor.js';
import MovimientoStock from '../models/MovimientoStock.js';
import Precio from '../models/Precio.js';
import Oferta from '../models/Oferta.js';
import OfertaProducto from '../models/OfertaProducto.js';
import Venta from '../models/Venta.js';
import DetalleVenta from '../models/DetalleVenta.js';

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

// Producto 1 ─── N MovimientoStock

Producto.hasMany(MovimientoStock, {
    foreignKey: 'productoId',
    as: 'movimientos_stock'
});

MovimientoStock.belongsTo(Producto, {
    foreignKey: 'productoId',
    as: 'producto'
});

// Producto 1 ─── N Precio

Producto.hasMany(Precio, {
    foreignKey: 'productoId',
    as: 'precios'
});

Precio.belongsTo(Producto, {
    foreignKey: 'productoId',
    as: 'producto'
});

// Oferta N ─── M Producto
// Oferta 1 ─── M OfertaProducto

Oferta.hasMany(OfertaProducto, {
    foreignKey: 'ofertaId',
    as: 'productos'
});

OfertaProducto.belongsTo(Oferta, {
    foreignKey: 'ofertaId',
    as: 'oferta'
});
// Producto 1 ─── M OfertaProducto
Producto.hasMany(OfertaProducto, {
    foreignKey: 'productoId',
    as: 'ofertas'
});

OfertaProducto.belongsTo(Producto, {
    foreignKey: 'productoId',
    as: 'producto'
});

// Venta 1 ─── N DetalleVenta

Venta.hasMany(DetalleVenta, {

    foreignKey: 'ventaId',

    as: 'detalles'

});

DetalleVenta.belongsTo(Venta, {

    foreignKey: 'ventaId',

    as: 'venta'

});


// Producto 1 ─── N DetalleVenta

Producto.hasMany(DetalleVenta, {

    foreignKey: 'productoId',

    as: 'detallesVenta'

});

DetalleVenta.belongsTo(Producto, {

    foreignKey: 'productoId',

    as: 'producto'

});


// Oferta 1 ─── N DetalleVenta

Oferta.hasMany(DetalleVenta, {

    foreignKey: 'ofertaId',

    as: 'detallesVenta'

});

DetalleVenta.belongsTo(Oferta, {

    foreignKey: 'ofertaId',

    as: 'oferta'

});


// Venta 1 ─── N MovimientoStock

Venta.hasMany(MovimientoStock, {

    foreignKey: 'ventaId',

    as: 'movimientosStock'

});

MovimientoStock.belongsTo(Venta, {

    foreignKey: 'ventaId',

    as: 'venta'

});