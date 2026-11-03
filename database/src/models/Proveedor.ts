import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class Proveedor extends Model {
    declare id: number;
    declare nombre: string;
    declare cuil: string | null;
    declare descripcion: string | null;
    declare ctaCte: boolean;
    declare telefono: string | null;
    declare email: string | null;
    declare direccion: string | null;
    declare diasEntrega: string[];
    declare activo: boolean;
    declare fechaBaja: Date | null;
}

Proveedor.init({

    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },

    nombre: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            len: {
                args: [1, 50],
                msg: "El nombre del proveedor debe tener menos de 50 caracteres."
            }
        }
    },

    cuil: {
        type: DataTypes.STRING(11),
        allowNull: true,
        defaultValue: null,
        unique: true,
        validate: {
            isValidCuil(value: string | null) {
                if (value !== null && !/^\d{11}$/.test(value)) {
                    throw new Error(
                        'El CUIL debe contener exactamente 11 dígitos.'
                    );
                }
            }
        }
    },

    descripcion: {
        type: DataTypes.STRING(300),
        allowNull: true,
        defaultValue: null,
        validate: {
            len: {
                args: [0, 300],
                msg: 'La descripción no puede superar los 300 caracteres.'
            }
        }
    },

    ctaCte: {
        type: DataTypes.BOOLEAN,
        allowNull: false
    },

    telefono: {
        type: DataTypes.STRING(15),
        allowNull: true,
        defaultValue: null,
        unique: true,
        validate: {
            isValidTelefono(value: string | null) {
                if (value !== null && !/^\d{10,15}$/.test(value)) {
                    throw new Error(
                        'El teléfono debe contener entre 10 y 15 dígitos.'
                    );
                }
            }
        }
    },

    email: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
        unique: true,
        validate: {
            isValidEmail(value: string | null) {
                if (
                    value !== null &&
                    !/^[^\s@]+@[^\s@]+\.com$/.test(value)
                ) {
                    throw new Error(
                        'El email debe tener un formato válido y finalizar en .com.'
                    );
                }
            }
        }
    },

    direccion: {
        type: DataTypes.STRING(200),
        allowNull: true,
        defaultValue: null,
        validate: { len: [0, 200] }
    },

    diasEntrega: {
        type: DataTypes.ARRAY(DataTypes.STRING(10)),
        allowNull: false,
        defaultValue: []
    },

    activo: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },

    fechaBaja: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null
    }

}, {
    sequelize,
    modelName: 'Proveedor',
    tableName: 'proveedores',
    timestamps: false

});

export default Proveedor;
