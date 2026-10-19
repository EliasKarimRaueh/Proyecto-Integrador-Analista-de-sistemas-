import type { Request, Response } from 'express';

/**
 * Response falsa para probar controladores sin levantar HTTP.
 *
 * Los handlers del backend tienen la forma `async (req, res)` y nunca lanzan:
 * siempre contestan `res.status(n).json(...)`. Encadenar ambos mocks permite
 * escribir la aserción como `expect(res.status).toHaveBeenCalledWith(400)`
 * sin tener que cubrir el valor de retorno del status.
 *
 * setHeader está porque getEstadoStock publica el total paginado en
 * X-Total-Count antes de escribir el cuerpo.
 */
export type ResFalsa = Response & { status: jest.Mock; json: jest.Mock; setHeader: jest.Mock };

export function crearRes(): ResFalsa {
  const res = { status: jest.fn(), json: jest.fn(), setHeader: jest.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.setHeader.mockReturnValue(res);
  return res as unknown as ResFalsa;
}

/**
 * Request falsa con params/query/body planos. Los controladores solo leen
 * esas tres propiedades (más `req.params.id` y `req.params.productoId`).
 */
export function crearReq(overrides: {
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: unknown;
} = {}): Request {
  return {
    params: overrides.params ?? {},
    query: overrides.query ?? {},
    body: overrides.body ?? {},
  } as unknown as Request;
}