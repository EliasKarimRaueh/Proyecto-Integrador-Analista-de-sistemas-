import { describe, expect, it } from '@jest/globals';
import {
  calcularCantidadSugerida,
  calcularFaltante,
  calcularSubtotal,
  calcularTotal,
  convertirCantidadBase,
  convertirCostoUnitario,
  puedeCancelarPedido,
  redondearCantidad,
  validarDiferenciaRecepcion,
} from '../../src/services/comprasCalculos.js';
import { ErrorOperacion } from '../../src/services/operaciones.js';

describe('cálculos de compras', () => {
  it('calcula subtotales y totales sin coma flotante', () => {
    expect(calcularSubtotal(3, '10.10')).toBe('30.30');
    expect(calcularTotal(['30.30', '19.70'])).toBe('50.00');
  });

  it('convierte cantidades de presentación a unidad base', () => {
    expect(convertirCantidadBase(2, 10)).toBe(20);
    expect(convertirCantidadBase(0.125, 1)).toBe(0.125);
  });

  it('convierte costo por presentación a costo unitario', () => {
    expect(convertirCostoUnitario(100, 10)).toBe('10.00');
    expect(convertirCostoUnitario(125, 3)).toBe('41.67');
  });

  it('calcula faltante y cantidad sugerida por múltiplos de compra', () => {
    expect(calcularFaltante(2, 5)).toBe(3);
    expect(calcularFaltante(9, 5)).toBe(0);
    expect(calcularFaltante(1, null)).toBe(0);
    expect(calcularCantidadSugerida(3, 1)).toBe(3);
    expect(calcularCantidadSugerida(13, 10)).toBe(20);
    expect(calcularCantidadSugerida(0, 10)).toBe(0);
  });

  it('redondea cantidades a tres decimales', () => {
    expect(redondearCantidad(1.23456)).toBe(1.235);
  });

  it('valida diferencias de recepción', () => {
    expect(() => validarDiferenciaRecepcion(10, 10, null)).not.toThrow();
    expect(() => validarDiferenciaRecepcion(10, 9, 'faltó un cajón')).not.toThrow();
    expect(() => validarDiferenciaRecepcion(10, 9, null)).toThrow(ErrorOperacion);
  });

  it('solo permite cancelar pedidos realizados', () => {
    expect(puedeCancelarPedido('REALIZADO')).toBe(true);
    expect(puedeCancelarPedido('RECIBIDO')).toBe(false);
    expect(puedeCancelarPedido('CANCELADO')).toBe(false);
  });

  it('rechaza factores y cantidades inválidas', () => {
    expect(() => convertirCantidadBase(0, 1)).toThrow(ErrorOperacion);
    expect(() => convertirCantidadBase(1, 0)).toThrow(ErrorOperacion);
    expect(() => convertirCostoUnitario(100, 0)).toThrow(ErrorOperacion);
    expect(() => calcularCantidadSugerida(1, 0)).toThrow(ErrorOperacion);
  });
});
