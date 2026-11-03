
import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

const ESTADOS = ['PENDIENTE_RECEPCION', 'RECIBIDA'] as const;
const TIPOS_COMPROBANTE = ['FACTURA', 'REMITO', 'OTRO'] as const;

class Compra extends Model {
    declare id: number;
    declare fechaHora: Date;
    declare total: number;
    declare proveedorId: number;
    declare pedidoId: number | null;
    declare tipoComprobante: typeof TIPOS_COMPROBANTE[number] | null;
    declare numeroComprobante: string | null;
    declare estado: typeof ESTADOS[number];
}

Compra.init({

    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        unique: true
    },

    proveedorId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'proveedores',
            key: 'id'
        }
    },

    pedidoId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
        references: {
            model: 'pedidos_compra',
            key: 'id'
        }
    },

    tipoComprobante: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: null,
        validate: {
            isIn: {
                args: [TIPOS_COMPROBANTE],
                msg: 'El tipo de comprobante no es válido.'
            }
        }
    },

    numeroComprobante: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: null
    },

    estado: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'PENDIENTE_RECEPCION',
        validate: {
            isIn: {
                args: [ESTADOS],
                msg: 'El estado de la compra no es válido.'
            }
        }
    },

    fechaHora: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },

    total: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,

        validate: {
            isNonNegative(value: string | number) {
                if (Number(value) < 0) {
                    throw new Error(
                        'El total de la venta no puede ser negativo.'
                    );
                }
            }
        }
    }

}, {

    sequelize,

    modelName: 'Compra',

    tableName: 'compras',

    timestamps: false

});

export default Compra;
