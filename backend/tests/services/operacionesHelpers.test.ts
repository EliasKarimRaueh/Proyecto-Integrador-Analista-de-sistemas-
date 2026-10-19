import { describe, expect, it } from '@jest/globals';

import {
  estadoStock,
  id,
  motivo,
  numero,
  objeto,
  validarCantidad,
  ErrorOperacion,
} from '../../src/services/operaciones.js';

// Guardas puras de services/operaciones.ts. No tocan la base: son la frontera que
// decide qué.status y qué mensaje ve el cliente antes de tocar Sequelize.

describe('objeto', () => {

  it('acepta un objeto plano', () => {
    const valor = { productoId: 10 };
    expect(objeto(valor)).toBe(valor);
    expect(objeto({})).toEqual({});
  });

  it('rechaza todo lo que no sea un objeto plano', () => {
    // Los 422 que validados a mano salvo que contemplen null explícitamente: un
    // cuerpo ausente llega como undefined y un array como body mal armado.
    for (const valor of [undefined, null, 'texto', 10, true, [], [{ a: 1 }]]) {
      expect(() => objeto(valor)).toThrow('Se esperaba un objeto.');
    }
  });

  it('marca el error como 400 para que ejecutar() lo traduzca', () => {
    expect(() => objeto(null)).toThrow(ErrorOperacion);
    expect(new ErrorOperacion('x').status).toBe(400);
  });
});

describe('numero', () => {

  it('normaliza strings numéricos y números', () => {
    expect(numero(10, 'campo')).toBe(10);
    expect(numero('10', 'campo')).toBe(10);
    expect(numero('0.5', 'campo')).toBe(0.5);
    expect(numero('  10  ', 'campo')).toBe(10);
  });

  it('rechaza un valor no numérico o vacío', () => {
    for (const valor of [true, '', ' ', null, undefined, {}, []]) {
      expect(() => numero(valor, 'campo')).toThrow('campo debe ser numérico.');
    }
  });

  it('rechaza no finitos y strings que no son número', () => {
    // 'abc' es un string, así que pasa la comprobación de tipo de numero() y
    // falla recién en Number(): por eso el mensaje es "no es válido" y no
    // "debe ser numérico". Los dos mensajes significan cosas distintas.
    for (const valor of [NaN, Infinity, -Infinity, 'abc', 'NaN', '10px']) {
      expect(() => numero(valor, 'campo')).toThrow('campo no es válido.');
    }
  });

  it('rechaza el cero salvo que se pida admitirlo', () => {
    // cero=true existe para stockMinimo y merma, donde 0 es un valor real.
    expect(() => numero(0, 'cantidad')).toThrow('cantidad no es válido.');
    expect(() => numero(0, 'merma')).toThrow('merma no es válido.');
    expect(numero(0, 'merma', true)).toBe(0);
  });

  it('sigue rechazando los negativos aunque se admita el cero', () => {
    // cero solo abre la puerta al 0: el flag cambia n <= 0 por n < 0, así que un
    // stockMinimo de -5 o una merma negativa siguen siendo inválidos.
    expect(() => numero(-1, 'cantidad', true)).toThrow('cantidad no es válido.');
    expect(() => numero(-0.5, 'stockMinimo', true)).toThrow('stockMinimo no es válido.');
  });
});

describe('id', () => {

  it('acepta enteros dentro del rango de una columna integer', () => {
    expect(id(10)).toBe(10);
    expect(id('10')).toBe(10);
    expect(id(2147483647)).toBe(2147483647);
  });

  it('rechaza fracciones', () => {
    // 1.5 es unsafe integer: si pasara, Postgres truncaría y el recurso se
    // escribiría en una fila que no es la que el cliente pidió.
    expect(() => id(1.5)).toThrow('id debe ser un entero válido.');
  });

  it('rechaza el rango de un integer de 4 bytes', () => {
    expect(() => id(2147483648)).toThrow('id debe ser un entero válido.');
  });

  it('usa el nombre del campo en el mensaje', () => {
    // id(true) dispara el mensaje de tipo y id(1.5) el de entero: son las dos
    // validaciones que id() agrega sobre numero().
    expect(() => id(true, 'productoId')).toThrow('productoId debe ser numérico.');
    expect(() => id(1.5, 'page')).toThrow('page debe ser un entero válido.');
  });
});

describe('motivo', () => {

  it('acepta texto y recorta los espacios', () => {
    expect(motivo('  Compra a proveedor  ')).toBe('Compra a proveedor');
  });

  it('rechaza vacío, en blanco o no texto', () => {
    for (const valor of ['', '   ', null, undefined, 10, true, {}]) {
      expect(() => motivo(valor)).toThrow('El motivo es obligatorio y admite hasta 250 caracteres.');
    }
  });

  it('impone el límite de 250 caracteres', () => {
    expect(motivo('a'.repeat(250))).toHaveLength(250);
    expect(() => motivo('a'.repeat(251))).toThrow('El motivo es obligatorio y admite hasta 250 caracteres.');
  });
});

describe('estadoStock', () => {

  it('marca Crítico sin stock o por debajo del mínimo', () => {
    expect(estadoStock(0, 10)).toBe('Crítico');
    expect(estadoStock(-5, 10)).toBe('Crítico');
    expect(estadoStock(10, 10)).toBe('Crítico');
    expect(estadoStock(0, null)).toBe('Crítico');
  });

  it('marca Próximo al Mínimo dentro del 20% del umbral', () => {
    expect(estadoStock(11, 10)).toBe('Próximo al Mínimo');
    expect(estadoStock(12, 10)).toBe('Próximo al Mínimo');
    // El borde: 10 * 1.2 === 12, así que 12 todavía entra.
    expect(estadoStock(12, 10)).toBe('Próximo al Mínimo');
  });

  it('marca Normal por encima del 20% y también sin mínimo configurado', () => {
    expect(estadoStock(13, 10)).toBe('Normal');
    expect(estadoStock(500, 10)).toBe('Normal');
    // Sin mínimo solo se puede llegar a Crítico por stock <= 0.
    expect(estadoStock(1, null)).toBe('Normal');
  });
});

describe('validarCantidad', () => {

  const producto = (overrides: Record<string, unknown> = {}) =>
    ({ activo: true, unidadVenta: 'KILOS', ...overrides });

  it('no hace nada con un producto activo medido en kilos', () => {
    expect(() => validarCantidad(producto() as never, 1.5)).not.toThrow();
  });

  it('rechaza un producto inactivo', () => {
    expect(() => validarCantidad(producto({ activo: false }) as never, 1)).toThrow(
      'El producto está inactivo.',
    );
  });

  it('exige cantidad entera en productos vendidos por unidad', () => {
    // Vender media unidad de algo que se cuenta por unidades dejaría un stock
    // fraccionario que la reposición no sabe interpretar.
    expect(() => validarCantidad(producto({ unidadVenta: 'UNIDADES' }) as never, 1.5)).toThrow(
      'Los productos por unidad requieren cantidades enteras.',
    );
    expect(() => validarCantidad(producto({ unidadVenta: 'UNIDADES' }) as never, 2)).not.toThrow();
  });
});