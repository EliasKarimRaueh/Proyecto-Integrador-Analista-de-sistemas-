import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class Oferta extends Model {
    declare id: number;
    declare nombre: string;
    declare descripcion: string | null;
    declare fechaInicio: Date;
    declare fechaFin: Date;
    declare activo: boolean;
    declare fechaBaja: Date | null;
}

Oferta.init({

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
                msg: "El nombre de la oferta debe tener menos de 50 caracteres."
            }
        }
    },

    descripcion: {
        type: DataTypes.STRING(300),
        allowNull: true,
        defaultValue: null
    },

    fechaInicio: {
        type: DataTypes.DATE,
        allowNull: false
    },

    fechaFin: {
        type: DataTypes.DATE,
        allowNull: false
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

    modelName: 'Oferta',

    tableName: 'ofertas',

    timestamps: false,

    validate: {

        validarVigencia(this: { fechaInicio: Date; fechaFin: Date }) {

            if (this.fechaFin <= this.fechaInicio) {
                throw new Error(
                    "La fecha de fin debe ser posterior a la fecha de inicio."
                );
            }
        }

    }

});

export default Oferta;
