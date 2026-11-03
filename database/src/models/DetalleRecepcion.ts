import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

const PRESENTACIONES = ['UNIDAD', 'KILOS', 'CAJON', 'CAJA', 'BOLSA', 'BULTO'] as const;

class DetalleRecepcion extends Model {
    declare id: number;
    declare recepcionId: number;
    declare productoId: number;
    declare presentacion: typeof PRESENTACIONES[number];
    declare cantidadPresentacion: number;
    declare factorConversion: number;
    declare cantidadBase: number;
    declare costoUnitario: string | null;
}

DetalleRecepcion.init({

    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },

    recepcionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'recepciones',
            key: 'id'
        }
    },

    productoId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'productos',
            key: 'id'
        }
    },

    presentacion: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
            isIn: {
                args: [PRESENTACIONES],
                msg: 'La presentación de la recepción no es válida.'
            }
        }
    },

    cantidadPresentacion: {
        type: DataTypes.FLOAT,
        allowNull: false,
        validate: {
            isPositive(value: number) {
                if (value <= 0) {
                    throw new Error('La cantidad recibida debe ser positiva.');
                }
            }
        }
    },

    factorConversion: {
        type: DataTypes.FLOAT,
        allowNull: false,
        validate: {
            isPositive(value: number) {
                if (value <= 0) {
                    throw new Error('El factor de conversión debe ser positivo.');
                }
            }
        }
    },

    cantidadBase: {
        type: DataTypes.FLOAT,
        allowNull: false,
        validate: {
            isPositive(value: number) {
                if (value <= 0) {
                    throw new Error('La cantidad en unidad base debe ser positiva.');
                }
            }
        }
    },

    costoUnitario: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: null
    }

}, {

    sequelize,

    modelName: 'DetalleRecepcion',

    tableName: 'detalles_recepcion',

    timestamps: false,

    indexes: [
        {
            unique: true,
            fields: ['recepcionId', 'productoId']
        }
    ]

});

export default DetalleRecepcion;
