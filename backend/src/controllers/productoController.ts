import { type Request, type Response } from 'express';

export const getProductos = async (req: Request, res: Response) => {
  try {
    // Datos mockeados alineados 100% con la interfaz Product del frontend
    const productosMock = [
      { 
        id: '1', 
        code: 'POL-001', 
        name: 'Pollo entero', 
        category: 'Pollo', 
        unit: 'kg', 
        description: 'Pollo entero fresco, sin menudos.', 
        active: true 
      },
      { 
        id: '2', 
        code: 'COR-001', 
        name: 'Pata y muslo', 
        category: 'Cortes', 
        unit: 'kg', 
        description: 'Cuarto trasero de pollo fresco.', 
        active: true 
      },
      { 
        id: '8', 
        code: 'OTR-002', 
        name: 'Pan rallado · 500 g', 
        category: 'Otros', 
        unit: 'paquete', 
        description: 'Paquete de pan rallado de 500 gramos.', 
        active: true 
      }
    ];
    
    res.status(200).json(productosMock);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los productos", error });
  }
};