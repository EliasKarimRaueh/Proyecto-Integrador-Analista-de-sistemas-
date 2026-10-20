import { type Request, type Response } from 'express';
import ProveedorRepository from 'polleria-database/repositories/proveedorRepository';

const proveedorRepository = new ProveedorRepository();

type ProveedorInput = {
  nombre?: unknown;
  cuil?: unknown;
  descripcion?: unknown;
  ctaCte?: unknown;
  telefono?: unknown;
  email?: unknown;
  direccion?: unknown;
  diasEntrega?: unknown;
};

function validateInput(body: ProveedorInput) {
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
  const cuil = typeof body.cuil === 'string' && body.cuil.trim() !== '' ? body.cuil.trim() : null;
  const descripcion = typeof body.descripcion === 'string' && body.descripcion.trim() !== '' ? body.descripcion.trim() : null;
  // Soporta que el frontend mande un booleano real o un string 'true'/'false'
  const ctaCte = typeof body.ctaCte === 'boolean' ? body.ctaCte : body.ctaCte === 'true';
  const telefono = typeof body.telefono === 'string' && body.telefono.trim() !== '' ? body.telefono.trim() : null;
  const email = typeof body.email === 'string' && body.email.trim() !== '' ? body.email.trim().toLowerCase() : null;
  const direccion = typeof body.direccion === 'string' && body.direccion.trim() !== '' ? body.direccion.trim() : null;
  const diasValidos = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  if (body.direccion !== undefined && body.direccion !== null && typeof body.direccion !== 'string') return { error: 'La dirección debe ser texto.' };
  if (direccion && direccion.length > 200) return { error: 'La dirección no puede superar los 200 caracteres.' };
  if (body.diasEntrega !== undefined && (!Array.isArray(body.diasEntrega) || body.diasEntrega.some(dia => typeof dia !== 'string' || !diasValidos.includes(dia)))) return { error: 'Los días de entrega no son válidos.' };
  const diasEntrega = body.diasEntrega === undefined ? undefined : diasValidos.filter(dia => (body.diasEntrega as string[]).includes(dia));

  if (nombre.length < 1 || nombre.length > 50) return { error: 'El nombre debe tener entre 1 y 50 caracteres.' };
  if (cuil && !/^\d{11}$/.test(cuil)) return { error: 'El CUIL debe contener exactamente 11 dígitos numéricos.' };
  if (telefono && !/^\d{10,15}$/.test(telefono)) return { error: 'El teléfono debe contener entre 10 y 15 dígitos.' };
  if (email && !/^[^\s@]+@[^\s@]+\.com$/.test(email)) return { error: 'El email debe tener un formato válido y finalizar en .com.' };
  if (descripcion && descripcion.length > 300) return { error: 'La descripción no puede superar los 300 caracteres.' };

  return { value: { nombre, cuil, descripcion, ctaCte, telefono, email,
    ...(body.direccion === undefined ? {} : { direccion }),
    ...(diasEntrega === undefined ? {} : { diasEntrega })
  } };
}

function parseId(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ message: 'El identificador del proveedor no es válido.' });
    return null;
  }
  return id;
}

function sendDatabaseError(res: Response, error: unknown) {
  const details = error instanceof Error ? error.message : String(error);
  // Captura errores de unicidad si intentan registrar un CUIL, Teléfono o Email que ya existe
  if (/unique|cuil|email|telefono/i.test(details)) {
    res.status(409).json({ message: 'Ya existe un proveedor registrado con ese CUIL, email o teléfono.' });
    return;
  }
  console.error('Error al operar sobre proveedores:', error);
  res.status(500).json({ message: 'No se pudo guardar el proveedor en la base de datos.' });
}

export const getProveedores = async (_req: Request, res: Response) => {
  try {
    const proveedores = await proveedorRepository.buscarTodos('nombre', 'ASC');
    res.json(proveedores);
  } catch (error) { sendDatabaseError(res, error); }
};

export const getProveedorById = async (req: Request, res: Response) => {
  const id = parseId(req, res);
  if (id === null) return;
  try {
    const proveedor = await proveedorRepository.buscarPorId(id);
    if (!proveedor) {
      res.status(404).json({ message: 'Proveedor no encontrado.' });
      return;
    }
    res.json(proveedor);
  } catch (error) { 
    sendDatabaseError(res, error); 
  }
};

export const createProveedor = async (req: Request, res: Response) => {
  const parsed = validateInput(req.body as ProveedorInput);
  if (!parsed.value) { res.status(400).json({ message: parsed.error }); return; }
  try {
    const proveedor = await proveedorRepository.crear({
      ...parsed.value,
      activo: true,
      fechaBaja: null
    });
    res.status(201).json(proveedor);
  } catch (error) { sendDatabaseError(res, error); }
};

export const updateProveedor = async (req: Request, res: Response) => {
  const id = parseId(req, res);
  if (id === null) return;
  const parsed = validateInput(req.body as ProveedorInput);
  if (!parsed.value) { res.status(400).json({ message: parsed.error }); return; }
  try {
    const proveedor = await proveedorRepository.actualizar(id, parsed.value);
    if (!proveedor) { res.status(404).json({ message: 'Proveedor no encontrado.' }); return; }
    res.json(proveedor);
  } catch (error) { sendDatabaseError(res, error); }
};

export const deactivateProveedor = async (req: Request, res: Response) => {
  const id = parseId(req, res);
  if (id === null) return;
  try {
    const proveedor = await proveedorRepository.eliminar(id);
    if (!proveedor) { res.status(404).json({ message: 'Proveedor no encontrado.' }); return; }
    res.json(proveedor);
  } catch (error) { sendDatabaseError(res, error); }
};

export const reactivateProveedor = async (req: Request, res: Response) => {
  const id = parseId(req, res);
  if (id === null) return;
  try {
    const proveedor = await proveedorRepository.actualizar(id, { 
      activo: true, 
      fechaBaja: null 
    });
    if (!proveedor) { res.status(404).json({ message: 'Proveedor no encontrado.' }); return; }
    res.json(proveedor);
  } catch (error) { sendDatabaseError(res, error); }
};
