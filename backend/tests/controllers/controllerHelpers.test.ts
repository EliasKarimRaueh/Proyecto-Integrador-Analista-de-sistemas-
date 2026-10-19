import { describe, expect, it, jest } from '@jest/globals';
import {
  ok, fail, esObjeto, texto,
  parseMonto, parseMontoOpcional, parseFecha, parseId, parsePaginacion,
  sendDatabaseError,
} from '../../src/controllers/controllerHelpers.js';
import { crearRes } from '../helpers/http.js';

// controllerHelpers.ts no importa nada en runtime (su único import es un type),
// así que estos tests no necesitan mocks ni variables de entorno.

describe('ok / fail', () => {

  it('ok envuelve el valor con el discriminante true', () => {
    expect(ok('hola')).toEqual({ ok: true, value: 'hola' });
  });

  it('fail envuelve el error con el discriminante false', () => {
    expect(fail('algo anda mal')).toEqual({ ok: false, error: 'algo anda mal' });
  });
});

describe('esObjeto', () => {

  it('acepta objetos planos y los que tienen prototype propio', () => {
    expect(esObjeto({})).toBe(true);
    expect(esObjeto({ nombre: 'pollo' })).toBe(true);
    expect(esObjeto(new Date())).toBe(true);
  });

  it('rechaza null, arrays, primitivos y funciones', () => {
    expect(esObjeto(null)).toBe(false);
    expect(esObjeto([])).toBe(false);
    expect(esObjeto([{ a: 1 }])).toBe(false);
    expect(esObjeto('texto')).toBe(false);
    expect(esObjeto(5)).toBe(false);
    expect(esObjeto(true)).toBe(false);
    expect(esObjeto(undefined)).toBe(false);
  });
});

describe('texto', () => {

  it('recorta los espacios de los dos lados', () => {
    expect(texto('  pollo  ')).toBe('pollo');
  });

  it('devuelve cadena vacía cuando no es string', () => {
    expect(texto(42)).toBe('');
    expect(texto(null)).toBe('');
    expect(texto(undefined)).toBe('');
    expect(texto({})).toBe('');
  });

  it('conserva una cadena que era solo espacios', () => {
    expect(texto('   ')).toBe('');
  });
});

describe('parseMonto', () => {

  it('devuelve el importe con dos decimales como string', () => {
    // El resultado es string a propósito: Sequelize devuelve DECIMAL como texto
    // y devolver number introduciría errores de coma flotante en los importes.
    expect(parseMonto(10, 'precio')).toEqual({ ok: true, value: '10.00' });
    expect(parseMonto('10.5', 'precio')).toEqual({ ok: true, value: '10.50' });
    expect(parseMonto('1500', 'precio')).toEqual({ ok: true, value: '1500.00' });
    expect(parseMonto(0, 'precio')).toEqual({ ok: true, value: '0.00' });
  });

  it('rechaza valores ausentes como obligatorios', () => {
    for (const valor of [undefined, null, '']) {
      expect(parseMonto(valor, 'precioMinorista')).toEqual({
        ok: false, error: 'El campo precioMinorista es obligatorio.',
      });
    }
  });

  it('rechaza tipos que no son número', () => {
    expect(parseMonto({}, 'precio')).toEqual({
      ok: false, error: 'El campo precio debe ser un número.',
    });
    expect(parseMonto([], 'precio')).toEqual({
      ok: false, error: 'El campo precio debe ser un número.',
    });
    expect(parseMonto(true, 'precio')).toEqual({
      ok: false, error: 'El campo precio debe ser un número.',
    });
  });

  it('rechaza NaN y las cadenas no numéricas', () => {
    expect(parseMonto('abc', 'precio')).toEqual({
      ok: false, error: 'El campo precio debe ser un número.',
    });
    expect(parseMonto(NaN, 'precio')).toEqual({
      ok: false, error: 'El campo precio debe ser un número.',
    });
    expect(parseMonto(Infinity, 'precio')).toEqual({
      ok: false, error: 'El campo precio debe ser un número.',
    });
  });

  it('rechaza importes negativos', () => {
    expect(parseMonto(-1, 'precio')).toEqual({
      ok: false, error: 'El campo precio no puede ser negativo.',
    });
    expect(parseMonto('-0.01', 'precio')).toEqual({
      ok: false, error: 'El campo precio no puede ser negativo.',
    });
  });

  it('acepta el máximo de NUMERIC(10,2) y rechaza uno más', () => {
    expect(parseMonto(99999999.99, 'precio')).toEqual({ ok: true, value: '99999999.99' });
    expect(parseMonto(100000000, 'precio')).toEqual({
      ok: false,
      error: 'El campo precio supera el máximo permitido (99999999.99).',
    });
  });
});

