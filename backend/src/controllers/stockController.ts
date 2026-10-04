import { type Request, type Response } from 'express';
// 1. Importamos la CLASE (con mayúscula)
import ProductoRepository from '../../../database/src/repositories/productoRepository.js'; 

// 2. CREAMOS LA INSTANCIA (con minúscula) fuera de la función para que se reutilice
const productoRepository = new ProductoRepository();

export const getEstadoStock = async (req: Request, res: Response) => {
  try {
    // 3. Llamamos a findAll sobre la INSTANCIA (minúscula)
    const resultado = await productoRepository.findAll(1, 1000); 
    
    // Extraemos el array real de productos de la propiedad 'rows' de Sequelize
    const productos = resultado.rows;
    
    // Mapeamos los datos para el frontend
    const stockActual = productos.map((p: any) => {
      const estadoAlerta = (p.stockMinimo !== null && p.stockActual <= p.stockMinimo) ? 'Crítico' : 'Normal';

      return { 
        id: p.id, 
        codigo: p.codigo, 
        nombre: p.nombre, 
        stockActual: p.stockActual, 
        stockMinimo: p.stockMinimo, 
        unidadVenta: p.unidadVenta, 
        estado: estadoAlerta 
      };
    });
    
    res.status(200).json(stockActual);
  } catch (error) {
    console.error("Error al consultar la base de datos:", error);
    res.status(500).json({ message: "Error interno al consultar el stock", error });
  }
};

// ... (resto de tus funciones)
// 2. Registrar cualquier tipo de movimiento (POST /api/stock/movimientos)
export const registrarMovimiento = async (req: Request, res: Response) => {
  try {
    // 'cantMovimiento' es la cantidad que entra o sale
    const { productoId, tipo, cantMovimiento, motivo, usuarioId = 1 } = req.body;

    if (!productoId || !tipo || !cantMovimiento) {
      return res.status(400).json({ message: "Faltan datos obligatorios" });
    }

    // Tipos según tu enum o lógica de negocio
    const tiposSuma = ['INGRESO', 'AJUSTE_POSITIVO'];
    const tiposResta = ['EGRESO', 'AJUSTE_NEGATIVO', 'MERMA', 'PERDIDA', 'FRACCIONAMIENTO'];

    /* 
      LÓGICA TRANSACCIONAL PARA SUPABASE (A implementar con tu ORM/Query Builder):
      
      1. INICIAR TRANSACCIÓN (BEGIN)
      
      2. LEER STOCK ACTUAL:
         const producto = await DB.query('SELECT "stockActual" FROM productos WHERE id = $1 FOR UPDATE', [productoId]);
         const cantInicial = producto.stockActual;

      3. CALCULAR STOCK FINAL:
         let cantFinal = cantInicial;
         if (tiposSuma.includes(tipo)) cantFinal += cantMovimiento;
         else if (tiposResta.includes(tipo)) cantFinal -= cantMovimiento;
         else throw new Error('Tipo no válido');

      4. INSERTAR EN movimientos_stock:
         await DB.query(`
           INSERT INTO movimientos_stock 
           ("productoId", "fechaHora", tipo, "cantInicial", "cantMovimiento", "cantFinal", "usuarioId", motivo, "numeroMovimiento")
           VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8)
         `, [productoId, tipo, cantInicial, cantMovimiento, cantFinal, usuarioId, motivo, numeroGenerado]);

      5. ACTUALIZAR EN productos:
         await DB.query('UPDATE productos SET "stockActual" = $1 WHERE id = $2', [cantFinal, productoId]);

      6. CONFIRMAR TRANSACCIÓN (COMMIT)
    */

    res.status(201).json({ 
      message: `Movimiento de ${tipo} registrado correctamente`,
      detalle: { productoId, cantMovimiento, motivo }
    });
  } catch (error) {
    res.status(500).json({ message: "Error al registrar el movimiento", error });
  }
};

// 3. Historial (GET /api/stock/movimientos/:productoId)
export const getMovimientos = async (req: Request, res: Response) => {
  try {
    const { productoId } = req.params;
    // Acá buscarán en la tabla movimientos_stock ordenado por fechaHora DESC
    res.status(200).json({ message: `Historial del producto ${productoId} listo para conectar a DB` });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener historial", error });
  }
};

// 4. Registrar Fraccionamiento y Merma (POST /api/stock/fraccionamientos)
export const registrarFraccionamiento = async (req: Request, res: Response) => {
  try {
    const { productoOrigenId, cantidadOrigen, derivados, merma, motivo, usuarioId = 1 } = req.body;

    // Validación básica de estructura
    if (!productoOrigenId || !cantidadOrigen || !derivados || !Array.isArray(derivados)) {
      return res.status(400).json({ message: "Datos incompletos para el fraccionamiento" });
    }

    // Validación matemática: Lo que sale (origen) debe ser igual a lo que entra (derivados + merma)
    const totalDerivados = derivados.reduce((acc, curr) => acc + curr.cantidad, 0);
    const totalCalculado = totalDerivados + (merma || 0);

    if (cantidadOrigen !== totalCalculado) {
      return res.status(400).json({ 
        message: "Error de consistencia: La cantidad de origen no coincide con la suma de los derivados y la merma." 
      });
    }

    /*
      LÓGICA TRANSACCIONAL CRÍTICA (A implementar con Supabase):
      
      1. INICIAR TRANSACCIÓN (BEGIN)
      
      2. PROCESAR ORIGEN (EGRESO):
         - Leer "stockActual" del productoOrigenId.
         - Calcular: cantFinal = stockActual - cantidadOrigen.
         - Insertar en movimientos_stock (tipo: 'FRACCIONAMIENTO', cantMovimiento: cantidadOrigen).
         - Actualizar tabla productos[cite: 28].

      3. PROCESAR DERIVADOS (INGRESOS):
         - Bucle for...of sobre "derivados".
         - Para cada uno: Leer "stockActual" del derivado.productoId.
         - Calcular: cantFinal = stockActual + derivado.cantidad.
         - Insertar en movimientos_stock (tipo: 'FRACCIONAMIENTO_INGRESO', cantMovimiento: derivado.cantidad)[cite: 28].
         - Actualizar tabla productos[cite: 28].

      4. PROCESAR MERMA (Si existe):
         - Insertar un registro en movimientos_stock para reflejar la pérdida (tipo: 'MERMA', cantMovimiento: merma) asociado al producto de origen o a un ID de desperdicio[cite: 28].

      5. CONFIRMAR TRANSACCIÓN (COMMIT)
    */

    res.status(201).json({
      message: "Fraccionamiento y merma registrados correctamente",
      detalle: {
        origen: { productoId: productoOrigenId, cantidad: cantidadOrigen },
        derivadosGenerados: derivados.length,
        mermaRegistrada: merma || 0
      }
    });

  } catch (error) {
    res.status(500).json({ message: "Error al procesar el fraccionamiento", error });
  }
};