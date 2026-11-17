import { afterEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';

jest.mock('../../src/routes/productoRoutes.js', () => require('express').Router());
jest.mock('../../src/routes/precioRoutes.js', () => require('express').Router());
jest.mock('../../src/routes/ofertaRoutes.js', () => require('express').Router());
jest.mock('../../src/routes/stockRoutes.js', () => require('express').Router());
jest.mock('../../src/routes/ventaRoutes.js', () => require('express').Router());
jest.mock('../../src/routes/proveedorRoutes.js', () => require('express').Router());
jest.mock('../../src/routes/catalogoRoutes.js', () => require('express').Router());
jest.mock('../../src/routes/compraRoutes.js', () => require('express').Router());
jest.mock('../../src/routes/pedidoRoutes.js', () => require('express').Router());
jest.mock('../../src/routes/recepcionRoutes.js', () => require('express').Router());
jest.mock('../../src/routes/cuentaRoutes.js', () => require('express').Router());
jest.mock('../../src/routes/pagoRoutes.js', () => require('express').Router());

const originalCorsOrigin = process.env.CORS_ORIGIN;

async function loadAppWithCorsOrigin(corsOrigin: string | undefined) {
  jest.resetModules();
  if (corsOrigin === undefined) {
    delete process.env.CORS_ORIGIN;
  } else {
    process.env.CORS_ORIGIN = corsOrigin;
  }
  const mod = await import('../../src/app.js');
  return mod.default;
}

afterEach(() => {
  if (originalCorsOrigin === undefined) {
    delete process.env.CORS_ORIGIN;
  } else {
    process.env.CORS_ORIGIN = originalCorsOrigin;
  }
});

describe('CORS en backend/src/app.ts', () => {
  it('devuelve el primer origen permitido cuando la solicitud no incluye cabecera Origin', async () => {
    const app = await loadAppWithCorsOrigin(undefined);
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-expose-headers']).toBe('X-Total-Count');
  });

  it('permite Origin http://localhost:5173', async () => {
    const app = await loadAppWithCorsOrigin(undefined);
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:5173');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-expose-headers']).toBe('X-Total-Count');
  });

  it('permite Origin http://127.0.0.1:5173', async () => {
    const app = await loadAppWithCorsOrigin(undefined);
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://127.0.0.1:5173');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-expose-headers']).toBe('X-Total-Count');
  });

  it('rechaza orígenes no autorizados como http://evil.example omitiendo Access-Control-Allow-Origin', async () => {
    const app = await loadAppWithCorsOrigin(undefined);
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://evil.example');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('usa los orígenes por defecto cuando CORS_ORIGIN está vacío ("")', async () => {
    const app = await loadAppWithCorsOrigin('');

    const sinOrigin = await request(app).get('/api/health');
    expect(sinOrigin.headers['access-control-allow-origin']).toBe('http://localhost:5173');

    const localhost = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:5173');
    expect(localhost.headers['access-control-allow-origin']).toBe('http://localhost:5173');

    const loopback = await request(app)
      .get('/api/health')
      .set('Origin', 'http://127.0.0.1:5173');
    expect(loopback.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5173');

    const rechazado = await request(app)
      .get('/api/health')
      .set('Origin', 'http://evil.example');
    expect(rechazado.headers['access-control-allow-origin']).toBeUndefined();
  });
});
