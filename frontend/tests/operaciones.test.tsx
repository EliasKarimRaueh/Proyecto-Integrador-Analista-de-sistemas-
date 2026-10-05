import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SalesPage } from '../src/features/sales/SalesPage'
import { StockPage } from '../src/features/stock/StockPage'
import { DespostePage } from '../src/features/stock/DespostePage'
import { SalesHistoryPage } from '../src/features/sales/SalesHistoryPage'
import { MovementsPage } from '../src/features/stock/MovementsPage'
import { cantidadInput, rangoDelDia } from '../src/shared/lib/operaciones'
import type { StockProducto } from '../src/shared/services/operaciones'

HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
let stock: StockProducto[]
let fetchMock: ReturnType<typeof vi.fn>
let failSale = false
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
function respuesta(path: string, options?: RequestInit) {
  const url = new URL(path, 'http://localhost'), method = options?.method ?? 'GET'
  const b = options?.body ? JSON.parse(String(options.body)) : undefined
  if (url.pathname === '/api/stock' && method === 'GET') return json(stock)
  if (url.pathname === '/api/productos') return json(stock.map(p => ({ id: String(p.id), name: p.nombre, code: p.codigo, unit: p.unidadVenta === 'KILOS' ? 'kg' : 'unidad', active: true, category: 'Fresco', description: '' })))
  if (url.pathname === '/api/ventas/productos') return json({ rows: stock.filter(p => `${p.nombre} ${p.codigo}`.toLowerCase().includes((url.searchParams.get('q') ?? '').toLowerCase())), count: stock.length })
  if (url.pathname === '/api/precios') return json(stock.map(p => ({ id: String(p.id), productoId: p.id, precioMinorista: '100.00', precioMayorista: '80.00', activo: true, vigente: true, fechaDesde: '2026-01-01', fechaHasta: null, fechaBaja: null })))
  if (url.pathname === '/api/ofertas') return json([{ id: '10', nombre: 'Combo del día', vigente: true, activo: true, descripcion: 'Pollo y suprema', fechaInicio: '2026-01-01', fechaFin: '2027-01-01', fechaBaja: null }])
  if (url.pathname === '/api/ventas/cotizacion' || (url.pathname === '/api/ventas' && method === 'POST')) {
    if (method === 'POST' && url.pathname === '/api/ventas' && failSale) return json({ message: 'Stock insuficiente para Pollo entero.' }, 409)
    const detalles = b.detalles.map((d: { productoId?: number; ofertaId?: number; cantidad: number; tipoPrecio: string }) => {
      const precio = d.ofertaId ? 300 : d.tipoPrecio === 'MAYORISTA' ? 80 : 100
      return { ...d, nombre: d.ofertaId ? 'Combo del día' : stock.find(p => p.id === d.productoId)!.nombre, importeUnitario: precio.toFixed(2), subtotal: (d.cantidad * precio).toFixed(2) }
    })
    const total = detalles.reduce((sum: number, d: { subtotal: string }) => sum + Number(d.subtotal), 0).toFixed(2)
    return json(url.pathname.includes('cotizacion') ? { total, detalles } : { venta: { id: 123, total, fechaHora: '2026-10-04T15:00:00Z' }, detalles }, url.pathname.includes('cotizacion') ? 200 : 201)
  }
  if (url.pathname === '/api/stock/movimientos' && method === 'POST') {
    const p = stock.find(p => p.id === b.productoId)!
    const inicial = p.stockActual
    p.stockActual = b.tipo === 'AJUSTE' ? b.stockObjetivo : p.stockActual + (b.tipo === 'INGRESO' ? b.cantMovimiento : -b.cantMovimiento)
    return json({ id: 1, productoId: p.id, cantInicial: inicial, cantFinal: p.stockActual, motivo: b.motivo }, 201)
  }
  if (url.pathname.endsWith('/reposicion')) return json({})
  if (url.pathname === '/api/stock/fraccionamientos') return json({ operacionId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', merma: b.merma, movimientos: [] }, 201)
  if (url.pathname === '/api/stock/movimientos') return json({ rows: [{ id: 1, productoId: 1, numeroMovimiento: 1, tipo: 'EGRESO', fechaHora: '2026-10-04T15:00:00Z', cantInicial: 20, cantMovimiento: 1.25, cantFinal: 18.75, motivo: null, ventaId: 123, usuarioId: 1 }], count: 1 })
  if (url.pathname.startsWith('/api/ventas')) {
    const row = { venta: { id: 123, total: '125.00', fechaHora: '2026-10-04T15:00:00Z' }, detalles: [{ nombre: 'Pollo entero', cantidad: 1.25, importeUnitario: '100', subtotal: '125' }] }
    return json(url.pathname === '/api/ventas' ? { rows: [row], count: 1 } : row)
  }
  return json({ message: `Ruta no contemplada: ${url.pathname}` }, 404)
}
beforeEach(() => {
  stock = [
    { id: 1, codigo: 'POL-001', nombre: 'Pollo entero', unidadVenta: 'KILOS', stockActual: 20, stockMinimo: 5, margenStock: 0, estado: 'Normal' },
    { id: 2, codigo: 'SUP-001', nombre: 'Suprema', unidadVenta: 'KILOS', stockActual: 2, stockMinimo: 5, margenStock: 0, estado: 'Crítico' },
    { id: 3, codigo: 'UNI-001', nombre: 'Hamburguesa', unidadVenta: 'UNIDADES', stockActual: 6, stockMinimo: 5, margenStock: 0, estado: 'Próximo al Mínimo' },
  ]
  failSale = false
  fetchMock = vi.fn((path, options) => Promise.resolve(respuesta(String(path), options)))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const mount = (component: React.ReactNode, url = '/') => render(<MemoryRouter initialEntries={[url]}>{component}</MemoryRouter>)
const calls = (path: string) => fetchMock.mock.calls.filter(([url, options]) => new URL(String(url), 'http://localhost').pathname === path && options?.method === 'POST')

describe('Caja integrada', () => {
  it('cotiza kilos y unidades, cambia de lista y confirma una sola venta', async () => {
    const user = userEvent.setup(); mount(<SalesPage/>)
    await user.click(await screen.findByRole('button', { name: /POL-001/ }))
    const qty = screen.getByLabelText('Cantidad de Pollo entero')
    await user.clear(qty); await user.type(qty, '1,25')
    await user.click(screen.getByRole('button', { name: /UNI-001/ }))
    await user.selectOptions(screen.getByLabelText('Lista de precios'), 'MAYORISTA')
    const confirmar = screen.getByRole('button', { name: 'Confirmar venta' })
    await waitFor(() => expect((confirmar as HTMLButtonElement).disabled).toBe(false))
    await user.click(confirmar)
    await user.click(screen.getByRole('button', { name: 'Registrar venta' }))
    expect(await screen.findByText('Venta #123 registrada. El stock ya está actualizado.')).toBeTruthy()
    expect(calls('/api/ventas')).toHaveLength(1)
    const payload = JSON.parse(calls('/api/ventas')[0][1].body)
    expect(payload.detalles).toEqual([{ productoId: 1, cantidad: 1.25, tipoPrecio: 'MAYORISTA' }, { productoId: 3, cantidad: 1, tipoPrecio: 'MAYORISTA' }])
  })
  it('una cantidad inválida invalida la cotización anterior y bloquea el cobro', async () => {
    const user = userEvent.setup(); mount(<SalesPage/>)
    await user.click(await screen.findByRole('button', { name: /UNI-001/ }))
    await waitFor(() => expect((screen.getByRole('button', { name: 'Confirmar venta' }) as HTMLButtonElement).disabled).toBe(false))
    const qty = screen.getByLabelText('Cantidad de Hamburguesa')
    await user.clear(qty); await user.type(qty, '1,5')
    expect(await screen.findByText('Los productos por unidad requieren cantidades enteras.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Confirmar venta' }) as HTMLButtonElement).disabled).toBe(true)
    expect(calls('/api/ventas')).toHaveLength(0)
  })
  it('conserva el carrito cuando el backend rechaza la venta', async () => {
    failSale = true
    const user = userEvent.setup(); mount(<SalesPage/>)
    await user.click(await screen.findByRole('button', { name: /POL-001/ }))
    const confirmar = screen.getByRole('button', { name: 'Confirmar venta' })
    await waitFor(() => expect((confirmar as HTMLButtonElement).disabled).toBe(false))
    await user.click(confirmar); await user.click(screen.getByRole('button', { name: 'Registrar venta' }))
    expect(await screen.findByText('Stock insuficiente para Pollo entero.')).toBeTruthy()
    expect(screen.getByLabelText('Cantidad de Pollo entero')).toBeTruthy()
    expect(screen.queryByText('Venta registrada')).toBeNull()
  })
  it('agrega ofertas vigentes y envía la referencia de oferta al backend', async () => {
    const user = userEvent.setup(); mount(<SalesPage/>)
    await user.click(screen.getByRole('button', { name: 'Ofertas vigentes' }))
    await user.click(await screen.findByRole('button', { name: /Combo del día/ }))
    await waitFor(() => expect(calls('/api/ventas/cotizacion').some(([, options]) => JSON.parse(options.body).detalles[0].ofertaId === 10)).toBe(true))
  })
  it('bloquea otro cobro si se pierde la respuesta y permite revisar el historial', async () => {
    fetchMock.mockImplementation((path, options) => {
      if (String(path) === '/api/ventas' && options?.method === 'POST') return Promise.reject(new TypeError('Failed to fetch'))
      return Promise.resolve(respuesta(String(path), options))
    })
    const user = userEvent.setup(); mount(<SalesPage/>)
    await user.click(await screen.findByRole('button', { name: /POL-001/ }))
    const confirmar = screen.getByRole('button', { name: 'Confirmar venta' })
    await waitFor(() => expect((confirmar as HTMLButtonElement).disabled).toBe(false))
    await user.click(confirmar); await user.click(screen.getByRole('button', { name: 'Registrar venta' }))
    expect(await screen.findByText('No se pudo comprobar si la venta quedó registrada. Revisá el historial antes de volver a cobrar.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Confirmar venta' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('link', { name: 'Revisar historial de ventas' })).toBeTruthy()
    expect(calls('/api/ventas')).toHaveLength(1)
  })
})
describe('Inventario y fraccionamiento', () => {
  it('filtra alertas y registra una merma justificada', async () => {
    const user = userEvent.setup(); mount(<StockPage/>)
    await screen.findByText('Pollo entero')
    await user.selectOptions(screen.getByLabelText('Estado'), 'Crítico')
    expect(screen.queryByText('Pollo entero')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Registrar movimiento' }))
    const dialog = screen.getByRole('dialog')
    await user.selectOptions(within(dialog).getByLabelText('Tipo de movimiento'), 'MERMA')
    await user.type(within(dialog).getByLabelText('Cantidad (kg)'), '0,5')
    await user.type(within(dialog).getByLabelText('Motivo obligatorio'), 'Recorte de preparación')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('Movimiento registrado y stock actualizado.')).toBeTruthy()
    expect(stock[1].stockActual).toBe(1.5)
    expect(JSON.parse(calls('/api/stock/movimientos')[0][1].body)).toMatchObject({ productoId: 2, tipo: 'MERMA', cantMovimiento: 0.5, motivo: 'Recorte de preparación' })
  })
  it('usa stockObjetivo para los ajustes y admite conteo cero', async () => {
    const user = userEvent.setup(); mount(<StockPage/>)
    await screen.findByText('Pollo entero')
    await user.click(screen.getAllByRole('button', { name: 'Registrar movimiento' })[0])
    await user.selectOptions(screen.getByLabelText('Tipo de movimiento'), 'AJUSTE')
    await user.type(screen.getByLabelText('Stock contado (kg)'), '0')
    await user.type(screen.getByLabelText('Motivo obligatorio'), 'Conteo físico')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await screen.findByText('Movimiento registrado y stock actualizado.')
    expect(JSON.parse(calls('/api/stock/movimientos')[0][1].body)).toMatchObject({ tipo: 'AJUSTE', stockObjetivo: 0 })
  })
  it('valida el balance antes de registrar desposte con merma', async () => {
    const user = userEvent.setup(); mount(<DespostePage/>)
    await user.selectOptions(await screen.findByLabelText('Producto'), '1')
    await user.type(screen.getByLabelText('Kilos a fraccionar'), '10')
    await user.selectOptions(screen.getByLabelText('Derivado 1'), '2')
    await user.type(screen.getByLabelText('Kilos del derivado 1'), '9')
    await user.type(screen.getByLabelText('Motivo obligatorio'), 'Desposte diario')
    await user.click(screen.getByRole('button', { name: 'Revisar y registrar' }))
    expect(await screen.findByText('Los kilos de origen deben coincidir con la suma de derivados y merma.')).toBeTruthy()
    expect(calls('/api/stock/fraccionamientos')).toHaveLength(0)
    await user.clear(screen.getByLabelText('Merma (kg)')); await user.type(screen.getByLabelText('Merma (kg)'), '1')
    await user.click(screen.getByRole('button', { name: 'Revisar y registrar' })); await user.click(screen.getByRole('button', { name: 'Confirmar desposte' }))
    expect(await screen.findByText('Desposte registrado y existencias actualizadas.')).toBeTruthy()
    expect(JSON.parse(calls('/api/stock/fraccionamientos')[0][1].body)).toEqual({ productoOrigenId: 1, cantidadOrigen: 10, derivados: [{ productoId: 2, cantidad: 9 }], merma: 1, motivo: 'Desposte diario' })
  })
})
describe('Auditoría', () => {
  it('abre un comprobante y filtra fechas con el día completo de Argentina', async () => {
    const user = userEvent.setup(); mount(<SalesHistoryPage/>)
    await user.click(await screen.findByRole('button', { name: 'Ver detalle' }))
    expect(await within(screen.getByRole('dialog')).findByText('Pollo entero')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Cerrar detalle' }))
    await user.type(screen.getByLabelText('Desde'), '2026-10-01')
    await user.type(screen.getByLabelText('Hasta'), '2026-10-04')
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('fechaHasta=2026-10-04T23%3A59%3A59.999-03%3A00'))).toBe(true))
  })
  it('muestra stock inicial y final y la venta asociada a un movimiento', async () => {
    const user = userEvent.setup(); mount(<MovementsPage/>, '/movimientos?ventaId=123')
    await user.click(await screen.findByRole('button', { name: 'Ver' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Stock inicial')).toBeTruthy()
    expect(within(dialog).getByText('18,75')).toBeTruthy()
    expect(within(dialog).getByRole('link', { name: 'Ver venta' }).getAttribute('href')).toBe('/ventas?ventaId=123')
  })
})
it('valida cantidades y rangos sin confundir comas, unidades y cero', () => {
  expect(cantidadInput('1,250')).toBe(1.25)
  expect(cantidadInput('0', 'KILOS', true)).toBe(0)
  for (const value of ['', '1,2,3', '-2', 'Infinity', 'NaN']) expect(() => cantidadInput(value)).toThrow()
  expect(() => cantidadInput('1,5', 'UNIDADES')).toThrow()
  expect(() => rangoDelDia('2026-10-04', '2026-10-01')).toThrow()
})
