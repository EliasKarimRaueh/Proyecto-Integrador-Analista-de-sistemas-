import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class ProductoProveedor extends Model {}

ProductoProveedor.init({

    productoId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
    },

    proveedorId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
    }

}, {
    sequelize,
    modelName: 'ProductoProveedor',
    tableName: 'productos_proveedores',
    timestamps: false
});

export default ProductoProveedor;