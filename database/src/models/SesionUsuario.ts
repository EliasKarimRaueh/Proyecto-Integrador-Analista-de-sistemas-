import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class SesionUsuario extends Model {
    declare id: number;
    declare jti: string;
    declare usuarioId: number;
    declare creadaEn: Date;
    declare expiraEn: Date;
    declare revocadaEn: Date | null;
}

SesionUsuario.init(
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },

        jti: {
            type: DataTypes.UUID,
            allowNull: false,
            unique: true
        },

        usuarioId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },

        creadaEn: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },

        expiraEn: {
            type: DataTypes.DATE,
            allowNull: false
        },

        revocadaEn: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null
        }
    },
    {
        sequelize,
        modelName: 'SesionUsuario',
        tableName: 'sesiones_usuario',
        timestamps: false
    }
);

export default SesionUsuario;
