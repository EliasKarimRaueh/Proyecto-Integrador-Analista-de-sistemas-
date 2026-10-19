import { beforeEach, describe, expect, it } from '@jest/globals';

// stockController consulta los modelos directo y NO pasa por repositorio.
jest.mock('polleria-database/models/Producto', () => require('../mocks/modelos.js').ProductoModel);
jest.mock('polleria-database/models/MovimientoStock', () => require('../mocks/modelos.js').MovimientoStockModel);

// Mock parcial del servicio: se conservan reales estadoStock, id, numero, objeto
// y ErrorOperacion porque de ellos dependen las validaciones que estos tests
// miden. Las dos operaciones que abren transacción se sustituyen: aquí se
// verifica que el controlador delega y devuelve 201, no la lógica de stock.
jest.mock('../../src/services/operaciones.js', () => ({
  ...jest.requireActual('../../src/services/operaciones.js'),
  registrarMovimiento: jest.fn(),
  fraccionar: jest.fn(),
}));

import {
  configurarReposicion, getEstadoStock, getMovimientos,
  registrarFraccionamiento, registrarMovimiento,
} from '../../src/controllers/stockController.js';
import * as operaciones from '../../src/services/operaciones.js';
import { ProductoModel, MovimientoStockModel } from '../mocks/modelos.js';
import { crearReq, crearRes } from '../helpers/http.js';
import { ErrorOperacion } from '../../src/services/operaciones.js';
import { Op } from 'sequelize';

function producto(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    codigo: 'P-001',
    nombre: 'Pollo entero',
    stockActual: 30,
    stockMinimo: 10,
    margenStock: 5,
    unidadVenta: 'KILOS',
    activo: true,
    update: jest.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  ProductoModel.findAndCountAll.mockResolvedValue({ rows: [producto()], count: 1 } as never);
  ProductoModel.findByPk.mockResolvedValue(producto() as never);
  MovimientoStockModel.findAndCountAll.mockResolvedValue({ rows: [], count: 0 } as never);
  operaciones.registrarMovimiento.mockResolvedValue({ id: 100 } as never);
  operaciones.fraccionar.mockResolvedValue({ operacionId: 'abc' } as never);
});

describe('getEstadoStock', () => {

  it('expone el total paginado en X-Total-Count', async () => {
    // La tabla del front usa el header para el paginador, así que debe ir antes
    // del cuerpo y con el total real, no con la longitud de la página.
    const res = crearRes();
    await getEstadoStock(crearReq(), res);

    expect(res.setHeader).toHaveBeenCalledWith('X-Total-Count', 1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([
      {
        id: 10,
        codigo: 'P-001',
        nombre: 'Pollo entero',
        stockActual: 30,
        stockMinimo: 10,
        margenStock: 5,
        unidadVenta: 'KILOS',
        estado: 'Normal',
      },
    ]);
  });

  it('pagina con offset y ordena por id', async () => {
    await getEstadoStock(crearReq({ query: { page: 3, limite: 20 } }), crearRes());

    expect(ProductoModel.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { activo: true },
      attributes: { exclude: ['imagen'] },
      order: [['id', 'ASC']],
      limit: 20,
      offset: 40,
    }));
  });

  it('expone la imagen pero no filtra el estado calculado', async () => {
    ProductoModel.findAndCountAll.mockResolvedValue({
      rows: [
        producto({ id: 1, stockActual: 0, stockMinimo: 10 }),
        producto({ id: 2, stockActual: 10, stockMinimo: 10 }),
        producto({ id: 3, stockActual: 11, stockMinimo: 10 }),
      ],
      count: 3,
    } as never);
    const res = crearRes();
    await getEstadoStock(crearReq(), res);

    expect((res.json.mock.calls[0]![0] as Array<{ estado: string }>).map((p) => p.estado))
      .toEqual(['Crítico', 'Crítico', 'Próximo al Mínimo']);
  });

  it('rechaza un límite por encima del máximo', async () => {
    const res = crearRes();
    await getEstadoStock(crearReq({ query: { limite: 1001 } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'limite no puede superar 1000.' });
    expect(ProductoModel.findAndCountAll).not.toHaveBeenCalled();
  });
});

describe('registrarMovimiento', () => {

  it('delega el cuerpo al servicio y responde 201', async () => {
    const res = crearRes();
    const body = { productoId: 10, tipo: 'INGRESO', motivo: 'Compra', cantMovimiento: 5 };

    await registrarMovimiento(crearReq({ body }), res);

    expect(operaciones.registrarMovimiento).toHaveBeenCalledWith(body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: 100 });
  });

  it('traduce el error del servicio con su status', async () => {
    // El status lo decide el ErrorOperacion del servicio (409 para stock
    // insuficiente), no el controlador.
    operaciones.registrarMovimiento.mockRejectedValue(
      new ErrorOperacion('El movimiento supera el margen de stock permitido.', 409),
    );
    const res = crearRes();

    await registrarMovimiento(crearReq(), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: 'El movimiento supera el margen de stock permitido.' });
  });
});

