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
    throw new Error(`Error en la API: ${response.status} ${response.statusText}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