describe('parseMontoOpcional', () => {

  it('devuelve null cuando el valor está ausente', () => {
    for (const valor of [undefined, null, '']) {
      expect(parseMontoOpcional(valor, 'precioMayorista')).toEqual({ ok: true, value: null });
    }
  });

  it('aplica las mismas reglas que parseMonto cuando hay valor', () => {
    expect(parseMontoOpcional('1200', 'precioMayorista')).toEqual({ ok: true, value: '1200.00' });
    expect(parseMontoOpcional(-5, 'precioMayorista')).toEqual({
      ok: false, error: 'El campo precioMayorista no puede ser negativo.',
    });
    expect(parseMontoOpcional('xyz', 'precioMayorista')).toEqual({
      ok: false, error: 'El campo precioMayorista debe ser un número.',
    });
  });
});

describe('parseFecha', () => {

  it('acepta una Date y la devuelve sin clonar', () => {
    const original = new Date('2026-03-01T00:00:00.000Z');
    const resultado = parseFecha(original, 'fechaDesde');
    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value).toBe(original);
  });

  it('parsea un string ISO', () => {
    expect(parseFecha('2026-03-01T00:00:00.000Z', 'fechaDesde')).toEqual({
      ok: true, value: new Date('2026-03-01T00:00:00.000Z'),
    });
  });

  it('rechaza tipos que no son fecha', () => {
    expect(parseFecha(20260301, 'fechaDesde')).toEqual({
      ok: false, error: 'El campo fechaDesde debe ser una fecha.',
    });
    expect(parseFecha(null, 'fechaDesde')).toEqual({
      ok: false, error: 'El campo fechaDesde debe ser una fecha.',
    });
    expect(parseFecha({}, 'fechaDesde')).toEqual({
      ok: false, error: 'El campo fechaDesde debe ser una fecha.',
    });
  });

  it('distingue un string inválido de un tipo incorrecto', () => {
    // El mensaje es distinto a propósito: "no es una fecha válida" orienta a
    // revisar el formato, "debe ser una fecha" orienta a revisar el tipo.
    expect(parseFecha('ayer', 'fechaDesde')).toEqual({
      ok: false, error: 'El campo fechaDesde no es una fecha válida.',
    });
  });
});

describe('parseId', () => {

  it('convierte strings y números válidos', () => {
    expect(parseId(5)).toEqual({ ok: true, value: 5 });
    expect(parseId('5')).toEqual({ ok: true, value: 5 });
    expect(parseId(1)).toEqual({ ok: true, value: 1 });
  });

  it('rechaza el cero, los negativos y los decimales', () => {
    for (const valor of [0, -1, '0', '-1', 1.5]) {
      expect(parseId(valor).ok).toBe(false);
    }
  });

  it('rechaza los tipos que no son string ni número', () => {
    expect(parseId('abc')).toEqual({ ok: false, error: 'el identificador no es válido.' });
    expect(parseId(null)).toEqual({ ok: false, error: 'el identificador no es válido.' });
    expect(parseId(undefined)).toEqual({ ok: false, error: 'el identificador no es válido.' });
  });

  it('usa el nombre del campo en el mensaje cuando se pasa', () => {
    expect(parseId('abc', 'El identificador del producto')).toEqual({
      ok: false, error: 'El identificador del producto no es válido.',
    });
  });

  it('rechaza valores por fuera del rango seguro de enteros', () => {
    expect(parseId(Number.MAX_SAFE_INTEGER + 10).ok).toBe(false);
    expect(parseId(1e21).ok).toBe(false);
  });
});

