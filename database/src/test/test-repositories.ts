import sequelize from '../config/database.js';

import TipoProductoRepository from '../repositories/tipoProductoRepository.js';
import DiaPedidoRepository from '../repositories/diaPedidoRepository.js';
import ProveedorRepository from '../repositories/proveedorRepository.js';
import ProductoRepository from '../repositories/productoRepository.js';
import ProductoProveedorRepository from '../repositories/ProductoProveedorRepository.js';
import ProductoDiaPedidoRepository from '../repositories/productoDiaPedidoRepository.js';
import PrecioRepository from '../repositories/precioRepository.js';
import OfertaRepository from '../repositories/ofertaRepository.js';
import OfertaProductoRepository from '../repositories/ofertaProductoRepository.js';

import Precio from '../models/Precio.js';
import Oferta from '../models/Oferta.js';
import OfertaProducto from '../models/OfertaProducto.js';
import Producto from '../models/Producto.js';
import TipoProducto from '../models/TipoProducto.js';
import Proveedor from '../models/Proveedor.js';


// ============================================================
// REPOSITORIOS
// ============================================================

const tipoProductoRepository = new TipoProductoRepository();
const diaPedidoRepository = new DiaPedidoRepository();
const proveedorRepository = new ProveedorRepository();
const productoRepository = new ProductoRepository();

const productoProveedorRepository =
    new ProductoProveedorRepository();

const productoDiaPedidoRepository =
    new ProductoDiaPedidoRepository();
const precioRepository = new PrecioRepository();
const ofertaRepository = new OfertaRepository();
const ofertaProductoRepository =
    new OfertaProductoRepository();


// ============================================================
// CONTADORES
// ============================================================

let pruebasExitosas = 0;
let pruebasFallidas = 0;


// ============================================================
// FUNCIONES AUXILIARES
// ============================================================

function iniciarPrueba(numero: number, nombre: string) {

    console.log('');
    console.log('============================================================');
    console.log(`PRUEBA ${numero}: ${nombre}`);
    console.log('============================================================');
}


function logInfo(mensaje: string) {
    console.log(`   ℹ ${mensaje}`);
}


function logOk(mensaje: string) {
    console.log(`   ✓ ${mensaje}`);
}


function logError(mensaje: string) {
    console.log(`   ✗ ${mensaje}`);
}


function pruebaExitosa() {

    pruebasExitosas++;

    logOk('PRUEBA EJECUTADA CORRECTAMENTE');
}


function pruebaFallida(error: unknown) {

    pruebasFallidas++;

    if (error instanceof Error) {

        logError(
            `PRUEBA FALLIDA: ${error.message}`
        );

    } else {

        logError(
            `PRUEBA FALLIDA: ${String(error)}`
        );
    }
}


// ============================================================
// PRUEBA 1
//
// TIPO PRODUCTO
//
// Alta → consulta → modificación → consulta
// ============================================================

async function test1() {

    iniciarPrueba(
        1,
        'TipoProducto: alta, consulta y modificación'
    );

    try {

        // ----------------------------------------------------
        // ALTA
        // ----------------------------------------------------

        const nombreOriginal =
            `TEST_TIPO_${Date.now()}`;

        logInfo(
            `Creando TipoProducto "${nombreOriginal}"...`
        );

        const tipoCreado =
            await tipoProductoRepository.create({
                nombre: nombreOriginal
            });

        logOk(
            `TipoProducto creado con ID ${tipoCreado.id}.`
        );


        // ----------------------------------------------------
        // CONSULTA
        // ----------------------------------------------------

        logInfo(
            'Consultando el TipoProducto creado...'
        );

        const tipoConsultado =
            await tipoProductoRepository.findById(
                tipoCreado.id
            );

        if (!tipoConsultado) {

            throw new Error(
                'No se pudo consultar el TipoProducto creado.'
            );
        }

        logOk(
            `Resultado: ID=${tipoConsultado.id}, ` +
            `nombre="${tipoConsultado.nombre}", ` +
            `activo=${tipoConsultado.activo}`
        );


        // ----------------------------------------------------
        // MODIFICACIÓN
        // ----------------------------------------------------

        const nuevoNombre =
            `${nombreOriginal}_MODIFICADO`;

        logInfo(
            `Modificando nombre a "${nuevoNombre}"...`
        );

        await tipoProductoRepository.updateNombre(
            tipoCreado.id,
            nuevoNombre
        );


        // ----------------------------------------------------
        // CONSULTA DESPUÉS DE MODIFICAR
        // ----------------------------------------------------

        logInfo(
            'Consultando nuevamente para verificar la modificación...'
        );

        const tipoModificado =
            await tipoProductoRepository.findById(
                tipoCreado.id
            );

        if (!tipoModificado) {

            throw new Error(
                'No se pudo consultar el TipoProducto modificado.'
            );
        }

        if (tipoModificado.nombre !== nuevoNombre) {

            throw new Error(
                'El nombre no fue modificado correctamente.'
            );
        }

        logOk(
            `Resultado: ID=${tipoModificado.id}, ` +
            `nombre="${tipoModificado.nombre}"`
        );


        // ----------------------------------------------------
        // BAJA
        // ----------------------------------------------------

        logInfo(
            'Realizando baja lógica del TipoProducto...'
        );

        await tipoProductoRepository.deleteById(
            tipoCreado.id
        );


        // ----------------------------------------------------
        // CONSULTA DESPUÉS DE LA BAJA
        // ----------------------------------------------------

        logInfo(
            'Consultando para verificar la baja...'
        );

        const tipoBaja =
            await tipoProductoRepository.findById(
                tipoCreado.id
            );

        if (!tipoBaja) {

            throw new Error(
                'El registro fue eliminado físicamente.'
            );
        }

        logOk(
            `Resultado: activo=${tipoBaja.activo}, ` +
            `fechaBaja=${tipoBaja.fechaBaja}`
        );


        // ----------------------------------------------------
        // RESTAURACIÓN
        // ----------------------------------------------------

        logInfo(
            'Restaurando el TipoProducto...'
        );

        await tipoProductoRepository.updateById(
            tipoCreado.id,
            {
                activo: true,
                fechaBaja: null
            }
        );


        // ----------------------------------------------------
        // CONSULTA DESPUÉS DE RESTAURAR
        // ----------------------------------------------------

        logInfo(
            'Consultando para verificar la restauración...'
        );

        const tipoRestaurado =
            await tipoProductoRepository.findById(
                tipoCreado.id
            );

        if (!tipoRestaurado) {

            throw new Error(
                'No se pudo recuperar el TipoProducto restaurado.'
            );
        }

        if (
            tipoRestaurado.activo !== true ||
            tipoRestaurado.fechaBaja !== null
        ) {

            throw new Error(
                'La restauración no se realizó correctamente.'
            );
        }

        logOk(
            `Resultado restaurado: activo=${tipoRestaurado.activo}, ` +
            `fechaBaja=${tipoRestaurado.fechaBaja}`
        );


        // ----------------------------------------------------
        // LIMPIEZA
        //
        // El alta/baja/restauración de arriba es el objeto de la
        // prueba y usa baja lógica, que es el comportamiento real del
        // sistema. Lo que NO debe quedar es el registro de prueba: si
        // se conserva, cada corrida suma un TEST_TIPO_* permanente a
        // la base.
        // ----------------------------------------------------

        logInfo(
            'Limpiando el tipo de producto de la prueba...'
        );

        await TipoProducto.destroy({
            where: { id: tipoCreado.id }
        });

        logOk(
            'Tipo de producto de prueba eliminado.'
        );


        pruebaExitosa();

    } catch (error) {

        pruebaFallida(error);
    }
}


