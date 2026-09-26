import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OfertasPage } from '../src/features/ofertas/OfertasPage'
import type { Oferta, OfertaConProductos } from '../src/features/ofertas/ofertas'
import type { Product } from '../src/features/products/products'
import { hoyComoFechaInput } from '../src/shared/lib/money'

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

const vigente: Oferta = {
  id: '1',
  nombre: 'Fin de semana',
  descripcion: 'Promo del sábado',
  fechaInicio: '2026-09-01T00:00:00.000Z',
  fechaFin: '2026-09-30T00:00:00.000Z',
  vigente: true,
  activo: true,
  fechaBaja: null,
}

const programada: Oferta = {
  id: '2',
  nombre: 'Primavera',
  descripcion: null,
  fechaInicio: '2099-01-01T00:00:00.000Z',
  fechaFin: '2099-01-31T00:00:00.000Z',
  vigente: false,
  activo: true,
  fechaBaja: null,
}

const vencida: Oferta = {
  id: '3',
  nombre: 'Otoño 2025',
  descripcion: null,
  fechaInicio: '2025-09-01T00:00:00.000Z',
  fechaFin: '2025-09-30T00:00:00.000Z',
  vigente: false,
  activo: true,
  fechaBaja: null,
}

function detalleDe(oferta: Oferta): OfertaConProductos {
  return {
    ...oferta,
    productos: [
      {
        productoId: 1,
        codigo: 'POL-001',
        nombre: 'Suprema',
        unidadVenta: 'kg',
        stockActual: 40,
        precioOferta: '3900.00',
        activo: true,
      },
    ],
  }
}

