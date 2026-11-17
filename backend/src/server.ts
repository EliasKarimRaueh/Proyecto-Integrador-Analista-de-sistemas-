import 'dotenv/config';
import app from './app.js';
import sequelize from 'polleria-database/config/database';
import 'polleria-database/relationships/relationships'; /* <-- AGREGÁ ESTA LÍNEA AQUÍ */
import { migrateProductCatalog } from 'polleria-database/migrations/productCatalog';
import { migratePreciosOfertas } from 'polleria-database/migrations/preciosOfertas';
import { migrateComprasSprint4 } from 'polleria-database/migrations/comprasSprint4';
import { migrateProveedores } from 'polleria-database/migrations/proveedores';
import { migrateCuentasProveedores } from 'polleria-database/migrations/cuentasProveedores';
import { migrateZonaHorariaRecepcion } from 'polleria-database/migrations/zonaHorariaRecepcion';
import { migrateLimpiezaEsquema } from 'polleria-database/migrations/limpiezaEsquema';
import { migratePresentacionPedidos } from 'polleria-database/migrations/presentacionPedidos';
import { migrateRecepcionConformidad } from 'polleria-database/migrations/recepcionConformidad';

const PORT = process.env.PORT || 3000;

const inicioTotal = Date.now();

try {

  // AUTENTICACION
  let tiempoInicio = Date.now()
  await sequelize.authenticate();
  let tiempoFin = Date.now();
  console.log(`Conexión con la base de datos realizada, duración: ${((tiempoFin - tiempoInicio) / 1000).toFixed(2)} segundos`);


  //MIGRACION CATALOGO PRODUCTOS
  //tiempoInicio = Date.now();
  //await migrateProductCatalog();
  //tiempoFin = Date.now();
  //console.log(`Migración Product Catalog realizada, duración: ${((tiempoFin - tiempoInicio) / 1000).toFixed(2)} segundos`);


  //MIGRACION PRECIOS OFERTA
  //tiempoInicio = Date.now();
  //await migratePreciosOfertas();
  //tiempoFin = Date.now();
  //console.log(`Migración Precios y Ofertas realizada, duración: ${((tiempoFin - tiempoInicio) / 1000).toFixed(2)} segundos`);


  //MIGRACION COMPRAS SPRINT 4
  //tiempoInicio = Date.now();
  //await migrateComprasSprint4();
  //tiempoFin = Date.now();
  //console.log(`Migración Compras Sprint 4 realizada, duración: ${((tiempoFin - tiempoInicio) / 1000).toFixed(2)} segundos`);


  //MIGRACION PROVEEDORES
  //tiempoInicio = Date.now();
  //await migrateProveedores();
  //tiempoFin = Date.now();
  //console.log(`Migración Proveedores realizada, duración: ${((tiempoFin - tiempoInicio) / 1000).toFixed(2)} segundos`);


  //MIGRACION CUENTAS PROVEEDORES
  //tiempoInicio = Date.now();
  //await migrateCuentasProveedores();
  //tiempoFin = Date.now();
  //console.log(`Migración Cuentas Proveedores realizada, duración: ${((tiempoFin - tiempoInicio) / 1000).toFixed(2)} segundos`);


  //MIGRACION ZONA HORARIA RECEPCION
  //tiempoInicio = Date.now();
  //await migrateZonaHorariaRecepcion();
  //tiempoFin = Date.now();
  //console.log(`Migración Zona Horaria Recepción realizada, duración: ${((tiempoFin - tiempoInicio) / 1000).toFixed(2)} segundos`);


  //MIGRACION LIMPIEZA ESQUEMAS
  //tiempoInicio = Date.now();
  //await migrateLimpiezaEsquema();
  //tiempoFin = Date.now();
  //console.log(`Migración Limpieza Esquema realizada, duración: ${((tiempoFin - tiempoInicio) / 1000).toFixed(2)} segundos`);


  //MIGRACION PRESENTACION PEDIDOS
  //tiempoInicio = Date.now();
  //await migratePresentacionPedidos();
  //tiempoFin = Date.now();
  //console.log(`Migración Presentación Pedidos realizada, duración: ${((tiempoFin - tiempoInicio) / 1000).toFixed(2)} segundos`);


  //MIGRACION RECEPCION CONFORMIDAD
  //tiempoInicio = Date.now();
  //await migrateRecepcionConformidad();
  //tiempoFin = Date.now();
  //console.log(`Migración Recepción Conformidad realizada, duración: ${((tiempoFin - tiempoInicio) / 1000).toFixed(2)} segundos`);


  console.log(`Tiempo total de inicialización: ${((Date.now() - inicioTotal) / 1000).toFixed(2)} segundos`);
  console.log('Conexión exitosa con la base de datos');


  //Escuchar puerto
  tiempoInicio = Date.now();
  app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
  });
  tiempoFin = Date.now();
  console.log(`Duración para la escucha: ${((tiempoFin - tiempoInicio) / 1000).toFixed(2)} segundos`);


} catch (error) {
  console.error('No se pudo conectar con la base de datos:', error);
  process.exit(1);
}