// ============================================================
// PRUEBA 2
//
// DIA PEDIDO
//
// Consulta → modificación → consulta
// ============================================================

async function test2() {

    iniciarPrueba(
        2,
        'DiaPedido: consulta y modificación'
    );

    try {

        // ----------------------------------------------------
        // CONSULTA
        // ----------------------------------------------------

        logInfo(
            'Buscando el día "Lunes"...'
        );

        const lunes =
            await diaPedidoRepository.findByName(
                'Lunes'
            );

        if (!lunes) {

            throw new Error(
                'No se encontró el día Lunes.'
            );
        }

        logOk(
            `Resultado: ID=${lunes.id}, ` +
            `nombre=${lunes.nombre}, ` +
            `activo=${lunes.activo}`
        );


        // ----------------------------------------------------
        // MODIFICACIÓN
        // ----------------------------------------------------
        //
        // Para no alterar permanentemente el ENUM ni la
        // información original, cambiamos temporalmente:
        //
        // Lunes → Martes
        //
        // Pero Martes ya existe y posee UNIQUE.
        //
        // Por lo tanto usamos el método updateById solamente
        // para probar una modificación sobre "activo".
        // ----------------------------------------------------

        logInfo(
            'Modificando temporalmente el estado activo...'
        );

        await diaPedidoRepository.updateById(
            lunes.id,
            {
                activo: false,
                fechaBaja: new Date()
            }
        );


        // ----------------------------------------------------
        // CONSULTA DESPUÉS DE MODIFICAR
        // ----------------------------------------------------

        logInfo(
            'Consultando para verificar la modificación...'
        );

        const lunesModificado =
            await diaPedidoRepository.findById(
                lunes.id
            );

        if (!lunesModificado) {

            throw new Error(
                'No se pudo recuperar el día modificado.'
            );
        }

        logOk(
            `Resultado: activo=${lunesModificado.activo}, ` +
            `fechaBaja=${lunesModificado.fechaBaja}`
        );


        // ----------------------------------------------------
        // RESTAURACIÓN
        // ----------------------------------------------------

        logInfo(
            'Restaurando el estado original...'
        );

        await diaPedidoRepository.updateById(
            lunes.id,
            {
                activo: true,
                fechaBaja: null
            }
        );


        // ----------------------------------------------------
        // CONSULTA FINAL
        // ----------------------------------------------------

        logInfo(
            'Consultando para verificar la restauración...'
        );

        const lunesRestaurado =
            await diaPedidoRepository.findById(
                lunes.id
            );

        if (!lunesRestaurado) {

            throw new Error(
                'No se pudo recuperar el día restaurado.'
            );
        }

        if (
            lunesRestaurado.activo !== true ||
            lunesRestaurado.fechaBaja !== null
        ) {

            throw new Error(
                'El día no fue restaurado correctamente.'
            );
        }

        logOk(
            `Resultado final: activo=${lunesRestaurado.activo}, ` +
            `fechaBaja=${lunesRestaurado.fechaBaja}`
        );


        pruebaExitosa();

    } catch (error) {

        pruebaFallida(error);
    }
}


// ============================================================
// PRUEBA 3
//
// PROVEEDOR
//
// Alta → consulta → modificación → consulta → baja
// → consulta → restauración → consulta
// ============================================================

async function test3() {

    iniciarPrueba(
        3,
        'Proveedor: alta, consulta, modificación y baja lógica'
    );

    try {

        // ----------------------------------------------------
        // ALTA
        // ----------------------------------------------------

        const nombreOriginal =
            `TEST_PROVEEDOR_${Date.now()}`;

        logInfo(
            `Creando proveedor "${nombreOriginal}"...`
        );

        const proveedorCreado =
            await proveedorRepository.create({
                nombre: nombreOriginal
            });

        logOk(
            `Proveedor creado con ID ${proveedorCreado.id}.`
        );


        // ----------------------------------------------------
        // CONSULTA
        // ----------------------------------------------------

        logInfo(
            'Consultando proveedor creado...'
        );

        const proveedor =
            await proveedorRepository.findById(
                proveedorCreado.id
            );

        if (!proveedor) {

            throw new Error(
                'No se pudo consultar el proveedor creado.'
            );
        }

        logOk(
            `Resultado: ${proveedor.nombre}`
        );


        // ----------------------------------------------------
        // MODIFICACIÓN
        // ----------------------------------------------------

        const nuevoNombre =
            `${nombreOriginal}_MODIFICADO`;

        logInfo(
            `Modificando nombre a "${nuevoNombre}"...`
        );

        await proveedorRepository.updateNombre(
            proveedorCreado.id,
            nuevoNombre
        );


        // ----------------------------------------------------
        // CONSULTA
        // ----------------------------------------------------

        const proveedorModificado =
            await proveedorRepository.findById(
                proveedorCreado.id
            );

        if (!proveedorModificado) {

            throw new Error(
                'No se pudo consultar el proveedor modificado.'
            );
        }

        logOk(
            `Resultado después de modificar: ` +
            `${proveedorModificado.nombre}`
        );


        // ----------------------------------------------------
        // BAJA
        // ----------------------------------------------------

        logInfo(
            'Realizando baja lógica...'
        );

        await proveedorRepository.deleteById(
            proveedorCreado.id
        );


        // ----------------------------------------------------
        // CONSULTA
        // ----------------------------------------------------

        const proveedorBaja =
            await proveedorRepository.findById(
                proveedorCreado.id
            );

        if (!proveedorBaja) {

            throw new Error(
                'El proveedor fue eliminado físicamente.'
            );
        }

        logOk(
            `Resultado: activo=${proveedorBaja.activo}, ` +
            `fechaBaja=${proveedorBaja.fechaBaja}`
        );


        // ----------------------------------------------------
        // RESTAURACIÓN
        // ----------------------------------------------------

        logInfo(
            'Restaurando proveedor...'
        );

        await proveedorRepository.updateById(
            proveedorCreado.id,
            {
                activo: true,
                fechaBaja: null
            }
        );


        // ----------------------------------------------------
        // CONSULTA
        // ----------------------------------------------------

        const proveedorRestaurado =
            await proveedorRepository.findById(
                proveedorCreado.id
            );

        if (!proveedorRestaurado) {

            throw new Error(
                'No se pudo recuperar el proveedor restaurado.'
            );
        }

        if (
            proveedorRestaurado.activo !== true ||
            proveedorRestaurado.fechaBaja !== null
        ) {

            throw new Error(
                'El proveedor no fue restaurado correctamente.'
            );
        }

        logOk(
            `Resultado final: activo=${proveedorRestaurado.activo}, ` +
            `fechaBaja=${proveedorRestaurado.fechaBaja}`
        );


        // ----------------------------------------------------
        // LIMPIEZA
        //
        // La baja lógica ya se probó más arriba; lo que se borra acá
        // es el registro de prueba, para no acumular un
        // TEST_PROVEEDOR_* por cada corrida.
        // ----------------------------------------------------

        logInfo(
            'Limpiando el proveedor de la prueba...'
        );

        await Proveedor.destroy({
            where: { id: proveedorCreado.id }
        });

        logOk(
            'Proveedor de prueba eliminado.'
        );


        pruebaExitosa();

    } catch (error) {

        pruebaFallida(error);
    }
}


