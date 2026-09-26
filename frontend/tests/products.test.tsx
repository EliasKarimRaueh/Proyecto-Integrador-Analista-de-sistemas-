import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProductsPage } from '../src/features/products/ProductsPage'
import type { Product } from '../src/features/products/products'
import type { Precio } from '../src/features/precios/precios'

HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }

const initialProducts: Product[] = [
  { id: '1', code: 'POL-001', name: 'Suprema', category: 'Fresco', unit: 'kg', description: 'Pollo fresco', active: true, imagen: null },
  { id: '2', code: 'CON-001', name: 'Patitas', category: 'Congelado', unit: 'unidad', description: '', active: true, imagen: null },
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

/**
 * El alta con foto va como FormData y sin foto como JSON, así que el mock tiene
 * que leer las dos formas. El archivo se reduce a `archivo:nombre` para poder
 * compararlo en las aserciones.
 */
function leerCampos(body: BodyInit | null | undefined): Record<string, string> {
  if (body instanceof FormData) {
    const campos: Record<string, string> = {}
    body.forEach((valor, clave) => {
      campos[clave] = valor instanceof File ? `archivo:${valor.name}` : String(valor)
    })
    return campos
  }
  return JSON.parse(String(body))
}

function pngValido(nombre = 'pollo.png') {
  // Solo importa la firma: la validación real la hace el backend mirando bytes.
  return new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])], nombre, { type: 'image/png' })
}

