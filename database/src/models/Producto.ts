import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class Producto extends Model {
    declare id: number;
    declare codigo: string;
    declare nombre: string;
    declare descripcion: string;
    declare tipoProductoId: number;
    declare unidadCompra:
        | 'KILOS'
        | 'UNIDADES'
        | 'CAJONES'
        | 'CAJAS'
        | 'BOLSAS'
        | 'BULTOS';
    declare unidadVenta: 'UNIDADES' | 'KILOS';
    declare factorConversion: number;
    declare stockActual: number;
    declare costoActual: string;
    declare activo: boolean;
    declare fechaBaja: Date | null;
    declare tipoReposicion:
        | 'stockMinimo'
        | 'diario'
        | 'semanal';
    declare stockMinimo: number | null;
    declare imagen: Buffer | null;
    declare imagenNombre: string | null;
    declare imagenMime: string | null;
    declare imagenBytes: number | null;
}

Producto.init({

    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },

    codigo: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
        validate: {
            is: /^[A-Z0-9-]{2,20}$/i
        }
    },

    nombre: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            len: {
                args: [1, 50],
                msg: "El nombre del producto debe tener menos de 50 caracteres."
            }
        }
    },

    descripcion: {
        type: DataTypes.STRING(300),
        allowNull: false,
        defaultValue: ''
    },

    unidadCompra: {
        type: DataTypes.ENUM(
            'KILOS',
            'UNIDADES',
            'CAJONES',
            'CAJAS',
            'BOLSAS',
            'BULTOS'
        ),
        allowNull: false
    },

    unidadVenta: {
        type: DataTypes.ENUM(
            'UNIDADES',
            'KILOS'
        ),
        allowNull: false
    },

    factorConversion: {
        type: DataTypes.FLOAT,
        allowNull: false,
        validate: {
            isPositive(value: number) {
                if (value <= 0) {
                    throw new Error(
                        "El factor de conversión debe ser positivo."
                    );
                }
            }
        }
    },

    stockActual: {
        type: DataTypes.FLOAT,
        allowNull: false
    },

    costoActual: {
        type: DataTypes.DECIMAL,
        allowNull: false,
        validate: {
            isPositive(value: string) {
                if (Number(value) < 0) {
                    throw new Error(
                        "El costo actual no puede ser negativo."
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
    },

    tipoReposicion: {
        type: DataTypes.ENUM(
            'stockMinimo',
            'diario',
            'semanal'
        ),
        allowNull: false
    },

    tipoProductoId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'tipos_producto',
            key: 'id'
        }
    },

    stockMinimo: {
        type: DataTypes.FLOAT,
        allowNull: true,
        validate: {
            isPositive(value: number | null) {
                if (value !== null && value < 0) {
                    throw new Error(
                        "El stock mínimo debe ser positivo."
                    );
                }
            }
        }
    },

    // La foto vive en la misma tabla, pero las lecturas de catálogo la excluyen:
    // ver ProductoRepository. Los cuatro campos se escriben juntos o ninguno.
    imagen: {
        type: DataTypes.BLOB,
        allowNull: true,
        defaultValue: null
    },

    imagenNombre: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null
    },

    imagenMime: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: null
    },

    imagenBytes: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null
    }

}, {

    sequelize,

    modelName: 'Producto',

    tableName: 'productos',

    timestamps: false,

    /**
     * Los bytes de la foto quedan fuera de las lecturas: ver ProductoRepository,
     * que es donde se filtran. acá solo se guardan los metadatos que el
     * catálogo necesita para mostrar nombre y peso sin descargar el archivo.
     */

    validate: {

        validarReposicion() {

            if (
                this.tipoReposicion === 'stockMinimo' &&
                this.stockMinimo === null
            ) {
                throw new Error(
                    "El stock mínimo es obligatorio cuando el tipo de reposición es stockMinimo."
                );
            }
        }

    }

});

export default Producto;