// ============================================================
// PRUEBA 4
//
// PRODUCTO
//
// Alta → consulta → modificación → consulta
// → stock → consulta → baja → consulta → restauración → consulta
// ============================================================

async function test4() {

    iniciarPrueba(
        4,
        'Producto: alta, consulta, modificación y stock'
    );

    try {

        // ----------------------------------------------------
        // CONSULTAMOS UN TIPO DE PRODUCTO EXISTENTE
        // ----------------------------------------------------

        logInfo(
            'Buscando TipoProducto para asociar el producto...'
        );

        const tipo =
            await tipoProductoRepository.findByName(
                'FRESCO'
            );

        if (!tipo) {

            throw new Error(
                'No existe el TipoProducto FRESCO.'
            );
        }

        logOk(
            `Tipo encontrado: ${tipo.nombre} (ID ${tipo.id})`
        );


        // ----------------------------------------------------
        // ALTA
        // ----------------------------------------------------

        const nombre =
            `TEST_PRODUCTO_${Date.now()}`;

        const codigo =
            `TEST-${Date.now()}`;

        logInfo(
            `Creando producto "${nombre}"...`
        );

        const productoCreado =
            await productoRepository.create({

                nombre,

                codigo,

                tipoProductoId: tipo.id,

                unidadCompra: 'KILOS',

                unidadVenta: 'KILOS',

                factorConversion: 1,

                stockActual: 10,

                costoActual: '1000',

                tipoReposicion: 'stockMinimo',

                stockMinimo: 5

            });

        logOk(
            `Producto creado con ID ${productoCreado.id}.`
        );


        // ----------------------------------------------------
        // CONSULTA
        // ----------------------------------------------------

        logInfo(
            'Consultando producto creado...'
        );

        const producto =
            await productoRepository.findById(
                productoCreado.id
            );

        if (!producto) {

            throw new Error(
                'No se pudo consultar el producto creado.'
            );
        }

        logOk(
            `Resultado: ${producto.nombre}`
        );

        logOk(
            `Stock: ${producto.stockActual}`
        );

        logOk(
            `Costo: ${producto.costoActual}`
        );


        // ----------------------------------------------------
        // MODIFICACIÓN DEL NOMBRE
        // ----------------------------------------------------

        const nuevoNombre =
            `${nombre}_MODIFICADO`;

        logInfo(
            `Modificando nombre a "${nuevoNombre}"...`
        );

        await productoRepository.updateNombre(
            productoCreado.id,
            nuevoNombre
        );


        // ----------------------------------------------------
        // CONSULTA
        // ----------------------------------------------------

        const productoModificado =
            await productoRepository.findById(
                productoCreado.id
            );

        if (!productoModificado) {

            throw new Error(
                'No se pudo consultar el producto modificado.'
            );
        }

        logOk(
            `Nombre después de modificar: ` +
            `${productoModificado.nombre}`
        );


        // ----------------------------------------------------
        // INCREMENTO DE STOCK
        // ----------------------------------------------------

        logInfo(
            'Incrementando stock en 5...'
        );

        await productoRepository.incrementStock(
            productoCreado.id,
            5
        );


        // ----------------------------------------------------
        // CONSULTA
        // ----------------------------------------------------

        const productoStock =
            await productoRepository.findById(
                productoCreado.id
            );

        if (!productoStock) {

            throw new Error(
                'No se pudo consultar el producto después del incremento.'
            );
        }

        logOk(
            `Stock después del incremento: ` +
            `${productoStock.stockActual}`
        );


        // ----------------------------------------------------
        // DECREMENTO DE STOCK
        // ----------------------------------------------------

        logInfo(
            'Decrementando stock en 2...'
        );

        await productoRepository.decrementStock(
            productoCreado.id,
            2
        );


        // ----------------------------------------------------
        // CONSULTA
        // ----------------------------------------------------

        const productoStockFinal =
            await productoRepository.findById(
                productoCreado.id
            );

        if (!productoStockFinal) {

            throw new Error(
                'No se pudo consultar el producto después del decremento.'
            );
        }

        logOk(
            `Stock después del decremento: ` +
            `${productoStockFinal.stockActual}`
        );


        // ----------------------------------------------------
        // BAJA
        // ----------------------------------------------------

        logInfo(
            'Realizando baja lógica del producto...'
        );

        await productoRepository.deleteById(
            productoCreado.id
        );


        // ----------------------------------------------------
        // CONSULTA
        // ----------------------------------------------------

        const productoBaja =
            await productoRepository.findById(
                productoCreado.id
            );

        if (!productoBaja) {

            throw new Error(
                'El producto fue eliminado físicamente.'
            );
        }

        logOk(
            `Resultado: activo=${productoBaja.activo}, ` +
            `fechaBaja=${productoBaja.fechaBaja}`
        );


        // ----------------------------------------------------
        // RESTAURACIÓN
        // ----------------------------------------------------

        logInfo(
            'Restaurando producto...'
        );

        await productoRepository.updateById(
            productoCreado.id,
            {
                activo: true,
                fechaBaja: null
            }
        );


        // ----------------------------------------------------
        // CONSULTA
        // ----------------------------------------------------

        const productoRestaurado =
            await productoRepository.findById(
                productoCreado.id
            );

        if (!productoRestaurado) {

            throw new Error(
                'No se pudo recuperar el producto restaurado.'
            );
        }

        if (
            productoRestaurado.activo !== true ||
            productoRestaurado.fechaBaja !== null
        ) {

            throw new Error(
                'El producto no fue restaurado correctamente.'
            );
        }

        logOk(
            `Resultado final: activo=${productoRestaurado.activo}, ` +
            `fechaBaja=${productoRestaurado.fechaBaja}`
        );


        // ----------------------------------------------------
        // LIMPIEZA
        //
        // El producto de prueba se borra físicamente: antes esta
        // prueba fallaba al dar de alta y no dejaba rastro, así que
        // sin esto cada corrida acumularía un producto más.
        // ----------------------------------------------------

        logInfo(
            'Limpiando el producto de la prueba...'
        );

        await Producto.destroy({
            where: { id: productoCreado.id }
        });

        logOk(
            'Producto de prueba eliminado.'
        );


        pruebaExitosa();

    } catch (error) {

        pruebaFallida(error);
    }
}


