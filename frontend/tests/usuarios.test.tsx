import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UsuariosPage } from '../src/features/usuarios/UsuariosPage'
import { guardarTokenEnMemoria } from '../src/shared/services/api'
import type { Usuario } from '../src/features/auth/types'

HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }

const ana: Usuario = { id: 1, nombre: 'Ana', apellido: 'Pérez', email: 'ana@avixsoft.com', rol: 'PROPIETARIO', activo: true }
const juan: Usuario = { id: 2, nombre: 'Juan', apellido: 'López', email: 'juan@avixsoft.com', rol: 'EMPLEADO', activo: true }
const maria: Usuario = { id: 3, nombre: 'María', apellido: 'Gómez', email: 'maria@avixsoft.com', rol: 'EMPLEADO', activo: false }

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

let fetchMock: ReturnType<typeof vi.fn>
let usuarios: Usuario[]

beforeEach(() => {
  usuarios = [{ ...ana }, { ...juan }, { ...maria }]
  guardarTokenEnMemoria(null)
  fetchMock = vi.fn((input: string | URL | Request, options?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost')
    const method = options?.method ?? 'GET'
    const body = options?.body ? JSON.parse(String(options.body)) as Record<string, unknown> : {}
    const matcher = url.pathname.match(/^\/api\/usuarios\/(\d+)(?:\/(reactivar))?$/)

    if (url.pathname === '/api/usuarios' && method === 'GET') {
      const q = (url.searchParams.get('q') ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      const rol = url.searchParams.get('rol')
      const activo = url.searchParams.get('activo')
      return json(usuarios.filter(usuario => {
        const texto = `${usuario.nombre} ${usuario.apellido} ${usuario.email}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        if (q && !texto.includes(q)) return false
        if (rol && usuario.rol !== rol) return false
        if (activo === 'true' && !usuario.activo) return false
        if (activo === 'false' && usuario.activo) return false
        return true
      }))
    }
    if (url.pathname === '/api/usuarios' && method === 'POST') {
      const creado = { ...body, id: usuarios.length + 1, activo: true } as Usuario
      usuarios.push(creado)
      return json(creado, 201)
    }
    if (matcher) {
      const usuario = usuarios.find(item => item.id === Number(matcher[1]))
      if (!usuario) return json({ message: 'Usuario no encontrado' }, 404)
      if (method === 'DELETE') {
        usuario.activo = false
        return json(usuario)
      }
      if (method === 'PUT' && matcher[2] === 'reactivar') {
        usuario.activo = true
        return json(usuario)
      }
      if (method === 'PUT') {
        Object.assign(usuario, body)
        return json(usuario)
      }
      return json(usuario)
    }
    return json([])
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  guardarTokenEnMemoria(null)
})

it('filtra por nombre/email, rol y estado en tiempo real', async () => {
  const user = userEvent.setup()
  render(<UsuariosPage />)
  expect(await screen.findByText('Ana Pérez')).toBeTruthy()
  expect(screen.getByText('Juan López')).toBeTruthy()

  await user.type(screen.getByLabelText('Buscar por nombre o email'), 'juan')
  expect(await screen.findByText('Juan López')).toBeTruthy()
  await waitFor(() => expect(screen.queryByText('Ana Pérez')).toBeNull())
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('q=juan'))).toBe(true))

  await user.clear(screen.getByLabelText('Buscar por nombre o email'))
  await user.selectOptions(screen.getByLabelText('Filtrar por rol'), 'EMPLEADO')
  expect(await screen.findByText('María Gómez')).toBeTruthy()
  await waitFor(() => expect(screen.queryByText('Ana Pérez')).toBeNull())
  expect(screen.getByText('Juan López')).toBeTruthy()

  await user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'false')
  await waitFor(() => expect(screen.queryByText('Juan López')).toBeNull())
  expect(await screen.findByText('María Gómez')).toBeTruthy()
})

it('informa cuando la búsqueda no da resultados', async () => {
  const user = userEvent.setup()
  render(<UsuariosPage />)
  await screen.findByText('Ana Pérez')
  await user.type(screen.getByLabelText('Buscar por nombre o email'), 'nadie')
  expect(await screen.findByText('No encontramos usuarios')).toBeTruthy()
  expect(await screen.findByText(/Probá con otro nombre/)).toBeTruthy()
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('q=nadie'))).toBe(true))
})

it('da de alta un usuario sin enviar ni pedir hashes', async () => {
  const user = userEvent.setup()
  render(<UsuariosPage />)
  await screen.findByText('Ana Pérez')
  await user.click(screen.getByRole('button', { name: /Nuevo usuario/ }))
  await user.type(await screen.findByLabelText('Nombre *'), 'Carla')
  await user.type(screen.getByLabelText('Apellido *'), 'Ruiz')
  await user.type(screen.getByLabelText('Email *'), 'carla@avixsoft.com')
  await user.type(screen.getByLabelText('Contraseña *'), 'secreto123')
  await user.click(screen.getByRole('button', { name: 'Registrar usuario' }))

  expect(await screen.findByText('Usuario creado correctamente.')).toBeTruthy()
  const alta = fetchMock.mock.calls.find(([url, options]) => String(url) === '/api/usuarios' && options?.method === 'POST')!
  const cuerpo = JSON.parse(String(alta[1].body)) as Record<string, unknown>
  expect(cuerpo).toMatchObject({ nombre: 'Carla', apellido: 'Ruiz', email: 'carla@avixsoft.com', rol: 'EMPLEADO', password: 'secreto123' })
  expect(cuerpo).not.toHaveProperty('passwordHash')
  expect(screen.queryByText(/passwordHash/i)).toBeNull()
})

it('edita un usuario dejando la contraseña vacía para conservarla', async () => {
  const user = userEvent.setup()
  render(<UsuariosPage />)
  await screen.findByText('Juan López')
  await user.click(screen.getByRole('button', { name: 'Editar Juan López' }))
  const password = await screen.findByLabelText('Nueva contraseña (dejar vacío para conservar)')
  expect((password as HTMLInputElement).value).toBe('')
  const email = screen.getByLabelText('Email *')
  await user.clear(email)
  await user.type(email, 'juan.nuevo@avixsoft.com')
  await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

  expect(await screen.findByText('Usuario actualizado correctamente.')).toBeTruthy()
  const edicion = fetchMock.mock.calls.find(([url, options]) => String(url) === '/api/usuarios/2' && options?.method === 'PUT')!
  const cuerpo = JSON.parse(String(edicion[1].body)) as Record<string, unknown>
  expect(cuerpo.email).toBe('juan.nuevo@avixsoft.com')
  expect(cuerpo).not.toHaveProperty('password')
})

it('pide confirmación explícita antes de dar de baja', async () => {
  const user = userEvent.setup()
  render(<UsuariosPage />)
  await screen.findByText('Juan López')
  await user.click(screen.getByRole('button', { name: 'Dar de baja Juan López' }))
  const dialog = await screen.findByRole('dialog', { name: 'Dar de baja usuario' })
  expect(within(dialog).getByText(/¿Querés dar de baja/)).toBeTruthy()
  await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
  expect(fetchMock.mock.calls.some(([url, options]) => String(url) === '/api/usuarios/2' && options?.method === 'DELETE')).toBe(false)

  await user.click(screen.getByRole('button', { name: 'Dar de baja Juan López' }))
  await user.click(within(await screen.findByRole('dialog', { name: 'Dar de baja usuario' })).getByRole('button', { name: 'Confirmar baja' }))
  await waitFor(() => expect(fetchMock.mock.calls.some(([url, options]) => String(url) === '/api/usuarios/2' && options?.method === 'DELETE')).toBe(true))
  expect(await screen.findByText(/dado de baja correctamente/)).toBeTruthy()
})

it('reactiva un usuario inactivo con confirmación', async () => {
  const user = userEvent.setup()
  render(<UsuariosPage />)
  await screen.findByText('María Gómez')
  await user.click(screen.getByRole('button', { name: 'Reactivar María Gómez' }))
  await user.click(within(await screen.findByRole('dialog', { name: 'Reactivar usuario' })).getByRole('button', { name: 'Confirmar reactivación' }))
  await waitFor(() => expect(fetchMock.mock.calls.some(([url, options]) => String(url) === '/api/usuarios/3/reactivar' && options?.method === 'PUT')).toBe(true))
  expect(await screen.findByText(/reactivado correctamente/)).toBeTruthy()
})
