import type { Product, ProductDraft } from '../../features/products/products'

// Agregamos nuestra llamada usando el apiRequest que ya existe
export async function fetchProducts(): Promise<Product[]> {
  // apiRequest ya le agrega el "/" y la URL base automáticamente
  return apiRequest<Product[]>('productos')
}

/**
 * Con foto la solicitud tiene que ser multipart; sin foto sigue yendo como
 * JSON, que es lo que ya consumía la app. apiRequest solo assigns el
 * Content-Type cuando el body es un string, así que el FormData pasa intacto y
 * es el navegador quien pone el boundary.
 */
function productBody(
  product: ProductDraft,
  foto?: File | null,
  quitarFoto?: boolean,
): string | FormData {
  const campos: Record<string, string> = {
    code: product.code,
    name: product.name,
    category: product.category,
    unit: product.unit,
    description: product.description,
  }

  if (!foto && !quitarFoto) {
    return JSON.stringify(campos)
  }

  const form = new FormData()
  Object.entries(campos).forEach(([clave, valor]) => form.append(clave, valor))
  if (foto) form.append('foto', foto)
  if (quitarFoto) form.append('quitarFoto', '1')
  return form
}

export async function createProduct(
  product: ProductDraft,
  foto?: File | null,
): Promise<Product> {
  return apiRequest<Product>('productos', { method: 'POST', body: productBody(product, foto) })
}

export async function updateProduct(
  id: string,
  product: ProductDraft,
  foto?: File | null,
  quitarFoto?: boolean,
): Promise<Product> {
  return apiRequest<Product>(`productos/${id}`, {
    method: 'PUT',
    body: productBody(product, foto, quitarFoto),
  })
}

export async function deactivateProduct(id: string): Promise<Product> {
  return apiRequest<Product>(`productos/${id}`, { method: 'DELETE' })
}

const apiUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

/** Envía una solicitud a un endpoint que devuelve JSON. */
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${apiUrl}/${path.replace(/^\//, '')}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(payload?.message || `Error en la API: ${response.status} ${response.statusText}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

