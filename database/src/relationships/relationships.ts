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
import Pago from '../models/Pago.js';
import CuentaProveedor from '../models/CuentaProveedor.js';
import Compra from '../models/Compra.js';
import PagoPorCuenta from '../models/PagoPorCuenta.js';

import Pedido from '../models/Pedido.js';
import DetallePedido from '../models/DetallePedido.js';
import DetalleCompra from '../models/DetalleCompra.js';

import Recepcion from '../models/Recepcion.js';
import DetalleRecepcion from '../models/DetalleRecepcion.js';


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

// Producto 1 ─── N MovimientoStock ────────────────────────────────────

Producto.hasMany(MovimientoStock, {
    foreignKey: 'productoId',
    as: 'movimientos_stock'
});

MovimientoStock.belongsTo(Producto, {
    foreignKey: 'productoId',
    as: 'producto'
});

// Producto 1 ─── N Precio ────────────────────────────────────

Producto.hasMany(Precio, {
    foreignKey: 'productoId',
    as: 'precios'
});

Precio.belongsTo(Producto, {
    foreignKey: 'productoId',
    as: 'producto'
});

// Oferta N ─── M Producto ────────────────────────────────────
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

// Venta 1 ─── N DetalleVenta ────────────────────────────────────

Venta.hasMany(DetalleVenta, {

    foreignKey: 'ventaId',

    as: 'detalles'

});

DetalleVenta.belongsTo(Venta, {

    foreignKey: 'ventaId',

    as: 'venta'

});


// Producto 1 ─── N DetalleVenta ────────────────────────────────────

Producto.hasMany(DetalleVenta, {

    foreignKey: 'productoId',

    as: 'detallesVenta'

});

DetalleVenta.belongsTo(Producto, {

    foreignKey: 'productoId',

    as: 'producto'

});


// Oferta 1 ─── N DetalleVenta ────────────────────────────────────

Oferta.hasMany(DetalleVenta, {

    foreignKey: 'ofertaId',

    as: 'detallesVenta'

});

DetalleVenta.belongsTo(Oferta, {

    foreignKey: 'ofertaId',

    as: 'oferta'

});


// Venta 1 ─── N MovimientoStock ────────────────────────────────────

Venta.hasMany(MovimientoStock, {

    foreignKey: 'ventaId',

    as: 'movimientosStock'

});

MovimientoStock.belongsTo(Venta, {

    foreignKey: 'ventaId',

    as: 'venta'

});

// Proveedor 1 ─── N Pago ────────────────────────────────────
Proveedor.hasMany(Pago, {
    foreignKey: 'proveedorId',
    as: 'pagos'
});

Pago.belongsTo(Proveedor, {
    foreignKey: 'proveedorId',
    as: 'proveedor'
});

// Proveedor 1 ─── N CuentaProveedor ────────────────────────────────────
Proveedor.hasMany(CuentaProveedor, {
    foreignKey: 'proveedorId',
    as: 'cuentasProveedor'
});

CuentaProveedor.belongsTo(Proveedor, {
    foreignKey: 'proveedorId',
    as: 'proveedor'
});

// Proveedor 1 ─── N Compra ────────────────────────────────────
Proveedor.hasMany(Compra, {
    foreignKey: 'proveedorId',
    as: 'compras'
});

Compra.belongsTo(Proveedor, {
    foreignKey: 'proveedorId',
    as: 'proveedor'
});

// Compra 1 ─── N CuentaProveedor ──────────────────────────────────── 
Compra.hasOne(CuentaProveedor, {
    foreignKey: 'compraId',
    as: 'cuentaProveedor'
});

CuentaProveedor.belongsTo(Compra, {
    foreignKey: 'compraId',
    as: 'compra'
});

// Pago N ─── M CuentaProveedor ──────────────────────────────────── 
// Pago 1 ─── N PagoPorCuenta
Pago.hasMany(PagoPorCuenta, {
    foreignKey: 'pagoId',
    as: 'pagosPorCuenta'
});

PagoPorCuenta.belongsTo(Pago, {
    foreignKey: 'pagoId',
    as: 'pago'
});