// ============================================================
// PRUEBA 5
//
// PRODUCTO-PROVEEDOR
//
// Alta relación → consulta → modificación → consulta
// → baja → consulta → restauración → consulta
// ============================================================

async function test5() {

    iniciarPrueba(
        5,
        'ProductoProveedor: relación, consulta, modificación y baja'
    );

    try {

        const productoId = 1;
        const proveedorId = 1;


        // ----------------------------------------------------
        // CONSULTA DEL PRODUCTO
        // ----------------------------------------------------

        logInfo(
            'Consultando producto de la relación...'
        );

        const producto =
            await productoRepository.findById(
                productoId
            );

        if (!producto) {

            throw new Error(
                'El producto utilizado no existe.'
            );
        }

        logOk(
            `Producto: ${producto.nombre}`
        );


        // ----------------------------------------------------
        // CONSULTA DEL PROVEEDOR
        // ----------------------------------------------------

        logInfo(
            'Consultando proveedor de la relación...'
        );

        const proveedor =
            await proveedorRepository.findById(
                proveedorId
            );

        if (!proveedor) {

            throw new Error(
                'El proveedor utilizado no existe.'
            );
        }

        logOk(
            `Proveedor: ${proveedor.nombre}`
        );


        // ----------------------------------------------------
        // ALTA DE RELACIÓN
        // ----------------------------------------------------

        const existe =
            await productoProveedorRepository.existsRelation(
                productoId,
                proveedorId
            );

        if (!existe) {

            logInfo(
                'La relación no existe. Creándola...'
            );

            await productoProveedorRepository.create({
                productoId,
                proveedorId
            });

        } else {

            logInfo(
                'La relación ya existe.'
            );
        }


        // ----------------------------------------------------
        // CONSULTA
        // ----------------------------------------------------

        const relacion =
            await productoProveedorRepository.findByRelation(
                productoId,
                proveedorId
            );

        if (!relacion) {

            throw new Error(
                'No se pudo consultar la relación.'
            );
        }

        logOk(
            `Relación encontrada: ` +
            `productoId=${relacion.productoId}, ` +
            `proveedorId=${relacion.proveedorId}, ` +
            `activo=${relacion.activo}`
        );


        // ----------------------------------------------------
        // MODIFICACIÓN
        // ----------------------------------------------------

        logInfo(
            'Modificando temporalmente la relación...'
        );

        await productoProveedorRepository.updateRelation(
            productoId,
            proveedorId,
            {
                activo: false,
                fechaBaja: new Date()
            }
        );


        // ----------------------------------------------------
        // CONSULTA
        // ----------------------------------------------------

        const relacionModificada =
            await productoProveedorRepository.findByRelation(
                productoId,
                proveedorId
            );

        if (!relacionModificada) {

            throw new Error(
                'No se pudo consultar la relación modificada.'
            );
        }

        logOk(
            `Resultado: activo=${relacionModificada.activo}, ` +
            `fechaBaja=${relacionModificada.fechaBaja}`
        );


        // ----------------------------------------------------
        // RESTAURACIÓN
        // ----------------------------------------------------

        logInfo(
            'Restaurando la relación...'
        );

        await productoProveedorRepository.activateRelation(
            productoId,
            proveedorId
        );


        // ----------------------------------------------------
        // CONSULTA
        // ----------------------------------------------------

        const relacionRestaurada =
            await productoProveedorRepository.findByRelation(
                productoId,
                proveedorId
            );

        if (!relacionRestaurada) {

            throw new Error(
                'No se pudo consultar la relación restaurada.'
            );
        }

        if (
            relacionRestaurada.activo !== true ||
            relacionRestaurada.fechaBaja !== null
        ) {

            throw new Error(
                'La relación no fue restaurada correctamente.'
            );
        }

        logOk(
            `Resultado restaurado: activo=${relacionRestaurada.activo}, ` +
            `fechaBaja=${relacionRestaurada.fechaBaja}`
        );


        // ----------------------------------------------------
        // BAJA
        // ----------------------------------------------------

        logInfo(
            'Realizando baja lógica de la relación...'
        );

        await productoProveedorRepository.deleteRelation(
            productoId,
            proveedorId
        );


        // ----------------------------------------------------
        // CONSULTA
        // ----------------------------------------------------

        const relacionBaja =
            await productoProveedorRepository.findByRelation(
                productoId,
                proveedorId
            );

        if (!relacionBaja) {

            throw new Error(
                'La relación fue eliminada físicamente.'
            );
        }

        logOk(
            `Resultado baja: activo=${relacionBaja.activo}, ` +
            `fechaBaja=${relacionBaja.fechaBaja}`
        );


        // ----------------------------------------------------
        // RESTAURACIÓN FINAL
        // ----------------------------------------------------

        logInfo(
            'Restaurando nuevamente la relación...'
        );

        await productoProveedorRepository.activateRelation(
            productoId,
            proveedorId
        );


        // ----------------------------------------------------
        // CONSULTA FINAL
        // ----------------------------------------------------

        const relacionFinal =
            await productoProveedorRepository.findByRelation(
                productoId,
                proveedorId
            );

        if (!relacionFinal) {

            throw new Error(
                'No se pudo recuperar la relación final.'
            );
        }

        logOk(
            `Resultado final: activo=${relacionFinal.activo}, ` +
            `fechaBaja=${relacionFinal.fechaBaja}`
        );


        pruebaExitosa();

    } catch (error) {

        pruebaFallida(error);
    }
}


