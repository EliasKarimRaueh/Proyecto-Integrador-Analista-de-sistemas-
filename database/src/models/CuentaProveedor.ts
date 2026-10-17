
import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class CuentaProveedor extends Model {
    declare id: number;
    declare proveedorId: number;
    declare compraId: number;
    declare importePendiente: number;
    declare estado: 'PAGO PENDIENTE' | 'PAGO PARCIAL' | 'PAGADO';
}

CuentaProveedor.init({

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

    compraId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: {
            model: 'compras',
            key: 'id'
        }
    },

    importePendiente: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        validate: {
            isNonNegative(value: string | number) {
                if (Number(value) < 0) {
                    throw new Error(
                        'El importe pendiente no puede ser negativo.'
                    );
                }
            }
        }
    },

        estado: {
        type: DataTypes.ENUM(
            'PAGO PENDIENTE',
            'PAGO PARCIAL',
            'PAGADO'
        ),
        allowNull: false,
        defaultValue: 'PAGO PENDIENTE',
        field: 'ESTADO'
    },



}, {

    sequelize,

    modelName: 'CuentaProveedor',

    tableName: 'cuentas_proveedores',

    timestamps: false

});

export default CuentaProveedor;