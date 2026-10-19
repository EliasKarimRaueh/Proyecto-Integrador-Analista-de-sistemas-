import { beforeEach, describe, expect, it } from '@jest/globals';

jest.mock('polleria-database/repositories/ventaRepository', () => require('../mocks/ventaRepository.js'));

// Mock parcial del servicio: id y ErrorOperacion quedan reales porque las
// validaciones de paginación dependen de ellos. vender y buscarProductos se
// sustituyen porque abren transacción o pegan a la base; aquí importa que el
// controlador delegue y traduzca el status, no la lógica de venta.
jest.mock('../../src/services/operaciones.js', () => ({
  ...jest.requireActual('../../src/services/operaciones.js'),
  vender: jest.fn(),
  buscarProductos: jest.fn(),
}));

import {
  cotizarVenta, crearVenta, detalleVenta, historialVentas,
  productosMostrador,
} from '../../src/controllers/operacionesController.js';
import * as operaciones from '../../src/services/operaciones.js';
import { instancia as ventaRepo } from '../mocks/ventaRepository.js';
import { crearReq, crearRes } from '../helpers/http.js';
import { ErrorOperacion } from '../../src/services/operaciones.js';

beforeEach(() => {
  operaciones.vender.mockResolvedValue({ venta: { id: 55 }, detalles: [] } as never);
  operaciones.buscarProductos.mockResolvedValue({ rows: [], count: 0 } as never);
  ventaRepo.findAllVentas.mockResolvedValue({ rows: [], count: 0 } as never);
  ventaRepo.findVentaConDetalles.mockResolvedValue({
    venta: { id: 55, total: '30.00' },
    detalles: [{ productoId: 10, cantidad: 2 }],
  } as never);
});

describe('crearVenta', () => {

  it('delega el cuerpo y responde 201 con la venta creada', async () => {
    const res = crearRes();
    const body = { detalles: [{ productoId: 10, cantidad: 2 }] };

    await crearVenta(crearReq({ body }), res);

    expect(operaciones.vender).toHaveBeenCalledWith(body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ venta: { id: 55 }, detalles: [] });
  });

  it('traduce un error de negocio con su status', async () => {
    operaciones.vender.mockRejectedValue(new ErrorOperacion('Stock insuficiente para Pollo entero.', 409));
    const res = crearRes();

    await crearVenta(crearReq(), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: 'Stock insuficiente para Pollo entero.' });
  });

  it('no persiste nada cuando el carrito está vacío', async () => {
    operaciones.vender.mockRejectedValue(new ErrorOperacion('Debe indicar entre 1 y 100 detalles.'));
    const res = crearRes();

    await crearVenta(crearReq(), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Debe indicar entre 1 y 100 detalles.' });
  });

  it('responde 500 cuando el fallo no es de negocio', async () => {
    // ejecutar (operacionesController.ts:9) sólo especializa ErrorOperacion;
    // cualquier otro error cae a sendDatabaseError con su mensaje genérico.
    const consola = jest.spyOn(console, 'error').mockImplementation(() => {});
    operaciones.vender.mockRejectedValue(new Error('se cayó la conexión'));
    const res = crearRes();

    await crearVenta(crearReq(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'No se pudo completar la operación en la base de datos.',
    });
    consola.mockRestore();
  });
});

describe('cotizarVenta', () => {

  it('pide la cotización sin tocar la base y responde 200', async () => {
    // La cotización es el segundo argumento de vender(): distingue simular de
    // cobrar, así que el valor importa.
    const res = crearRes();
    operaciones.vender.mockResolvedValue({ total: '30.00', detalles: [] } as never);

    await cotizarVenta(crearReq({ body: { detalles: [] } }), res);

    expect(operaciones.vender).toHaveBeenCalledWith({ detalles: [] }, true);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ total: '30.00', detalles: [] });
  });
});

