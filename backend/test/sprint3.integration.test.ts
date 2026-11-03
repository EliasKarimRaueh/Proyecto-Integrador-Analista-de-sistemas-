import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sequelize from 'polleria-database/config/database';
import 'polleria-database/relationships/relationships';
import Proveedor from 'polleria-database/models/Proveedor';
import Producto from 'polleria-database/models/Producto';
import TipoProducto from 'polleria-database/models/TipoProducto';
import Precio from 'polleria-database/models/Precio';
import Pago from 'polleria-database/models/Pago';
import PagoPorCuenta from 'polleria-database/models/PagoPorCuenta';
import Compra from 'polleria-database/models/Compra';
import { migrateCuentasProveedores } from 'polleria-database/migrations/cuentasProveedores';
import { migrateProveedores } from 'polleria-database/migrations/proveedores';
import { asociarProductos, registrarComprobante, registrarPago, estadoCuenta } from '../src/services/proveedores.js';
import { guardarOfertaGlobal } from '../src/services/ofertasGlobales.js';
import { vender } from '../src/services/operaciones.js';
import type { Transaction } from 'sequelize';

test('Sprint 3 en PostgreSQL: migración, asociaciones, comprobantes, pagos y ofertas con rollback', { timeout: 120000 }, async t => {
  const original = sequelize.transaction.bind(sequelize);
  const exterior = await original();
  // Todas las operaciones y el DDL quedan dentro de una transacción que se revierte.
  t.mock.method(sequelize, 'transaction', (...args: unknown[]) => {
    const callback = args.at(-1) as (tx: Transaction) => Promise<unknown>;
    const opciones = args.length > 1 ? args[0] as object : {};
    return original({ ...opciones, transaction: exterior }, callback);
  });
  try {
    await migrateCuentasProveedores(); await migrateProveedores();
    // Idempotencia del DDL sobre una base ya migrada.
    await migrateCuentasProveedores(); await migrateProveedores();
    const opciones = { transaction: exterior };
    const proveedor = await Proveedor.create({ nombre: `TEST-S3-${randomUUID().slice(0, 8)}`, activo: true, ctaCte: true, direccion: 'Prueba 123', diasEntrega: ['Lunes'] }, opciones);
    const tipo = await TipoProducto.create({ nombre: `S3-${randomUUID().slice(0, 8)}`, activo: true }, opciones);
    const producto = await Producto.create({ codigo: `S3-${randomUUID().slice(0, 12)}`, nombre: 'Pollo integración S3', tipoProductoId: tipo.id, unidadCompra: 'KILOS', unidadVenta: 'KILOS', factorConversion: 1, stockActual: 100, costoActual: '1', activo: true, tipoReposicion: 'diario', stockMinimo: null, margenStock: 0 }, opciones);
    await Precio.create({ productoId: producto.id, precioMinorista: '100.00', precioMayorista: '80.00', fechaDesde: new Date(Date.now() - 60000), activo: true }, opciones);
    await t.test('asocia, desasocia y reactiva sin duplicar la relación', async () => {
      await asociarProductos(proveedor.id, { productoIds: [producto.id] });
      await asociarProductos(proveedor.id, { productoIds: [] });
      const resultado = await asociarProductos(proveedor.id, { productoIds: [producto.id] });
      assert.equal(resultado.length, 1); assert.equal(resultado[0].activo, true);
    });
    await t.test('comprobante y pago son idempotentes, parciales y totales', async () => {
      const clave = randomUUID();
      const body = { total: '100.50', numeroComprobante: 'S3-001', fecha: '2020-01-01', claveOperacion: clave };
      const compra = await registrarComprobante(proveedor.id, body);
      assert.equal((await registrarComprobante(proveedor.id, body)).id, compra.id);
      assert.equal(await Compra.count({ ...opciones, where: { proveedorId: proveedor.id } }), 1);
      const pagoBody = { importe: '25.25', claveOperacion: randomUUID() };
      const pago = await registrarPago(proveedor.id, pagoBody);
      assert.equal((await registrarPago(proveedor.id, pagoBody)).pago.id, pago.pago.id);
      assert.equal(await Pago.count({ ...opciones, where: { proveedorId: proveedor.id } }), 1);
      let estado = await estadoCuenta(proveedor.id, {});
      assert.equal(estado.saldo, '75.25'); assert.equal(estado.cuentas.rows[0].estado, 'PAGO PARCIAL');
      PagoPorCuenta.addHook('beforeCreate', 'sprint3-fallo', () => { throw new Error('Fallo simulado al aplicar el pago'); });
      try { await assert.rejects(() => registrarPago(proveedor.id, { importe: '5.00', claveOperacion: randomUUID() }), /Fallo simulado/); }
      finally { PagoPorCuenta.removeHook('beforeCreate', 'sprint3-fallo'); }
      assert.equal((await estadoCuenta(proveedor.id, {})).saldo, '75.25');
      assert.equal(await Pago.count({ ...opciones, where: { proveedorId: proveedor.id } }), 1);
      await assert.rejects(() => registrarPago(proveedor.id, { importe: '75.26', claveOperacion: randomUUID() }), /supera la deuda/);
      await registrarPago(proveedor.id, { importe: '75.25', claveOperacion: randomUUID() });
      estado = await estadoCuenta(proveedor.id, {});
      assert.equal(estado.saldo, '0.00'); assert.equal(estado.cuentas.rows[0].estado, 'PAGADO');
      assert.equal(estado.pagos.count, 2);
    });
    await t.test('los endpoints HTTP consultan y registran comprobantes y pagos', async () => {
      const { default: app } = await import('../src/app.js');
      const server = app.listen(0, '127.0.0.1');
      await new Promise<void>(resolve => server.once('listening', resolve));
      const address = server.address(); assert.ok(address && typeof address !== 'string');
      const url = `http://127.0.0.1:${address.port}/api/proveedores/${proveedor.id}`;
      const request = (path: string, options: RequestInit = {}) => fetch(url + path, { ...options, signal: AbortSignal.timeout(15000) });
      const post = (path: string, body: unknown) => request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      try {
        assert.equal((await request('/productos')).status, 200);
        assert.equal((await request('/cuenta?desde=2026-02-30')).status, 400);
        const compra = await post('/comprobantes', { total: '5.50', fecha: '2020-01-01', numeroComprobante: 'S3-HTTP', claveOperacion: randomUUID() });
        assert.equal(compra.status, 201);
        const body = { importe: '5.50', claveOperacion: randomUUID() };
        const pago = await post('/pagos', body); assert.equal(pago.status, 201);
        const id = (await pago.json()).pago.id;
        assert.equal((await (await post('/pagos', body)).json()).pago.id, id);
        const estado = await (await request('/cuenta')).json();
        assert.equal(estado.saldo, '0.00'); assert.equal(estado.pagos.count, 3);
      } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
    });
    await t.test('oferta suma precios de lista por cantidad y descuenta sobre el subtotal', async () => {
      const oferta = await guardarOfertaGlobal(undefined, { nombre: 'Combo S3', descripcion: '', fechaInicio: '2020-01-01', fechaFin: '2099-01-01', descuentoPorcentaje: '10.00', productos: [{ productoId: producto.id, cantidad: 1.25 }] });
      const cotizacion = await vender({ detalles: [{ ofertaId: oferta.id, cantidad: 2, tipoPrecio: 'MAYORISTA' }] }, true);
      assert.equal('total' in cotizacion && cotizacion.total, '180.00');
      assert.equal(Number((await Producto.findByPk(producto.id, opciones))!.stockActual), 100);
      const venta = await vender({ detalles: [{ ofertaId: oferta.id, cantidad: 2, tipoPrecio: 'MAYORISTA' }] });
      assert.ok(venta.venta);
      assert.equal(Number(venta.venta.total), 180);
      assert.equal(Number((await Producto.findByPk(producto.id, opciones))!.stockActual), 97.5);
    });
  } finally { t.mock.restoreAll(); await exterior.rollback(); await sequelize.close(); }
});
