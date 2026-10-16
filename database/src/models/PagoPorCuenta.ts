import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class PagoPorCuenta extends Model {
    declare pagoId: number;
    declare fechaHora: Date;
    declare cuentaId: number;
    declare importeAplicado: string;
}

PagoPorCuenta.init({
    pagoId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        references: {
            model: 'pagos',
            key: 'id'
        }
    },

    fechaHora: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },

    cuentaId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        references: {
            model: 'cuentas_proveedores',
            key: 'id'
        }
    },

    importeAplicado: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        validate: {
            isPositive(value: string | number) {
                if (Number(value) <= 0) {
                    throw new Error(
                        'El importe aplicado debe ser mayor que cero.'
                    );
                }
            }
        }
    }
}, {
    sequelize,
    modelName: 'PagoPorCuenta',
    tableName: 'pagos_por_cuenta',
    timestamps: false
});

export default PagoPorCuenta;