describe('parsePaginacion', () => {

  it('usa page=1 y limite=1000 por omisión', () => {
    expect(parsePaginacion({})).toEqual({ ok: true, value: { page: 1, limit: 1000 } });
  });

  it('lee page y limite de la query', () => {
    expect(parsePaginacion({ page: '3', limite: '25' })).toEqual({
      ok: true, value: { page: 3, limit: 25 },
    });
  });

  it('acepta los extremos del rango de limite', () => {
    expect(parsePaginacion({ limite: '1' })).toEqual({ ok: true, value: { page: 1, limit: 1 } });
    expect(parsePaginacion({ limite: '1000' })).toEqual({ ok: true, value: { page: 1, limit: 1000 } });
  });

  it('rechaza page menor que 1 o no entero', () => {
    for (const valor of ['0', '-1', 'abc', '1.5']) {
      expect(parsePaginacion({ page: valor })).toEqual({
        ok: false, error: 'El parámetro page debe ser un entero mayor o igual a 1.',
      });
    }
  });

  it('rechaza limite fuera del rango 1..1000', () => {
    for (const valor of ['0', '-1', '1001', 'abc']) {
      expect(parsePaginacion({ limite: valor })).toEqual({
        ok: false, error: 'El parámetro limite debe ser un entero entre 1 y 1000.',
      });
    }
  });
});

describe('sendDatabaseError', () => {

  // sequelizeUnique() imita lo que llega de verdad: SequelizeUniqueConstraintError
  // con message genérico ("Validation error"), así que el mapeo tiene que leer
  // error.name y no el texto.
  function sequelizeUnique() {
    const error = new Error('Validation error');
    error.name = 'SequelizeUniqueConstraintError';
    return error;
  }

  it('mapea unique a 409 con el mensaje del llamador', () => {
    const res = crearRes();
    sendDatabaseError(res, sequelizeUnique(), 'No se pudo crear.');
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: 'No se pudo crear.' });
  });

  it('detecta unique por el texto cuando el nombre no ayuda', () => {
    const res = crearRes();
    sendDatabaseError(res, new Error('duplicate key value violates unique constraint'), 'No se pudo crear.');
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('mapea foreign key a 400 con un mensaje propio', () => {
    const res = crearRes();
    const error = new Error('insert failed');
    error.name = 'SequelizeForeignKeyConstraintError';
    sendDatabaseError(res, error, 'No se pudo crear.');
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Uno de los valores enviados no existe en la base de datos.',
    });
  });

  it('mapea validation a 400 devolviendo el detalle del error', () => {
    const res = crearRes();
    const error = new Error('productos.nombre no puede ser null');
    error.name = 'SequelizeValidationError';
    sendDatabaseError(res, error, 'No se pudo crear.');
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'productos.nombre no puede ser null' });
  });

  it('cae en 500 y registra en consola cuando el error no encaja en ninguna rama', () => {
    const errorConsola = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = crearRes();
    sendDatabaseError(res, new Error('se cayó la conexión'), 'No se pudo crear.');
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'No se pudo completar la operación en la base de datos.',
    });
    expect(errorConsola).toHaveBeenCalled();
    errorConsola.mockRestore();
  });

  it('tolera que el valor lanzado no sea un Error', () => {
    const errorConsola = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = crearRes();
    sendDatabaseError(res, 'fallo en texto plano', 'No se pudo crear.');
    expect(res.status).toHaveBeenCalledWith(500);
    errorConsola.mockRestore();
  });
});