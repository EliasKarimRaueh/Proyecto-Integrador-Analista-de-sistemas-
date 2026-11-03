import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class DetallePedidoCompra extends Model {
    declare id: number;
    declare pedidoId: number;
    declare productoId: number;
    declare cantidad: number;
    declare costoEstimado: string;
    declare subtotal: string;
}

DetallePedidoCompra.init({

    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },

    pedidoId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'pedidos_compra',
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
                    throw new Error('La cantidad del pedido debe ser positiva.');
                }
            }
        }
    },

    costoEstimado: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
            isNonNegative(value: string | number) {
                if (Number(value) < 0) {
                    throw new Error('El costo estimado no puede ser negativo.');
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
    }

}, {

    sequelize,

    modelName: 'DetallePedidoCompra',

    tableName: 'detalles_pedido_compra',

    timestamps: false,

    indexes: [
        {
            unique: true,
            fields: ['pedidoId', 'productoId']
        }
    ]

});

export default DetallePedidoCompra;
