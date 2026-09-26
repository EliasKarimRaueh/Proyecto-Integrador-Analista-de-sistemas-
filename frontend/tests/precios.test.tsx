import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProductsPage } from '../src/features/products/ProductsPage'
import { PreciosProductoModal } from '../src/features/precios/PreciosProductoModal'
import type { Product } from '../src/features/products/products'
import type { Precio } from '../src/features/precios/precios'

HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }

const producto: Product = {
  id: '1',
  code: 'POL-001',
  name: 'Suprema',
  category: 'Fresco',
  unit: 'kg',
  description: 'Pollo fresco',
  active: true,
}

const vigente: Precio = {
  id: '10',
  productoId: 1,
  precioMinorista: '4500.50',
  precioMayorista: '3900.00',
  fechaDesde: '2026-09-01T00:00:00.000Z',
  fechaHasta: null,
  vigente: true,
  activo: true,
  fechaBaja: null,
}

const anterior: Precio = {
  id: '9',
  productoId: 1,
  precioMinorista: '4200.00',
  precioMayorista: null,
  fechaDesde: '2026-08-01T00:00:00.000Z',
  fechaHasta: '2026-09-01T00:00:00.000Z',
  vigente: false,
  activo: true,
  fechaBaja: null,
}

let precios: Precio[]
let fetchMock: ReturnType<typeof vi.fn>
/** Cuando está seteado, el POST responde 409 con ese mensaje. */
let conflictoPost: string | null = null

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  precios = [vigente, anterior].map(precio => ({ ...precio }))
  conflictoPost = null
  fetchMock = vi.fn(async (input: string | URL | Request, options?: RequestInit) => {
    const path = String(input)
    const method = options?.method ?? 'GET'

    // El catálogo pide los productos y los precios vigentes al abrir.
    if (path.startsWith('/api/productos')) {
      return json([producto])
    }
    if (path.startsWith('/api/precios/productos/')) {
      return json(precios)
    }
    if (path === '/api/precios' && method === 'GET') {
      return json(precios.filter(precio => precio.vigente))
    }
    if (path === '/api/precios' && method === 'POST') {
      if (conflictoPost !== null) {
        return json({ message: conflictoPost }, 409)
      }
      const creado = {
        ...(JSON.parse(String(options?.body)) as Omit<Precio, 'id' | 'vigente' | 'activo' | 'fechaBaja' | 'fechaHasta'>),
        id: '11',
        fechaHasta: null,
        vigente: true,
        activo: true,
        fechaBaja: null,
      } as Precio
      precios = [creado, ...precios]
      return json(creado, 201)
    }
    if (method === 'PUT') {
      const id = path.split('/').at(-1)
      const body = JSON.parse(String(options?.body)) as Partial<Precio>
      const encontrado = precios.find(precio => precio.id === id)
      if (!encontrado) return json({ message: 'Precio no encontrado.' }, 404)
      Object.assign(encontrado, body)
      return json(encontrado)
    }
    if (method === 'DELETE') {
      const id = path.split('/').at(-1)
      const encontrado = precios.find(precio => precio.id === id)
      if (!encontrado) return json({ message: 'Precio no encontrado.' }, 404)
      encontrado.activo = false
      return json(encontrado)
    }
    return json({ message: 'Método no soportado' }, 405)
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

function abrirModal() {
  render(<PreciosProductoModal producto={producto} onClose={() => {}} onGuardado={() => {}} />)
}

describe('Modal de precios del producto', () => {
  it('muestra el precio vigente y el historial', async () => {
    abrirModal()

    const dialogo = await screen.findByRole('dialog')
    expect(dialogo.textContent).toContain('4.500,50')
    expect(dialogo.textContent).toContain('3.900,00')
    expect(dialogo.textContent).toContain('Vigente')

    // El precio cerrado aparece con su fecha de fin.
    expect(dialogo.textContent).toContain('01/09/2026')
    expect(dialogo.textContent).toContain('01/08/2026')
  })

  it('avisa cuando el producto todavía no tiene precio', async () => {
    precios = []
    abrirModal()

    expect((await screen.findByRole('dialog')).textContent).toContain('Sin precio')
  })

  it('registra un precio nuevo con POST y avisa que cierra el anterior', async () => {
    const user = userEvent.setup()
    abrirModal()
    await screen.findByRole('button', { name: 'Programar cambio' })

    await user.click(screen.getByRole('button', { name: 'Programar cambio' }))
    await user.type(screen.getByLabelText('Precio minorista *'), '4800')
    await user.type(screen.getByLabelText('Precio mayorista'), '4200,50')
    await user.click(screen.getByRole('button', { name: 'Registrar precio' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/precios',
      expect.objectContaining({ method: 'POST' })
    ))

    const cuerpo = JSON.parse(fetchMock.mock.calls.find(([path]) => path === '/api/precios')![1].body)
    expect(cuerpo.precioMinorista).toBe('4800.00')
    expect(cuerpo.precioMayorista).toBe('4200.50')
    expect(cuerpo.productoId).toBe(1)

    expect(await screen.findByText(/El anterior quedó en el historial/)).toBeTruthy()
  })

  it('rechaza un precio mayorista más caro que el minorista sin llamar a la API', async () => {
    const user = userEvent.setup()
    abrirModal()
    await screen.findByRole('button', { name: 'Programar cambio' })

    const antes = fetchMock.mock.calls.length
    await user.click(screen.getByRole('button', { name: 'Programar cambio' }))
    await user.type(screen.getByLabelText('Precio minorista *'), '4000')
    await user.type(screen.getByLabelText('Precio mayorista'), '4500')
    await user.click(screen.getByRole('button', { name: 'Registrar precio' }))

    expect(screen.getByText('El precio mayorista no puede superar al minorista.')).toBeTruthy()
    expect(fetchMock.mock.calls.length).toBe(antes)
  })

  it('pide el precio minorista antes de enviar', async () => {
    const user = userEvent.setup()
    abrirModal()
    await screen.findByRole('button', { name: 'Programar cambio' })

    await user.click(screen.getByRole('button', { name: 'Programar cambio' }))
    await user.click(screen.getByRole('button', { name: 'Registrar precio' }))

    expect(screen.getByText('Ingresá el precio minorista.')).toBeTruthy()
  })

  it('acepta la coma decimal que escribe un usuario argentino', async () => {
    const user = userEvent.setup()
    abrirModal()
    await screen.findByRole('button', { name: 'Programar cambio' })

    await user.click(screen.getByRole('button', { name: 'Programar cambio' }))
    await user.type(screen.getByLabelText('Precio minorista *'), '1234,56')
    await user.click(screen.getByRole('button', { name: 'Registrar precio' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/precios',
      expect.objectContaining({ method: 'POST' })
    ))
    const cuerpo = JSON.parse(fetchMock.mock.calls.find(([path]) => path === '/api/precios')![1].body)
    expect(cuerpo.precioMinorista).toBe('1234.56')
  })
})

describe('Conflicto de vigencia con el precio vigente', () => {
  const mensajeConflicto = 'Este producto ya tiene un precio vigente desde el 2026-09-01. ' +
    'Usá "Corregir" para cambiar el importe de hoy, o registrá el precio nuevo con una fecha posterior.'

  it('muestra el 409 del servidor y conserva lo tipeado', async () => {
    const user = userEvent.setup()
    conflictoPost = mensajeConflicto
    abrirModal()
    await screen.findByRole('button', { name: 'Programar cambio' })

    await user.click(screen.getByRole('button', { name: 'Programar cambio' }))
    await user.type(screen.getByLabelText('Precio minorista *'), '4800')
    await user.click(screen.getByRole('button', { name: 'Registrar precio' }))

    expect(await screen.findByText(mensajeConflicto)).toBeTruthy()

    // El error no debe borrar lo que la persona ya escribía.
    const campo = screen.getByLabelText('Precio minorista *') as HTMLInputElement
    expect(campo.value).toBe('4800')
    // Sigue en el formulario, no volvió a la vista de solo lectura.
    expect(screen.getByRole('button', { name: 'Registrar precio' })).toBeTruthy()
  })

  it('con precio vigente, Corregir es la acción principal', async () => {
    abrirModal()

    const corregir = await screen.findByRole('button', { name: 'Corregir' })
    const programar = screen.getByRole('button', { name: 'Programar cambio' })

    expect(corregir.className).toContain('primary')
    expect(programar.className).not.toContain('primary')
  })

  it('sin precio vigente, el alta es la acción principal', async () => {
    precios = []
    abrirModal()

    const registrar = await screen.findByRole('button', { name: 'Registrar nuevo precio' })
    expect(registrar.className).toContain('primary')
    expect(screen.queryByRole('button', { name: 'Corregir' })).toBeNull()
  })

  it('no ofrece en el selector una fecha anterior a la del vigente', async () => {
    const user = userEvent.setup()
    // El vigente arranca hoy, así que el primer día válido es mañana.
    precios = [{ ...vigente, fechaDesde: new Date().toISOString() }]
    abrirModal()
    await screen.findByRole('button', { name: 'Programar cambio' })

    await user.click(screen.getByRole('button', { name: 'Programar cambio' }))

    // El label incluye el texto de ayuda, así que va por regex.
    const campo = screen.getByLabelText(/Vigente desde/) as HTMLInputElement
    const manana = new Date()
    manana.setDate(manana.getDate() + 1)
    const esperado = [
      manana.getFullYear(),
      String(manana.getMonth() + 1).padStart(2, '0'),
      String(manana.getDate()).padStart(2, '0'),
    ].join('-')

    expect(campo.min).toBe(esperado)
    expect(campo.value).toBe(esperado)
  })
})

describe('Columna de precios del catálogo', () => {
  it('abre el modal de precios desde la fila del producto', async () => {
    const user = userEvent.setup()
    render(<ProductsPage />)

    await user.click(await screen.findByRole('button', { name: 'Precios de Suprema' }))

    const dialogo = await screen.findByRole('dialog')
    expect(dialogo.textContent).toContain('4.500,50')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/precios/productos/1'),
      expect.anything()
    )
  })

  it('la celda sin precio ofrece el alta en el lugar donde ya se mira', async () => {
    const user = userEvent.setup()
    precios = []
    render(<ProductsPage />)

    const celda = await screen.findByRole('button', { name: /Sin precio/ })
    expect(celda.textContent).toContain('agregar')

    await user.click(celda)
    expect((await screen.findByRole('dialog')).textContent).toContain('Sin precio')
  })
})
