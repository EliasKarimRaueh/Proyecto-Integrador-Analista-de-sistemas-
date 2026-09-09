import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class TipoProducto extends Model {}

TipoProducto.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nombre: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate:{
            len:{
                args: [1, 50],
                msg: "El nombre del tipo de producto no puede superar los 50 caracteres."
            }
        }
    }
}, {
    sequelize, 
    modelName: 'TipoProducto',
    tableName: 'tipos_producto',
    timestamps: false,
});

export default TipoProducto;