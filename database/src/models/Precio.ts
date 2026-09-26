import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class Precio extends Model {
    declare id: number;
    declare productoId: number;
    declare precioMinorista: string;
    declare precioMayorista: string | null;
    declare fechaDesde: Date;
    declare fechaHasta: Date | null;
    declare activo: boolean;
    declare fechaBaja: Date | null;
}

Precio.init({

    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },

    productoId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'productos',
            key: 'id'
        }
    },

    precioMinorista: {
        type: DataTypes.DECIMAL,
        allowNull: false,
        validate: {
            isPositive(value: string) {
                if (Number(value) < 0) {
                    throw new Error(
                        "El precio minorista no puede ser negativo."
                    );
                }
            }
        }
    },

    precioMayorista: {
        type: DataTypes.DECIMAL,
        allowNull: true,
        defaultValue: null,
        validate: {
            isPositive(value: string | null) {
                if (value !== null && Number(value) < 0) {
                    throw new Error(
                        "El precio mayorista no puede ser negativo."
                    );
                }
            }
        }
    },

    fechaDesde: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },

    fechaHasta: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null
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
    }

}, {

    sequelize,

    modelName: 'Precio',

    tableName: 'precios',

    timestamps: false,

    validate: {

        validarVigencia(this: { fechaDesde: Date; fechaHasta: Date | null }) {

            if (
                this.fechaHasta !== null &&
                this.fechaHasta <= this.fechaDesde
            ) {
                throw new Error(
                    "La fecha hasta debe ser posterior a la fecha desde."
                );
            }
        }

    }

});

export default Precio;
