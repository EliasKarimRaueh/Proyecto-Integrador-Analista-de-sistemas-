import { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';

export const LIMITE_FOTO_BYTES = 2 * 1024 * 1024;

export type FotoValida = { bytes: Buffer; nombre: string; mime: string };

/** La foto ya validada, para no arrastrar el multer por el resto del código. */
declare global {
  namespace Express {
    interface Request {
      foto?: FotoValida;
    }
  }
}

const FORMATOS = [
  {
    mime: 'image/jpeg',
    extension: 'jpg',
    coincide: (b: Buffer) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
  },
  {
    mime: 'image/png',
    extension: 'png',
    coincide: (b: Buffer) =>
      b.length > 8 &&
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  },
  {
    mime: 'image/webp',
    extension: 'webp',
    coincide: (b: Buffer) =>
      b.length > 12 &&
      b.toString('ascii', 0, 4) === 'RIFF' &&
      b.toString('ascii', 8, 12) === 'WEBP'
  }
];

/** Rechazo temprano por mime declarado, antes de leer el archivo a memoria. */
export class ErrorFormatoNoPermitido extends Error {
  constructor() {
    super('FORMATO_NO_PERMITIDO');
    this.name = 'ErrorFormatoNoPermitido';
  }
}

/**
 * Identifica el formato mirando los primeros bytes, no el Content-Type que
 * declara el navegador. Un cliente puede mandar cualquier cosa diciendo
 * `image/jpeg`, así que el tipo real sale de la firma del archivo.
 *
 * SVG queda afuera a propósito: es un XML que el navegador ejecuta, y un SVG
 * subido por un usuario es un XSS esperando su turno.
 */
function detectarFormato(buffer: Buffer) {
  return FORMATOS.find(formato => formato.coincide(buffer));
}

/** Los navegadores mandan `C:\fakepath\pollo.jpg`; solo interesa el nombre. */
function sanearNombre(original: string) {
  const base = original.split(/[\\/]/).pop() ?? '';
  const limpio = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/-{2,}/g, '-')
    .slice(0, 255);
  return limpio || 'foto';
}

export const subirFoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITE_FOTO_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    // Filtro barato antes de leer el archivo entero a memoria. La decisión
    // final la toma validarFoto, que sí mira los bytes.
    if (!FORMATOS.some(formato => formato.mime === file.mimetype)) {
      callback(new ErrorFormatoNoPermitido());
      return;
    }
    callback(null, true);
  }
}).single('foto');

/** Corre después de multer: recién acá están los bytes para inspeccionarlos. */
export function validarFoto(req: Request, res: Response, next: NextFunction) {
  const file = req.file;

  if (!file) {
    next();
    return;
  }

  const formato = detectarFormato(file.buffer);

  if (!formato) {
    res.status(400).json({ message: 'El archivo no es una imagen válida. Usá JPG, PNG o WebP.' });
    return;
  }

  req.foto = {
    bytes: file.buffer,
    nombre: sanearNombre(file.originalname),
    // El mime sale de la firma, no del que decía el cliente.
    mime: formato.mime
  };

  next();
}

/**
 * Los errores de multer son operational errors: no son una falla del servidor
 * y si caen en el manejador general se reporta un 500 al usuario que solo
 * eligió una foto muy grande.
 */
export function manejarErrorDeSubida(error: unknown, _req: Request, res: Response, next: NextFunction) {
  if (error instanceof ErrorFormatoNoPermitido) {
    res.status(400).json({ message: 'Solo se admiten fotos JPG, PNG o WebP.' });
    return;
  }

  if (!(error instanceof multer.MulterError)) {
    next(error);
    return;
  }

  if (error.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({ message: `La foto supera el límite de ${Math.round(LIMITE_FOTO_BYTES / 1024 / 1024)}MB.` });
    return;
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE' || error.code === 'LIMIT_FILE_COUNT') {
    res.status(400).json({ message: 'Solo se admite un archivo por solicitud.' });
    return;
  }

  next(error);
}
