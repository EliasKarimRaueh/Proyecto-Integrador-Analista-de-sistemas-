import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class Recepcion extends Model {
    declare id: number;
    declare compraId: number;
    declare pedidoId: number | null;
    declare proveedorId: number;
    declare fechaHora: Date;
    declare observaciones: string | null;
    declare usuarioId: number;
}

Recepcion.init({

    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
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

    pedidoId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
        references: {
            model: 'pedidos_compra',
            key: 'id'
        }
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

    observaciones: {
        type: DataTypes.STRING(300),
        allowNull: true,
        defaultValue: null
    },

    usuarioId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    }

}, {

    sequelize,

    modelName: 'Recepcion',

    tableName: 'recepciones',

    timestamps: false

});

export default Recepcion;
