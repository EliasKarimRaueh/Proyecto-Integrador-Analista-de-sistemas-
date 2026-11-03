import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

const ESTADOS = ['PENDIENTE', 'FACTURADO', 'CANCELADO', 'RECIBIDO'] as const;

class PedidoCompra extends Model {
    declare id: number;
    declare proveedorId: number;
    declare fechaHora: Date;
    declare estado: typeof ESTADOS[number];
    declare totalEstimado: string;
    declare observaciones: string | null;
}

PedidoCompra.init({

    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },

    proveedorId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'proveedores',
            key: 'id'
        }
    },

    fechaHora: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },

    estado: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'PENDIENTE',
        validate: {
            isIn: {
                args: [ESTADOS],
                msg: 'El estado del pedido no es válido.'
            }
        }
    },

    totalEstimado: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
            isNonNegative(value: string | number) {
                if (Number(value) < 0) {
                    throw new Error('El total estimado no puede ser negativo.');
                }
            }
        }
    },

    observaciones: {
        type: DataTypes.STRING(300),
        allowNull: true,
        defaultValue: null
    }

}, {

    sequelize,

    modelName: 'PedidoCompra',

    tableName: 'pedidos_compra',

    timestamps: false

});

export default PedidoCompra;