// ============================================================
// PRUEBA 6
//
// PRODUCTO-DIA-PEDIDO
//
// Alta relación → consulta → modificación → consulta
// → baja → consulta → restauración → consulta
// ============================================================

async function test6() {

    iniciarPrueba(
        6,
        'ProductoDiaPedido: relación, consulta, modificación y baja'
    );

    try {

        const productoId = 1;
        const diaPedidoId = 1;


        // ----------------------------------------------------
        // CONSULTA DEL PRODUCTO
        // ----------------------------------------------------

        logInfo(
            'Consultando producto de la relación...'
        );

        const producto =
            await productoRepository.findById(
                productoId
            );

        if (!producto) {

            throw new Error(
                'El producto utilizado no existe.'
            );
        }

        logOk(
            `Producto: ${producto.nombre}`
        );


        // ----------------------------------------------------
        // CONSULTA DEL DÍA
        // ----------------------------------------------------

        logInfo(
            'Consultando día de pedido...'
        );

        const dia =
            await diaPedidoRepository.findById(
                diaPedidoId
            );

        if (!dia) {

            throw new Error(
                'El día de pedido utilizado no existe.'
            );
        }

        logOk(
            `Día: ${dia.nombre}`
        );


        // ----------------------------------------------------
        // ALTA DE RELACIÓN
        // ----------------------------------------------------

        const existe =
            await productoDiaPedidoRepository.existsRelation(
                productoId,
                diaPedidoId
            );

        if (!existe) {

            logInfo(
                'La relación no existe. Creándola...'
            );

            await productoDiaPedidoRepository.create({
                productoId,
                diaPedidoId
            });

        } else {

            logInfo(
                'La relación ya existe.'
            );
        }


        // ----------------------------------------------------
        // CONSULTA
        // ----------------------------------------------------

        const relacion =
            await productoDiaPedidoRepository.findByRelation(
                productoId,
                diaPedidoId
            );

        if (!relacion) {

            throw new Error(
                'No se pudo consultar la relación.'
            );
        }

        logOk(
            `Relación encontrada: ` +
            `productoId=${relacion.productoId}, ` +
            `diaPedidoId=${relacion.diaPedidoId}, ` +
            `activo=${relacion.activo}`
        );


        // ----------------------------------------------------
        // MODIFICACIÓN
        // ----------------------------------------------------

        logInfo(
            'Modificando temporalmente la relación...'
        );

        await productoDiaPedidoRepository.updateRelation(
            productoId,
            diaPedidoId,
            {
                activo: false,
                fechaBaja: new Date()
            }
        );


        // ----------------------------------------------------
        // CONSULTA
        // ----------------------------------------------------

        const relacionModificada =
            await productoDiaPedidoRepository.findByRelation(
                productoId,
                diaPedidoId
            );

        if (!relacionModificada) {

            throw new Error(
                'No se pudo consultar la relación modificada.'
            );
        }

        logOk(
            `Resultado: activo=${relacionModificada.activo}, ` +
            `fechaBaja=${relacionModificada.fechaBaja}`
        );


        // ----------------------------------------------------
        // RESTAURACIÓN
        // ----------------------------------------------------

        logInfo(
            'Restaurando la relación...'
        );

        await productoDiaPedidoRepository.activateRelation(
            productoId,
            diaPedidoId
        );


        // ----------------------------------------------------
        // CONSULTA
        // ----------------------------------------------------

        const relacionRestaurada =
            await productoDiaPedidoRepository.findByRelation(
                productoId,
                diaPedidoId
            );

        if (!relacionRestaurada) {

            throw new Error(
                'No se pudo consultar la relación restaurada.'
            );
        }

        if (
            relacionRestaurada.activo !== true ||
            relacionRestaurada.fechaBaja !== null
        ) {

            throw new Error(
                'La relación no fue restaurada correctamente.'
            );
        }

        logOk(
            `Resultado restaurado: activo=${relacionRestaurada.activo}, ` +
            `fechaBaja=${relacionRestaurada.fechaBaja}`
        );


        // ----------------------------------------------------
        // BAJA
        // ----------------------------------------------------

        logInfo(
            'Realizando baja lógica de la relación...'
        );

        await productoDiaPedidoRepository.deleteRelation(
            productoId,
            diaPedidoId
        );


        // ----------------------------------------------------
        // CONSULTA
        // ----------------------------------------------------

        const relacionBaja =
            await productoDiaPedidoRepository.findByRelation(
                productoId,
                diaPedidoId
            );

        if (!relacionBaja) {

            throw new Error(
                'La relación fue eliminada físicamente.'
            );
        }

        logOk(
            `Resultado baja: activo=${relacionBaja.activo}, ` +
            `fechaBaja=${relacionBaja.fechaBaja}`
        );


        // ----------------------------------------------------
        // RESTAURACIÓN FINAL
        // ----------------------------------------------------

        logInfo(
            'Restaurando nuevamente la relación...'
        );

        await productoDiaPedidoRepository.activateRelation(
            productoId,
            diaPedidoId
        );


        // ----------------------------------------------------
        // CONSULTA FINAL
        // ----------------------------------------------------

        const relacionFinal =
            await productoDiaPedidoRepository.findByRelation(
                productoId,
                diaPedidoId
            );

        if (!relacionFinal) {

            throw new Error(
                'No se pudo recuperar la relación final.'
            );
        }

        logOk(
            `Resultado final: activo=${relacionFinal.activo}, ` +
            `fechaBaja=${relacionFinal.fechaBaja}`
        );


        pruebaExitosa();

    } catch (error) {

        pruebaFallida(error);
    }
}


// ============================================================
// PRUEBA 7
//
// PRECIO
//
// Alta → consulta → cambio de precio → historial → cierre
// → reapertura → baja → restauración
// ============================================================

