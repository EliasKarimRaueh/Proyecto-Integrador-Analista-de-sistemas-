import { sequelize } from '../mocks/configDatabase.js';

/**
 * Transacción falsa con los mismos campos LOCK que usa el código.
 *
 * `bloquear()` (operaciones.ts:56) pide `transaction.LOCK.UPDATE` y `vender()`
 * pide `transaction.LOCK.SHARE` para el findByPk de las ofertas. Son cadenas
 * opacas: el doble no implementa semántica de bloqueo, solo necesita que existan
 * para que el argumento sea identificable en las aserciones.
 *
 * El patrón es devolver SIEMPRE la misma referencia desde transaction() para que
 * el test pueda compararla con `toHaveBeenCalledWith(..., transaccion)`: eso
 * verifica que la transacción se propaga hasta los repositorios en vez de
 * arreglarse con un any implícito.
 */
export type TransaccionFalsa = { LOCK: { UPDATE: string; SHARE: string } };

export function crearTransaccion(): TransaccionFalsa {
  return { LOCK: { UPDATE: 'UPDATE', SHARE: 'SHARE' } };
}

/**
 * Conecta el doble de config/database para que transaction(cb) invoque cb con la
 * transacción falsa. Devuelve la referencia para poder afirmarla después.
 *
 * Advertencia: `clearMocks: true` corre antes de cada test y borra las
 * implementaciones, así que hay que llamar a esto dentro de beforeEach.
 */
export function usarTransaccionFalsa(): TransaccionFalsa {
  const transaccion = crearTransaccion();
  sequelize.transaction.mockImplementation(
    async (cb: (t: TransaccionFalsa) => Promise<unknown>) => cb(transaccion),
  );
  return transaccion;
}