export const categories = ['Fresco', 'Congelado', 'Seco Almacen'] as const
export const units = ['kg', 'unidad'] as const

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

export const emptyDraft: ProductDraft = {
  code: '',
  name: '',
  category: 'Fresco',
  unit: 'kg',
  description: '',
}

export function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

export function validateProduct(draft: ProductDraft, products: Product[], editingId?: string) {
  const errors: Partial<Record<keyof ProductDraft, string>> = {}
  if (!/^[A-Z0-9-]{2,20}$/i.test(draft.code.trim())) errors.code = 'Usá entre 2 y 20 letras, números o guiones.'
  else if (products.some(p => p.id !== editingId && normalize(p.code) === normalize(draft.code))) errors.code = 'Este código ya existe, incluso entre los productos inactivos.'
  if (draft.name.trim().length < 2 || draft.name.trim().length > 50) errors.name = 'Ingresá un nombre de entre 2 y 50 caracteres.'
  if (!categories.includes(draft.category)) errors.category = 'Seleccioná una categoría válida.'
  if (!units.includes(draft.unit)) errors.unit = 'Seleccioná una unidad válida.'
  if (draft.description.length > 300) errors.description = 'La descripción admite hasta 300 caracteres.'
  return errors
}
