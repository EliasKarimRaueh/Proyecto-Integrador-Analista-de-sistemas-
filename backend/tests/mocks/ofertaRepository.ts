// Doble de prueba de polleria-database/repositories/ofertaRepository.
// Lo consume ofertaController.ts:11.

export const instancia = {
  findAllActivos: jest.fn(),
  findVigentes: jest.fn(),
  findById: jest.fn(),
  findByIdActivo: jest.fn(),
  updateById: jest.fn(),
  deleteById: jest.fn(),
};

const OfertaRepository = jest.fn(() => instancia);

export default OfertaRepository;