import sequelize from '../config/database.js';

import TipoProductoRepository from '../repositories/tipoProductoRepository.js';
import DiaPedidoRepository from '../repositories/diaPedidoRepository.js';
import ProveedorRepository from '../repositories/proveedorRepository.js';
import ProductoRepository from '../repositories/productoRepository.js';
import ProductoProveedorRepository from '../repositories/ProductoProveedorRepository.js';
import ProductoDiaPedidoRepository from '../repositories/productoDiaPedidoRepository.js';


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
        // ELIMINACIÓN FÍSICA
        // ----------------------------------------------------
        //
        // No se realiza.
        //
        // El sistema utiliza baja lógica.
        // El registro de prueba queda conservado.
        // ----------------------------------------------------

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

        logInfo(
            `Creando producto "${nombre}"...`
        );

        const productoCreado =
            await productoRepository.create({

                nombre,

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
