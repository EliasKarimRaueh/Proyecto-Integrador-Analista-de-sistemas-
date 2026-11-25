import { Op } from 'sequelize';
import type { Transaction, WhereOptions } from 'sequelize';

import Usuario from '../models/Usuario.js';

// Ninguna consulta pública trae passwordHash; además, Usuario.toJSON() lo omite.
const ATRIBUTOS_PUBLICOS = { exclude: ['passwordHash'] };

export type UsuarioPublico = Record<string, unknown>;
export type DatosCreacionUsuario = {
    nombre: string;
    apellido: string;
    email: string;
    passwordHash: string;
    rol?: 'PROPIETARIO' | 'EMPLEADO';
    activo?: boolean;
};

const whereEmail = (email: string) => ({
    email: { [Op.iLike]: email.trim() }
}) as WhereOptions<Usuario>;

function sinHash(usuario: Usuario): UsuarioPublico {
    const plano = usuario.get({ plain: true }) as Record<string, unknown>;
    delete plano.passwordHash;
    return plano;
}

export class UsuarioRepository {

    async buscarPorEmail(
        email: string,
        transaction?: Transaction
    ): Promise<UsuarioPublico | null> {
        const usuario = await Usuario.findOne({
            where: whereEmail(email),
            attributes: ATRIBUTOS_PUBLICOS,
            transaction
        });
        return usuario ? sinHash(usuario) : null;
    }

    async buscarPorId(
        id: number,
        transaction?: Transaction
    ): Promise<UsuarioPublico | null> {
        const usuario = await Usuario.findByPk(id, {
            attributes: ATRIBUTOS_PUBLICOS,
            transaction
        });
        return usuario ? sinHash(usuario) : null;
    }

    /** Define si ya existe un propietario activo (alta inicial / bootstrap). */
    async contarPropietariosActivos(
        transaction?: Transaction
    ): Promise<number> {
        return Usuario.count({
            where: { rol: 'PROPIETARIO', activo: true },
            transaction
        });
    }

    async listar(opciones: {
        soloActivos?: boolean;
        page?: number;
        limit?: number;
        transaction?: Transaction;
    } = {}): Promise<{ rows: UsuarioPublico[]; count: number }> {
        const page = opciones.page ?? 1;
        const limit = opciones.limit ?? 10;
        const resultado = await Usuario.findAndCountAll({
            where: opciones.soloActivos ? { activo: true } : undefined,
            attributes: ATRIBUTOS_PUBLICOS,
            order: [['apellido', 'ASC'], ['id', 'ASC']],
            limit,
            offset: (page - 1) * limit,
            transaction: opciones.transaction
        });
        return {
            rows: resultado.rows.map(sinHash),
            count: resultado.count
        };
    }

    /** El hash se recibe ya generado por el servicio de autenticación. */
    async crear(
        datos: DatosCreacionUsuario,
        transaction?: Transaction
    ): Promise<UsuarioPublico> {
        const usuario = await Usuario.create(datos as any, { transaction });
        return sinHash(usuario);
    }

    async actualizarUltimoAcceso(
        id: number,
        transaction?: Transaction
    ): Promise<void> {
        await Usuario.update(
            { ultimoAcceso: new Date() },
            { where: { id }, transaction }
        );
    }

    async desactivar(id: number, transaction?: Transaction): Promise<void> {
        await Usuario.update({ activo: false }, { where: { id }, transaction });
    }

    /**
     * Autenticación: verifica la contraseña dentro del repositorio y devuelve
     * el usuario sin hash. `verificar` suele ser bcrypt.compare.
     */
    async verificarPassword(
        email: string,
        verificar: (passwordHash: string) => boolean | Promise<boolean>,
        transaction?: Transaction
    ): Promise<UsuarioPublico | null> {
        const usuario = await Usuario.findOne({
            where: whereEmail(email),
            transaction
        });
        if (!usuario || !usuario.activo) return null;
        const valido = await verificar(usuario.passwordHash);
        return valido ? sinHash(usuario) : null;
    }
}

export default UsuarioRepository;
export const usuarioRepository = new UsuarioRepository();
