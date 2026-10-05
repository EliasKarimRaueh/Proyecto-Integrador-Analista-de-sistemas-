// Doble de prueba de polleria-database/repositories/detalleVentaRepository.
// operaciones.ts:51 lo instancia a nivel de módulo; vender() usa create una vez
// por línea de detalle calculada.

export const instancia = {
  create: jest.fn(),
};

const DetalleVentaRepository = jest.fn(() => instancia);

export default DetalleVentaRepository;