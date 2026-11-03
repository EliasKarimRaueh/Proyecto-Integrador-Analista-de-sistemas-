import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import sequelize from 'polleria-database/config/database';
import 'polleria-database/relationships/relationships';
import app from '../src/app.js';
import TipoProducto from 'polleria-database/models/TipoProducto';
import Producto from 'polleria-database/models/Producto';
import Precio from 'polleria-database/models/Precio';
import Oferta from 'polleria-database/models/Oferta';
import MovimientoStock from 'polleria-database/models/MovimientoStock';
import { migrateComprasSprint4 } from 'polleria-database/migrations/comprasSprint4';
import { migrateCuentasProveedores } from 'polleria-database/migrations/cuentasProveedores';

const url = new URL(process.env.DATABASE_URL!);
const habilitado = process.env.TEST_SPRINT4_DATABASE === 'true' && ['localhost', '127.0.0.1'].includes(url.hostname) && url.pathname.endsWith('_test');
test('Bloque 2 PostgreSQL: pesaje real, ranking, vigencias y reactivaciones concurrentes', { skip: !habilitado }, async t => {
  t.after(() => sequelize.close());
  await sequelize.sync();
  await migrateComprasSprint4();
  await migrateCuentasProveedores();
  await migrateComprasSprint4();
  const marca = Date.now().toString(36);
  const [fresco] = await TipoProducto.findOrCreate({ where: { nombre: 'FRESCO' }, defaults: { nombre: 'FRESCO', activo: true } });
  const [congelado] = await TipoProducto.findOrCreate({ where: { nombre: 'CONGELADO' }, defaults: { nombre: 'CONGELADO', activo: true } });
  const crearProducto = (nombre: string, unidadVenta: 'KILOS' | 'UNIDADES', tipoProductoId: number) => Producto.create({ nombre, codigo: `T-${marca}-${nombre[0]}`, tipoProductoId, unidadCompra: unidadVenta, unidadVenta, factorConversion: 1, stockActual: 20, costoActual: '1.00', activo: true, tipoReposicion: 'stockMinimo', stockMinimo: 2, margenStock: 0 });
  const pollo = await crearProducto(`Zeta ${marca}`, 'KILOS', fresco.id), unidad = await crearProducto(`Medallon ${marca}`, 'UNIDADES', congelado.id), sinVentas = await crearProducto(`Alas ${marca}`, 'KILOS', fresco.id);
  for (const p of [pollo, unidad, sinVentas]) await Precio.create({ productoId: p.id, precioMinorista: p.id === unidad.id ? '100.00' : '1000.00', precioMayorista: p.id === unidad.id ? '80.00' : '800.00', fechaDesde: new Date('2020-01-01'), activo: true });
  const hoy = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
  const body = { nombre: `Combo ${marca}`, fechaInicio: hoy, fechaFin: null, descuentoPorcentaje: '10', productos: [{ productoId: pollo.id, cantidad: 3 }, { productoId: unidad.id, cantidad: 1 }] };
  const alta = await request(app).post('/api/ofertas').send(body).expect(201), ofertaId = Number(alta.body.id);
  assert.equal(alta.body.fechaFin, null);
  const ventaBody = { detalles: [{ ofertaId, cantidad: 2, despacho: [{ productoId: pollo.id, cantidadReal: 6.235 }, { productoId: unidad.id, cantidadReal: 2 }] }] };
  let ventaId: number;

  await t.test('cobra el precio promocional y registra el peso real en stock e historial', async () => {
    const cotizacion = await request(app).post('/api/ventas/cotizacion').send(ventaBody).expect(200);
    assert.equal(cotizacion.body.total, '5580.00');
    assert.equal((await Producto.findByPk(pollo.id))!.stockActual, 20);
    const venta = await request(app).post('/api/ventas').send(ventaBody).expect(201);
    ventaId = venta.body.venta.id;
    assert.equal(Number(venta.body.venta.total), 5580);
    assert.equal((await Producto.findByPk(pollo.id))!.stockActual, 13.765);
    assert.equal((await Producto.findByPk(unidad.id))!.stockActual, 18);
    const movimiento = await MovimientoStock.findOne({ where: { ventaId, productoId: pollo.id } });
    assert.equal(movimiento!.cantMovimiento, 6.235);
    const historial = await request(app).get(`/api/ventas/${ventaId}`).expect(200);
    assert.deepEqual(historial.body.detalles[0].despacho.find((p: { productoId: number }) => p.productoId === pollo.id), { productoId: pollo.id, nombre: pollo.nombre, unidadVenta: 'KILOS', cantidadPromocional: 6, cantidadReal: 6.235 });
  });

  await t.test('valida stock real, precisión, unidades y componentes ajenos', async () => {
    await request(app).post('/api/ventas').send({ detalles: [{ ofertaId, cantidad: 1 }] }).expect(400);
    await request(app).post('/api/ventas').send({ detalles: [{ ofertaId, cantidad: 1, despacho: [{ productoId: pollo.id, cantidadReal: 19 }, { productoId: unidad.id, cantidadReal: 1 }] }] }).expect(409);
    await request(app).post('/api/ventas').send({ detalles: [{ ofertaId, cantidad: 1, despacho: [{ productoId: pollo.id, cantidadReal: 3.0001 }, { productoId: unidad.id, cantidadReal: 1 }] }] }).expect(400);
    await request(app).post('/api/ventas').send({ detalles: [{ ofertaId, cantidad: 1, despacho: [{ productoId: pollo.id, cantidadReal: 3 }, { productoId: unidad.id, cantidadReal: 2 }] }] }).expect(400);
    await request(app).post('/api/ventas').send({ detalles: [{ ofertaId, cantidad: 1, despacho: [{ productoId: sinVentas.id, cantidadReal: 3 }, { productoId: unidad.id, cantidadReal: 1 }] }] }).expect(400);
    assert.equal((await Producto.findByPk(pollo.id))!.stockActual, 13.765);
  });

  await t.test('filtra categorías y ordena por nombre y ventas incluyendo promociones', async () => {
    await request(app).post('/api/ventas').send({ detalles: [{ productoId: unidad.id, cantidad: 1 }] }).expect(201);
    const orden = await request(app).get(`/api/ventas/productos?q=${marca}&orden=mas_vendido`).expect(200);
    assert.deepEqual(orden.body.rows.map((p: { id: number }) => p.id), [unidad.id, pollo.id, sinVentas.id]);
    const categoria = await request(app).get(`/api/ventas/productos?q=${marca}&categoria=fres&orden=mas_vendido`).expect(200);
    assert.deepEqual(categoria.body.rows.map((p: { id: number }) => p.id), [pollo.id, sinVentas.id]);
    const alfabetico = await request(app).get(`/api/ventas/productos?q=${marca}&orden=nombre_asc`).expect(200);
    assert.equal(alfabetico.body.rows[0].id, sinVentas.id);
    const categorias = await request(app).get('/api/ventas/categorias').expect(200);
    assert.ok(categorias.body.some((c: { nombre: string }) => c.nombre === 'FRESCO'));
    await request(app).get('/api/ventas/productos?orden=sql').expect(400);
  });

  await t.test('vigencia abierta y snapshot histórico sobreviven a la edición', async () => {
    const vigentes = await request(app).get('/api/ofertas/vigentes').expect(200);
    assert.ok(vigentes.body.some((o: { id: string }) => Number(o.id) === ofertaId));
    await request(app).put(`/api/ofertas/${ofertaId}`).send({ ...body, descuentoPorcentaje: '20', productos: [{ productoId: pollo.id, cantidad: 5 }, { productoId: unidad.id, cantidad: 1 }] }).expect(200);
    const historia = await request(app).get(`/api/ventas/${ventaId}`).expect(200);
    assert.equal(Number(historia.body.detalles[0].subtotal), 5580);
    assert.equal(historia.body.detalles[0].despacho.find((p: { productoId: number }) => p.productoId === pollo.id).cantidadPromocional, 6);
  });

  await t.test('reactiva sin superposición y serializa dos reactivaciones incompatibles', async () => {
    await request(app).delete(`/api/ofertas/${ofertaId}`).expect(200);
    const otra = await request(app).post('/api/ofertas').send({ ...body, nombre: `Alternativa ${marca}` }).expect(201), otraId = Number(otra.body.id);
    await request(app).put(`/api/ofertas/${ofertaId}/reactivar`).send({ fechaInicio: hoy, fechaFin: null }).expect(409);
    assert.equal((await Oferta.findByPk(ofertaId))!.activo, false);
    await request(app).delete(`/api/ofertas/${otraId}`).expect(200);
    const simultaneas = await Promise.all([request(app).put(`/api/ofertas/${ofertaId}/reactivar`).send({ fechaInicio: hoy, fechaFin: null }), request(app).put(`/api/ofertas/${otraId}/reactivar`).send({ fechaInicio: hoy, fechaFin: null })]);
    assert.deepEqual(simultaneas.map(r => r.status).sort(), [200, 409]);
    const todas = await request(app).get('/api/ofertas?incluirBajas=true').expect(200);
    assert.ok(todas.body.some((o: { activo: boolean; id: string }) => [ofertaId, otraId].includes(Number(o.id)) && !o.activo));
    await request(app).post('/api/ofertas').send({ ...body, nombre: `Conflicto ${marca}` }).expect(409);
  });

  await t.test('las ofertas de precio fijo también admiten vigencia abierta', async () => {
    const oferta = await request(app).post('/api/ofertas').send({ nombre: `Precio fijo ${marca}`, fechaInicio: '2020-01-01', productos: [{ productoId: sinVentas.id, cantidad: 3, precioOferta: '1500.00' }] }).expect(201);
    const cotizacion = await request(app).post('/api/ventas/cotizacion').send({ detalles: [{ ofertaId: Number(oferta.body.id), cantidad: 1, despacho: [{ productoId: sinVentas.id, cantidadReal: 3.125 }] }] }).expect(200);
    assert.equal(cotizacion.body.total, '1500.00');
    assert.equal(cotizacion.body.detalles[0].despacho[0].cantidadReal, 3.125);
    await request(app).put(`/api/ofertas/${oferta.body.id}`).send({ fechaFin: '2099-01-01' }).expect(200);
    await request(app).put(`/api/ofertas/${oferta.body.id}`).send({ fechaFin: null }).expect(200);
    assert.equal((await Oferta.findByPk(Number(oferta.body.id)))!.fechaFin, null);
  });

  await t.test('precio final explícito se guarda y cobra en ambas listas sin precio de lista', async () => {
    const producto = await crearProducto(`Final ${marca}`, 'KILOS', fresco.id);
    const datos = { nombre: `Final explícito ${marca}`, fechaInicio: hoy, fechaFin: null, precioFinal: '2500.25', productos: [{ productoId: producto.id, cantidad: 3 }] };
    const res = await request(app).post('/api/ofertas').send(datos).expect(201);
    assert.equal(res.body.precioFinal, '2500.25');
    assert.equal(res.body.descuentoPorcentaje, null);
    const ofertaId = Number(res.body.id);
    for (const tipoPrecio of ['MINORISTA', 'MAYORISTA']) {
      const cotizacion = await request(app).post('/api/ventas/cotizacion').send({ detalles: [{ ofertaId, tipoPrecio, cantidad: 2, despacho: [{ productoId: producto.id, cantidadReal: 6.125 }] }] }).expect(200);
      assert.equal(cotizacion.body.total, '5000.50');
    }
    await request(app).post('/api/ventas').send({ detalles: [{ ofertaId, cantidad: 2, despacho: [{ productoId: producto.id, cantidadReal: 6.125 }] }] }).expect(201);
    assert.equal((await Producto.findByPk(producto.id))!.stockActual, 13.875);
    await request(app).put(`/api/ofertas/${ofertaId}`).send({ ...datos, precioFinal: '1750.50' }).expect(200);
    assert.equal((await Oferta.findByPk(ofertaId))!.precioFinal, '1750.50');
    await request(app).put(`/api/ofertas/${ofertaId}`).send({ ...datos, precioFinal: '0' }).expect(400);
    assert.equal((await Oferta.findByPk(ofertaId))!.precioFinal, '1750.50');
    await request(app).delete(`/api/ofertas/${ofertaId}`).expect(200);
    await request(app).put(`/api/ofertas/${ofertaId}/reactivar`).send({ fechaInicio: hoy, fechaFin: null }).expect(200);
  });
});
