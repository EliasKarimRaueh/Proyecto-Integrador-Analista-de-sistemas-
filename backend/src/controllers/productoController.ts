import { type Request, type Response } from 'express';
import { productoRepository, ValidationError } from 'polleria-database';

export const getProductos = async (req: Request, res: Response) => {
  try {
    const { rows } = await productoRepository.findAll(1, 100000, 'id', 'ASC');
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los productos", error });
  }
};

export const getProductoById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const producto = await productoRepository.findById(id);

    if (!producto) {
      res.status(404).json({ message: "Producto no encontrado" });
      return;
    }

    res.status(200).json(producto);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener el producto", error });
  }
};

export const createProducto = async (req: Request, res: Response) => {
  try {
    const data = req.body ?? {};

    const producto = await productoRepository.create(data);

    res.status(201).json(producto);
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ message: error.message, errors: error.errors });
      return;
    }

    res.status(500).json({ message: "Error al crear el producto", error });
  }
};

export const updateProducto = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const data = req.body ?? {};

    const producto = await productoRepository.updateById(id, data);

    if (!producto) {
      res.status(404).json({ message: "Producto no encontrado" });
      return;
    }

    res.status(200).json(producto);
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ message: error.message, errors: error.errors });
      return;
    }

    res.status(500).json({ message: "Error al actualizar el producto", error });
  }
};

export const deleteProducto = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const producto = await productoRepository.deleteById(id);

    if (!producto) {
      res.status(404).json({ message: "Producto no encontrado" });
      return;
    }

    res.status(200).json({ message: "Producto eliminado correctamente", producto });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar el producto", error });
  }
};