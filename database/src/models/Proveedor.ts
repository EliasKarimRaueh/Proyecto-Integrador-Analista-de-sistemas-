import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class Proveedor extends Model {}

Proveedor.init({

    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },

    nombre: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            len: {
                args: [1, 50],
                msg: "El nombre del proveedor debe tener menos de 50 caracteres."
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

//FALTA COMPLETAR, ES PARA PODER HACER LA RELACION CON PRODUCTO
}, {
    sequelize,
    modelName: 'Proveedor',
    tableName: 'proveedores',
    timestamps: false

});

export default Proveedor;