async function test7() {

    iniciarPrueba(
        7,
        'Precio: alta, vigencia, historial y baja lógica'
    );

    const productoId = 1;

    try {

        // ----------------------------------------------------
        // CONSULTA DEL PRODUCTO
        // ----------------------------------------------------

        const producto =
            await productoRepository.findById(productoId);

        if (!producto) {

            throw new Error(
                'No se encontró el producto del precio.'
            );
        }

        logInfo('Registrando el primer precio...');

        const primero = await precioRepository.registrarPrecio(
            productoId,
            '1000.00',
            '900.00'
        );

        logOk(
            `Precio registrado: id=${primero.id}, ` +
            `minorista=${primero.precioMinorista}, ` +
            `mayorista=${primero.precioMayorista}`
        );

        if (primero.fechaHasta !== null) {

            throw new Error(
                'El precio registrado no debería tener fechaHasta.'
            );
        }


        // ----------------------------------------------------
        // CONSULTA DEL PRECIO VIGENTE
        // ----------------------------------------------------

        logInfo('Consultando el precio vigente...');

        const vigente =
            await precioRepository.findVigente(productoId);

        if (!vigente) {

            throw new Error(
                'No se encontró el precio vigente.'
            );
        }

        if (vigente.id !== primero.id) {

            throw new Error(
                'El precio vigente no es el registrado.'
            );
        }

        logOk(
            `Vigente: id=${vigente.id}, ` +
            `minorista=${vigente.precioMinorista}`
        );

        const abierto =
            await precioRepository.findAbierto(productoId);

        if (!abierto || abierto.id !== primero.id) {

            throw new Error(
                'No se encontró el precio abierto.'
            );
        }

        logOk('findAbierto devolvió el precio abierto.');


        // ----------------------------------------------------
        // CAMBIO DE PRECIO
        // ----------------------------------------------------

        logInfo('Registrando un segundo precio...');

        const segundo = await precioRepository.registrarPrecio(
            productoId,
            '1200.00',
            '1100.00'
        );

        const primeroCerrado =
            await precioRepository.findById(primero.id);

        if (!primeroCerrado || primeroCerrado.fechaHasta === null) {

            throw new Error(
                'El precio anterior no se cerró al registrar el nuevo.'
            );
        }

        logOk(
            `Anterior cerrado: fechaHasta=${primeroCerrado.fechaHasta}`
        );

        const vigenteNuevo =
            await precioRepository.findVigente(productoId);

        if (!vigenteNuevo || vigenteNuevo.id !== segundo.id) {

            throw new Error(
                'El precio vigente no se actualizó al nuevo.'
            );
        }

        logOk('El precio vigente pasó a ser el nuevo.');


        // ----------------------------------------------------
        // HISTORIAL
        // ----------------------------------------------------

        logInfo('Consultando el historial de precios...');

        const historial =
            await precioRepository.findHistorial(productoId, 1, 10);

        if (historial.length !== 2) {

            throw new Error(
                `El historial debía traer 2 precios y trajo ${historial.length}.`
            );
        }

        logOk(`Historial con ${historial.length} precios.`);


        // ----------------------------------------------------
        // CIERRE DE VIGENCIA
        // ----------------------------------------------------

        logInfo('Cerrando la vigencia del precio actual...');

        const cerrado = await precioRepository.cerrarVigencia(
            segundo.id
        );

        if (!cerrado || cerrado.fechaHasta === null) {

            throw new Error(
                'No se pudo cerrar la vigencia del precio.'
            );
        }

        const sinVigente =
            await precioRepository.findVigente(productoId);

        if (sinVigente) {

            throw new Error(
                'No debería haber un precio vigente tras cerrarlo.'
            );
        }

        logOk('Tras el cierre no hay precio vigente.');


        // ----------------------------------------------------
        // REAPERTURA
        // ----------------------------------------------------

        logInfo('Registrando un precio para reabrir la vigencia...');

        const tercero = await precioRepository.registrarPrecio(
            productoId,
            '1300.00'
        );

        const vigenteTercero =
            await precioRepository.findVigente(productoId);

        if (!vigenteTercero || vigenteTercero.id !== tercero.id) {

            throw new Error(
                'La reapertura no quedó vigente.'
            );
        }

        if (tercero.precioMayorista !== null) {

            throw new Error(
                'El precio mayorista debía quedar en null.'
            );
        }

        logOk(
            `Reabierto: id=${tercero.id}, ` +
            `mayorista=${tercero.precioMayorista}`
        );


        // ----------------------------------------------------
        // BAJA LÓGICA
        // ----------------------------------------------------

        logInfo('Realizando baja lógica del precio...');

        const baja = await precioRepository.deleteById(tercero.id);

        if (!baja || baja.activo !== false) {

            throw new Error(
                'No se pudo registrar la baja lógica del precio.'
            );
        }

        const consultarBaja =
            await precioRepository.findById(tercero.id);

        if (!consultarBaja || consultarBaja.activo !== false) {

            throw new Error(
                'El precio no quedó dado de baja.'
            );
        }

        logOk(
            `Baja lógica: activo=${consultarBaja.activo}, ` +
            `fechaBaja=${consultarBaja.fechaBaja}`
        );


        // ----------------------------------------------------
        // RESTAURACIÓN
        // ----------------------------------------------------

        logInfo('Restaurando el precio...');

        await precioRepository.updateById(tercero.id, {
            activo: true,
            fechaBaja: null
        });

        const restaurado =
            await precioRepository.findById(tercero.id);

        if (!restaurado || restaurado.activo !== true) {

            throw new Error(
                'No se pudo restaurar el precio.'
            );
        }

        logOk('Precio restaurado.');


        // ----------------------------------------------------
        // LIMPIEZA
        //
        // A diferencia de las pruebas anteriores, acá se borra
        // físicamente: el índice precios_unico_abierto impide
        // dejar un precio abierto colgado de una corrida anterior.
        // ----------------------------------------------------

        logInfo('Limpiando los precios de la prueba...');

        await Precio.destroy({
            where: { productoId }
        });

        logOk('Precios de prueba eliminados.');


        pruebaExitosa();

    } catch (error) {

        pruebaFallida(error);
    }
}


// ============================================================
// PRUEBA 8
//
// OFERTA
//
// Alta → consulta → vigencia → ajuste de fechas → baja
// → restauración
// ============================================================

