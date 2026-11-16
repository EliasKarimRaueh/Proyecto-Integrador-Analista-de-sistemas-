export const categories = ['Fresco', 'Congelado', 'Seco Almacen'] as const
export const units = ['kg', 'unidad'] as const
export const purchaseUnits = ['KILOS', 'UNIDADES', 'CAJONES', 'CAJAS', 'BOLSAS', 'BULTOS'] as const

export type Product = {
  id: string
  code: string
  name: string
  category: typeof categories[number]
  unit: typeof units[number]
  description: string
  active: boolean
  unidadCompra?: typeof purchaseUnits[number]
  factorConversion?: number
  costoActual?: string
  stockActual?: number
  stockMinimo?: number | null
  margenStock?: number | null
  tipoReposicion?: 'diario' | 'semanal' | 'stockMinimo'
  proveedorIds?: number[]
  proveedorHabitualId?: number | null
  imagenNombre?: string | null
  imagenMime?: string | null
  imagenBytes?: number | null
}

export type ProductDraft = Omit<Product, 'id' | 'active'> & { precioMinorista?: string; precioMayorista?: string | null; imagenBase64?: string | null }

export const emptyDraft: ProductDraft = {
  code: '',
  name: '',
  category: 'Fresco',
  unit: 'kg',
  description: '',
  unidadCompra: 'KILOS',
  factorConversion: 1,
  costoActual: '0',
  stockActual: 0,
  stockMinimo: null,
  margenStock: null,
  tipoReposicion: 'diario',
  proveedorIds: [],
  proveedorHabitualId: null,
}

export function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function validateProduct(draft: ProductDraft, products: Product[], editingId?: string) {
  const errors: Partial<Record<keyof ProductDraft, string>> = {}
  for (const key of ['costoActual', 'precioMinorista', 'precioMayorista'] as const) {
    const valor = draft[key]
    if (valor != null && (!/^\d+(\.\d{1,2})?$/.test(valor) || Number(valor) > 99999999.99)) errors[key] = 'Ingresá un importe de hasta dos decimales.'
  }
  if (draft.precioMayorista != null && (draft.precioMinorista === undefined || Number(draft.precioMayorista) > Number(draft.precioMinorista))) errors.precioMayorista = 'El mayorista no puede superar al minorista.'
  for (const key of ['stockActual', 'stockMinimo', 'margenStock'] as const) {
    const valor = draft[key]
    if (valor != null && (!Number.isFinite(valor) || valor < 0 || valor > 1000000 || Math.abs(valor * 1000 - Math.round(valor * 1000)) > 1e-6 || draft.unit === 'unidad' && !Number.isInteger(valor))) errors[key] = 'Ingresá una cantidad válida en la unidad de venta.'
  }
  if (draft.tipoReposicion === 'stockMinimo' && draft.stockMinimo == null) errors.stockMinimo = 'Indicá el stock mínimo.'
  if (draft.proveedorHabitualId != null && !draft.proveedorIds?.includes(draft.proveedorHabitualId)) errors.proveedorHabitualId = 'Elegí un proveedor relacionado.'
  if ((editingId || draft.code.trim()) && !/^[A-Z0-9-]{2,20}$/i.test(draft.code.trim())) errors.code = 'Usá entre 2 y 20 letras, números o guiones.'
  else if (draft.code.trim() && products.some(p => p.id !== editingId && normalize(p.code) === normalize(draft.code))) errors.code = 'Este código ya existe, incluso entre los productos inactivos.'
  if (draft.name.trim().length < 2 || draft.name.trim().length > 50) errors.name = 'Ingresá un nombre de entre 2 y 50 caracteres.'
  else if (products.some(p => p.id !== editingId && normalize(p.name) === normalize(draft.name))) errors.name = 'Ya existe un producto con ese nombre.'
  if (!categories.includes(draft.category)) errors.category = 'Seleccioná una categoría válida.'
  if (!units.includes(draft.unit)) errors.unit = 'Seleccioná una unidad válida.'
  if (draft.description.length > 300) errors.description = 'La descripción admite hasta 300 caracteres.'
  if (draft.unidadCompra !== undefined && !purchaseUnits.includes(draft.unidadCompra)) errors.unidadCompra = 'Seleccioná una unidad de compra válida.'
  if (draft.factorConversion !== undefined && (!Number.isFinite(draft.factorConversion) || draft.factorConversion <= 0 || draft.factorConversion > 1000000 || draft.unit === 'unidad' && !Number.isSafeInteger(draft.factorConversion))) errors.factorConversion = 'Ingresá un factor positivo; para venta por unidad debe ser entero.'
  if ((draft.unidadCompra === 'KILOS' || draft.unidadCompra === 'UNIDADES') && (draft.unidadCompra !== (draft.unit === 'kg' ? 'KILOS' : 'UNIDADES') || (draft.factorConversion ?? 1) !== 1)) errors.unidadCompra = 'La compra en kilos/unidades debe coincidir con la venta y usar factor 1. Elegí cajones o bultos para otra equivalencia.'
  return errors
}