describe('productosMostrador', () => {

  it('delega la búsqueda recortada con la paginación', async () => {
    await productosMostrador(crearReq({ query: { q: '  pollo  ', page: 2, limite: 20 } }), crearRes());

    expect(operaciones.buscarProductos).toHaveBeenCalledWith('pollo', 2, 20);
  });

  it('busca con texto vacío cuando no viene q', async () => {
    await productosMostrador(crearReq(), crearRes());

    expect(operaciones.buscarProductos).toHaveBeenCalledWith('', 1, 50);
  });

  it('rechaza un q que no es texto', async () => {
    // Sin este chequeo un q=[] o q={} llegaría al iLike como "[object Object]".
    const res = crearRes();
    await productosMostrador(crearReq({ query: { q: [] } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'q debe ser texto.' });
    expect(operaciones.buscarProductos).not.toHaveBeenCalled();
  });

  it('rechaza una página no numérica', async () => {
    const res = crearRes();
    await productosMostrador(crearReq({ query: { page: 'primera' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'page no es válido.' });
  });

  it('rechaza un límite por encima del máximo', async () => {
    const res = crearRes();
    await productosMostrador(crearReq({ query: { limite: 5000 } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'limite no puede superar 1000.' });
  });
});

describe('historialVentas', () => {

  it('pide el historial con paginación y sin rango', async () => {
    await historialVentas(crearReq({ query: { page: 2, limite: 20 } }), crearRes());

    expect(ventaRepo.findAllVentas).toHaveBeenCalledWith(2, 20, undefined, undefined, true);
  });

  it('pasa el rango de fechas cuando viene', async () => {
    await historialVentas(
      crearReq({ query: { fechaDesde: '2026-01-01', fechaHasta: '2026-12-31' } }), crearRes(),
    );

    expect(ventaRepo.findAllVentas).toHaveBeenCalledWith(
      1, 50, expect.any(Date), expect.any(Date), true,
    );
  });

  it('rechaza un rango invertido sin consultar', async () => {
    const res = crearRes();
    await historialVentas(
      crearReq({ query: { fechaDesde: '2026-12-31', fechaHasta: '2026-01-01' } }), res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'El rango de fechas es inválido.' });
    expect(ventaRepo.findAllVentas).not.toHaveBeenCalled();
  });

  it('rechaza una fecha de calendario inexistente sin consultar', async () => {
    // '2026-02-30' pasa el regex ISO y Date.parse lo normaliza a 2026-03-02;
    // el chequeo de redondeo de fecha() (operacionesController.ts:21) lo detecta
    // y responde 400 sin pegar a la base.
    const res = crearRes();
    await historialVentas(crearReq({ query: { fechaDesde: '2026-02-30' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Fecha de calendario inválida.' });
    expect(ventaRepo.findAllVentas).not.toHaveBeenCalled();
  });

  it('rechaza una fecha fuera del formato ISO 8601 sin consultar', async () => {
    for (const fechaDesde of ['ayer', '2026-13-45']) {
      const res = crearRes();
      await historialVentas(crearReq({ query: { fechaDesde } }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Fecha inválida: utilice ISO 8601.' });
    }
    expect(ventaRepo.findAllVentas).not.toHaveBeenCalled();
  });

  it('rechaza una fecha que no es texto sin consultar', async () => {
    // Express 5 arma un arreglo cuando el query param se repite; fecha()
    // exige string y rechaza el valor antes de tocar la base.
    const res = crearRes();
    await historialVentas(crearReq({ query: { fechaDesde: ['2026-01-01'] } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Fecha inválida: utilice ISO 8601.' });
    expect(ventaRepo.findAllVentas).not.toHaveBeenCalled();
  });
});

describe('detalleVenta', () => {

  it('devuelve la venta con sus detalles', async () => {
    const res = crearRes();
    await detalleVenta(crearReq({ params: { id: '55' } }), res);

    expect(ventaRepo.findVentaConDetalles).toHaveBeenCalledWith(55);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      venta: { id: 55, total: '30.00' },
      detalles: [{ productoId: 10, cantidad: 2 }],
    });
  });

  it('responde 404 si la venta no existe', async () => {
    ventaRepo.findVentaConDetalles.mockResolvedValue({ venta: null, detalles: [] } as never);
    const res = crearRes();

    await detalleVenta(crearReq({ params: { id: '99' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Venta no encontrada.' });
  });

  it('rechaza un id no numérico', async () => {
    const res = crearRes();
    await detalleVenta(crearReq({ params: { id: 'abc' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ventaRepo.findVentaConDetalles).not.toHaveBeenCalled();
  });
});