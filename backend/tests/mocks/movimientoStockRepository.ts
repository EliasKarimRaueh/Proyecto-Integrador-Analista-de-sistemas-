// Doble de prueba de polleria-database/repositories/movimientoStockRepository.
// operaciones.ts:49 lo instancia a nivel de módulo (`const movimientos = new
// MovimientoStockRepository()`), así que el doble tiene que ser una clase que
// devuelve siempre la misma instancia compartida: si devolviera una nueva por
// llamada, las aserciones sobre `instancia` no verían las escrituras.

export const instancia = {
  registrarIngreso: jest.fn(),
  registrarEgreso: jest.fn(),
  ajustarStock: jest.fn(),
};

const MovimientoStockRepository = jest.fn(() => instancia);

export default MovimientoStockRepository;