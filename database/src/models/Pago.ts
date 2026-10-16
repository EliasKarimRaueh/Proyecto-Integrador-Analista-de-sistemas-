import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class Pago extends Model {
    declare id: number;
    declare fechaHora: Date;
    declare proveedorId: number;
    declare importe: string;
    declare importePendiente: string;
}

Pago.init({
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

    importe: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        validate: {
            isPositive(value: string | number) {
                if (Number(value) <= 0) {
                    throw new Error('El importe del pago debe ser mayor que cero.');
                }
            }
        }
    },

    importePendiente: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        validate: {
            isPositiveOrCero(value: string | number) {
                if (Number(value) < 0) {
                    throw new Error('El importe del pago pendiente debe ser mayor o igual que cero.');
                }
            }
        }
    }
}, {
    sequelize,
    modelName: 'Pago',
    tableName: 'pagos',
    timestamps: false
});

export default Pago;