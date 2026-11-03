import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import sequelize from 'polleria-database/config/database';
import 'polleria-database/relationships/relationships';
import app from '../src/app.js';
import TipoProducto from 'polleria-database/models/TipoProducto';
import Proveedor from 'polleria-database/models/Proveedor';
import Producto from 'polleria-database/models/Producto';
import Compra from 'polleria-database/models/Compra';
import PedidoCompra from 'polleria-database/models/PedidoCompra';
import Recepcion from 'polleria-database/models/Recepcion';
import MovimientoStock from 'polleria-database/models/MovimientoStock';
import CuentaProveedor from 'polleria-database/models/CuentaProveedor';
import { migrateComprasSprint4 } from 'polleria-database/migrations/comprasSprint4';
import { migrateCuentasProveedores } from 'polleria-database/migrations/cuentasProveedores';

const url = new URL(process.env.DATABASE_URL!);
const habilitado = process.env.TEST_SPRINT4_DATABASE === 'true' && ['localhost', '127.0.0.1'].includes(url.hostname) && url.pathname.endsWith('_test');

test('Sprint 4 sobre PostgreSQL aislado: abastecimiento, diferencias y rollback real', { skip: !habilitado }, async t => {
  t.after(() => sequelize.close());
  await sequelize.authenticate();
  await sequelize.sync();
  await migrateComprasSprint4();
  await migrateCuentasProveedores();
  await migrateComprasSprint4(); // idempotencia con las tablas ya presentes
  const [tipo] = await TipoProducto.findOrCreate({ where: { nombre: 'FRESCO' }, defaults: { nombre: 'FRESCO', activo: true } });
  const proveedor = await Proveedor.create({ nombre: 'Distribuidor de prueba', ctaCte: true, activo: true });
  const alta = await request(app).post('/api/productos').send({ name: 'Pollo de prueba', category: 'Fresco', unit: 'kg', description: '', unidadCompra: 'CAJONES', factorConversion: 20 }).expect(201);
  const productoId = Number(alta.body.id);
  const segundo = await Producto.create({ codigo: `T-${Date.now()}`, nombre: 'Segundo producto', tipoProductoId: tipo.id, unidadCompra: 'BULTOS', unidadVenta: 'KILOS', factorConversion: 10, stockActual: 5, stockMinimo: 10, costoActual: '7.00', activo: true, tipoReposicion: 'stockMinimo' });
  await Producto.update({ stockActual: 5, stockMinimo: 10 }, { where: { id: productoId } });
  await request(app).put(`/api/proveedores/${proveedor.id}/productos`).send({ productoIds: [productoId, segundo.id] }).expect(200);
  await request(app).put(`/api/stock/${productoId}/proveedor-habitual`).send({ proveedorId: proveedor.id }).expect(200);

  await t.test('filtra reposición por proveedor habitual y convierte movimientos', async () => {
    const reposicion = await request(app).get(`/api/compras/reposicion?proveedorId=${proveedor.id}&soloHabitual=true`).expect(200);
    assert.equal(reposicion.headers['x-total-count'], '1');
    assert.equal(reposicion.body[0].cantidadSugerida, 20);
    await request(app).post('/api/stock/movimientos').send({ productoId, tipo: 'INGRESO', cantMovimiento: 2, unidad: 'COMPRA', motivo: 'Ingreso en cajones' }).expect(201);
    assert.equal((await Producto.findByPk(productoId))!.stockActual, 45);
    await request(app).post('/api/stock/movimientos').send({ productoId, tipo: 'AJUSTE', stockObjetivo: 0.25, unidad: 'COMPRA', motivo: 'Conteo en cajones' }).expect(201);
    assert.equal((await Producto.findByPk(productoId))!.stockActual, 5);
  });

  const detalles = [{ productoId, cantidad: 20, costoEstimado: '1000.00' }, { productoId: segundo.id, cantidad: 10, costoEstimado: '100.00' }];
  const pedidoRes = await request(app).post('/api/pedidos').send({ proveedorId: proveedor.id, detalles }).expect(201);
  const pedidoId = pedidoRes.body.pedido.id;
  const compraRes = await request(app).post('/api/compras').send({ proveedorId: proveedor.id, pedidoId, tipoComprobante: 'FACTURA', numeroComprobante: 'TEST-001', observaciones: 'Compra de prueba', detalles: [{ productoId, cantidadPresentacion: 1, factorConversion: 20, presentacion: 'CAJON', costoPresentacion: 20000 }, { productoId: segundo.id, cantidad: 10, costoUnitario: 100 }] }).expect(201);
  const compraId = compraRes.body.compra.id;

  await t.test('la compra genera deuda y factura el pedido sin ingresar stock', async () => {
    assert.equal(Number(compraRes.body.compra.total), 21000);
    assert.equal(Number((await CuentaProveedor.findOne({ where: { compraId } }))!.importePendiente), 21000);
    assert.equal((await Producto.findByPk(productoId))!.stockActual, 5);
    assert.equal((await PedidoCompra.findByPk(pedidoId))!.estado, 'FACTURADO');
    const consulta = await request(app).get(`/api/compras/${compraId}`).expect(200);
    assert.equal(consulta.body.compra.observaciones, 'Compra de prueba');
    assert.equal(consulta.body.compra.detalles.find((d: { productoId: number }) => d.productoId === productoId).producto.nombre, 'Pollo de prueba');
    await request(app).post(`/api/pedidos/${pedidoId}/cancelar`).expect(409);
  });

  const recepcion = { compraId, observaciones: 'Pesaje real distinto al facturado', detalles: [{ productoId, presentacion: 'KILOS', cantidadPresentacion: 19.5, factorConversion: 1 }, { productoId: segundo.id, presentacion: 'BULTO', cantidadPresentacion: 1, factorConversion: 10 }] };
  await t.test('rechaza diferencias sin justificación y revierte una falla después del primer ingreso', async () => {
    await request(app).post('/api/recepciones').send({ ...recepcion, observaciones: '' }).expect(400);
    const movimientosAntes = await MovimientoStock.count();
    await sequelize.query(`CREATE FUNCTION sprint4_falla_ingreso() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Falla de prueba controlada'; END $$`);
    await sequelize.query(`CREATE TRIGGER sprint4_falla BEFORE INSERT ON movimientos_stock FOR EACH ROW WHEN (NEW."productoId" = ${segundo.id}) EXECUTE FUNCTION sprint4_falla_ingreso()`);
    try {
      const consola = t.mock.method(console, 'error', () => {});
      try { await request(app).post('/api/recepciones').send(recepcion).expect(500); }
      finally { consola.mock.restore(); }
      assert.equal(await Recepcion.count({ where: { compraId } }), 0);
      assert.equal(await MovimientoStock.count(), movimientosAntes);
      assert.equal((await Producto.findByPk(productoId))!.stockActual, 5);
      assert.equal(Number((await Producto.findByPk(segundo.id))!.costoActual), 7);
      assert.equal((await Compra.findByPk(compraId))!.estado, 'PENDIENTE_RECEPCION');
      assert.equal((await PedidoCompra.findByPk(pedidoId))!.estado, 'FACTURADO');
    } finally {
      await sequelize.query('DROP TRIGGER sprint4_falla ON movimientos_stock');
      await sequelize.query('DROP FUNCTION sprint4_falla_ingreso()');
    }
  });

  await t.test('recibe una sola vez y actualiza inventario, costos, estados e historial', async () => {
    const res = await request(app).post('/api/recepciones').send(recepcion).expect(201);
    assert.equal((await Producto.findByPk(productoId))!.stockActual, 24.5);
    assert.equal((await Producto.findByPk(segundo.id))!.stockActual, 15);
    assert.equal(Number((await Producto.findByPk(segundo.id))!.costoActual), 100);
    assert.equal((await Compra.findByPk(compraId))!.estado, 'RECIBIDA');
    assert.equal((await PedidoCompra.findByPk(pedidoId))!.estado, 'RECIBIDO');
    await request(app).post('/api/recepciones').send(recepcion).expect(409);
    assert.equal((await Producto.findByPk(productoId))!.stockActual, 24.5);
    const detalle = await request(app).get(`/api/recepciones/${res.body.recepcion.id}`).expect(200);
    assert.equal(detalle.body.movimientosStock.length, 2);
    const listado = await request(app).get(`/api/compras?proveedorId=${proveedor.id}&estado=RECIBIDA&fechaDesde=2020-01-01&fechaHasta=2099-01-01`).expect(200);
    assert.equal(listado.headers['x-total-count'], '1');
  });

  await t.test('cancela pedidos pendientes y evita facturarlos', async () => {
    const res = await request(app).post('/api/pedidos').send({ proveedorId: proveedor.id, detalles }).expect(201);
    await request(app).post(`/api/pedidos/${res.body.pedido.id}/cancelar`).expect(200);
    await request(app).post('/api/compras').send({ proveedorId: proveedor.id, pedidoId: res.body.pedido.id, tipoComprobante: 'REMITO', numeroComprobante: 'TEST-002', detalles }).expect(409);
  });

  await t.test('evita comprobantes duplicados y recepciones concurrentes duplicadas', async () => {
    const body = { proveedorId: proveedor.id, tipoComprobante: 'REMITO', numeroComprobante: 'TEST-CONCURRENCIA', detalles: [{ productoId, cantidad: 20, costoUnitario: 1000 }] };
    const nueva = await request(app).post('/api/compras').send(body).expect(201);
    await request(app).post('/api/compras').send(body).expect(409);
    assert.equal(await CuentaProveedor.count({ where: { compraId: nueva.body.compra.id } }), 1);
    const recibir = { compraId: nueva.body.compra.id, detalles: [{ productoId, presentacion: 'KILOS', cantidadPresentacion: 20, factorConversion: 1 }] };
    const resultados = await Promise.all([request(app).post('/api/recepciones').send(recibir), request(app).post('/api/recepciones').send(recibir)]);
    assert.deepEqual(resultados.map(r => r.status).sort(), [201, 409]);
    assert.equal(await Recepcion.count({ where: { compraId: nueva.body.compra.id } }), 1);
    assert.equal((await Producto.findByPk(productoId))!.stockActual, 44.5);
  });
});
