import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

const ROLES = ['PROPIETARIO', 'EMPLEADO'] as const;

class Usuario extends Model {
    declare id: number;
    declare nombre: string;
    declare apellido: string;
    declare email: string;
    declare passwordHash: string;
    declare rol: typeof ROLES[number];
    declare activo: boolean;
    declare fechaCreacion: Date;
    declare fechaActualizacion: Date;
    declare ultimoAcceso: Date | null;

    // Nunca serializar el hash (respuestas JSON, logs, etc.).
    toJSON<T>(): T {
        const valores = this.get({ plain: true }) as Record<string, unknown>;
        delete valores.passwordHash;
        return valores as unknown as T;
    }
}

Usuario.init(
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },

        nombre: {
            type: DataTypes.STRING(50),
            allowNull: false
        },

        apellido: {
            type: DataTypes.STRING(50),
            allowNull: false
        },

        email: {
            type: DataTypes.STRING(254),
            allowNull: false
        },

        passwordHash: {
            type: DataTypes.STRING(255),
            allowNull: false
        },

        rol: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'EMPLEADO',
            validate: {
                isIn: {
                    args: [ROLES],
                    msg: 'El rol del usuario no es válido.'
                }
            }
        },

        activo: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },

        fechaCreacion: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },

        fechaActualizacion: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },

        ultimoAcceso: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null
        }
    },
    {
        sequelize,
        modelName: 'Usuario',
        tableName: 'usuarios',
        timestamps: true,
        createdAt: 'fechaCreacion',
        updatedAt: 'fechaActualizacion'
    }
);

export default Usuario;
