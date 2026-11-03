import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class DetalleCompra extends Model {
    declare id: number;
    declare compraId: number;
    declare productoId: number;
    declare cantidad: number;
    declare costoUnitario: string;
    declare subtotal: string;
    declare presentacion: string | null;
    declare cantidadPresentacion: number | null;
    declare factorConversion: number | null;
}

DetalleCompra.init({

    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },

    compraId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'compras',
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

    cantidad: {
        type: DataTypes.FLOAT,
        allowNull: false,
        validate: {
            isPositive(value: number) {
                if (value <= 0) {
                    throw new Error('La cantidad de la compra debe ser positiva.');
                }
            }
        }
    },

    costoUnitario: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
            isNonNegative(value: string | number) {
                if (Number(value) < 0) {
                    throw new Error('El costo unitario no puede ser negativo.');
                }
            }
        }
    },

    subtotal: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
            isNonNegative(value: string | number) {
                if (Number(value) < 0) {
                    throw new Error('El subtotal no puede ser negativo.');
                }
            }
        }
    },

    presentacion: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: null
    },

    cantidadPresentacion: {
        type: DataTypes.FLOAT,
        allowNull: true,
        defaultValue: null
    },

    factorConversion: {
        type: DataTypes.FLOAT,
        allowNull: true,
        defaultValue: null
    }

}, {

    sequelize,

    modelName: 'DetalleCompra',

    tableName: 'detalles_compra',

    timestamps: false,

    indexes: [
        {
            unique: true,
            fields: ['compraId', 'productoId']
        }
    ]

});

export default DetalleCompra;
