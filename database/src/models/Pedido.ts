import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class Pedido extends Model {
    declare id: number;
    declare proveedorId: number;
    declare fechaHora: Date;
    declare total: number;
    declare estado:'REALIZADO'|'RECIBIDO'|'CANCELADO'
}

Pedido.init(
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },

        fechaHora: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },

        proveedorId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'proveedores',
                key: 'id'
            }
        },

        total: {
            type: DataTypes.DECIMAL(12, 2),
            allowNull: false,
            defaultValue: 0,

            validate: {
                isNonNegative(value: string | number) {
                    if (Number(value) < 0) {
                        throw new Error(
                            'El total del pedido no puede ser negativo.'
                        );
                    }
                }
            }
        },
        
        estado: {
            type: DataTypes.ENUM(
                'REALIZADO',
                'RECIBIDO',
                'CANCELADO',
                ),
            allowNull: false,
            defaultValue: 'REALIZADO'
        },
    },
    {
        sequelize,
        modelName: 'Pedido',
        tableName: 'pedidos',
        timestamps: false
    }
);

export default Pedido;