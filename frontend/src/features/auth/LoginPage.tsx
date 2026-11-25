import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '../../shared/components/Icon'
import { useAuth } from '../../shared/hooks/useAuth'
import { ApiError } from '../../shared/services/api'

function mensajeError(fallo: unknown) {
  const mensaje = fallo instanceof Error ? fallo.message : ''
  const texto = mensaje.toLowerCase()
  if (texto.includes('inactiv')) return 'El usuario está inactivo. Contactá con el propietario.'
  if (fallo instanceof ApiError && fallo.status === 401) return 'Credenciales inválidas. Revisá el identificador y la contraseña.'
  if (texto.includes('credencial') || texto.includes('contraseña') || texto.includes('inválid')) {
    return 'Credenciales inválidas. Revisá el identificador y la contraseña.'
  }
  return mensaje || 'No pudimos iniciar sesión. Intentá nuevamente.'
}

export function LoginPage() {
  const { login, usuario, cargando } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [identificador, setIdentificador] = useState('')
  const [password, setPassword] = useState('')
  const [recordarme, setRecordarme] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const destino = (location.state as { from?: string } | null)?.from || '/'

  if (!cargando && usuario) return <Navigate to={destino} replace />

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (enviando) return
    if (!identificador.trim() || !password) {
      setError('Ingresá el identificador y la contraseña.')
      return
    }
    setEnviando(true)
    setError('')
    try {
      await login({ identificador: identificador.trim(), password, recordarme })
      navigate(destino, { replace: true })
    } catch (fallo) {
      setError(mensajeError(fallo))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="titulo-login">
        <div className="login-brand">
          <span className="brand-mark" aria-hidden="true">
            <img src="/android-chrome-192x192.png" alt="" width="40" height="40" />
          </span>
          <div>
            <h1 id="titulo-login">AvixSoft</h1>
            <p>La Nena · Pollería</p>
          </div>
        </div>

        <h2>Ingresar al sistema</h2>
        <p className="login-help">Usá tu email o nombre de usuario y tu contraseña para continuar.</p>

        {error !== '' && <div className="notice error" role="alert">{error}</div>}

        <form onSubmit={enviar} noValidate>
          <label className="login-field">
            Identificador
            <input
              autoFocus
              aria-label="Identificador"
              name="identificador"
              autoComplete="username"
              placeholder="Email o usuario"
              required
              value={identificador}
              onChange={evento => setIdentificador(evento.target.value)}
            />
          </label>
          <label className="login-field">
            Contraseña
            <input
              aria-label="Contraseña"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Tu contraseña"
              required
              value={password}
              onChange={evento => setPassword(evento.target.value)}
            />
          </label>
          <label className="login-remember">
            <input type="checkbox" aria-label="Recordarme" checked={recordarme} onChange={evento => setRecordarme(evento.target.checked)} />
            <span>Recordarme</span>
          </label>
          <button className="button primary login-submit" type="submit" disabled={enviando}>
            <Icon name="key" size={18} />
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
        <p className="login-footnote">El acceso está restringido al personal autorizado.</p>
      </section>
    </main>
  )
}
