import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

const ESTADOS = ['REALIZADO','PENDIENTE', 'FACTURADO', 'CANCELADO', 'RECIBIDO'] as const;
class Pedido extends Model {
    declare id: number;
    declare proveedorId: number;
    declare fechaHora: Date;
    declare total: number;
    declare totalEstimado: string;
    declare estado: typeof ESTADOS[number];
    declare usuarioRecepcion: string | null;
    declare fechaHoraRecepcion: Date | null;
    declare observaciones: string | null;
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

        fechaHoraRecepcion: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null,
        },

        usuarioRecepcion: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },

        observaciones: {
            type: DataTypes.STRING(300),
            allowNull: true,
            defaultValue: null
        }
    },
    {
        sequelize,
        modelName: 'Pedido',
        tableName: 'pedidos',
        timestamps: false
    }
);

export default Pedido;