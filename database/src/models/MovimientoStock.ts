import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class MovimientoStock extends Model {
    declare id: number;
    declare productoId: number;
    declare numeroMovimiento: number;
    declare ventaId: number | null;
    declare compraId: number | null;
    declare tipo: 'INGRESO' | 'EGRESO';
    declare cantInicial: number;
    declare cantMovimiento: number;
    declare cantFinal: number;
    declare fechaHora: Date;
    declare motivo: string | null;
    declare usuarioId: number;
}

MovimientoStock.init({

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

    numeroMovimiento: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            isPositive(value: number) {
                if (value <= 0) {
                    throw new Error(
                        "El número de movimiento debe ser positivo."
                    );
                }
            }
        }
    },

    
    fechaHora: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },

    ventaId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
        /*references: {
            model: 'ventas',
            key: 'id'
        }*/
    },

    compraId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
        /*references: {
            model: 'compras',
            key: 'id'
        }*/
    },

    tipo: {
        type: DataTypes.ENUM(
            'INGRESO',
            'EGRESO'
        ),
        allowNull: false
    },

    cantInicial: {
        type: DataTypes.FLOAT,
        allowNull: false
    },

    cantMovimiento: {
        type: DataTypes.FLOAT,
        allowNull: false,
        validate: {
            isPositive(value: number) {
                if (value <= 0) {
                    throw new Error(
                        "La cantidad del movimiento debe ser positiva."
                    );
                }
            }
        }
    },

    cantFinal: {
        type: DataTypes.FLOAT,
        allowNull: false,
        validate: {
            isConsistente(this: MovimientoStock, value: number) {

                const { tipo, cantInicial, cantMovimiento } = this;

                if (tipo === 'INGRESO') {
                    if (value !== cantInicial + cantMovimiento) {
                        throw new Error(
                            "La cantidad final no coincide con la cantidad inicial más la cantidad del movimiento."
                        );
                    }
                }

                if (tipo === 'EGRESO') {
                    if (value !== cantInicial - cantMovimiento) {
                        throw new Error(
                            "La cantidad final no coincide con la cantidad inicial menos la cantidad del movimiento."
                        );
                    }
                }
            }
        }
    },

    usuarioId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        /*references: {
            model: 'usuarios',
            key: 'id'
        }*/
    },

    motivo: {
        type: DataTypes.STRING(300),
        allowNull: true,
        defaultValue: null
    }

}, {

    sequelize,

    modelName: 'MovimientoStock',

    tableName: 'movimientos_stock',

    timestamps: false,

    indexes: [
        {
            unique: true,
            fields: ['productoId', 'numeroMovimiento']
        }
    ]

});

export default MovimientoStock;