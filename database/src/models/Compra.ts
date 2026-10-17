
import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class Compra extends Model {
    declare id: number;
    declare fechaHora: Date;
    declare total: number;
    declare proveedorId: number;
}

Compra.init({

    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        unique: true
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

    total: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,

        validate: {
            isNonNegative(value: string | number) {
                if (Number(value) < 0) {
                    throw new Error(
                        'El total de la venta no puede ser negativo.'
                    );
                }
            }
        }
    }

}, {

    sequelize,

    modelName: 'Compra',

    tableName: 'compras',

    timestamps: false

});

export default Compra;
