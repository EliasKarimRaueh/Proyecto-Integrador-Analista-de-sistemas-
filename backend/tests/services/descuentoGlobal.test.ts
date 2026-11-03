import { describe, expect, it } from '@jest/globals';
import { centavos, descontarSubtotal } from '../../src/services/dinero.js';
import { porcentajeOferta, fechaOferta, precioFinalOferta } from '../../src/services/ofertasGlobales.js';

describe('Descuento sobre el subtotal conjunto', () => {
  it('normaliza el precio final explícito y rechaza importes inválidos', () => {
    expect(precioFinalOferta('12345.67')).toBe('12345.67');
    expect(precioFinalOferta(2500)).toBe('2500.00');
    for (const precio of [0, -1, '', null, true, '1.001', 100000000]) expect(() => precioFinalOferta(precio)).toThrow('precio final positivo');
  });
  it('admite vigencia abierta e incluye el último día argentino completo', () => {
    expect(fechaOferta(null, true)).toBeNull();
    expect(fechaOferta(undefined, true)).toBeNull();
    expect(fechaOferta('2026-11-03')?.toISOString()).toBe('2026-11-03T03:00:00.000Z');
    expect(fechaOferta('2026-11-03', true)?.toISOString()).toBe('2026-11-04T02:59:59.999Z');
    expect(() => fechaOferta('2026-02-30')).toThrow('fechas válidas');
  });
  it('redondea una sola vez después de sumar todos los componentes', () => {
    const subtotal = centavos(1, '0.05') + centavos(1, '0.05');
    expect(descontarSubtotal(subtotal, '10.00')).toEqual({ subtotalLista: '0.10', descuento: '0.01', total: '0.09' });
  });
  it('considera cantidades fraccionadas antes de aplicar el porcentaje', () => {
    expect(descontarSubtotal(centavos(1.25, '100.00') + centavos(2, '50.00'), '15.00')).toEqual({ subtotalLista: '225.00', descuento: '33.75', total: '191.25' });
  });
  it.each([-1, 101, 'abc', true, '', '10.001'])('rechaza porcentajes inválidos %p', p => expect(() => porcentajeOferta(p)).toThrow());
  it('permite descuento cero o cien', () => {
    expect(descontarSubtotal(100n, porcentajeOferta(0)).total).toBe('1.00');
    expect(descontarSubtotal(100n, porcentajeOferta(100)).total).toBe('0.00');
  });
});
