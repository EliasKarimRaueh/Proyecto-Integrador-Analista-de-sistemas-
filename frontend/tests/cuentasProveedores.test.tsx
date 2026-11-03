import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CuentaProveedorModal } from '../src/features/proveedores/CuentaProveedorModal'
import { ProductosProveedorModal } from '../src/features/proveedores/ProductosProveedorModal'
import type { Proveedor } from '../src/features/proveedores/proveedores'

HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
const proveedor: Proveedor = { id: 5, nombre: 'Sur', cuil: null, telefono: null, email: null, direccion: null, diasEntrega: [], descripcion: null, ctaCte: true, activo: true, fechaBaja: null }
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
let saldo: string, fetchMock: ReturnType<typeof vi.fn>
const onClose = vi.fn()
beforeEach(() => {
  saldo = '100.00'; onClose.mockReset()
  fetchMock = vi.fn((input, options?: RequestInit) => {
    const path = String(input), body = options?.body ? JSON.parse(String(options.body)) : {}
    if (path.includes('/cuenta?')) return json({ proveedor, saldo, credito: '0.00', cuentas: { rows: [{ id: 1, compraId: 10, importePendiente: saldo, estado: Number(saldo) === 0 ? 'PAGADO' : 'PAGO PENDIENTE', compra: { fechaHora: '2026-01-01T15:00:00Z', total: '100.00', numeroComprobante: 'A-001' } }], count: 1 }, pagos: { rows: [], count: 0 } })
    if (path.endsWith('/pagos')) { saldo = (Number(saldo) - Number(body.importe)).toFixed(2); return json({ pago: { id: 7, fechaHora: '2026-01-02T15:00:00Z', importe: body.importe }, aplicaciones: [{ cuentaId: 1, importeAplicado: body.importe }] }, 201) }
    if (path.endsWith('/comprobantes')) return json({ id: 11 }, 201)
    if (path === '/api/productos') return json([{ id: '1', name: 'Suprema', unit: 'kg', active: true }, { id: '2', name: 'Patitas', unit: 'unidad', active: true }])
    if (path.endsWith('/productos')) return json(options?.method === 'PUT' ? body.productoIds.map((productoId: number) => ({ productoId, activo: true })) : [{ productoId: 1, activo: true }])
    return json([])
  })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const post = (path: string) => fetchMock.mock.calls.filter(([url, o]) => String(url).endsWith(path) && o?.method === 'POST')
describe('Cuentas corrientes', () => {
  it('consulta comprobantes, confirma pago parcial y actualiza saldo y recibo', async () => {
    const user = userEvent.setup(); render(<CuentaProveedorModal proveedor={proveedor} onClose={onClose} />)
    await screen.findByText('A-001')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    await user.type(screen.getByLabelText('Importe'), '25,50')
    await user.click(screen.getByRole('button', { name: 'Revisar operación' }))
    expect(post('/pagos')).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Confirmar registro' }))
    await screen.findByText('Pago #7 registrado correctamente.')
    expect(JSON.parse(post('/pagos')[0][1].body).importe).toBe('25.50')
    expect(screen.getByText('Comprobante de pago #7')).toBeTruthy()
    await waitFor(() => expect(saldo).toBe('74.50'))
  })
  it('paga todo el saldo y bloquea nuevos pagos con deuda cero', async () => {
    const user = userEvent.setup(); render(<CuentaProveedorModal proveedor={proveedor} onClose={onClose} />)
    await user.click(await screen.findByRole('button', { name: 'Registrar pago' }))
    await user.click(screen.getByRole('button', { name: 'Pagar saldo total' }))
    await user.click(screen.getByRole('button', { name: 'Revisar operación' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar registro' }))
    await screen.findByText('Pago #7 registrado correctamente.')
    await waitFor(() => expect((screen.getByRole('button', { name: 'Registrar pago' }) as HTMLButtonElement).disabled).toBe(true))
  })
  it('rechaza sobrepago sin enviarlo al servidor', async () => {
    const user = userEvent.setup(); render(<CuentaProveedorModal proveedor={proveedor} onClose={onClose} />)
    await user.click(await screen.findByRole('button', { name: 'Registrar pago' }))
    await user.type(screen.getByLabelText('Importe'), '100,01')
    await user.click(screen.getByRole('button', { name: 'Revisar operación' }))
    expect((await screen.findByRole('alert')).textContent).toContain('superar la deuda')
    expect(post('/pagos')).toHaveLength(0)
  })
  it('reintenta con la misma clave después de perder la respuesta', async () => {
    const original = fetchMock.getMockImplementation()!
    let primera = true
    fetchMock.mockImplementation((input, options) => { if (String(input).endsWith('/pagos') && primera) { primera = false; throw new TypeError('Sin red') } return original(input, options) })
    const user = userEvent.setup(); render(<CuentaProveedorModal proveedor={proveedor} onClose={onClose} />)
    await user.click(await screen.findByRole('button', { name: 'Registrar pago' }))
    await user.type(screen.getByLabelText('Importe'), '10')
    await user.click(screen.getByRole('button', { name: 'Revisar operación' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar registro' }))
    await screen.findByText('No pudimos comprobar el resultado. Reintentá esta misma operación: no se registrará dos veces.')
    await user.click(screen.getByRole('button', { name: 'Reintentar operación' }))
    await screen.findByText('Pago #7 registrado correctamente.')
    const escrituras = post('/pagos').map(([, o]) => JSON.parse(o.body))
    expect(escrituras).toHaveLength(2); expect(escrituras[0]).toEqual(escrituras[1])
  })
  it('registra un comprobante con número, fecha e importe', async () => {
    const user = userEvent.setup(); render(<CuentaProveedorModal proveedor={proveedor} onClose={onClose} />)
    await user.click(await screen.findByRole('button', { name: 'Registrar comprobante' }))
    await user.type(screen.getByLabelText('Número de comprobante'), 'A-002')
    await user.type(screen.getByLabelText('Importe'), '55,25')
    await user.click(screen.getByRole('button', { name: 'Revisar operación' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar registro' }))
    await screen.findByText('Comprobante #11 registrado correctamente.')
    expect(JSON.parse(post('/comprobantes')[0][1].body)).toMatchObject({ numeroComprobante: 'A-002', total: '55.25' })
  })
  it('envía filtros de fechas y estado y permite limpiarlos', async () => {
    const user = userEvent.setup(); render(<CuentaProveedorModal proveedor={proveedor} onClose={onClose} />)
    await screen.findByText('A-001')
    await user.type(screen.getByLabelText('Desde'), '2026-01-01')
    await user.selectOptions(screen.getByLabelText('Estado del comprobante'), 'PAGADO')
    await waitFor(() => expect(fetchMock.mock.calls.some(([p]) => String(p).includes('estado=PAGADO'))).toBe(true))
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect((screen.getByLabelText('Desde') as HTMLInputElement).value).toBe('')
  })
})
describe('Productos por distribuidor', () => {
  it('carga asociaciones anteriores y guarda la selección completa', async () => {
    const user = userEvent.setup(); render(<ProductosProveedorModal proveedor={proveedor} onClose={onClose} />)
    const suprema = await screen.findByRole('checkbox', { name: /Suprema/ })
    expect((suprema as HTMLInputElement).checked).toBe(true)
    await user.click(suprema)
    await user.click(screen.getByRole('checkbox', { name: /Patitas/ }))
    await user.click(screen.getByRole('button', { name: 'Guardar asociaciones' }))
    await screen.findByText('Productos asociados correctamente.')
    const llamada = fetchMock.mock.calls.find(([, o]) => o?.method === 'PUT')!
    expect(JSON.parse(llamada[1].body)).toEqual({ productoIds: [2] })
  })
})
