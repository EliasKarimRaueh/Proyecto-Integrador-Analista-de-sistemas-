import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class ProductoDiaPedido extends Model {
    declare productoId: number;
    declare diaPedidoId: number;
    declare activo: boolean;
    declare fechaBaja: Date | null;
}

ProductoDiaPedido.init({

    productoId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: {
            model: 'productos',
            key: 'id'
        }
    },

    diaPedidoId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: {
            model: 'dias_pedido',
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
    modelName: 'ProductoDiaPedido',
    tableName: 'productos_dia_pedido',
    timestamps: false
});

export default ProductoDiaPedido;
