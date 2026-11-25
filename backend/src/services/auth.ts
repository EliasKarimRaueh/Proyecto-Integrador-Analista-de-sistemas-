import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { Op } from 'sequelize';
import sequelize from 'polleria-database/config/database';
import Usuario from 'polleria-database/models/Usuario';
import SesionUsuario from 'polleria-database/models/SesionUsuario';
import { ErrorOperacion, objeto } from './validacion.js';

export type Rol = 'PROPIETARIO' | 'EMPLEADO';

export interface UsuarioPublico {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  rol: Rol;
  activo: boolean;
  fechaCreacion?: Date | string;
  fechaActualizacion?: Date | string;
  ultimoAcceso?: Date | string | null;
}

export interface UsuarioAutenticado extends UsuarioPublico {
  jti: string;
}

interface SesionAutenticada {
  usuario: UsuarioAutenticado;
  jti: string;
  expiraEn: Date;
}

interface Tokens {
  accessToken: string;
  refreshToken: string;
  usuario: UsuarioPublico;
  recordarme: boolean;
}

interface Claims {
  sub: string;
  jti: string;
  tipo: 'access' | 'refresh';
  recordarme?: boolean;
}

const COSTE_HASH = 10;
const DIAS_REFRESH_PREDETERMINADO = 1;
const DIAS_REFRESH_RECORDARME = 7;

