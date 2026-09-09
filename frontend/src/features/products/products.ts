export const categories = ['Pollo', 'Cortes', 'Milanesas', 'Otros'] as const
export const units = ['kg', 'unidad', 'paquete', 'docena'] as const
export type Product = {
  id: string
  code: string
  name: string
  category: typeof categories[number]
  unit: typeof units[number]
  description: string
  active: boolean
}
export type ProductDraft = Omit<Product, 'id' | 'active'>
export const emptyDraft: ProductDraft = { code: '', name: '', category: 'Pollo', unit: 'kg', description: '' }
export const demoProducts: Product[] = [
  { id: '1', code: 'POL-001', name: 'Pollo entero', category: 'Pollo', unit: 'kg', description: 'Pollo entero fresco, sin menudos.', active: true },
  { id: '2', code: 'COR-001', name: 'Pata y muslo', category: 'Cortes', unit: 'kg', description: 'Cuarto trasero de pollo fresco.', active: true },
  { id: '3', code: 'COR-002', name: 'Suprema', category: 'Cortes', unit: 'kg', description: 'Pechuga de pollo deshuesada.', active: true },
  { id: '4', code: 'MIL-001', name: 'Milanesas de pollo', category: 'Milanesas', unit: 'kg', description: 'Milanesas de suprema rebozadas.', active: true },
  { id: '5', code: 'COR-003', name: 'Alitas', category: 'Cortes', unit: 'kg', description: 'Alas de pollo frescas.', active: true },
  { id: '6', code: 'COR-004', name: 'Picada de pollo', category: 'Cortes', unit: 'kg', description: 'Carne de pollo picada.', active: false },
  { id: '7', code: 'OTR-001', name: 'Huevos', category: 'Otros', unit: 'docena', description: 'Huevos frescos por docena.', active: true },
  { id: '8', code: 'OTR-002', name: 'Pan rallado · 500 g', category: 'Otros', unit: 'paquete', description: 'Paquete de pan rallado de 500 gramos.', active: true },
]
export function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}
export function validateProduct(draft: ProductDraft, products: Product[], editingId?: string) {
  const errors: Partial<Record<keyof ProductDraft, string>> = {}
  if (!/^[A-Z0-9-]{2,20}$/i.test(draft.code.trim())) errors.code = 'Usá entre 2 y 20 letras, números o guiones.'
  else if (products.some(p => p.id !== editingId && normalize(p.code) === normalize(draft.code))) errors.code = 'Este código ya existe, incluso entre los productos inactivos.'
  if (draft.name.trim().length < 2 || draft.name.trim().length > 80) errors.name = 'Ingresá un nombre de entre 2 y 80 caracteres.'
  if (!categories.includes(draft.category)) errors.category = 'Seleccioná una categoría válida.'
  if (!units.includes(draft.unit)) errors.unit = 'Seleccioná una unidad válida.'
  if (draft.description.length > 300) errors.description = 'La descripción admite hasta 300 caracteres.'
  return errors
}
const storageKey = 'la-nena.products.v1'
export function loadProducts(): Product[] {
  const saved = localStorage.getItem(storageKey)
  if (saved === null) return demoProducts.map(p => ({ ...p }))
  const data: unknown = JSON.parse(saved)
  if (!Array.isArray(data) || !data.every((p: unknown) => {
    if (!p || typeof p !== 'object') return false
    const item = p as Product
    return typeof item.id === 'string' && typeof item.code === 'string' &&
      typeof item.name === 'string' && typeof item.description === 'string' &&
      typeof item.active === 'boolean' && categories.includes(item.category) && units.includes(item.unit)
  })) throw new Error('El catálogo guardado no tiene un formato válido.')
  return data as Product[]
}
export function saveProducts(products: Product[]) {
  localStorage.setItem(storageKey, JSON.stringify(products))
}

