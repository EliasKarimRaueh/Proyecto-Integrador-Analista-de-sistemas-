import { type Request, type Response } from 'express';

export const getProductos = async (req: Request, res: Response) => {
  try {
    // Acá más adelante llamaremos a Supabase: await productoRepository.getAll()
    // Por ahora mandamos datos de prueba:
    const productosMock = [
      { id: 1, nombre: "Pollo entero (Cajón)", precioMinorista: 2500, unidadVenta: "kg" },
      { id: 2, nombre: "Pata muslo", precioMinorista: 1800, unidadVenta: "kg" },
      { id: 3, nombre: "Pan rallado", precioMinorista: 1200, unidadVenta: "kg" }
    ];
    
    res.status(200).json(productosMock);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los productos", error });
  }
};