describe('registrarFraccionamiento', () => {

  it('delega el cuerpo al servicio y responde 201', async () => {
    const res = crearRes();
    const body = { productoOrigenId: 10, cantidadOrigen: 10, derivados: [{ productoId: 11, cantidad: 10 }] };

    await registrarFraccionamiento(crearReq({ body }), res);

    expect(operaciones.fraccionar).toHaveBeenCalledWith(body);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('traduce un cuerpo inválido como 400', async () => {
    operaciones.fraccionar.mockRejectedValue(new ErrorOperacion('Origen debe coincidir con derivados más merma.'));
    const res = crearRes();

    await registrarFraccionamiento(crearReq(), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('configurarReposicion', () => {

  it('fija stockMinimo y cambia la reposición a ese criterio', async () => {
    const p = producto();
    p.update.mockResolvedValue(producto({ stockMinimo: 12, tipoReposicion: 'stockMinimo' }));
    ProductoModel.findByPk.mockResolvedValue(p as never);
    const res = crearRes();

    await configurarReposicion(
      crearReq({ params: { productoId: '10' }, body: { stockMinimo: 12 } }),
      res,
    );

    // tipoReposicion pasa a 'stockMinimo': al cambiar el criterio hay que
    // desmarcar la reposición por tiempo para que no compitan.
    expect(p.update).toHaveBeenCalledWith({ stockMinimo: 12, tipoReposicion: 'stockMinimo' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ stockMinimo: 12, tipoReposicion: 'stockMinimo' }),
    );
  });

  it('admite stockMinimo cero', async () => {
    const p = producto();
    ProductoModel.findByPk.mockResolvedValue(p as never);

    await configurarReposicion(crearReq({ params: { productoId: '10' }, body: { stockMinimo: 0 } }), crearRes());

    expect(p.update).toHaveBeenCalledWith({ stockMinimo: 0, tipoReposicion: 'stockMinimo' });
  });

  it('rechaza un stockMinimo negativo o no numérico', async () => {
    const res = crearRes();

    await configurarReposicion(
      crearReq({ params: { productoId: '10' }, body: { stockMinimo: -1 } }), res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'stockMinimo no es válido.' });

    await configurarReposicion(
      crearReq({ params: { productoId: '10' }, body: { stockMinimo: 'mucho' } }), crearRes(),
    );
    expect(ProductoModel.findByPk).toHaveBeenCalled();
  });

  it('responde 404 si el producto no existe', async () => {
    ProductoModel.findByPk.mockResolvedValue(null as never);
    const res = crearRes();

    await configurarReposicion(crearReq({ params: { productoId: '99' }, body: { stockMinimo: 5 } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Producto no encontrado.' });
  });
});

describe('getMovimientos', () => {

  it('pide los movimientos del más nuevo al más viejo', async () => {
    await getMovimientos(crearReq(), crearRes());

    expect(MovimientoStockModel.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        order: [['fechaHora', 'DESC'], ['id', 'DESC']],
        limit: 50,
        offset: 0,
        include: [expect.objectContaining({ as: 'producto', attributes: ['nombre'] })],
      }),
    );
  });

  it('filtra por el productoId de la ruta', async () => {
    await getMovimientos(crearReq({ params: { productoId: '10' } }), crearRes());

    expect(MovimientoStockModel.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { productoId: 10 } }),
    );
  });

  it('filtra por ventaId y por tipo', async () => {
    await getMovimientos(crearReq({ query: { ventaId: '55', tipo: 'EGRESO' } }), crearRes());

    expect(MovimientoStockModel.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ventaId: 55, tipo: 'EGRESO' } }),
    );
  });

  it('rechaza un tipo fuera del catálogo', async () => {
    const res = crearRes();
    await getMovimientos(crearReq({ query: { tipo: 'ROBO' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Tipo inválido.' });
  });

  it('filtra un desposte por operacionId con el prefijo del motivo', async () => {
    // Los movimientos de un desposte comparten el motivo `DESP:<uuid>:X <razón>`,
    // así que el filtro busca por LIKE y no por una columna propia.
    const operacionId = '53fabc20-051f-4b13-9f51-01103abc1a35';
    await getMovimientos(crearReq({ query: { operacionId } }), crearRes());

    expect(MovimientoStockModel.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { motivo: { [Op.like]: `DESP:${operacionId}:%` } } }),
    );
  });

  it('rechaza un operacionId que no es un uuid', async () => {
    const res = crearRes();
    await getMovimientos(crearReq({ query: { operacionId: 'no-es-uuid' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'operacionId inválido.' });
    expect(MovimientoStockModel.findAndCountAll).not.toHaveBeenCalled();
  });

  it('acota por rango de fechas solo con los extremos informados', async () => {
    await getMovimientos(crearReq({ query: { fechaDesde: '2026-01-01' } }), crearRes());
    expect(MovimientoStockModel.findAndCountAll).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { fechaHora: { [Op.gte]: expect.any(Date) } } }),
    );

    await getMovimientos(crearReq({ query: { fechaHasta: '2026-12-31' } }), crearRes());
    expect(MovimientoStockModel.findAndCountAll).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { fechaHora: { [Op.lte]: expect.any(Date) } } }),
    );
  });

  it('rechaza una fecha que no es ISO 8601', async () => {
    const res = crearRes();
    await getMovimientos(crearReq({ query: { fechaDesde: 'ayer' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Fecha inválida: utilice ISO 8601.' });
  });

  it('rechaza un rango invertido', async () => {
    const res = crearRes();
    await getMovimientos(
      crearReq({ query: { fechaDesde: '2026-12-31', fechaHasta: '2026-01-01' } }), res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'El rango de fechas es inválido.' });
  });
});