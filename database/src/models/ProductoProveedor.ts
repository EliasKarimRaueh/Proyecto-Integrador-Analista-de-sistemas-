import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class ProductoProveedor extends Model {
    declare productoId: number;
    declare proveedorId: number;
    declare activo: boolean;
    declare fechaBaja: Date | null;
}

ProductoProveedor.init({

    productoId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: {
            model: 'productos',
            key: 'id'
        }
    },

    proveedorId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: {
            model: 'proveedores',
            key: 'id'
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
    }

}, {
    sequelize,
    modelName: 'ProductoProveedor',
    tableName: 'productos_proveedores',
    timestamps: false
});

export default ProductoProveedor;