let ofertas: Oferta[]
let fetchMock: ReturnType<typeof vi.fn>

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  ofertas = [vigente, programada, vencida].map(oferta => ({ ...oferta }))
  fetchMock = vi.fn(async (input: string | URL | Request, options?: RequestInit) => {
    const path = String(input)
    const method = options?.method ?? 'GET'
    const id = path.split('/').at(-1)

    // El selector de productos del formulario usa el catálogo.
    if (path.startsWith('/api/productos')) {
      return json([producto])
    }

    if (method === 'DELETE') {
      const objetivo = ofertas.find(oferta => oferta.id === id)
      if (!objetivo) return json({ message: 'Oferta no encontrada.' }, 404)
      objetivo.activo = false
      objetivo.fechaBaja = new Date().toISOString()
      return json(objetivo)
    }

    if (method === 'PUT' || method === 'PATCH') {
      const oferta = ofertas.find(item => item.id === id)
      if (!oferta) return json({ message: 'Oferta no encontrada.' }, 404)
      Object.assign(oferta, JSON.parse(String(options?.body)))
      return json(oferta)
    }

    if (method === 'POST') {
      const body = JSON.parse(String(options?.body)) as Oferta
      const creada = { ...body, id: String(ofertas.length + 1), vigente: true, activo: true, fechaBaja: null }
      ofertas.push(creada)
      return json(creada, 201)
    }

    // El detalle cuelga de /api/ofertas/:id y no devuelve un array.
    if (path !== '/api/ofertas' && !path.startsWith('/api/ofertas?')) {
      const oferta = ofertas.find(item => item.id === id)
      if (oferta) return json(detalleDe(oferta))
    }

    return json(ofertas)
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('Listado de ofertas', () => {
  it('muestra las ofertas con su estado calculado en el frontend', async () => {
    render(<OfertasPage />)
    await screen.findByRole('button', { name: 'Fin de semana' })

    expect(screen.getByRole('button', { name: 'Primavera' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Otoño 2025' })).toBeTruthy()

    const fila = screen.getByRole('button', { name: 'Fin de semana' }).closest('tr')!
    expect(fila.textContent).toContain('Vigente')
    expect(fila.textContent).toContain('30/09/2026')
  })

  it('filtra por estado y por nombre', async () => {
    const user = userEvent.setup()
    render(<OfertasPage />)
    await screen.findByRole('button', { name: 'Fin de semana' })

    await user.type(screen.getByRole('textbox', { name: 'Buscar por nombre de la oferta' }), 'primavera')
    expect(screen.getByRole('button', { name: 'Primavera' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Fin de semana' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }))
    await user.selectOptions(screen.getByRole('combobox'), 'vigente')
    expect(screen.getByRole('button', { name: 'Fin de semana' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Primavera' })).toBeNull()
  })

  it('da de baja una oferta con DELETE', async () => {
    const user = userEvent.setup()
    render(<OfertasPage />)
    await screen.findByRole('button', { name: 'Fin de semana' })

    await user.click(screen.getByRole('button', { name: 'Dar de baja Fin de semana' }))
    await user.click(await screen.findByRole('button', { name: /Confirmar/i }))

    await waitFor(() => expect(ofertas.find(oferta => oferta.id === '1')?.activo).toBe(false))
    expect(fetchMock).toHaveBeenCalledWith('/api/ofertas/1', expect.objectContaining({ method: 'DELETE' }))
  })

  it('avisa cuando todavía no hay ofertas', async () => {
    ofertas = []
    render(<OfertasPage />)
    expect(await screen.findByText('Todavía no hay ofertas')).toBeTruthy()
  })
})

describe('Alta de oferta', () => {
  it('crea la oferta con sus productos y precios', async () => {
    const user = userEvent.setup()
    render(<OfertasPage />)
    await user.click(await screen.findByRole('button', { name: 'Nueva oferta' }))

    await user.type(screen.getByLabelText('Nombre de la oferta *'), 'Finde largo')
    await user.type(screen.getByLabelText(/^Descripción/), 'Tres dias de promo')

    // El selector viene del catálogo, no de una llamada propia.
    await waitFor(() => expect(fetchMock.mock.calls.some(([path]) => String(path).startsWith('/api/productos'))).toBe(true))
    await user.click(await screen.findByRole('button', { name: 'Agregar Suprema' }))
    await user.type(screen.getByLabelText('Precio de oferta para Suprema'), '3800,50')
    await user.click(screen.getByRole('button', { name: 'Registrar oferta' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/ofertas',
      expect.objectContaining({ method: 'POST' })
    ))

    const cuerpo = JSON.parse(fetchMock.mock.calls.find(([path, o]) => String(path) === '/api/ofertas' && (o as RequestInit).method === 'POST')![1].body)
    expect(cuerpo.nombre).toBe('Finde largo')
    expect(cuerpo.descripcion).toBe('Tres dias de promo')
    expect(cuerpo.fechaInicio).toBe(hoyComoFechaInput())
    expect(cuerpo.productos).toEqual([{ productoId: 1, precioOferta: '3800.50' }])
  })

  it('no deja guardar sin productos ni con precio inválido', async () => {
    const user = userEvent.setup()
    render(<OfertasPage />)
    await user.click(await screen.findByRole('button', { name: 'Nueva oferta' }))

    await user.type(screen.getByLabelText('Nombre de la oferta *'), 'Sin productos')
    await user.click(screen.getByRole('button', { name: 'Registrar oferta' }))
    expect(screen.getByText('Agregá al menos un producto a la oferta.')).toBeTruthy()

    await user.click(await screen.findByRole('button', { name: 'Agregar Suprema' }))
    await user.type(screen.getByLabelText('Precio de oferta para Suprema'), 'abc')
    await user.click(screen.getByRole('button', { name: 'Registrar oferta' }))
    expect(screen.getByText('Ingresá el precio de oferta con hasta 2 decimales, usando coma o punto.')).toBeTruthy()

    const escrituras = fetchMock.mock.calls.filter(([, o]) => (o as RequestInit | undefined)?.method)
    expect(escrituras).toHaveLength(0)
  })

  it('deja quitar un producto agregado', async () => {
    const user = userEvent.setup()
    render(<OfertasPage />)
    await user.click(await screen.findByRole('button', { name: 'Nueva oferta' }))

    await user.click(await screen.findByRole('button', { name: 'Agregar Suprema' }))
    expect(screen.queryByText('Todavía no agregaste productos.')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Quitar Suprema' }))
    expect(screen.getByText('Todavía no agregaste productos.')).toBeTruthy()
  })
})

describe('Edición y detalle', () => {
  it('carga la oferta y guarda los cambios con PUT', async () => {
    const user = userEvent.setup()
    render(<OfertasPage />)
    await user.click(await screen.findByRole('button', { name: 'Editar Primavera' }))

    const nombre = await screen.findByLabelText('Nombre de la oferta *')
    await waitFor(() => expect((nombre as HTMLInputElement).value).toBe('Primavera'))

    await user.clear(nombre)
    await user.type(nombre, 'Primavera 2027')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/ofertas/2',
      expect.objectContaining({ method: 'PUT' })
    ))
    expect(ofertas.find(oferta => oferta.id === '2')?.nombre).toBe('Primavera 2027')
  })

  it('muestra el detalle con los precios de oferta y avisa al cambiar uno', async () => {
    const user = userEvent.setup()
    render(<OfertasPage />)
    await user.click(await screen.findByRole('button', { name: 'Ver Fin de semana' }))

    const dialogo = await screen.findByRole('dialog')
    expect(dialogo.textContent).toContain('Promo del sábado')
    expect(dialogo.textContent).toContain('Vigente')

    const input = screen.getByLabelText('Precio de Suprema')
    expect((input as HTMLInputElement).value).toBe('3900,00')
    await user.clear(input)
    await user.type(input, '3800')
    await user.click(screen.getByRole('button', { name: 'Guardar precio de Suprema' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/ofertas/1/productos/1',
      expect.objectContaining({ method: 'PUT' })
    ))
    const cuerpoPrecio = JSON.parse(fetchMock.mock.calls.filter(([p, o]) => String(p) === '/api/ofertas/1/productos/1' && (o as RequestInit).method === 'PUT').at(-1)![1].body)
    expect(cuerpoPrecio).toEqual({ precioOferta: '3800.00' })
    expect(await screen.findByText('Precio de oferta actualizado.')).toBeTruthy()
  })

  it('quita un producto del detalle luego de confirmar', async () => {
    const user = userEvent.setup()
    render(<OfertasPage />)
    await user.click(await screen.findByRole('button', { name: 'Ver Fin de semana' }))

    await user.click(await screen.findByRole('button', { name: 'Quitar Suprema de la oferta' }))
    await user.click(await screen.findByRole('button', { name: 'Confirmar' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/ofertas/1/productos/1',
      expect.objectContaining({ method: 'DELETE' })
    ))
    expect(await screen.findByText('Producto quitado de la oferta.')).toBeTruthy()
  })
})
