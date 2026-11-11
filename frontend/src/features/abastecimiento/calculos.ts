import type { Product } from '../products/products'

export function estadoTexto(estado: string) {
  return ({ REALIZADO: 'Realizado', CANCELADO: 'Cancelado', RECIBIDO: 'Recibido', PENDIENTE_RECEPCION: 'Pendiente de recepción', RECIBIDA: 'Recibida' } as Record<string, string>)[estado] ?? estado
}
export const fechaTexto = (fecha: string) => new Date(fecha).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'short', timeStyle: 'short' })

export type LineaEditor = { productoId: string; cantidad: string; costo: string; unidad: 'COMPRA' | 'VENTA' }
export const numeroInput = (valor: string) => Number(valor.replace(',', '.'))
export function datosLinea(linea: LineaEditor, productos: Product[]) {
  const producto = productos.find(p => p.id === linea.productoId)
  const cantidad = numeroInput(linea.cantidad), costo = numeroInput(linea.costo)
  const factor = linea.unidad === 'COMPRA' ? producto?.factorConversion ?? 1 : 1
  const cantidadBase = Number((cantidad * factor).toFixed(3))
  const costoBase = Number((costo / factor).toFixed(2))
  const subtotal = Math.round(cantidadBase * Math.round(costoBase * 100)) / 100
  return { producto, cantidad, costo, factor, cantidadBase, costoBase, subtotal }
}
export function validarLineas(lineas: LineaEditor[], productos: Product[]) {
  if (!lineas.length || lineas.length > 100) throw new Error('Agregá entre 1 y 100 productos.')
  if (new Set(lineas.map(l => l.productoId)).size !== lineas.length) throw new Error('No repitas productos.')
  return lineas.map(linea => {
    const d = datosLinea(linea, productos)
    if (!d.producto?.active) throw new Error('Seleccioná productos activos.')
    if (!linea.cantidad.trim() || !Number.isFinite(d.cantidadBase) || d.cantidadBase <= 0 || !Number.isFinite(d.factor) || d.factor <= 0) throw new Error('Ingresá cantidades positivas.')
    if (d.producto.unit === 'unidad' && !Number.isSafeInteger(d.cantidadBase)) throw new Error('Las existencias por unidad deben ser enteras.')
    if (!linea.costo.trim() || !Number.isFinite(d.costoBase) || d.costoBase < 0 || !/^\d+([.,]\d{1,2})?$/.test(linea.costo)) throw new Error('Ingresá costos válidos de hasta dos decimales.')
    return { productoId: Number(linea.productoId), cantidad: d.cantidadBase, costoUnitario: d.costoBase.toFixed(2), costoEstimado: d.costoBase.toFixed(2), ...(linea.unidad === 'COMPRA' ? { presentacion: d.producto.unidadCompra, cantidadPresentacion: d.cantidad, factorConversion: d.factor } : {}) }
  })
}
