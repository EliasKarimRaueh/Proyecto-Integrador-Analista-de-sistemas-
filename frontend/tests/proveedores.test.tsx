import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProveedoresPage } from '../src/features/proveedores/ProveedoresPage'
import { editarProveedor, validarProveedor, type Proveedor } from '../src/features/proveedores/proveedores'

HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
let proveedores: Proveedor[]
let fetchMock: ReturnType<typeof vi.fn>
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }) }
beforeEach(() => {
  proveedores = [
    { id: 1, nombre: 'Distribuidora Sur', cuil: '20123456789', telefono: '1145678900', email: 'sur@aves.com', direccion: 'San Martín 123', diasEntrega: ['Lunes'], descripcion: 'Aves', ctaCte: true, activo: true, fechaBaja: null },
    { id: 2, nombre: 'Avícola Norte', cuil: null, telefono: null, email: null, direccion: null, diasEntrega: [], descripcion: null, ctaCte: false, activo: false, fechaBaja: '2026-09-01' },
  ]
  fetchMock = vi.fn((input, options?: RequestInit) => {
    const path = String(input), method = options?.method ?? 'GET'
    if (method === 'GET') return json(proveedores)
    if (method === 'POST') {
      const p = { ...JSON.parse(String(options?.body)), id: 3, activo: true, fechaBaja: null }
      proveedores.push(p)
      return json(p, 201)
    }
    const id = Number(path.split('/')[3])
    const p = proveedores.find(item => item.id === id)!
    if (method === 'DELETE') { p.activo = false; p.fechaBaja = '2026-10-19' }
    else if (path.endsWith('/reactivar')) { p.activo = true; p.fechaBaja = null }
    else Object.assign(p, JSON.parse(String(options?.body)))
    return json(p)
  })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('Directorio de proveedores', () => {
  it('registra y edita datos completos, normalizando CUIT y teléfono', async () => {
    const user = userEvent.setup()
    render(<ProveedoresPage />)
    await user.click(await screen.findByRole('button', { name: 'Nuevo proveedor' }))
    await user.type(screen.getByLabelText('Razón social *'), 'Mayorista Centro')
    await user.type(screen.getByLabelText('CUIT'), '30-12345678-9')
    await user.type(screen.getByLabelText('Teléfono'), '11 5555-4444')
    await user.type(screen.getByLabelText('Dirección'), 'Belgrano 456')
    await user.click(screen.getByLabelText('Miércoles'))
    await user.click(screen.getByLabelText('Habilitar cuenta corriente'))
    await user.click(screen.getByRole('button', { name: 'Registrar proveedor' }))
    await screen.findByText('Proveedor registrado correctamente.')
    const post = fetchMock.mock.calls.find(([, options]) => options?.method === 'POST')!
    expect(JSON.parse(post[1].body)).toMatchObject({ cuil: '30123456789', telefono: '1155554444', direccion: 'Belgrano 456', diasEntrega: ['Miércoles'], ctaCte: true })
    await user.click(screen.getByRole('button', { name: 'Editar Mayorista Centro' }))
    expect((screen.getByLabelText('Dirección') as HTMLInputElement).value).toBe('Belgrano 456')
    await user.clear(screen.getByLabelText('Razón social *'))
    await user.type(screen.getByLabelText('Razón social *'), 'Centro actualizado')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await screen.findByRole('button', { name: 'Centro actualizado' })
    expect(fetchMock).toHaveBeenCalledWith('/api/proveedores/3', expect.objectContaining({ method: 'PUT' }))
  })

  it('filtra mientras se escribe, sin distinguir acentos, y combina estado y cuenta', async () => {
    const user = userEvent.setup()
    render(<ProveedoresPage />)
    await screen.findByRole('button', { name: 'Distribuidora Sur' })
    await user.type(screen.getByRole('textbox', { name: 'Buscar proveedores' }), 'san martin')
    expect(screen.queryByRole('button', { name: 'Avícola Norte' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Estado' }), 'inactivos')
    expect(screen.getByRole('button', { name: 'Avícola Norte' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Distribuidora Sur' })).toBeNull()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Cuenta corriente' }), 'si')
    expect(screen.getByText('No encontramos proveedores')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(screen.getByRole('button', { name: 'Distribuidora Sur' })).toBeTruthy()
  })

  it('consulta el detalle y confirma la baja y reactivación conservando los datos', async () => {
    const user = userEvent.setup()
    render(<ProveedoresPage />)
    await user.click(await screen.findByRole('button', { name: 'Ver Distribuidora Sur' }))
    expect(within(screen.getByRole('dialog')).getByText('San Martín 123')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Cerrar detalle' }))
    await user.click(screen.getByRole('button', { name: 'Dar de baja Distribuidora Sur' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar baja' }))
    await screen.findByText('Proveedor dado de baja correctamente.')
    await user.click(screen.getByRole('button', { name: 'Reactivar Distribuidora Sur' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar reactivación' }))
    await screen.findByText('Proveedor reactivado correctamente.')
    expect(proveedores[0]).toMatchObject({ activo: true, direccion: 'San Martín 123', diasEntrega: ['Lunes'] })
    expect(fetchMock).toHaveBeenCalledWith('/api/proveedores/1', expect.objectContaining({ method: 'DELETE' }))
    expect(fetchMock).toHaveBeenCalledWith('/api/proveedores/1/reactivar', expect.objectContaining({ method: 'PUT' }))
  })

  it('valida requeridos y datos duplicados antes de escribir', async () => {
    const user = userEvent.setup()
    render(<ProveedoresPage />)
    await user.click(await screen.findByRole('button', { name: 'Nuevo proveedor' }))
    await user.click(screen.getByRole('button', { name: 'Registrar proveedor' }))
    expect(screen.getByText('Ingresá una razón social de hasta 50 caracteres.')).toBeTruthy()
    await user.type(screen.getByLabelText('Razón social *'), 'Otro proveedor')
    await user.type(screen.getByLabelText('CUIT'), '20-12345678-9')
    await user.click(screen.getByRole('button', { name: 'Registrar proveedor' }))
    expect(screen.getByText('Este dato ya está registrado, incluso entre proveedores inactivos.')).toBeTruthy()
    expect(fetchMock.mock.calls.some(([, options]) => options?.method)).toBe(false)
  })

  it('mantiene el formulario y permite corregir un rechazo del servidor', async () => {
    const user = userEvent.setup()
    render(<ProveedoresPage />)
    await user.click(await screen.findByRole('button', { name: 'Editar Distribuidora Sur' }))
    fetchMock.mockResolvedValueOnce(json({ message: 'Conflicto de datos.' }, 409))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Conflicto de datos.')
    expect((screen.getByLabelText('Razón social *') as HTMLInputElement).value).toBe('Distribuidora Sur')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await screen.findByText('Proveedor actualizado correctamente.')
  })

  it('muestra error de carga y permite reintentar', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Sin conexión'))
    const user = userEvent.setup()
    render(<ProveedoresPage />)
    expect((await screen.findByRole('alert')).textContent).toContain('Sin conexión')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    await screen.findByRole('button', { name: 'Distribuidora Sur' })
  })

  it('bloquea el envío y el cierre mientras se guarda', async () => {
    const user = userEvent.setup()
    render(<ProveedoresPage />)
    await user.click(await screen.findByRole('button', { name: 'Editar Distribuidora Sur' }))
    let resolver!: (respuesta: Response) => void
    fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { resolver = resolve }))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect((screen.getByRole('button', { name: 'Guardando...' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Cerrar', exact: true }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement).disabled).toBe(true)
    resolver(json(proveedores[0]))
    await screen.findByText('Proveedor actualizado correctamente.')
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1)
  })

  it('informa el directorio vacío', async () => {
    proveedores = []
    render(<ProveedoresPage />)
    await screen.findByText('Todavía no hay proveedores')
  })

  it('valida formatos y permite mantener los datos del proveedor editado', () => {
    const draft = editarProveedor(proveedores[0])
    expect(validarProveedor(draft, proveedores, 1)).toEqual({})
    expect(validarProveedor({ ...draft, cuil: 'abc', telefono: '123', email: 'sin-email', direccion: 'a'.repeat(201), descripcion: 'a'.repeat(301) }, [])).toHaveProperty('cuil')
    const errores = validarProveedor({ ...draft, cuil: '', telefono: '123', email: 'sin-email', direccion: 'a'.repeat(201), descripcion: 'a'.repeat(301) }, [])
    expect(Object.keys(errores).sort()).toEqual(['descripcion', 'direccion', 'email', 'telefono'])
  })
})