// CuentaProveedor 1 ─── N PagoPorCuenta
CuentaProveedor.hasMany(PagoPorCuenta, {
    foreignKey: 'cuentaId',
    as: 'pagosAplicados'
});

PagoPorCuenta.belongsTo(CuentaProveedor, {
    foreignKey: 'cuentaId',
    as: 'cuentaProveedor'
});


// Pedido 1 ─── N DetallePedido ────────────────────────────────────

Pedido.hasMany(DetallePedido, {

    foreignKey: 'pedidoId',

    as: 'detalles'

});

DetallePedido.belongsTo(Pedido, {

    foreignKey: 'pedidoId',

    as: 'pedido'

});


// Proveedor 1 ─── N Pedido ────────────────────────────────────
Proveedor.hasMany(Pedido, {
    foreignKey: 'proveedorId',
    as: 'pedidos'
});

Pedido.belongsTo(Proveedor, {
    foreignKey: 'proveedorId',
    as: 'proveedor'
});

// Producto 1 ─── N DetallePedido ────────────────────────────────────

Producto.hasMany(DetallePedido, {

    foreignKey: 'productoId',

    as: 'detallesProducto'

});

DetallePedido.belongsTo(Producto, {

    foreignKey: 'productoId',

    as: 'producto'

});


// Pedido 1 ─── 1 Compra
// Un pedido puede generar una única compra al registrar su recepción.

Pedido.hasOne(Compra, {
    foreignKey: 'pedidoId',
    as: 'compra'
});

Compra.belongsTo(Pedido, {
    foreignKey: 'pedidoId',
    as: 'pedido'
});


// Compra 1 ─── N DetalleCompra

Compra.hasMany(DetalleCompra, {
    foreignKey: 'compraId',
    as: 'detalles'
});

DetalleCompra.belongsTo(Compra, {
    foreignKey: 'compraId',
    as: 'compra'
});


// Producto 1 ─── N DetalleCompra

Producto.hasMany(DetalleCompra, {
    foreignKey: 'productoId',
    as: 'detallesCompra'
});

DetalleCompra.belongsTo(Producto, {
    foreignKey: 'productoId',
    as: 'producto'
});


// Compra 1 ─── N MovimientoStock

Compra.hasMany(MovimientoStock, {
    foreignKey: 'compraId',
    as: 'movimientosStock'
});

MovimientoStock.belongsTo(Compra, {
    foreignKey: 'compraId',
    as: 'compra'
});

// Compra 1 - 1 Recepcion
Compra.hasOne(Recepcion, {
    foreignKey: 'compraId',
    as: 'recepcion'
});

Recepcion.belongsTo(Compra, {
    foreignKey: 'compraId',
    as: 'compra'
});

Pedido.hasMany(Recepcion, {
    foreignKey: 'pedidoId',
    as: 'recepciones'
});

Recepcion.belongsTo(Pedido, {
    foreignKey: 'pedidoId',
    as: 'pedido'
});

Proveedor.hasMany(Recepcion, {
    foreignKey: 'proveedorId',
    as: 'recepciones'
});

Recepcion.belongsTo(Proveedor, {
    foreignKey: 'proveedorId',
    as: 'proveedor'
});

// Recepcion 1 - N DetalleRecepcion
Recepcion.hasMany(DetalleRecepcion, {
    foreignKey: 'recepcionId',
    as: 'detalles'
});

DetalleRecepcion.belongsTo(Recepcion, {
    foreignKey: 'recepcionId',
    as: 'recepcion'
});

Producto.hasMany(DetalleRecepcion, {
    foreignKey: 'productoId',
    as: 'detallesRecepcion'
});

DetalleRecepcion.belongsTo(Producto, {
    foreignKey: 'productoId',
    as: 'producto'
});

Recepcion.hasMany(MovimientoStock, {
    foreignKey: 'recepcionId',
    as: 'movimientosStock'
});

MovimientoStock.belongsTo(Recepcion, {
    foreignKey: 'recepcionId',
    as: 'recepcion'
});
