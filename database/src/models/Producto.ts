import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class Producto extends Model {}

Producto.init({

    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },

    nombre: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            len: {
                args: [1, 50],
                msg: "El nombre del producto debe tener menos de 50 caracteres."
            }
        }
    },

    unidadCompra: {
        type: DataTypes.ENUM(
            'kilos',
            'unidades',
            'cajones',
            'cajas',
            'bolsas',
            'bultos'
        ),
        allowNull: false
    },

    unidadVenta: {
        type: DataTypes.ENUM(
            'unidades',
            'kilos'
        ),
        allowNull: false
    },

    factorConversion: {
        type: DataTypes.FLOAT,
        allowNull: false,
        validate: {
            isPositive(value: number) {
                if (value <= 0) {
                    throw new Error(
                        "El factor de conversión debe ser positivo."
                    );
                }
            }
        }
    },

    stockActual: {
        type: DataTypes.FLOAT,
        allowNull: false
    },

    costoActual: {
        type: DataTypes.DECIMAL,
        allowNull: false,
        validate: {
            isPositive(value: string) {
                if (Number(value) <= 0) {
                    throw new Error(
                        "El costo actual debe ser positivo."
                    );
                }
            }
        }
    },

    activo: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },

    fechaBaja: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null
    },

    tipoReposicion: {
        type: DataTypes.ENUM(
            'stockMinimo',
            'diario',
            'semanal'
        ),
        allowNull: false
    },

    stockMinimo: {
        type: DataTypes.FLOAT,
        allowNull: true,
        validate: {
            isPositive(value: number | null) {
                if (value !== null && value <= 0) {
                    throw new Error(
                        "El stock mínimo debe ser positivo."
                    );
                }
            }
        }
    }

}, {

    sequelize,

    modelName: 'Producto',

    tableName: 'productos',

    timestamps: false,

    validate: {

        validarReposicion() {

            if (
                this.tipoReposicion === 'stockMinimo' &&
                this.stockMinimo === null
            ) {
                throw new Error(
                    "El stock mínimo es obligatorio cuando el tipo de reposición es stockMinimo."
                );
            }

            if (
                this.tipoReposicion !== 'stockMinimo' &&
                this.stockMinimo !== null
            ) {
                throw new Error(
                    "El stock mínimo debe ser NULL cuando el tipo de reposición no es stockMinimo."
                );
            }
        }

    }

});

export default Producto;