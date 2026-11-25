import { Op, type WhereOptions } from 'sequelize';
import sequelize from 'polleria-database/config/database';
import Usuario from 'polleria-database/models/Usuario';
import { hashPassword, normalizarEmail, publicarUsuario, revocarSesionesDeUsuario, type Rol, type UsuarioPublico } from './auth.js';
import { ErrorOperacion, objeto } from './validacion.js';

export type { UsuarioPublico, Rol } from './auth.js';

interface DatosUsuario {
  nombre: string;
  apellido: string;
  email: string;
  password?: string;
  rol: Rol;
  activo?: boolean;
}

function texto(value: unknown, campo: string, maximo = 50): string {
  if (typeof value !== 'string') throw new ErrorOperacion(`${campo} debe ser texto.`);
  const resultado = value.trim();
  if (!resultado || resultado.length > maximo) throw new ErrorOperacion(`${campo} es obligatorio y admite hasta ${maximo} caracteres.`);
  return resultado;
}

function correo(value: unknown): string {
  const email = texto(value, 'email', 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErrorOperacion('El email no es válido.');
  return normalizarEmail(email);
}

function password(value: unknown, obligatoria: boolean): string | undefined {
  if (value === undefined || value === null || value === '') {
    if (obligatoria) throw new ErrorOperacion('La contraseña es obligatoria.');
    return undefined;
  }
  if (typeof value !== 'string') throw new ErrorOperacion('La contraseña debe ser texto.');
  if (value.length < 8 || value.length > 72) throw new ErrorOperacion('La contraseña debe tener entre 8 y 72 caracteres.');
  return value;
}

function rol(value: unknown, obligatorio: boolean): Rol | undefined {
  if (value === undefined) {
    if (obligatorio) throw new ErrorOperacion('El rol es obligatorio.');
    return undefined;
  }
  if (value !== 'PROPIETARIO' && value !== 'EMPLEADO') throw new ErrorOperacion('Rol inválido.');
  return value;
}

function bandera(value: unknown, campo: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new ErrorOperacion(`${campo} debe ser verdadero o falso.`);
  return value;
}

function validarDatos(body: unknown, crear: boolean): DatosUsuario {
  const b = objeto(body);
  return {
    nombre: texto(b.nombre, 'nombre'),
    apellido: texto(b.apellido, 'apellido'),
    email: correo(b.email),
    password: password(b.password, crear),
    rol: rol(b.rol, crear)!,
    activo: bandera(b.activo, 'activo')
  };
}

function whereEmail(email: string, excluirId?: number): WhereOptions {
  const porEmail = sequelize.where(sequelize.fn('lower', sequelize.col('email')), normalizarEmail(email));
  return excluirId === undefined
    ? porEmail
    : { [Op.and]: [porEmail, { id: { [Op.ne]: excluirId } }] } as WhereOptions;
}

async function asegurarEmailLibre(email: string, excluirId?: number): Promise<void> {
  const existente = await Usuario.findOne({ where: whereEmail(email, excluirId) });
  if (existente) throw new ErrorOperacion('Ya existe un usuario con ese email.', 409);
}

async function buscar(idUsuario: number): Promise<Usuario> {
  const usuario = await Usuario.findByPk(idUsuario);
  if (!usuario) throw new ErrorOperacion('Usuario no encontrado.', 404);
  return usuario;
}

async function ultimoPropietarioActivo(usuario: Usuario): Promise<boolean> {
  if (usuario.get('rol') !== 'PROPIETARIO' || usuario.get('activo') !== true) return false;
  const cantidad = await Usuario.count({
    where: { rol: 'PROPIETARIO', activo: true, id: { [Op.ne]: usuario.id } }
  });
  return cantidad === 0;
}

export async function listarUsuarios(filtros: { q?: string; rol?: string; activo?: boolean } = {}): Promise<UsuarioPublico[]> {
  const where: Record<string | symbol, unknown> = {};
  const q = filtros.q?.trim();
  if (q) {
    where[Op.or] = [
      { nombre: { [Op.iLike]: `%${q}%` } },
      { apellido: { [Op.iLike]: `%${q}%` } },
      { email: { [Op.iLike]: `%${q}%` } }
    ];
  }
  if (filtros.rol !== undefined) where.rol = rol(filtros.rol, true);
  if (filtros.activo !== undefined) where.activo = filtros.activo;

  const usuarios = await Usuario.findAll({ where, order: [['id', 'ASC']] });
  return usuarios.map(publicarUsuario);
}

export async function obtenerUsuario(idUsuario: number): Promise<UsuarioPublico> {
  return publicarUsuario(await buscar(idUsuario));
}

export async function crearUsuario(body: unknown): Promise<UsuarioPublico> {
  const datos = validarDatos(body, true);
  await asegurarEmailLibre(datos.email);
  const creado = await Usuario.create({
    nombre: datos.nombre,
    apellido: datos.apellido,
    email: datos.email,
    passwordHash: await hashPassword(datos.password!),
    rol: datos.rol!,
    activo: datos.activo ?? true,
    ultimoAcceso: null
  });
  return publicarUsuario(creado);
}

export async function actualizarUsuario(idUsuario: number, body: unknown, operadorId: number): Promise<UsuarioPublico> {
  const usuario = await buscar(idUsuario);
  const datos = validarDatos(body, false);
  await asegurarEmailLibre(datos.email, idUsuario);

  const rolAnterior = usuario.get('rol') as Rol;
  const activoAnterior = usuario.get('activo') as boolean;
  const nuevoRol = datos.rol ?? rolAnterior;
  const nuevoActivo = datos.activo ?? activoAnterior;
  if (rolAnterior === 'PROPIETARIO' && activoAnterior && (nuevoRol !== 'PROPIETARIO' || !nuevoActivo)) {
    if (operadorId === idUsuario) throw new ErrorOperacion('No podés quitarte el rol de propietario a vos mismo.', 409);
    if (await ultimoPropietarioActivo(usuario)) throw new ErrorOperacion('No se puede dejar al sistema sin un propietario activo.', 409);
  }

  await usuario.update({
    nombre: datos.nombre,
    apellido: datos.apellido,
    email: datos.email,
    rol: nuevoRol,
    activo: nuevoActivo,
    ...(datos.password === undefined ? {} : { passwordHash: await hashPassword(datos.password) })
  });

  if (activoAnterior && !nuevoActivo) await revocarSesionesDeUsuario(idUsuario);
  return publicarUsuario(usuario);
}

export async function bajarUsuario(idUsuario: number, operadorId: number): Promise<UsuarioPublico> {
  if (idUsuario === operadorId) throw new ErrorOperacion('No podés darte de baja a vos mismo.', 409);
  const usuario = await buscar(idUsuario);
  if (!usuario.get('activo')) return publicarUsuario(usuario);
  if (await ultimoPropietarioActivo(usuario)) throw new ErrorOperacion('No se puede dar de baja al último propietario activo.', 409);

  await usuario.update({ activo: false });
  await revocarSesionesDeUsuario(idUsuario);
  return publicarUsuario(usuario);
}

export async function reactivarUsuario(idUsuario: number): Promise<UsuarioPublico> {
  const usuario = await buscar(idUsuario);
  if (usuario.get('activo')) return publicarUsuario(usuario);
  await usuario.update({ activo: true });
  return publicarUsuario(usuario);
}
