import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProductsPage } from '../src/features/products/ProductsPage'
import type { Product } from '../src/features/products/products'

HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }

const initialProducts: Product[] = [
  { id: '1', code: 'POL-001', name: 'Suprema', category: 'Fresco', unit: 'kg', description: 'Pollo fresco', active: true },
  { id: '2', code: 'CON-001', name: 'Patitas', category: 'Congelado', unit: 'unidad', description: '', active: true },
]

let products: Product[]
let fetchMock: ReturnType<typeof vi.fn>

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  products = initialProducts.map(product => ({ ...product }))
  fetchMock = vi.fn(async (input: string | URL | Request, options?: RequestInit) => {
    const path = String(input)
    const method = options?.method ?? 'GET'
    if (method === 'GET') return json(products)
    const id = path.split('/').at(-1)
    if (method === 'POST') {
      const created = { ...(JSON.parse(String(options?.body))), id: '3', active: true } as Product
      products.push(created)
      return json(created, 201)
    }
    if (method === 'PUT') {
      const index = products.findIndex(product => product.id === id)
      products[index] = { ...products[index], ...JSON.parse(String(options?.body)) }
      return json(products[index])
    }
    if (method === 'DELETE') {
      const index = products.findIndex(product => product.id === id)
      products[index] = { ...products[index], active: false }
      return json(products[index])
    }
    return json({ message: 'Método no soportado' }, 405)
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('Catálogo de productos conectado a la API', () => {
  it('registra, edita y da de baja mediante POST, PUT y DELETE', async () => {
    const user = userEvent.setup()
    render(<ProductsPage />)
    await screen.findByRole('button', { name: 'Nuevo producto' })

    await user.click(screen.getByRole('button', { name: 'Nuevo producto' }))
    await user.type(screen.getByLabelText('Nombre del producto *'), 'Menudos')
    await user.type(screen.getByLabelText('Código *'), 'pol-010')
    await user.click(screen.getByRole('button', { name: 'Registrar producto' }))
    await screen.findByRole('button', { name: 'Menudos' })
    expect(fetchMock).toHaveBeenCalledWith('/api/productos', expect.objectContaining({ method: 'POST' }))

    await user.click(screen.getByRole('button', { name: 'Editar Menudos' }))
    await user.clear(screen.getByLabelText('Nombre del producto *'))
    await user.type(screen.getByLabelText('Nombre del producto *'), 'Menudos frescos')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await screen.findByRole('button', { name: 'Menudos frescos' })
    expect(fetchMock).toHaveBeenCalledWith('/api/productos/3', expect.objectContaining({ method: 'PUT' }))

    await user.click(screen.getByRole('button', { name: 'Dar de baja Menudos frescos' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar baja' }))
    await waitFor(() => expect(products.find(product => product.id === '3')?.active).toBe(false))
    expect(fetchMock).toHaveBeenCalledWith('/api/productos/3', expect.objectContaining({ method: 'DELETE' }))
  })

  it('filtra los productos obtenidos del servidor', async () => {
    const user = userEvent.setup()
    render(<ProductsPage />)
    await screen.findByRole('button', { name: 'Suprema' })
    await user.type(screen.getByRole('textbox', { name: 'Buscar por nombre o código' }), 'patitas')
    expect(screen.getByRole('button', { name: 'Patitas' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Suprema' })).toBeNull()
  })

  it('valida el formulario antes de llamar a la API', async () => {
    const user = userEvent.setup()
    render(<ProductsPage />)
    await user.click(await screen.findByRole('button', { name: 'Nuevo producto' }))
    await user.click(screen.getByRole('button', { name: 'Registrar producto' }))
    expect(screen.getByText('Ingresá un nombre de entre 2 y 50 caracteres.')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('mantiene abierto el formulario cuando la API rechaza el cambio', async () => {
    fetchMock.mockImplementationOnce(async () => json(initialProducts))
      .mockImplementationOnce(async () => json({ message: 'Ya existe un producto con ese código.' }, 409))
    const user = userEvent.setup()
    render(<ProductsPage />)
    await user.click(await screen.findByRole('button', { name: 'Editar Suprema' }))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Ya existe un producto con ese código.')
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})