function secreto(nombre: string): string {
  const valor = process.env[nombre]?.trim();
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}.`);
  return valor;
}

function accesosSecret(): string {
  return secreto('JWT_SECRET');
}

function refreshSecret(): string {
  return secreto('JWT_REFRESH_SECRET');
}

function accessTtl(): SignOptions['expiresIn'] {
  return (process.env.JWT_ACCESS_TTL?.trim() || '15m') as SignOptions['expiresIn'];
}

function diasRefresh(recordarme: boolean): number {
  const variable = recordarme ? 'JWT_REFRESH_DIAS_RECORDARME' : 'JWT_REFRESH_DIAS';
  const configurado = Number(process.env[variable]);
  if (Number.isFinite(configurado) && configurado > 0) return configurado;
  return recordarme ? DIAS_REFRESH_RECORDARME : DIAS_REFRESH_PREDETERMINADO;
}

export function normalizarEmail(valor: string): string {
  return valor.trim().toLowerCase();
}

function nombreUsuario(u: UsuarioPublico): string {
  return `${normalizarEmail(u.nombre)}.${normalizarEmail(u.apellido)}`;
}

function datosUsuario(usuario: Usuario | UsuarioPublico): Record<string, unknown> {
  const instancia = usuario as Usuario & { get?: (options?: { plain?: boolean }) => Record<string, unknown> };
  return typeof instancia.get === 'function'
    ? instancia.get({ plain: true })
    : usuario as unknown as Record<string, unknown>;
}

export function publicarUsuario(usuario: Usuario | UsuarioPublico): UsuarioPublico {
  const datos = datosUsuario(usuario);
  return {
    id: Number(datos.id),
    nombre: String(datos.nombre),
    apellido: String(datos.apellido),
    email: String(datos.email),
    rol: datos.rol === 'PROPIETARIO' ? 'PROPIETARIO' : 'EMPLEADO',
    activo: datos.activo !== false,
    ...(datos.fechaCreacion === undefined ? {} : { fechaCreacion: datos.fechaCreacion as Date | string }),
    ...(datos.fechaActualizacion === undefined ? {} : { fechaActualizacion: datos.fechaActualizacion as Date | string }),
    ...(datos.ultimoAcceso === undefined ? {} : { ultimoAcceso: datos.ultimoAcceso as Date | string | null })
  };
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COSTE_HASH);
}

export function verificarPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function firmarAcceso(usuario: UsuarioPublico, jti: string): string {
  const payload: Claims = { sub: String(usuario.id), jti, tipo: 'access' };
  return jwt.sign(payload, accesosSecret(), { expiresIn: accessTtl() });
}

function firmarRefresh(usuario: UsuarioPublico, jti: string, dias: number, recordarme: boolean): string {
  const payload: Claims = { sub: String(usuario.id), jti, tipo: 'refresh', recordarme };
  return jwt.sign(payload, refreshSecret(), { expiresIn: `${dias}d` });
}

async function crearSesion(usuarioId: number, dias: number): Promise<{ jti: string; expiraEn: Date }> {
  const jti = randomUUID();
  const creadaEn = new Date();
  const expiraEn = new Date(creadaEn.getTime() + dias * 24 * 60 * 60 * 1000);
  await SesionUsuario.create({ jti, usuarioId, creadaEn, expiraEn, revocadaEn: null });
  return { jti, expiraEn };
}

async function marcarAcceso(usuarioId: number): Promise<void> {
  await Usuario.update({ ultimoAcceso: new Date() }, { where: { id: usuarioId } });
}

function decodificar(token: string, secreto: string, tipo: Claims['tipo'], ignoreExpiration = false): Claims {
  let claims: jwt.JwtPayload | string;
  try {
    claims = jwt.verify(token, secreto, { ignoreExpiration });
  } catch {
    throw new ErrorOperacion('Sesión inválida o vencida.', 401);
  }
  if (typeof claims === 'string' || claims.tipo !== tipo || typeof claims.sub !== 'string' || typeof claims.jti !== 'string') {
    throw new ErrorOperacion('Sesión inválida o vencida.', 401);
  }
  return { sub: claims.sub, jti: claims.jti, tipo, recordarme: claims.recordarme === true };
}

async function usuarioPorId(id: number): Promise<Usuario | null> {
  return Usuario.findByPk(id);
}

async function sesionVigente(jti: string, usuarioId: number): Promise<SesionUsuario | null> {
  return SesionUsuario.findOne({
    where: {
      jti,
      usuarioId,
      revocadaEn: null,
      expiraEn: { [Op.gt]: new Date() }
    }
  });
}

async function usuarioActivo(id: number): Promise<UsuarioPublico> {
  const usuario = await usuarioPorId(id);
  if (!usuario) throw new ErrorOperacion('Sesión inválida o vencida.', 401);
  const publico = publicarUsuario(usuario);
  if (!publico.activo) throw new ErrorOperacion('El usuario está inactivo.', 403);
  return publico;
}

function validarCredenciales(body: unknown): { identificador: string; password: string; recordarme: boolean } {
  const b = objeto(body);
  const identificador = typeof b.identificador === 'string' ? b.identificador.trim() : '';
  const password = typeof b.password === 'string' ? b.password : '';
  if (!identificador || identificador.length > 254) throw new ErrorOperacion('Indicá un usuario o correo válido.');
  if (!password || password.length > 200) throw new ErrorOperacion('Indicá la contraseña.');
  return { identificador, password, recordarme: b.recordarme === true };
}

async function buscarUsuario(identificador: string): Promise<Usuario | null> {
  const normalizado = normalizarEmail(identificador);
  const porEmail = await Usuario.findOne({
    where: sequelize.where(sequelize.fn('lower', sequelize.col('email')), normalizado)
  });
  if (porEmail) return porEmail;
  if (!normalizado.includes('.')) return null;
  const candidatos = await Usuario.findAll();
  return candidatos.find(candidato => nombreUsuario(publicarUsuario(candidato)) === normalizado) ?? null;
}

export async function iniciarSesion(body: unknown): Promise<Tokens> {
  const { identificador, password, recordarme } = validarCredenciales(body);
  const usuario = await buscarUsuario(identificador);
  if (!usuario) throw new ErrorOperacion('Credenciales inválidas.', 401);

  const publico = publicarUsuario(usuario);
  if (!publico.activo) throw new ErrorOperacion('El usuario está inactivo. Contacte al propietario.', 403);

  const datos = datosUsuario(usuario);
  const hash = String(datos.passwordHash ?? '');
  if (!hash || !await verificarPassword(password, hash)) throw new ErrorOperacion('Credenciales inválidas.', 401);

  const dias = diasRefresh(recordarme);
  const { jti } = await crearSesion(publico.id, dias);
  await marcarAcceso(publico.id);
  return {
    accessToken: firmarAcceso(publico, jti),
    refreshToken: firmarRefresh(publico, jti, dias, recordarme),
    usuario: publico,
    recordarme
  };
}

export async function verificarAccessToken(token: string): Promise<SesionAutenticada> {
  const claims = decodificar(token, accesosSecret(), 'access');
  const id = Number(claims.sub);
  if (!Number.isSafeInteger(id) || id <= 0) throw new ErrorOperacion('Sesión inválida o vencida.', 401);

  const [usuario, sesion] = await Promise.all([
    usuarioActivo(id),
    sesionVigente(claims.jti, id)
  ]);
  if (!sesion) throw new ErrorOperacion('Sesión inválida o vencida.', 401);
  return { usuario: { ...usuario, jti: claims.jti }, jti: claims.jti, expiraEn: new Date(sesion.get('expiraEn')) };
}

export async function renovarSesion(token: string): Promise<Tokens> {
  const claims = decodificar(token, refreshSecret(), 'refresh');
  const id = Number(claims.sub);
  if (!Number.isSafeInteger(id) || id <= 0) throw new ErrorOperacion('Sesión inválida o vencida.', 401);

  const sesion = await sesionVigente(claims.jti, id);
  if (!sesion) throw new ErrorOperacion('Sesión inválida o vencida.', 401);
  const usuario = await usuarioActivo(id);
  await SesionUsuario.update({ revocadaEn: new Date() }, { where: { id: sesion.id, revocadaEn: null } });

  const recordarme = claims.recordarme === true;
  const dias = diasRefresh(recordarme);
  const { jti } = await crearSesion(id, dias);
  await marcarAcceso(id);
  return {
    accessToken: firmarAcceso(usuario, jti),
    refreshToken: firmarRefresh(usuario, jti, dias, recordarme),
    usuario,
    recordarme
  };
}

export async function revocarSesionPorToken(token: string): Promise<void> {
  let jti: string;
  try {
    jti = decodificar(token, refreshSecret(), 'refresh', true).jti;
  } catch {
    try {
      jti = decodificar(token, accesosSecret(), 'access', true).jti;
    } catch {
      return;
    }
  }
  await revocarSesion(jti);
}

export async function revocarSesion(jti: string | undefined): Promise<void> {
  if (!jti) return;
  await SesionUsuario.update({ revocadaEn: new Date() }, { where: { jti, revocadaEn: null } });
}

export async function revocarSesionesDeUsuario(usuarioId: number): Promise<void> {
  await SesionUsuario.update({ revocadaEn: new Date() }, { where: { usuarioId, revocadaEn: null } });
}

export function milisegundosRefresh(recordarme = false): number {
  return diasRefresh(recordarme) * 24 * 60 * 60 * 1000;
}

export function configuracionAuthCompleta(): boolean {
  return Boolean(process.env.JWT_SECRET?.trim() && process.env.JWT_REFRESH_SECRET?.trim());
}

export async function asegurarPropietarioInicial(): Promise<UsuarioPublico | null> {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('No se creó el propietario inicial: definí ADMIN_EMAIL y ADMIN_PASSWORD en el entorno.');
    return null;
  }
  if (password.length < 8) throw new Error('ADMIN_PASSWORD debe tener al menos 8 caracteres.');

  const normalizado = normalizarEmail(email);
  const existente = await Usuario.findOne({
    where: sequelize.where(sequelize.fn('lower', sequelize.col('email')), normalizado)
  });
  if (existente) return publicarUsuario(existente);

  const nombre = (process.env.ADMIN_NOMBRE?.trim() || 'Propietario').slice(0, 50);
  const apellido = (process.env.ADMIN_APELLIDO?.trim() || 'Sistema').slice(0, 50);
  const creado = await Usuario.create({
    nombre,
    apellido,
    email: normalizado,
    passwordHash: await hashPassword(password),
    rol: 'PROPIETARIO',
    activo: true,
    ultimoAcceso: null
  });
  return publicarUsuario(creado);
}
