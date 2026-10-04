import { test } from 'node:test';
import assert from 'node:assert/strict';
import sequelize from 'polleria-database/config/database';
import Producto from 'polleria-database/models/Producto';
import TipoProducto from 'polleria-database/models/TipoProducto';
import Precio from 'polleria-database/models/Precio';
import Oferta from 'polleria-database/models/Oferta';
import OfertaProducto from 'polleria-database/models/OfertaProducto';
import Venta from 'polleria-database/models/Venta';
import MovimientoStock from 'polleria-database/models/MovimientoStock';
import { vender, registrarMovimiento, fraccionar } from '../src/services/operaciones.js';
import type { Transaction } from 'sequelize';

test('Sprint 2 sobre PostgreSQL: ventas, ofertas, rollback, ajustes y desposte', async t => {
  // Sólo habilitar en la base descartable de CI; nunca altera la base compartida.
  if (process.env.TEST_DATABASE_SYNC === 'true') await sequelize.sync();
  const transaction = await sequelize.transaction({ logging: false });
  const original = sequelize.transaction.bind(sequelize);
  // Las operaciones usan savepoints: al terminar se revierte toda la prueba.
  t.mock.method(sequelize, 'transaction', (callback: (tx: Transaction) => Promise<unknown>) => original({ transaction, logging: false }, callback));
  try {
    const opciones = { transaction, logging: false };
    const tipo = await TipoProducto.create({ nombre: `TEST-${Date.now()}`, activo: true }, opciones);
    const producto = async (nombre: string, unidadVenta = 'KILOS') => Producto.create({
      codigo: `T-${Date.now().toString(36)}-${nombre}`, nombre, descripcion: '', tipoProductoId: tipo.id,
      unidadCompra: unidadVenta, unidadVenta, factorConversion: 1, stockActual: 20, costoActual: '1',
      activo: true, tipoReposicion: 'stockMinimo', stockMinimo: 2, margenStock: 0,
    }, opciones);
    const pollo = await producto('POLLO'), suprema = await producto('SUPREMA'), unidad = await producto('UNIDAD', 'UNIDADES');
    for (const p of [pollo, suprema, unidad]) await Precio.create({ productoId: p.id, precioMinorista: '10.10', precioMayorista: '8.00', fechaDesde: new Date(Date.now() - 60000), activo: true }, opciones);
    const stock = async (p: Producto) => (await Producto.findByPk(p.id, opciones))!.stockActual;

    await t.test('API HTTP valida entradas, registra ventas y consulta historiales', async () => {
      const { default: app } = await import('../src/app.js');
      const server = app.listen(0, '127.0.0.1');
      await new Promise<void>(resolve => server.once('listening', resolve));
      const address = server.address();
      assert.ok(address && typeof address !== 'string');
      const url = `http://127.0.0.1:${address.port}/api`;
      try {
        assert.equal((await fetch(`${url}/ventas?limite=0`)).status, 400);
        assert.equal((await fetch(`${url}/ventas/abc`)).status, 400);
        assert.equal((await fetch(`${url}/ventas?fechaDesde=incorrecta`)).status, 400);
        assert.equal((await fetch(`${url}/ventas?fechaDesde=2026-02-30`)).status, 400);
        assert.equal((await fetch(`${url}/ventas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })).status, 400);
        const response = await fetch(`${url}/ventas/cotizacion`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ detalles: [{ productoId: pollo.id, cantidad: 0.125 }] }) });
        assert.equal(response.status, 200);
        assert.equal((await response.json()).total, '1.26');
        const p = await producto('HTTP');
        await Precio.create({ productoId: p.id, precioMinorista: '5.00', fechaDesde: new Date(Date.now() - 60000), activo: true }, opciones);
        const ventaHTTP = await fetch(`${url}/ventas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ detalles: [{ productoId: p.id, cantidad: 2 }] }) });
        assert.equal(ventaHTTP.status, 201);
        assert.equal(Number((await ventaHTTP.json()).venta.total), 10);
        assert.equal(await stock(p), 18);
        for (const endpoint of ['/ventas?limite=1', '/stock?limite=1', '/stock/movimientos?limite=1', '/ventas/productos?q=pollo&limite=1']) assert.equal((await fetch(url + endpoint)).status, 200);
      } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
    });

    await t.test('Cotización redondea y no escribe venta ni stock', async () => {
      const antes = await Venta.count(opciones);
      const cotizacion = await vender({ detalles: [{ productoId: pollo.id, cantidad: 0.125 }] }, true);
      assert.equal('total' in cotizacion && cotizacion.total, '1.26');
      assert.equal(await Venta.count(opciones), antes);
      assert.equal(await stock(pollo), 20);
    });
    await t.test('Venta mixta calcula listas y registra egresos vinculados', async () => {
      const resultado = await vender({ detalles: [{ productoId: pollo.id, cantidad: 1.5 }, { productoId: unidad.id, cantidad: 2, tipoPrecio: 'MAYORISTA' }] });
      assert.ok(resultado.venta);
      assert.equal(Number(resultado.venta.total), 31.15);
      assert.equal(await stock(pollo), 18.5);
      assert.equal(await stock(unidad), 18);
      assert.equal(await MovimientoStock.count({ ...opciones, where: { ventaId: resultado.venta.id } }), 2);
    });
    await t.test('Carrito combinado evita superar stock y rechaza unidades fraccionarias', async () => {
      const antes = await Venta.count(opciones);
      await assert.rejects(vender({ detalles: [{ productoId: pollo.id, cantidad: 10 }, { productoId: pollo.id, cantidad: 10 }] }), /Stock insuficiente/);
      await assert.rejects(vender({ detalles: [{ productoId: unidad.id, cantidad: 0.5 }] }), /enteras/);
      assert.equal(await Venta.count(opciones), antes);
      assert.equal(await stock(pollo), 18.5);
    });
    await t.test('Oferta vigente usa componentes activos para precio y stock', async () => {
      const oferta = await Oferta.create({ nombre: 'TEST combo', fechaInicio: new Date(Date.now() - 60000), fechaFin: new Date(Date.now() + 60000), activo: true }, opciones);
      await OfertaProducto.create({ ofertaId: oferta.id, productoId: pollo.id, cantidad: 1, precioOferta: '7.00', activo: true }, opciones);
      await OfertaProducto.create({ ofertaId: oferta.id, productoId: suprema.id, cantidad: 1, precioOferta: '100.00', activo: false }, opciones);
      const resultado = await vender({ detalles: [{ ofertaId: oferta.id, cantidad: 2 }] });
      assert.ok(resultado.venta);
      assert.equal(Number(resultado.venta.total), 14);
      assert.equal(await stock(pollo), 16.5);
      assert.equal(await stock(suprema), 20);
      await oferta.update({ fechaFin: new Date(Date.now() - 1000) }, opciones);
      await assert.rejects(vender({ detalles: [{ ofertaId: oferta.id, cantidad: 1 }] }), /vigente/);
    });
    await t.test('Ingreso, merma justificada y ajuste absoluto persisten', async () => {
      await registrarMovimiento({ productoId: pollo.id, tipo: 'INGRESO', cantMovimiento: 2, motivo: 'Recepción' });
      await registrarMovimiento({ productoId: pollo.id, tipo: 'MERMA', cantMovimiento: 0.5, motivo: 'Recorte' });
      assert.equal(await stock(pollo), 18);
      await registrarMovimiento({ productoId: pollo.id, tipo: 'AJUSTE', stockObjetivo: 10, motivo: 'Conteo físico' });
      assert.equal(await stock(pollo), 10);
    });
    await t.test('Desposte descuenta origen una vez y separa merma del derivado', async () => {
      const resultado = await fraccionar({ productoOrigenId: pollo.id, cantidadOrigen: 2, derivados: [{ productoId: suprema.id, cantidad: 1.8 }], merma: 0.2, motivo: 'Desposte' });
      assert.equal(resultado.movimientos.length, 3);
      assert.ok(resultado.movimientos.every(m => m.motivo?.includes(resultado.operacionId)));
      assert.equal(await stock(pollo), 8);
      assert.equal(await stock(suprema), 21.8);
      await assert.rejects(fraccionar({ productoOrigenId: pollo.id, cantidadOrigen: 50, derivados: [{ productoId: suprema.id, cantidad: 50 }], motivo: 'Desposte' }));
      assert.equal(await stock(pollo), 8);
      assert.equal(await stock(suprema), 21.8);
    });
    await t.test('Falla durante desposte revierte también los movimientos previos', async () => {
      const crear = MovimientoStock.create.bind(MovimientoStock);
      let llamadas = 0;
      const reemplazo = t.mock.method(MovimientoStock, 'create', (...args: Parameters<typeof MovimientoStock.create>) => {
        if (++llamadas === 2) throw new Error('Falla de movimiento');
        return crear(...args);
      });
      const antes = await MovimientoStock.count(opciones);
      try {
        await assert.rejects(fraccionar({ productoOrigenId: pollo.id, cantidadOrigen: 2, derivados: [{ productoId: suprema.id, cantidad: 1.8 }], merma: 0.2, motivo: 'Desposte' }), /Falla de movimiento/);
        assert.equal(await stock(pollo), 8);
        assert.equal(await stock(suprema), 21.8);
        assert.equal(await MovimientoStock.count(opciones), antes);
      } finally { reemplazo.mock.restore(); }
    });
    await t.test('Bajas por vencimiento y rotura quedan justificadas y rechazan faltantes', async () => {
      for (const tipo of ['VENCIMIENTO', 'ROTURA']) {
        const movimiento = await registrarMovimiento({ productoId: unidad.id, tipo, cantMovimiento: 1, motivo: 'Control de mercadería' });
        assert.ok(movimiento?.motivo?.startsWith(tipo));
      }
      assert.equal(await stock(unidad), 16);
      await assert.rejects(registrarMovimiento({ productoId: unidad.id, tipo: 'EGRESO', cantMovimiento: 100, motivo: 'Salida' }), /margen/);
      assert.equal(await stock(unidad), 16);
    });
    await t.test('Falla al escribir el segundo detalle revierte venta completa', async () => {
      const { default: DetalleVenta } = await import('polleria-database/models/DetalleVenta');
      const crear = DetalleVenta.create.bind(DetalleVenta);
      let llamadas = 0;
      const reemplazo = t.mock.method(DetalleVenta, 'create', (...args: Parameters<typeof DetalleVenta.create>) => {
        if (++llamadas === 2) throw new Error('Falla simulada');
        return crear(...args);
      });
      const antes = await Venta.count(opciones);
      try {
        await assert.rejects(vender({ detalles: [{ productoId: pollo.id, cantidad: 1 }, { productoId: suprema.id, cantidad: 1 }] }), /Falla simulada/);
        assert.equal(await Venta.count(opciones), antes);
        assert.equal(await stock(pollo), 8);
      } finally { reemplazo.mock.restore(); }
    });
  } finally {
    t.mock.restoreAll();
    await transaction.rollback();
    await sequelize.close();
  }
});
