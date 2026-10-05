// Doble de prueba de polleria-database/repositories/precioRepository.
//
// Además de los métodos, reexporta ErrorVigenciaPrecio con la misma forma que
// la clase real (precioRepository.ts:17). precioController.ts:167 decide entre
// 409 y 500 con `error instanceof ErrorVigenciaPrecio`, así que el test tiene
// que lanzar una instancia de ESTA clase para que la comprobación funcione.

export class ErrorVigenciaPrecio extends Error {

    constructor(mensaje: string) {
        super(mensaje);
        this.name = 'ErrorVigenciaPrecio';
    }
}

export const instancia = {
  findGlobales: jest.fn(),
  findHistorial: jest.fn(),
  findVigente: jest.fn(),
  // La usa services/operaciones.ts al cotizar y vender: recibe los productoIds,
  // una fecha y la transacción, y debe devolver exactamente un precio vigente
  // por producto.
  findAllVigentes: jest.fn(),
  registrarPrecio: jest.fn(),
  updatePrecios: jest.fn(),
  findById: jest.fn(),
  deleteById: jest.fn(),
};

const PrecioRepository = jest.fn(() => instancia);

export default PrecioRepository;