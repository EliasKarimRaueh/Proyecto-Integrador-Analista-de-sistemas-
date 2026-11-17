jest.mock('../../../database/src/config/database.js', () => ({ __esModule: true, default: { query: jest.fn() } }));
import sequelize from '../../../database/src/config/database.js';
import CircuitoRepository from '../../../database/src/repositories/circuitoAbastecimientoRepository.js';
import type { Transaction } from 'sequelize';
const query = sequelize.query as jest.Mock;
beforeEach(() => jest.resetAllMocks());
test('detecta la transición pendiente sin modificar tablas ni modelos', async () => {
  const repo = new CircuitoRepository();
  query.mockResolvedValue([{ table_name: 'recepciones', column_name: 'compraId', is_nullable: 'NO' }]);
  expect(await repo.esquemaDisponible()).toBe(false);
  query.mockResolvedValue([{ table_name: 'compras', column_name: 'recepcionId', is_nullable: 'YES' }]);
  expect(await repo.esquemaDisponible()).toBe(true);
  expect(query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))).toBe(true);
});
test('crea recepción con pedido y timestamp de BD, sin insertar compraId', async () => {
  query.mockResolvedValue([{ id: 7 }]);
  await new CircuitoRepository().crearRecepcion({ pedidoId: 42, proveedorId: 5, usuarioId: 1, observaciones: null, conformidad: 'COMPLETA' }, {} as Transaction);
  const [sql, options] = query.mock.calls[0];
  expect(sql).toContain('CURRENT_TIMESTAMP'); expect(sql).toContain('"pedidoId"'); expect(sql).not.toContain('"compraId"');
  expect(options.replacements).toMatchObject({ pedidoId: 42 });
});
test('bloquea la recepción y relee la compra asociada después del bloqueo', async () => {
  query.mockResolvedValueOnce([{ id: 7 }]).mockResolvedValueOnce([{ id: 7, compra: { id: 8 } }]);
  const resultado = await new CircuitoRepository().recepcion(7, {} as Transaction, true);
  expect(query.mock.calls[0][0]).toContain('FOR UPDATE');
  expect(query.mock.calls[1][0]).toContain("to_jsonb(c)->>'recepcionId'");
  expect(query.mock.calls[1][0]).not.toContain('r."compraId"');
  expect(resultado?.compra?.id).toBe(8);
});
test('relacionadasPorPedidos agrupa recepciones y compras en lote sin consultas N+1', async () => {
  query
    .mockResolvedValueOnce([{ id: 10, pedidoId: 1 }, { id: 11, pedidoId: 2 }])
    .mockResolvedValueOnce([{ id: 20, pedidoId: 1, recepcionId: 10 }, { id: 21, pedidoId: null, recepcionId: 11 }]);
  const mapa = await new CircuitoRepository().relacionadasPorPedidos([1, 2, 3]);
  expect(query).toHaveBeenCalledTimes(2);
  expect(mapa.get(1)).toMatchObject({ recepcion: { id: 10 }, compra: { id: 20 } });
  expect(mapa.get(2)).toMatchObject({ recepcion: { id: 11 }, compra: { id: 21 } });
  expect(mapa.get(3)).toEqual({ recepciones: [], compras: [], recepcion: null, compra: null });
});
