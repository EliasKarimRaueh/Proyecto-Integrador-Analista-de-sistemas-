import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class DiaPedido extends Model {
    declare id: number;
    declare nombre:
        | 'Lunes'
        | 'Martes'
        | 'Miércoles'
        | 'Jueves'
        | 'Viernes'
        | 'Sábado'
        | 'Domingo';
    declare activo: boolean;
    declare fechaBaja: Date | null;
}

DiaPedido.init({

    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },

    nombre: {
        type: DataTypes.ENUM(
            'Lunes',
            'Martes',
            'Miércoles',
            'Jueves',
            'Viernes',
            'Sábado',
            'Domingo'
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