async function test8() {

    iniciarPrueba(
        8,
        'Oferta: alta, vigencia y baja lógica'
    );

    const nombre = 'Oferta de prueba repositorio';

    try {

        // ----------------------------------------------------
        // ALTA
        // ----------------------------------------------------

        logInfo('Creando la oferta...');

        const inicio = new Date('2026-01-01T00:00:00.000Z');
        const fin = new Date('2026-02-01T00:00:00.000Z');

        const oferta = await ofertaRepository.create({
            nombre,
            descripcion: 'Oferta temporal de verificación',
            fechaInicio: inicio,
            fechaFin: fin
        });

        logOk(`Oferta creada: id=${oferta.id}`);

        if (oferta.activo !== true) {

            throw new Error(
                'La oferta no debería haber nacido dada de baja.'
            );
        }


        // ----------------------------------------------------
        // CONSULTA
        // ----------------------------------------------------

        logInfo('Consultando la oferta por nombre...');

        const porNombre =
            await ofertaRepository.findByName(nombre);

        if (!porNombre || porNombre.id !== oferta.id) {

            throw new Error(
                'No se encontró la oferta por nombre.'
            );
        }

        logOk('findByName devolvió la oferta.');

        const porId =
            await ofertaRepository.findByIdActivo(oferta.id);

        if (!porId || porId.id !== oferta.id) {

            throw new Error(
                'findByIdActivo no devolvió la oferta.'
            );
        }

        logOk('findByIdActivo devolvió la oferta.');


        // ----------------------------------------------------
        // VIGENCIA
        // ----------------------------------------------------

        logInfo('Consultando ofertas vigentes...');

        const dentroDeRango = new Date('2026-01-15T00:00:00.000Z');
        const fueraDeRango = new Date('2026-03-01T00:00:00.000Z');

        const vigentesDentro =
            await ofertaRepository.findTodasVigentes(dentroDeRango);

        if (!vigentesDentro.some(o => o.id === oferta.id)) {

            throw new Error(
                'La oferta debía estar vigente dentro de su rango.'
            );
        }

        logOk('Está vigente dentro de su rango.');

        const vigentesFuera =
            await ofertaRepository.findTodasVigentes(fueraDeRango);

        if (vigentesFuera.some(o => o.id === oferta.id)) {

            throw new Error(
                'La oferta no debía estar vigente fuera de su rango.'
            );
        }

        logOk('No está vigente fuera de su rango.');


        // ----------------------------------------------------
        // AJUSTE DE FECHAS
        // ----------------------------------------------------

        logInfo('Ajustando la ventana de la oferta...');

        const nuevoInicio = new Date('2026-01-10T00:00:00.000Z');
        const nuevoFin = new Date('2026-01-20T00:00:00.000Z');

        const ajustada = await ofertaRepository.updateVigencia(
            oferta.id,
            nuevoInicio,
            nuevoFin
        );

        if (!ajustada) {

            throw new Error(
                'No se pudo ajustar la vigencia de la oferta.'
            );
        }

        if (
            ajustada.fechaInicio.getTime() !== nuevoInicio.getTime() ||
            ajustada.fechaFin.getTime() !== nuevoFin.getTime()
        ) {

            throw new Error(
                'Las fechas de la oferta no se actualizaron.'
            );
        }

        logOk('Ventana de la oferta actualizada.');


        // ----------------------------------------------------
        // BAJA LÓGICA
        // ----------------------------------------------------

        logInfo('Realizando baja lógica de la oferta...');

        const baja = await ofertaRepository.deleteById(oferta.id);

        if (!baja || baja.activo !== false) {

            throw new Error(
                'No se pudo registrar la baja lógica de la oferta.'
            );
        }

        const porIdInactivo =
            await ofertaRepository.findByIdActivo(oferta.id);

        if (porIdInactivo) {

            throw new Error(
                'findByIdActivo no debería devolver una oferta dada de baja.'
            );
        }

        const activas = await ofertaRepository.findAllActivos();
        const enActivos = activas.rows.some(o => o.id === oferta.id);

        if (enActivos) {

            throw new Error(
                'La oferta dada de baja apareció en findAllActivos.'
            );
        }

        logOk(
            'Baja lógica registrada y excluida de las activas.'
        );


        // ----------------------------------------------------
        // RESTAURACIÓN
        // ----------------------------------------------------

        logInfo('Restaurando la oferta...');

        await ofertaRepository.updateById(oferta.id, {
            activo: true,
            fechaBaja: null
        });

        const restaurada =
            await ofertaRepository.findByIdActivo(oferta.id);

        if (!restaurada || restaurada.activo !== true) {

            throw new Error(
                'No se pudo restaurar la oferta.'
            );
        }

        logOk('Oferta restaurada.');


        // ----------------------------------------------------
        // LIMPIEZA
        // ----------------------------------------------------

        logInfo('Limpiando la oferta de la prueba...');

        await OfertaProducto.destroy({
            where: { ofertaId: oferta.id }
        });

        await Oferta.destroy({
            where: { id: oferta.id }
        });

        logOk('Oferta de prueba eliminada.');


        pruebaExitosa();

    } catch (error) {

        pruebaFallida(error);
    }
}


// ============================================================
// PRUEBA 9
//
// OFERTA-PRODUCTO
//
// Alta relación → duplicado → consulta → modificación
// → ofertas vigentes → baja → restauración
// ============================================================