/** Responde como el backend: rutas de precios primero, luego productos. */
function responderComoLaApi(input: string | URL | Request, options?: RequestInit) {
  const path = String(input)
  const method = options?.method ?? 'GET'

  if (path.startsWith('/api/precios')) {
    return json(precios)
  }

  if (method === 'GET') return json(products)

  const id = path.split('/').at(-1)

  if (method === 'POST') {
    const { foto, ...datos } = leerCampos(options?.body)
    const created = {
      ...datos, id: '3', active: true,
      imagen: foto ? { url: '/api/productos/3/imagen', nombre: foto.replace('archivo:', ''), bytes: 11 } : null,
    } as unknown as Product
    products.push(created)
    return json(created, 201)
  }

  if (method === 'PUT') {
    const index = products.findIndex(product => product.id === id)
    const { foto, quitarFoto, ...datos } = leerCampos(options?.body)
    const imagen = foto
      ? { url: `/api/productos/${id}/imagen`, nombre: foto.replace('archivo:', ''), bytes: 11 }
      : quitarFoto ? null : products[index].imagen
    products[index] = { ...products[index], ...datos, imagen } as Product
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
  // jsdom no implementa createObjectURL, que es lo que usa la previsualización.
  URL.createObjectURL = vi.fn(() => 'blob:previsualizacion')
  URL.revokeObjectURL = vi.fn()
  products = initialProducts.map(product => ({ ...product }))
  precios = initialPrecios.map(precio => ({ ...precio }))
  fetchMock = vi.fn(responderComoLaApi)
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

    // La página carga productos y precios al abrir, así que la aserción
    // es que no hubo escrituras, no que hubo una sola llamada.
    const escritura = fetchMock.mock.calls.filter(([, options]) => (options as RequestInit | undefined)?.method)
    expect(escritura).toHaveLength(0)
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

describe('Fotos de producto', () => {
  it('sube la foto elegida junto con el alta y la muestra en el catálogo', async () => {
    const user = userEvent.setup()
    render(<ProductsPage />)
    await user.click(await screen.findByRole('button', { name: 'Nuevo producto' }))
    await user.type(screen.getByLabelText('Nombre del producto *'), 'Menudos')
    await user.type(screen.getByLabelText('Código *'), 'pol-010')
    await user.upload(screen.getByLabelText('Elegir foto'), pngValido('menudos.png'))

    // La previsualización aparece antes de guardar, sin pedir nada al servidor.
    expect(screen.getByAltText('Previsualización de la foto elegida')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Registrar producto' }))
    await screen.findByRole('button', { name: 'Menudos' })

    const llamada = fetchMock.mock.calls.find(([, opciones]) => opciones?.method === 'POST')
    const cuerpo = llamada?.[1]?.body as FormData
    expect(cuerpo).toBeInstanceOf(FormData)
    expect((cuerpo.get('foto') as File).name).toBe('menudos.png')
    expect(cuerpo.get('code')).toBe('POL-010')

    // En el catálogo la foto real toma el lugar de la letra de categoría.
    expect(screen.getByAltText('Menudos')).toBeTruthy()
  })

  it('libera la URL de la previsualización cuando se descarta la foto', async () => {
    const user = userEvent.setup()
    render(<ProductsPage />)
    await user.click(await screen.findByRole('button', { name: 'Nuevo producto' }))
    await user.upload(screen.getByLabelText('Elegir foto'), pngValido())
    expect(URL.createObjectURL).toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Quitar la elegida' }))
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:previsualizacion')
    expect(screen.queryByAltText('Previsualización de la foto elegida')).toBeNull()
  })

  it('no adjunta a la API un archivo que no es una foto', async () => {
    const user = userEvent.setup()
    render(<ProductsPage />)
    await user.click(await screen.findByRole('button', { name: 'Nuevo producto' }))
    await user.type(screen.getByLabelText('Nombre del producto *'), 'Menudos')
    await user.type(screen.getByLabelText('Código *'), 'pol-010')

    // Se usa fireEvent y no upload porque el selector de archivos respeta el
    // atributo accept y ni deja elegir un SVG. Esto simula el archivo que se
    // cuela igual, por ejemplo arrastrándolo o con otra extensión.
    const input = screen.getByLabelText('Elegir foto')
    fireEvent.change(input, { target: { files: [new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' })] } })
    expect((await screen.findByRole('alert')).textContent).toContain('JPG, PNG o WebP')

    // El input se vació, así que ya no queda foto pendiente: el producto se
    // guarda sin ella y la solicitud vuelve a ser JSON, sin archivo adjunto.
    await user.click(screen.getByRole('button', { name: 'Registrar producto' }))
    await screen.findByRole('button', { name: 'Menudos' })
    const llamada = fetchMock.mock.calls.find(([, o]) => o?.method === 'POST')
    expect(llamada?.[1]?.body).not.toBeInstanceOf(FormData)
  })

  it('rechaza una foto que supera el límite antes de subirla', async () => {
    const user = userEvent.setup()
    render(<ProductsPage />)
    await user.click(await screen.findByRole('button', { name: 'Nuevo producto' }))
    await user.type(screen.getByLabelText('Nombre del producto *'), 'Menudos')
    await user.type(screen.getByLabelText('Código *'), 'pol-010')

    const pesada = new File([new Uint8Array(3 * 1024 * 1024)], 'pesada.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText('Elegir foto'), pesada)
    expect((await screen.findByRole('alert')).textContent).toContain('supera el límite de 2MB')
  })

  it('quita la foto guardada al editar el producto', async () => {
    const user = userEvent.setup()
    products[0].imagen = { url: '/api/productos/1/imagen', nombre: 'suprema.png', bytes: 4096 }
    render(<ProductsPage />)
    await user.click(await screen.findByRole('button', { name: 'Editar Suprema' }))

    // El formulario muestra la foto que ya está guardada, además de la del
    // catálogo, así que la búsqueda va acotada al modal abierto.
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByAltText('Suprema')).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: 'Quitar la foto' }))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    const llamada = fetchMock.mock.calls.find(([, o]) => o?.method === 'PUT')
    const cuerpo = llamada?.[1]?.body as FormData
    expect(cuerpo.get('quitarFoto')).toBe('1')
    expect(cuerpo.get('foto')).toBeNull()
    await waitFor(() => expect(products[0].imagen).toBeNull())
  })

  it('muestra el nombre y el peso de la foto en el detalle', async () => {
    const user = userEvent.setup()
    products[0].imagen = { url: '/api/productos/1/imagen', nombre: 'suprema.png', bytes: 4096 }
    render(<ProductsPage />)
    await user.click(await screen.findByRole('button', { name: 'Ver Suprema' }))
    const detalle = screen.getByRole('dialog')
    expect(detalle.textContent).toContain('suprema.png')
    expect(detalle.textContent).toContain('4 KB')
  })

  it('vuelve a la letra de categoría si la imagen no se puede cargar', async () => {
    products[0].imagen = { url: '/api/productos/1/imagen', nombre: 'rota.png', bytes: 100 }
    render(<ProductsPage />)
    const imagen = await screen.findByAltText('Suprema')
    await waitFor(() => {
      imagen.dispatchEvent(new Event('error', { bubbles: false }))
    })
    await waitFor(() => expect(screen.queryByAltText('Suprema')).toBeNull())
    expect(screen.getByRole('button', { name: 'Suprema' })).toBeTruthy()
  })
})
