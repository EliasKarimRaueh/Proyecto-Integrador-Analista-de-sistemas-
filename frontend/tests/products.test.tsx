import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProductsPage } from '../src/features/products/ProductsPage'
import type { Product } from '../src/features/products/products'
import type { Precio } from '../src/features/precios/precios'

HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }

const initialProducts: Product[] = [
  { id: '1', code: 'POL-001', name: 'Suprema', category: 'Fresco', unit: 'kg', description: 'Pollo fresco', active: true },
  { id: '2', code: 'CON-001', name: 'Patitas', category: 'Congelado', unit: 'unidad', description: '', active: true },
]

// productoId va como número aunque el id del producto sea texto: el
// frontend tiene que convertir antes de indexar por producto.
const initialPrecios: Precio[] = [
  { id: '10', productoId: 1, precioMinorista: '4500.50', precioMayorista: '3900.00', fechaDesde: '2026-09-20T00:00:00.000Z', fechaHasta: null, vigente: true, activo: true, fechaBaja: null },
]

let products: Product[]
let precios: Precio[]
let fetchMock: ReturnType<typeof vi.fn>

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

/** Responde como el backend: rutas de precios primero, luego productos. */
function responderComoLaApi(input: string | URL | Request, options?: RequestInit) {
  const path = String(input)
  const method = options?.method ?? 'GET'
  if (path === '/api/proveedores') return json([{ id: 1, nombre: 'Proveedor A', activo: true }, { id: 2, nombre: 'Proveedor B', activo: true }])

  if (path.startsWith('/api/precios')) {
    return json(precios)
  }

  if (method === 'GET') return json(products)

  if (method === 'PUT' && path.endsWith('/reactivar')) {
    const product = products.find(p => p.id === path.split('/').at(-2))!
    product.active = true
    return json(product)
  }

  const id = path.split('/').at(-1)

  if (method === 'POST') {
    const created = { ...(JSON.parse(String(options?.body))), id: '3', code: 'PRO-AUTO3', active: true } as Product
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
}

beforeEach(() => {
  products = initialProducts.map(product => ({ ...product }))
  precios = initialPrecios.map(precio => ({ ...precio }))
  fetchMock = vi.fn(responderComoLaApi)
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('Catálogo de productos conectado a la API', () => {
  it('registra precios, stock y proveedores, y limita el habitual a los relacionados', async () => {
    const user = userEvent.setup()
    render(<ProductsPage />)
    await user.click(await screen.findByRole('button', { name: 'Nuevo producto' }))
    await user.type(screen.getByLabelText('Nombre del producto *'), 'Alitas')
    await user.clear(screen.getByLabelText('Precio de compra (por kg)'))
    await user.type(screen.getByLabelText('Precio de compra (por kg)'), '1500')
    await user.type(screen.getByLabelText('Precio de venta minorista (por kg)'), '2500')
    await user.type(screen.getByLabelText('Precio de venta mayorista (opcional) (por kg)'), '2200')
    await user.click(screen.getByRole('button', { name: 'Ver más' }))
    const habitual = screen.getByLabelText('Proveedor habitual')
    expect(habitual.querySelectorAll('option')).toHaveLength(1)
    await user.click(screen.getByLabelText('Proveedor A'))
    expect(habitual.querySelectorAll('option')).toHaveLength(2)
    await user.selectOptions(habitual, '1')
    await user.clear(screen.getByLabelText('Stock actual (kg)'))
    await user.type(screen.getByLabelText('Stock actual (kg)'), '12.5')
    await user.click(screen.getByRole('button', { name: 'Registrar producto' }))
    await screen.findByRole('button', { name: 'Alitas' })
    const llamada = fetchMock.mock.calls.find(([, opciones]) => opciones?.method === 'POST')!
    expect(JSON.parse(String(llamada[1]?.body))).toMatchObject({ costoActual: '1500', precioMinorista: '2500', precioMayorista: '2200', stockActual: 12.5, proveedorIds: [1], proveedorHabitualId: 1 })
  })

  it('no permite adjuntar imágenes ni en alta, edición o detalle', async () => {
    const user = userEvent.setup()
    render(<ProductsPage />)
    await user.click(await screen.findByRole('button', { name: 'Nuevo producto' }))
    await user.click(screen.getByRole('button', { name: 'Ver más' }))
    expect(screen.queryByLabelText('Imagen del producto')).toBeNull()
    expect(screen.queryByText(/PNG, JPEG o WebP/)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    await user.click(screen.getByRole('button', { name: 'Editar Suprema' }))
    await user.click(screen.getByRole('button', { name: 'Ver más' }))
    expect(screen.queryByLabelText('Imagen del producto')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    await user.click(screen.getByRole('button', { name: 'Ver Suprema' }))
    expect(screen.queryByText('Imagen')).toBeNull()
  })

  it('precarga los precios y limpia el habitual al quitar su relación', async () => {
    products[0] = { ...products[0], costoActual: '1500', proveedorIds: [1], proveedorHabitualId: 1 }
    const user = userEvent.setup()
    render(<ProductsPage />)
    await user.click(await screen.findByRole('button', { name: 'Editar Suprema' }))
    expect((screen.getByLabelText('Precio de venta minorista (por kg)') as HTMLInputElement).value).toBe('4500.50')
    await user.click(screen.getByRole('button', { name: 'Ver más' }))
    await user.click(screen.getByLabelText('Proveedor A'))
    expect((screen.getByLabelText('Proveedor habitual') as HTMLSelectElement).value).toBe('')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await screen.findByText('Producto actualizado correctamente.')
    expect(products[0].proveedorIds).toEqual([])
    expect(products[0].proveedorHabitualId).toBeNull()
  })
  it('oculta el código también al editar y conserva su valor interno', async () => {
    const user = userEvent.setup()
    render(<ProductsPage />)
    await screen.findByRole('button', { name: 'Suprema' })
    expect(screen.queryByRole('columnheader', { name: 'Código' })).toBeNull()
    expect(screen.queryByText('POL-001')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Ver Suprema' }))
    expect(screen.queryByText('POL-001')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Editar producto' }))
    expect(screen.queryByLabelText('Código *')).toBeNull()
    expect(screen.queryByText('POL-001')).toBeNull()
  })

  it('reactiva un producto inactivo usando el endpoint existente', async () => {
    products[0].active = false
    const user = userEvent.setup()
    render(<ProductsPage />)
    await user.click(await screen.findByRole('button', { name: 'Reactivar Suprema' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar reactivación' }))
    await screen.findByText('Producto reactivado correctamente.')
    expect(fetchMock).toHaveBeenCalledWith('/api/productos/1/reactivar', expect.objectContaining({ method: 'PUT' }))
    expect(screen.getByRole('button', { name: 'Dar de baja Suprema' })).toBeTruthy()
  })

  it('conserva el estado inactivo si falla la reactivación', async () => {
    products[0].active = false
    fetchMock.mockImplementation((input, options) => String(input).endsWith('/reactivar') ? json({ message: 'No se pudo reactivar.' }, 500) : responderComoLaApi(input, options))
    const user = userEvent.setup()
    render(<ProductsPage />)
    await user.click(await screen.findByRole('button', { name: 'Reactivar Suprema' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar reactivación' }))
    expect((await screen.findByRole('alert')).textContent).toContain('No se pudo reactivar.')
    expect(products[0].active).toBe(false)
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
  it('registra, edita y da de baja mediante POST, PUT y DELETE', async () => {
    const user = userEvent.setup()
    render(<ProductsPage />)
    await screen.findByRole('button', { name: 'Nuevo producto' })

    await user.click(screen.getByRole('button', { name: 'Nuevo producto' }))
    await user.type(screen.getByLabelText('Nombre del producto *'), 'Menudos')
    expect(screen.queryByLabelText('Código *')).toBeNull()
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
    await user.type(screen.getByRole('textbox', { name: 'Buscar por nombre' }), 'patitas')
    expect(screen.getByRole('button', { name: 'Patitas' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Suprema' })).toBeNull()
  })

  it('valida el formulario antes de llamar a la API', async () => {
    const user = userEvent.setup()
    render(<ProductsPage />)
    await user.click(await screen.findByRole('button', { name: 'Nuevo producto' }))
    await user.click(screen.getByRole('button', { name: 'Registrar producto' }))
    expect(screen.getByText('Ingresá un nombre de entre 2 y 50 caracteres.')).toBeTruthy()

    // La página carga productos y precios al abrir, así que la aserción
    // es que no hubo escrituras, no que hubo una sola llamada.
    const escritura = fetchMock.mock.calls.filter(([, options]) => (options as RequestInit | undefined)?.method)
    expect(escritura).toHaveLength(0)
  })

  it('bloquea el alta cuando el nombre ya existe en el catálogo', async () => {
    const user = userEvent.setup()
    render(<ProductsPage />)
    await user.click(await screen.findByRole('button', { name: 'Nuevo producto' }))
    await user.type(screen.getByLabelText('Nombre del producto *'), 'Suprema')
    await user.click(screen.getByRole('button', { name: 'Registrar producto' }))

    expect(screen.getByText('Ya existe un producto con ese nombre.')).toBeTruthy()
    const escritura = fetchMock.mock.calls.filter(([, options]) => (options as RequestInit | undefined)?.method)
    expect(escritura).toHaveLength(0)
  })

  it('bloquea la edición cuando el nombre ya lo usa otro producto', async () => {
    const user = userEvent.setup()
    render(<ProductsPage />)
    await screen.findByRole('button', { name: 'Suprema' })
    await user.click(screen.getByRole('button', { name: 'Editar Patitas' }))
    await user.clear(screen.getByLabelText('Nombre del producto *'))
    await user.type(screen.getByLabelText('Nombre del producto *'), 'Suprema')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(screen.getByText('Ya existe un producto con ese nombre.')).toBeTruthy()
    expect(screen.getByRole('dialog')).toBeTruthy()
    const escriturasPut = fetchMock.mock.calls.filter(([, options]) => (options as RequestInit | undefined)?.method === 'PUT')
    expect(escriturasPut).toHaveLength(0)
  })

  it('mantiene abierto el formulario cuando la API rechaza el cambio', async () => {
    fetchMock.mockImplementation((input, options) => {
      if (String(input).startsWith('/api/precios')) return json(precios)
      if ((options?.method ?? 'GET') === 'PUT') {
        return json({ message: 'Ya existe un producto con ese código.' }, 409)
      }
      return json(products)
    })

    const user = userEvent.setup()
    render(<ProductsPage />)
    await user.click(await screen.findByRole('button', { name: 'Editar Suprema' }))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Ya existe un producto con ese código.')
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('muestra el precio vigente de cada producto', async () => {
    render(<ProductsPage />)
    await screen.findByRole('button', { name: 'Suprema' })

    const fila = screen.getByRole('button', { name: 'Suprema' }).closest('tr')!
    expect(fila.textContent).toContain('4.500,50')
    expect(fila.textContent).toContain('3.900,00')

    // El producto sin precio lo dice explícitamente.
    const sinPrecio = screen.getByRole('button', { name: 'Patitas' }).closest('tr')!
    expect(sinPrecio.textContent).toContain('Sin precio')
  })

  it('pide los precios de todos los productos en una sola llamada', async () => {
    render(<ProductsPage />)
    await screen.findByRole('button', { name: 'Suprema' })

    const llamadasPrecios = fetchMock.mock.calls.filter(([input]) => String(input).startsWith('/api/precios'))
    expect(llamadasPrecios).toHaveLength(1)
  })
})
