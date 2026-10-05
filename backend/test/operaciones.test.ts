import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { centavos, importe } from '../src/services/dinero.js';
process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
const { numero, id, estadoStock, registrarMovimiento, fraccionar, vender } = await import('../src/services/operaciones.js');
const { default: sequelize } = await import('polleria-database/config/database');
after(() => sequelize.close());
test('Importes usan redondeo decimal exacto y aceptan notación exponencial', () => {
  assert.equal(importe(centavos(1, '1.005')), '1.01');
  assert.equal(importe(centavos(0.125, '10.10')), '1.26');
  assert.equal(importe(centavos(3, '0.10')), '0.30');
  assert.equal(importe(centavos(1e-7, '100000')), '0.01');
});
test('Estados de reposición: límite, proximidad, normal y sin mínimo', () => {
  assert.equal(estadoStock(10, 10), 'Crítico');
  assert.equal(estadoStock(11, 10), 'Próximo al Mínimo');
  assert.equal(estadoStock(13, 10), 'Normal');
  assert.equal(estadoStock(0, null), 'Crítico');
  assert.equal(estadoStock(5, null), 'Normal');
});
test('Cantidades e identificadores rechazan booleanos, blancos y no finitos', () => {
  for (const value of [true, '', ' ', null, NaN, Infinity, -1]) assert.throws(() => numero(value, 'cantidad'));
  assert.throws(() => id(1.5));
  assert.equal(numero('0.125', 'cantidad'), 0.125);
});
test('Movimientos rechazan tipo desconocido y bajas sin justificación', async () => {
  await assert.rejects(registrarMovimiento({ productoId: 1, tipo: 'DESCONOCIDO', cantMovimiento: 1, motivo: 'test' }));
  await assert.rejects(registrarMovimiento({ productoId: 1, tipo: 'MERMA', cantMovimiento: 1 }));
});
test('Fraccionamiento valida balance, derivados duplicados y origen', async () => {
  const base = { productoOrigenId: 1, cantidadOrigen: 10, motivo: 'Desposte' };
  await assert.rejects(fraccionar({ ...base, derivados: [{ productoId: 2, cantidad: 9 }] }));
  await assert.rejects(fraccionar({ ...base, derivados: [{ productoId: 2, cantidad: 5 }, { productoId: 2, cantidad: 5 }] }));
  await assert.rejects(fraccionar({ ...base, derivados: [{ productoId: 1, cantidad: 10 }] }));
});
test('Venta rechaza carrito vacío, referencia ambigua y lista inválida', async () => {
  await assert.rejects(vender({ detalles: [] }));
  await assert.rejects(vender({ detalles: [{ productoId: 1, ofertaId: 1, cantidad: 1 }] }));
  await assert.rejects(vender({ detalles: [{ productoId: 1, cantidad: 1, tipoPrecio: 'OTRA' }] }));
});
