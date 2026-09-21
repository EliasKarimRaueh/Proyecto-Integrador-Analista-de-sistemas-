import type { Product, ProductDraft } from '../../features/products/products'

// Agregamos nuestra llamada usando el apiRequest que ya existe
export async function fetchProducts(): Promise<Product[]> {
  // apiRequest ya le agrega el "/" y la URL base automáticamente
  return apiRequest<Product[]>('productos')
}

export async function createProduct(product: ProductDraft): Promise<Product> {
  return apiRequest<Product>('productos', { method: 'POST', body: JSON.stringify(product) })
}

export async function updateProduct(id: string, product: ProductDraft): Promise<Product> {
  return apiRequest<Product>(`productos/${id}`, { method: 'PUT', body: JSON.stringify(product) })
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