async function test9() {

    iniciarPrueba(
        9,
        'OfertaProducto: relación, duplicado y baja lógica'
    );

    const productoId = 1;

    try {

        // ----------------------------------------------------
        // PREPARACIÓN
        // ----------------------------------------------------

        const producto =
            await productoRepository.findById(productoId);

        if (!producto) {

            throw new Error(
                'No se encontró el producto de la relación.'
            );
        }

        const inicio = new Date('2026-01-01T00:00:00.000Z');
        const fin = new Date('2026-12-31T00:00:00.000Z');

        const oferta = await ofertaRepository.create({
            nombre: 'Oferta de prueba relación',
            descripcion: 'Relación temporal de verificación',
            fechaInicio: inicio,
            fechaFin: fin
        });

        logInfo(
            `Oferta de apoyo creada: id=${oferta.id}`
        );


        // ----------------------------------------------------
        // ALTA DE LA RELACIÓN
        // ----------------------------------------------------

        logInfo('Creando la relación oferta-producto...');

        const relacion = await ofertaProductoRepository.create({
            ofertaId: oferta.id,
            productoId,
            precioOferta: '850.00'
        });

        logOk(
            `Relación creada: id=${relacion.id}, ` +
            `precioOferta=${relacion.precioOferta}`
        );

        const existe =
            await ofertaProductoRepository.existsOfertaProducto(
                oferta.id,
                productoId
            );

        if (!existe) {

            throw new Error(
                'La relación no se encontró.'
            );
        }

        logOk('existsOfertaProducto devolvió true.');


        // ----------------------------------------------------
        // DUPLICADO
        // ----------------------------------------------------

        logInfo('Intentando crear un duplicado...');

        let duplicadoRechazado = false;

        try {

            await ofertaProductoRepository.create({
                ofertaId: oferta.id,
                productoId,
                precioOferta: '700.00'
            });

        } catch (error) {

            duplicadoRechazado = true;

            logInfo(
                'El duplicado fue rechazado por el índice único.'
            );
        }

        if (!duplicadoRechazado) {

            throw new Error(
                'Se permitió crear una relación duplicada.'
            );
        }

        logOk('El índice único impidió el duplicado.');


        // ----------------------------------------------------
        // CONSULTA
        // ----------------------------------------------------

        logInfo('Consultando los productos de la oferta...');

        const productos =
            await ofertaProductoRepository.getProductos(oferta.id);

        if (productos.length !== 1 || productos[0].id !== productoId) {

            throw new Error(
                `getProductos debía traer 1 producto y trajo ${productos.length}.`
            );
        }

        logOk(`getProductos trajo ${productos.length} producto(s).`);

        const porNombre =
            await ofertaProductoRepository.findProductosName(oferta.id);

        if (porNombre[0] !== producto.nombre) {

            throw new Error(
                'findProductosName no devolvió el nombre esperado.'
            );
        }

        const total =
            await ofertaProductoRepository.countProductos(oferta.id);

        if (total !== 1) {

            throw new Error(
                `countProductos debía devolver 1 y devolvió ${total}.`
            );
        }

        logOk('findProductosName y countProductos correctos.');


        // ----------------------------------------------------
        // MODIFICACIÓN
        // ----------------------------------------------------

        logInfo('Modificando el precio de la oferta...');

        const modificada =
            await ofertaProductoRepository.updatePrecioOferta(
                oferta.id,
                productoId,
                '800.00'
            );

        if (!modificada || modificada.precioOferta !== '800.00') {

            throw new Error(
                'No se pudo modificar el precio de la oferta.'
            );
        }

        logOk('precioOferta actualizado a 800.00.');


        // ----------------------------------------------------
        // OFERTAS VIGENTES DEL PRODUCTO
        // ----------------------------------------------------

        logInfo('Consultando las ofertas vigentes del producto...');

        const dentroDeRango = new Date('2026-06-01T00:00:00.000Z');
        const fueraDeRango = new Date('2027-06-01T00:00:00.000Z');

        const vigentesDentro =
            await ofertaProductoRepository.getOfertasVigentes(
                productoId,
                dentroDeRango
            );

        if (!vigentesDentro.some(o => o.id === oferta.id)) {

            throw new Error(
                'La oferta debía estar vigente dentro de su rango.'
            );
        }

        const vigentesFuera =
            await ofertaProductoRepository.getOfertasVigentes(
                productoId,
                fueraDeRango
            );

        if (vigentesFuera.some(o => o.id === oferta.id)) {

            throw new Error(
                'La oferta no debía estar vigente fuera de su rango.'
            );
        }

        logOk('El filtro de vigencia funciona en ambos sentidos.');


        // ----------------------------------------------------
        // BAJA LÓGICA
        // ----------------------------------------------------

        logInfo('Realizando baja lógica de la relación...');

        const baja =
            await ofertaProductoRepository.deleteByOfertaProducto(
                oferta.id,
                productoId
            );

        if (!baja || baja.activo !== false) {

            throw new Error(
                'No se pudo registrar la baja lógica de la relación.'
            );
        }

        const activos =
            await ofertaProductoRepository.getProductosActivos(oferta.id);

        if (activos.some(p => p.id === productoId)) {

            throw new Error(
                'La relación dada de baja apareció en getProductosActivos.'
            );
        }

        logOk(
            'Baja lógica registrada y excluida de las activas.'
        );


        // ----------------------------------------------------
        // RESTAURACIÓN
        // ----------------------------------------------------

        logInfo('Restaurando la relación...');

        await ofertaProductoRepository.activateOfertaProducto(
            oferta.id,
            productoId
        );

        const restaurada =
            await ofertaProductoRepository.findByOfertaProducto(
                oferta.id,
                productoId
            );

        if (!restaurada || restaurada.activo !== true) {

            throw new Error(
                'No se pudo restaurar la relación.'
            );
        }

        logOk('Relación restaurada.');


        // ----------------------------------------------------
        // LIMPIEZA
        // ----------------------------------------------------

        logInfo('Limpiando los datos de la prueba...');

        await OfertaProducto.destroy({
            where: { ofertaId: oferta.id }
        });

        await Oferta.destroy({
            where: { id: oferta.id }
        });

        logOk('Datos de la prueba eliminados.');


        pruebaExitosa();

    } catch (error) {

        pruebaFallida(error);
    }
}


// ============================================================
// EJECUCIÓN
// ============================================================

async function ejecutarPruebas() {

    console.log('');
    console.log('============================================================');
    console.log('       TEST DE REPOSITORIOS - POLLERÍA LA NENA');
    console.log('============================================================');


    try {

        // ----------------------------------------------------
        // CONEXIÓN
        // ----------------------------------------------------

        logInfo(
            'Conectando con la base de datos...'
        );

        await sequelize.authenticate();

        logOk(
            'Conexión establecida correctamente.'
        );


        // ----------------------------------------------------
        // PRUEBAS
        // ----------------------------------------------------

        await test1();
        await test2();
        await test3();
        await test4();
        await test5();
        await test6();
        await test7();
        await test8();
        await test9();


    } catch (error) {

        logError(
            'Error general durante la ejecución.'
        );

        if (error instanceof Error) {

            console.error(
                `   ${error.message}`
            );

        } else {

            console.error(
                `   ${String(error)}`
            );
        }

    } finally {

        // ----------------------------------------------------
        // RESUMEN
        // ----------------------------------------------------

        console.log('');
        console.log('============================================================');
        console.log('                       RESUMEN');
        console.log('============================================================');

        console.log(
            `   ✓ Pruebas exitosas: ${pruebasExitosas}`
        );

        console.log(
            `   ✗ Pruebas fallidas: ${pruebasFallidas}`
        );

        console.log(
            `   Total: ${pruebasExitosas + pruebasFallidas}`
        );

        console.log('============================================================');


        // ----------------------------------------------------
        // CIERRE
        // ----------------------------------------------------

        logInfo(
            'Cerrando conexión con la base de datos...'
        );

        await sequelize.close();

        logOk(
            'Conexión cerrada correctamente.'
        );

        console.log('');
    }
}


// ============================================================
// INICIO
// ============================================================

ejecutarPruebas();
