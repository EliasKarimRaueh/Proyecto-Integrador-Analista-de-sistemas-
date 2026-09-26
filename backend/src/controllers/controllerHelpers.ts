// backend/src/controllers/controllerHelpers.ts
import { type Response } from 'express';

// Columnas NUMERIC(10,2) en PostgreSQL: el máximo representable es
// 99999999.99. Si no se valida acá, el desborde revienta con un 500
// en vez de un 400 con un mensaje útil.
const MONTO_MAXIMO = 99999999.99;

// `ok: true | false` es el discriminante. Con `error?: never` o con
// `error: null | string` TypeScript no logra estreitar el union desde
// `if (resultado.error)`, porque una propiedad opcional o de tipo
// string no cuenta como discriminante y `.value` queda como
// `T | null` en todos lados.
type Resultado<T> = { ok: true; value: T } | { ok: false; error: string };

function ok<T>(value: T): Resultado<T> {
  return { ok: true, value };
}

function fail<T = never>(error: string): Resultado<T> {
  return { ok: false, error };
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

/**
 * Acepta string o number, y siempre devuelve string porque Sequelize
 * devuelve DECIMAL como texto. Devolver número desde el servidor
 * introduciría errores de coma flotante en los importes.
 */
function parseMonto(valor: unknown, campo: string): Resultado<string> {

  if (valor === undefined || valor === null || valor === '') {
    return fail(`El campo ${campo} es obligatorio.`);
  }

  if (typeof valor !== 'string' && typeof valor !== 'number') {
    return fail(`El campo ${campo} debe ser un número.`);
  }

  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return fail(`El campo ${campo} debe ser un número.`);
  }

  if (numero < 0) {
    return fail(`El campo ${campo} no puede ser negativo.`);
  }

  if (numero > MONTO_MAXIMO) {
    return fail(`El campo ${campo} supera el máximo permitido (${MONTO_MAXIMO}).`);
  }

  return ok(numero.toFixed(2));
}

function parseMontoOpcional(valor: unknown, campo: string): Resultado<string | null> {

  if (valor === undefined || valor === null || valor === '') {
    return ok(null);
  }

  return parseMonto(valor, campo);
}

function parseFecha(valor: unknown, campo: string): Resultado<Date> {

  if (typeof valor !== 'string' && !(valor instanceof Date)) {
    return fail(`El campo ${campo} debe ser una fecha.`);
  }

  const fecha = valor instanceof Date ? valor : new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return fail(`El campo ${campo} no es una fecha válida.`);
  }

  return ok(fecha);
}

function parseId(valor: unknown, campo = 'el identificador'): Resultado<number> {

  if (typeof valor !== 'string' && typeof valor !== 'number') {
    return fail(`${campo} no es válido.`);
  }

  const id = Number(valor);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return fail(`${campo} no es válido.`);
  }

  return ok(id);
}

function parsePaginacion(query: Record<string, unknown>): Resultado<{ page: number; limit: number }> {

  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limite === undefined ? 1000 : Number(query.limite);

  if (!Number.isSafeInteger(page) || page < 1) {
    return fail('El parámetro page debe ser un entero mayor o igual a 1.');
  }

  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
    return fail('El parámetro limite debe ser un entero entre 1 y 1000.');
  }

  return ok({ page, limit });
}

/**
 * SequelizeUniqueConstraintError y SequelizeForeignKeyConstraintError
 * llegan con un message genérico ("Validation error"), así que el
 * mapeo a 409/400 tiene que leer error.name y no el texto.
 */
function sendDatabaseError(res: Response, error: unknown, mensaje: string) {

  const nombre = error instanceof Error ? error.name : '';
  const detalle = error instanceof Error ? error.message : String(error);

  if (nombre === 'SequelizeUniqueConstraintError' || /unique|duplicate key/i.test(detalle)) {
    res.status(409).json({ message: mensaje });
    return;
  }

  if (nombre === 'SequelizeForeignKeyConstraintError' || /violates foreign key constraint/i.test(detalle)) {
    res.status(400).json({ message: 'Uno de los valores enviados no existe en la base de datos.' });
    return;
  }

  if (nombre === 'SequelizeValidationError' || /Validation error/i.test(detalle)) {
    res.status(400).json({ message: detalle });
    return;
  }

  console.error('Error al operar sobre el recurso:', error);
  res.status(500).json({ message: 'No se pudo completar la operación en la base de datos.' });
}

export { ok, fail, esObjeto, texto, parseMonto, parseMontoOpcional, parseFecha, parseId, parsePaginacion, sendDatabaseError };
export type { Resultado };
