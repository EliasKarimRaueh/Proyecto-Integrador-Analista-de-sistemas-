import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AuthProvider } from '../src/features/auth/AuthProvider'
import { LoginPage } from '../src/features/auth/LoginPage'
import { RequireAuth, RequireRole } from '../src/features/auth/RequireAuth'
import { AppLayout } from '../src/shared/components/AppLayout'
import { useApiResource } from '../src/shared/hooks/useApiResource'
import { useAuth } from '../src/shared/hooks/useAuth'
import { apiRequest, guardarTokenEnMemoria } from '../src/shared/services/api'
import type { Usuario } from '../src/features/auth/types'

const propietario: Usuario = {
  id: 1, nombre: 'Ana', apellido: 'Pérez', email: 'ana@avixsoft.com', rol: 'PROPIETARIO', activo: true,
}
const empleado: Usuario = {
  id: 2, nombre: 'Juan', apellido: 'López', email: 'juan@avixsoft.com', rol: 'EMPLEADO', activo: true,
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

let fetchMock: ReturnType<typeof vi.fn>
let hayCookie: boolean
let sesion: { token: string; usuario: Usuario } | null
let credencialesInvalidas: boolean
let usuarioInactivo: boolean
let refreshFalla: boolean

beforeEach(() => {
  hayCookie = false
  sesion = null
  credencialesInvalidas = false
  usuarioInactivo = false
  refreshFalla = false
  guardarTokenEnMemoria(null)

  fetchMock = vi.fn((input: string | URL | Request, options?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost')
    const body = options?.body ? JSON.parse(String(options.body)) as Record<string, unknown> : {}

    if (url.pathname === '/api/auth/refresh') {
      if (!hayCookie || refreshFalla || !sesion) return json({ message: 'Sesión expirada' }, 401)
      return json({ accessToken: sesion.token, usuario: sesion.usuario })
    }
    if (url.pathname === '/api/auth/login') {
      if (credencialesInvalidas) return json({ message: 'Credenciales inválidas' }, 401)
      if (usuarioInactivo) return json({ message: 'Usuario inactivo' }, 403)
      sesion = { token: 'token-login', usuario: propietario }
      hayCookie = true
      return json({ accessToken: sesion.token, usuario: sesion.usuario })
    }
    if (url.pathname === '/api/auth/logout') {
      hayCookie = false
      sesion = null
      return json({ message: 'Sesión cerrada' })
    }
    if (url.pathname === '/api/auth/me') {
      return sesion ? json(sesion.usuario) : json({ message: 'No autorizado' }, 401)
    }
    if (url.pathname === '/api/health') return json({ status: 'ok' })
    if (url.pathname === '/api/productos') {
      const autorizacion = new Headers(options?.headers).get('Authorization')
      if (autorizacion === 'Bearer token-viejo' && hayCookie && sesion) {
        sesion = { ...sesion, token: 'token-nuevo' }
        return json({ message: 'Token expirado' }, 401)
      }
      return json([])
    }
    if (body.identificador !== undefined) return json({ message: 'Sin handler de prueba' }, 500)
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

function Inicio() {
  return <h1>Inicio</h1>
}

function AreaProtegida() {
  const { usuario, accessToken } = useAuth()
  return (
    <section>
      <h1>Área protegida</h1>
      <span data-testid="usuario">{usuario?.nombre ?? 'sin-usuario'}</span>
      <span data-testid="token">{accessToken ?? 'sin-token'}</span>
    </section>
  )
}

function Administracion() {
  return <h1>Administración de usuarios</h1>
}

function CerrarSesion() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  return <button onClick={async () => { await logout(); navigate('/login', { replace: true }) }}>Cerrar sesión</button>
}

function RecursoProtegido() {
  const recurso = useApiResource(() => apiRequest<{ ok: boolean }>('productos'))
  return <p role="status">{recurso.loading ? 'Cargando…' : recurso.error ? `Error: ${recurso.error}` : 'Datos cargados'}</p>
}

function Harness({ ruta = '/productos', pagina = <AreaProtegida />, conAdmin = false }: {
  ruta?: string
  pagina?: ReactNode
  conAdmin?: boolean
}) {
  return (
    <MemoryRouter initialEntries={[ruta]}>
      <AuthProvider>
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route element={<RequireAuth><Outlet /></RequireAuth>}>
            <Route path="productos" element={pagina} />
            <Route path="pedidos" element={pagina} />
            <Route path="logout" element={<CerrarSesion />} />
            <Route path="recurso" element={<RecursoProtegido />} />
            <Route index element={<Inicio />} />
            <Route path="usuarios" element={conAdmin ? <RequireRole rol="PROPIETARIO"><Administracion /></RequireRole> : <Administracion />} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
}

async function ingresar(user: ReturnType<typeof userEvent.setup>, identificador = 'ana@avixsoft.com', password = 'secreto123') {
  await user.type(await screen.findByLabelText('Identificador'), identificador)
  await user.type(screen.getByLabelText('Contraseña'), password)
  await user.click(screen.getByRole('button', { name: /Ingresar/ }))
}

it('recupera la sesión desde la cookie de refresh al montar', async () => {
  hayCookie = true
  sesion = { token: 'token-refresco', usuario: propietario }
  render(<Harness />)
  expect(await screen.findByRole('heading', { name: 'Área protegida' })).toBeTruthy()
  expect(screen.getByTestId('usuario').textContent).toBe('Ana')
  expect(screen.getByTestId('token').textContent).toBe('token-refresco')
  expect(fetchMock.mock.calls.some(([url]) => String(url) === '/api/auth/refresh')).toBe(true)
})

it('redirige a /login guardando el destino y vuelve luego de un login válido', async () => {
  const user = userEvent.setup()
  render(<Harness ruta="/pedidos" />)
  await screen.findByLabelText('Identificador')
  await user.type(screen.getByLabelText('Identificador'), 'ana')
  await user.type(screen.getByLabelText('Contraseña'), 'secreto123')
  await user.click(screen.getByLabelText('Recordarme'))
  await user.click(screen.getByRole('button', { name: /Ingresar/ }))

  expect(await screen.findByRole('heading', { name: 'Área protegida' })).toBeTruthy()
  expect(screen.getByTestId('token').textContent).toBe('token-login')
  const llamadaLogin = fetchMock.mock.calls.find(([url, options]) => String(url) === '/api/auth/login' && options?.method === 'POST')!
  expect(JSON.parse(String(llamadaLogin[1].body))).toEqual({ identificador: 'ana', password: 'secreto123', recordarme: true })
})

it('muestra un mensaje para credenciales inválidas', async () => {
  credencialesInvalidas = true
  const user = userEvent.setup()
  render(<Harness ruta="/login" />)
  await ingresar(user, 'ana', 'mala')
  expect(await screen.findByRole('alert').then(node => node.textContent)).toContain('Credenciales inválidas')
})

it('muestra un mensaje para usuario inactivo', async () => {
  usuarioInactivo = true
  const user = userEvent.setup()
  render(<Harness ruta="/login" />)
  await ingresar(user)
  expect(await screen.findByRole('alert').then(node => node.textContent)).toContain('inactivo')
})

it('cierra la sesión y limpia el token', async () => {
  hayCookie = true
  sesion = { token: 'token-refresco', usuario: propietario }
  const user = userEvent.setup()
  render(<Harness ruta="/logout" />)
  await screen.findByRole('button', { name: 'Cerrar sesión' })
  await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
  await screen.findByLabelText('Identificador')
  expect(fetchMock.mock.calls.some(([url, options]) => String(url) === '/api/auth/logout' && options?.method === 'POST')).toBe(true)
})

it('no permite a un empleado entrar en usuarios', async () => {
  hayCookie = true
  sesion = { token: 'token-refresco', usuario: empleado }
  render(<Harness ruta="/usuarios" conAdmin />)
  expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'Administración de usuarios' })).toBeNull()
})

it('reintenta una vez con refresh cuando una petición recibe 401', async () => {
  hayCookie = true
  sesion = { token: 'token-viejo', usuario: propietario }
  render(<Harness ruta="/recurso" />)
  expect(await screen.findByText('Datos cargados')).toBeTruthy()
  const productos = fetchMock.mock.calls.filter(([url]) => String(url) === '/api/productos')
  // Un 401 como máximo genera un reintento; el refresco puede compartirse
  // con el que hace AuthProvider al montar.
  expect(productos).toHaveLength(2)
  expect(new Headers(productos[1][1].headers).get('Authorization')).toBe('Bearer token-nuevo')
})

it('muestra el enlace de usuarios y el operador sólo según el rol', async () => {
  hayCookie = true
  sesion = { token: 'token-refresco', usuario: propietario }
  const { unmount } = render(
    <MemoryRouter><AuthProvider><AppLayout /></AuthProvider></MemoryRouter>
  )
  expect(await screen.findByRole('link', { name: /Usuarios/ })).toBeTruthy()
  expect(screen.getByText('Cerrar sesión')).toBeTruthy()
  expect(screen.getByText('Ana Pérez')).toBeTruthy()
  unmount()

  sesion = { token: 'token-refresco', usuario: empleado }
  render(<MemoryRouter><AuthProvider><AppLayout /></AuthProvider></MemoryRouter>)
  expect(await screen.findByText('Juan López')).toBeTruthy()
  expect(screen.queryByRole('link', { name: /Usuarios/ })).toBeNull()
  await waitFor(() => expect(screen.getByText('Juan López')).toBeTruthy())
})
