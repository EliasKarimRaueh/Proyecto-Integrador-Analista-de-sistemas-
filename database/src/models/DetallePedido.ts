import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class DetallePedido extends Model {
    declare pedidoId: number;

    declare numeroItem: number;
    declare cantidad: number;
    declare unidadPedido: string;

    declare productoId: number | null;
    declare nombre: string;

    declare importeUnitario: number;
    declare costoEstimado: string;
    declare subtotal: number;

    declare presentacion: string | null;
    declare cantidadPresentacion: number | null;
    declare factorConversion: number | null;
}

DetallePedido.init(
    {
        pedidoId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false,
            references: {
                model: 'pedidos',
                key: 'id'
            }
        },

        numeroItem: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false,

            validate: {
                isPositive(value: number) {
                    if (value <= 0) {
                        throw new Error(
                            'El número de item debe ser mayor que cero.'
                        );
                    }
                }
            }
        },

        cantidad: {
            type: DataTypes.FLOAT,
            allowNull: false,

            validate: {
                isPositive(value: number) {
                    if (value <= 0) {
                        throw new Error(
                            'La cantidad debe ser mayor que cero.'
                        );
                    }
                }
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


        nombre: {
            type: DataTypes.STRING,
            allowNull: false,
                validate: {
                len: {
                    args: [1, 50],
                    msg: "El nombre del item debe tener menos de 50 caracteres."
                }
            }
        },

        unidadPedido: {
            type: DataTypes.STRING,
            allowNull: false,
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
        
        importeUnitario: {
            type: DataTypes.DECIMAL,
            allowNull: false,

            validate: {
                isNonNegative(value: string | number) {
                    if (Number(value) < 0) {
                        throw new Error(
                            'El importe unitario no puede ser negativo.'
                        );
                    }
                }
            }
        },

        subtotal: {
            type: DataTypes.DECIMAL,
            allowNull: false,

            validate: {
                isConsistente(
                    this: DetallePedido,
                    value: string | number
                ) {
                    const cantidad = Number(this.cantidad);
                    const importeUnitario = Number(this.importeUnitario);
                    const subtotal = Number(value);

                    const esperado = cantidad * importeUnitario;
                    const EPSILON = 0.01;

                    if (Math.abs(subtotal - esperado) > EPSILON) {
                        throw new Error(
                            'El subtotal no coincide con la cantidad multiplicada por el importe unitario.'
                        );
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
    },
    {
        sequelize,
        modelName: 'DetallePedido',
        tableName: 'detallesPedido',
        timestamps: false,

    }
);

export default DetallePedido;