import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class DiaPedido extends Model {}

DiaPedido.init({

    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },

    dia: {
        type: DataTypes.ENUM(
            'lunes',
            'martes',
            'miércoles',
            'jueves',
            'viernes',
            'sábado',
            'domingo'
        ),
        allowNull: false,
        unique: true
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
    modelName: 'DiaPedido',
    tableName: 'dias_pedido',
    timestamps: false
});

export default DiaPedido;
