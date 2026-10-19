import { describe, expect, it } from '@jest/globals';

import { centavos, importe } from '../../src/services/dinero.js';

// Aritmética sobre dígitos decimales. El motivo de usar bigint en vez de número
// es que 1.005 * 100 en IEEE-754 da 100.49999999999999 y el redondeo se corre una
// centésima. Estos tests fijan los casos que upstream ejercita con node:test en
// test/operaciones.test.ts, más los bordes que ese archivo no cubre.

describe('centavos', () => {

  it('multiplica cantidad por precio y devuelve bigint en centavos', () => {
    expect(centavos(3, '0.10')).toBe(30n);
    expect(centavos(2, '15.50')).toBe(3100n);
    expect(centavos(1, '0.01')).toBe(1n);
  });

  it('redondea a dos decimales sin arrastrar el error de coma flotante', () => {
    // 1.005 debería redondear a 1.01 (round half up), no a 1.00.
    expect(centavos(1, '1.005')).toBe(101n);
    expect(centavos(0.125, '10.10')).toBe(126n);
  });

  it('acepta notación exponencial', () => {
    expect(centavos(1e-7, '100000')).toBe(1n);
    expect(centavos(1e3, '1.5')).toBe(150000n);
  });

  it('reescala un exponente positivo sin fracción a escala cero', () => {
    // '2e2' parsea como base='2', exponente='2', fraccion='' → escala -2, y
    // decimal() multiplica el entero por 10^2 para no arrastrar la escala
    // negativa al producto (dinero.ts:7).
    expect(centavos(1, '2e2')).toBe(20000n);
    expect(centavos(3, '1e3')).toBe(300000n);
  });

  it('escala hacia arriba cuando el producto tiene menos de dos decimales', () => {
    expect(centavos(1, '5')).toBe(500n);
    expect(centavos(3, '7')).toBe(2100n);
  });

  it('redondea hacia arriba cuando el dígito descartado es 5 o más', () => {
    // Con escala 3 el divisor es 10 y el código suma divisor/2 antes de dividir,
    // o sea round half up: 0.124 -> 0.12 pero 0.125 -> 0.13 y 0.126 -> 0.13.
    expect(centavos(1, '0.124')).toBe(12n);
    expect(centavos(1, '0.125')).toBe(13n);
    expect(centavos(1, '0.126')).toBe(13n);
    expect(importe(centavos(1, '0.125'))).toBe('0.13');
  });

  it('soporta cantidades fraccionarias con decimales', () => {
    expect(centavos(0.5, '10')).toBe(500n);
    expect(centavos(2.25, '4')).toBe(900n);
  });
});

describe('importe', () => {

  it('formatea con exactamente dos decimales', () => {
    expect(importe(101n)).toBe('1.01');
    expect(importe(3100n)).toBe('31.00');
    expect(importe(5n)).toBe('0.05');
    expect(importe(0n)).toBe('0.00');
  });

  it('conserva los centavos en la parte baja sin recortar', () => {
    // La tentación es usar toFixed o Math.round sobre un number; el truco es que
    // cents % 100n ya está en rango, solo falta rellenar con ceros a la izquierda.
    expect(importe(100n)).toBe('1.00');
    expect(importe(109n)).toBe('1.09');
    expect(importe(9n)).toBe('0.09');
  });

  it('es la inversa de centavos para importes de un solo paso', () => {
    // Ida y vuelta: lo que se calcula para cobrar es lo que se muestra. Si esto
    // se rompe, el total que ve el cliente no es el que se le cobra.
    const ida = ['0.01', '9.99', '1234.56', '0.10', '19.05', '0.30'];
    for (const [indice, precio] of ida.entries()) {
      expect(importe(centavos(1, precio))).toBe(ida[indice]);
    }
  });

  it('redondea importes grandes sin perder precisión', () => {
    expect(importe(999999999999n)).toBe('9999999999.99');
    expect(centavos(1e6, '9999.99')).toBe(999999000000n);
  });
});