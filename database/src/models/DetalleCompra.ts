import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class DetalleCompra extends Model {
    declare compraId: number;

    declare numeroItem: number;
    declare cantidad: number;
    declare unidadCompra: string; //Da la opcion de registrar en ingreso en la unidad de compra o unidad de venta segun como se compre (si por cajones o por kilo por ejemplo). La comversion se resuleve en los repositorios, con condicional segun el valor ingresado.
    declare pedidoId: number | null;
    declare numeroItemPedido: number | null;

    declare productoId: number;
    declare nombre: string;

    declare importeUnitario: number;
    declare subtotal: number;

    declare presentacion: string | null;
    declare cantidadPresentacion: number | null;
    declare factorConversion: number | null;
}

DetalleCompra.init(
    {
        compraId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false,
            references: {
                model: 'compras',
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

        //Clave compuesta de detalle pedido para poder ver las cantidades originales
        pedidoId: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        numeroItemPedido: {
            type: DataTypes.INTEGER,
            allowNull: true,
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

        unidadCompra: {
            type: DataTypes.STRING,
            allowNull: false,
        },

        importeUnitario: {
            type: DataTypes.DECIMAL(12,2),
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
            type: DataTypes.DECIMAL(12,2),
            allowNull: false,

            validate: {
                isConsistente(
                    this: DetalleCompra,
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
        modelName: 'DetalleCompra',
        tableName: 'detallesCompra',
        timestamps: false
        // Sin índice único (compraId, productoId): la base real no lo tiene.
        // La unicidad de producto por compra se valida en el servicio
        // (normalizarLineas) y la PK real es (compraId, numeroItem).
    }
);

export default DetalleCompra;
