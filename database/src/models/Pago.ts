import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class Pago extends Model {
    declare id: number;
    declare claveOperacion: string | null;
    declare fechaHora: Date;
    declare proveedorId: number;
    declare importe: number;
    declare importePendiente: number;
    declare usuarioId: number;
}

Pago.init({
    claveOperacion: { type: DataTypes.UUID, allowNull: true },
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
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
    },

    // Operador autenticado que registró el pago. Históricos quedaron en 1.
    usuarioId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    }
}, {
    sequelize,
    modelName: 'Pago',
    tableName: 'pagos',
    timestamps: false
});

export default Pago;
