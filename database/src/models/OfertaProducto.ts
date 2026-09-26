import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class OfertaProducto extends Model {
    declare id: number;
    declare ofertaId: number;
    declare productoId: number;
    declare precioOferta: string;
    declare activo: boolean;
    declare fechaBaja: Date | null;
}

OfertaProducto.init({

    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },

    ofertaId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'ofertas',
            key: 'id'
        }
    },

    productoId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'productos',
            key: 'id'
        }
    },

    precioOferta: {
        type: DataTypes.DECIMAL,
        allowNull: false,
        validate: {
            isPositive(value: string) {
                if (Number(value) < 0) {
                    throw new Error(
                        "El precio de la oferta no puede ser negativo."
                    );
                }
            }
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

    modelName: 'OfertaProducto',

    tableName: 'ofertas_productos',

    timestamps: false,

    indexes: [
        {
            name: 'oferta_producto_unico',
            unique: true,
            fields: ['ofertaId', 'productoId']
        }
    ]

});

export default OfertaProducto;
