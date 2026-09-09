import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class ProductoDiaPedido extends Model {}

ProductoDiaPedido.init({

    productoId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
    },

    diaPedidoId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
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
    modelName: 'ProductoDiaPedido',
    tableName: 'productos_dia_pedido',
    timestamps: false
});

export default ProductoDiaPedido;
