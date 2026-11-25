import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SalesHistoryPage } from '../src/features/sales/SalesHistoryPage'

HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }

const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json', 'X-Total-Count': '1' } })
const venta = { id: 7, fechaHora: '2026-11-25T10:00:00Z', total: '5500.00' }
const detalles = [{ numeroItem: 1, productoId: 3, nombre: 'Pollo', cantidad: 5, importeUnitario: '1100.00', subtotal: '5500.00' }]
let usuarioNombre: string | null, fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  usuarioNombre = 'Ana Pérez'
  fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://localhost')
    if (url.pathname === '/api/ventas') return json({ rows: [{ venta, detalles, usuarioNombre }], count: 1 })
    if (url.pathname === '/api/ventas/7') return json({ venta, detalles, usuarioNombre })
    return json([])
  })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('muestra el nombre del operador dado de baja en el historial y en el comprobante', async () => {
  const user = userEvent.setup()
  render(<MemoryRouter><SalesHistoryPage /></MemoryRouter>)
  expect(await screen.findByText('Ana Pérez')).toBeTruthy()
  expect(screen.getByRole('columnheader', { name: 'Operador' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Ver detalle' }))
  expect(await screen.findByText('Atendido por: Ana Pérez')).toBeTruthy()
})

it('identifica las ventas anteriores al módulo como Usuario histórico', async () => {
  usuarioNombre = null
  render(<MemoryRouter><SalesHistoryPage /></MemoryRouter>)
  expect(await screen.findByText('Usuario histórico')).toBeTruthy()
})
