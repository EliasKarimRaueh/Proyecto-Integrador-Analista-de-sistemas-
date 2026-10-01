import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class DetalleVenta extends Model {
    declare ventaId: number;
    declare numeroItem: number;
    declare cantidad: number;

    declare productoId: number | null;
    declare ofertaId: number | null;
    declare nombre: string;

    declare importeUnitario: number;
    declare subtotal: number;
}

DetalleVenta.init(
    {
        ventaId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false,
            references: {
                model: 'ventas',
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
            allowNull: true,
            defaultValue: null,
            references: {
                model: 'productos',
                key: 'id'
            }
        },

        ofertaId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null,
            references: {
                model: 'ofertas',
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
                    this: DetalleVenta,
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
        }
    },
    {
        sequelize,
        modelName: 'DetalleVenta',
        tableName: 'detallesVenta',
        timestamps: false,

        validate: {
            productoUOferta() {
                const tieneProducto = this.productoId !== null;
                const tieneOferta = this.ofertaId !== null;

                if (tieneProducto === tieneOferta) {
                    throw new Error(
                        'El detalle de venta debe tener un producto o una oferta, pero no ambos.'
                    );
                }
            }
        }
    }
);

export default DetalleVenta;