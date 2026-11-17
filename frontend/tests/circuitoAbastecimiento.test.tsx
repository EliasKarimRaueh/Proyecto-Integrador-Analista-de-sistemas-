import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { HistorialAbastecimientoPage } from '../src/features/abastecimiento/HistorialAbastecimientoPage'
import { ReposicionPage } from '../src/features/abastecimiento/ReposicionPage'
import { FormularioAbastecimiento } from '../src/features/abastecimiento/FormularioAbastecimiento'
import { CompraRecepcionModal } from '../src/features/abastecimiento/CompraRecepcionModal'

HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'X-Total-Count': '1' } })
const productos = [{ id: '1', code: 'M-1', name: 'Medallón', unit: 'unidad', category: 'Congelado', active: true, description: '', costoActual: '10.00', unidadCompra: 'CAJAS', factorConversion: 10 }, { id: '2', code: 'P-2', name: 'Extra', unit: 'unidad', category: 'Congelado', active: true, description: '', costoActual: '50.00', unidadCompra: 'UNIDADES', factorConversion: 1 }]
let proveedor: any, pedido: any, recepcion: any, fetchMock: ReturnType<typeof vi.fn>
const productoDetalle = (id: number) => ({ id, nombre: productos[id - 1].name, unidadVenta: 'UNIDADES', unidadCompra: productos[id - 1].unidadCompra, factorConversion: productos[id - 1].factorConversion, costoActual: productos[id - 1].costoActual })
beforeEach(() => {
  proveedor = { id: 5, nombre: 'Proveedor Sur', activo: true, ctaCte: false }
  pedido = { id: 42, proveedorId: 5, proveedor, fechaHora: '2026-11-16T10:00:00Z', estado: 'REALIZADO', totalEstimado: '1000', recepcion: null, detalles: [{ productoId: 1, cantidad: 100, costoEstimado: '10.00', subtotal: '1000', producto: productoDetalle(1) }] }
  recepcion = { id: 7, pedidoId: 42, proveedorId: 5, proveedor, fechaHora: '2026-11-16T11:00:00Z', conformidad: 'CON_DIFERENCIAS', compra: null, detalles: [{ productoId: 1, cantidadBase: 110, cantidadPresentacion: 110, factorConversion: 1, presentacion: 'UNIDAD', cantidadSobranteBase: 10, producto: productoDetalle(1) }] }
  fetchMock = vi.fn((input, options?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost'), method = options?.method ?? 'GET', body = options?.body ? JSON.parse(String(options.body)) : {}
    if (url.pathname === '/api/productos') return json(productos)
    if (url.pathname === '/api/proveedores') return json([proveedor])
    if (url.pathname === '/api/proveedores/5/productos') return json([{ productoId: 1, activo: true }, { productoId: 2, activo: true }])
    if (url.pathname === '/api/pedidos/42') return json(pedido)
    if (url.pathname === '/api/recepciones/7') return json(recepcion)
    if (url.pathname === '/api/compras/8') return json({ compra: { id: 8, proveedorId: 5, fechaHora: recepcion.fechaHora, estado: 'RECIBIDA', recepcion: { id: 7 }, pedidoId: 42, detalles: [], total: '2200' }, cuenta: null })
    if (url.pathname === '/api/recepciones' && method === 'POST') {
      pedido.estado = 'RECIBIDO'; pedido.recepcion = { id: 7 }
      recepcion.detalles = body.detalles.map((d: any) => ({ ...d, cantidadBase: d.cantidadPresentacion * d.factorConversion, producto: productoDetalle(d.productoId) }))
      return json({ recepcion, conformidad: 'CON_DIFERENCIAS' }, 201)
    }
    if (url.pathname === '/api/compras' && method === 'POST') { recepcion.compra = { id: 8 }; return json({ compra: { id: 8 } }, 201) }
    if (url.pathname === '/api/pedidos' && method === 'POST') return json({ pedido: { id: 43 } }, 201)
    if (url.pathname === '/api/pedidos') return json([pedido])
    if (url.pathname === '/api/recepciones') return json([recepcion])
    if (url.pathname === '/api/compras/reposicion') return json(url.searchParams.get('incluirNormales') === 'true' ? [{ id: 2, nombre: 'Extra', codigo: 'P-2', estado: 'Normal', unidadVenta: 'UNIDADES', unidadCompra: 'UNIDADES', factorConversion: 1, stockActual: 20, stockMinimo: 2, cantidadSugerida: 0, faltante: 0, proveedores: [] }] : [])
    return json([])
  })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('incluye los productos normales solo al activar la opción', async () => {
  const user = userEvent.setup(); render(<MemoryRouter><ReposicionPage/></MemoryRouter>)
  const opcion = screen.getByLabelText('Incluir productos con stock normal') as HTMLInputElement
  expect(opcion.checked).toBe(false)
  expect(screen.queryByText('Extra')).toBeNull()
  await user.click(opcion)
  expect(await screen.findByText('Extra')).toBeTruthy()
})
it('calcula el costo del pedido desde el producto y omite la fecha en la solicitud', async () => {
  const user = userEvent.setup(), guardado = vi.fn()
  render(<FormularioAbastecimiento modo="pedido" proveedores={[proveedor]} inicio={{ proveedorId: 5, lineas: [{ productoId: '1', cantidad: '2', unidad: 'COMPRA', costo: '9999' }] }} onClose={() => {}} onGuardado={guardado}/>)
  await screen.findByRole('option', { name: 'Medallón' })
  expect(screen.queryByLabelText('Fecha')).toBeNull()
  expect(screen.queryByLabelText('Costo producto 1')).toBeNull()
  expect(screen.getAllByText(/200,00/).length).toBeGreaterThan(0)
  await user.click(screen.getByRole('button', { name: 'Registrar pedido' }))
  await vi.waitFor(() => expect(guardado).toHaveBeenCalledWith(43))
  const llamada = fetchMock.mock.calls.find(([url, o]) => String(url).endsWith('/pedidos') && o?.method === 'POST')!
  expect(JSON.parse(String(llamada[1]?.body))).not.toHaveProperty('fechaHora')
})
it('recibe desde el pedido, acepta sobrantes y extras, y propone registrar la compra', async () => {
  const user = userEvent.setup(); render(<MemoryRouter><HistorialAbastecimientoPage tipo="pedidos"/></MemoryRouter>)
  await user.click(await screen.findByRole('button', { name: 'Registrar recepción' }))
  const aceptada = await screen.findByLabelText('Cantidad aceptada producto 1')
  await user.clear(aceptada); await user.type(aceptada, '110')
  expect(screen.getByText(/Sobrante: 10/)).toBeTruthy()
  await user.selectOptions(screen.getByLabelText('Producto adicional recibido'), '2')
  await user.click(screen.getByRole('button', { name: 'Agregar producto recibido' }))
  const extra = screen.getByLabelText('Cantidad aceptada producto 2')
  await user.clear(extra); await user.type(extra, '120')
  expect(screen.getByText(/Sobrante: 120/)).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Confirmar recepción e ingresar stock' }))
  await user.click(await screen.findByRole('button', { name: 'Registrar compra ahora' }))
  const pago = await screen.findByLabelText('Forma de pago') as HTMLSelectElement
  expect(pago.value).toBe('PAGADO'); expect(pago.disabled).toBe(true)
  expect(screen.queryByLabelText('Fecha')).toBeNull()
  expect(screen.queryByLabelText('Cantidad producto 1')).toBeNull()
  const costo = screen.getByLabelText('Costo producto 1')
  await user.clear(costo); await user.type(costo, '2200')
  expect(screen.getByText(/Costo por unidad:.*20,00/)).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Registrar compra' }))
  await screen.findByText('Compra #8 registrada correctamente.')
  const recibida = fetchMock.mock.calls.find(([url, o]) => String(url).endsWith('/recepciones') && o?.method === 'POST')!
  expect(JSON.parse(String(recibida[1]?.body))).toMatchObject({ pedidoId: 42 })
  expect(JSON.parse(String(recibida[1]?.body))).not.toHaveProperty('compraId')
  const comprada = fetchMock.mock.calls.find(([url, o]) => String(url).endsWith('/compras') && o?.method === 'POST')!
  expect(JSON.parse(String(comprada[1]?.body))).toMatchObject({ recepcionId: 7, formaPago: 'PAGADO', tipoComprobante: null, numeroComprobante: null, detalles: [{ productoId: 1, costo: '2200.00' }, { productoId: 2, costo: '6000.00' }] })
  expect(JSON.parse(String(comprada[1]?.body))).not.toHaveProperty('fechaHora')
})
it('rechaza costos iguales o menores a cero al registrar la compra', async () => {
  const user = userEvent.setup(); render(<CompraRecepcionModal recepcionId={7} onClose={() => {}} onGuardado={() => {}}/>)
  const costo = await screen.findByLabelText('Costo producto 1')
  await user.clear(costo); await user.type(costo, '0')
  await user.click(screen.getByRole('button', { name: 'Registrar compra' }))
  expect(await screen.findByText('Ingresá un costo total mayor a cero para cada producto.')).toBeTruthy()
  expect(fetchMock.mock.calls.some(([url, o]) => String(url).endsWith('/compras') && o?.method === 'POST')).toBe(false)
})
it('permite pagar en el momento una compra de un proveedor con cuenta corriente', async () => {
  proveedor.ctaCte = true
  const user = userEvent.setup(); render(<CompraRecepcionModal recepcionId={7} onClose={() => {}} onGuardado={() => {}}/>)
  const pago = await screen.findByLabelText('Forma de pago') as HTMLSelectElement
  expect(pago.value).toBe('A CUENTA'); expect(pago.disabled).toBe(false)
  await user.selectOptions(pago, 'PAGADO'); expect(pago.value).toBe('PAGADO')
})
it('abre pedidos y compras asociados desde el detalle de la recepción', async () => {
  recepcion.compra = { id: 8 }
  const user = userEvent.setup(); render(<MemoryRouter><HistorialAbastecimientoPage tipo="recepciones"/></MemoryRouter>)
  await user.click(await screen.findByRole('button', { name: 'Ver detalle' }))
  await user.click(await screen.findByRole('button', { name: 'Ver pedido #42' }))
  expect(await screen.findByRole('dialog', { name: /Pedidos a proveedores.*#42/ })).toBeTruthy()
  const pedidoModal = screen.getByRole('dialog', { name: /Pedidos a proveedores.*#42/ })
  await user.click(within(pedidoModal).getAllByRole('button', { name: 'Cerrar' })[0])
  await user.click(screen.getByRole('button', { name: 'Ver compra #8' }))
  expect(await screen.findByRole('dialog', { name: /Compras.*#8/ })).toBeTruthy()
})
