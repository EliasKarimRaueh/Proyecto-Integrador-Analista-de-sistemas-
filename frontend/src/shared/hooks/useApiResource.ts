import { useCallback, useEffect, useRef, useState } from 'react'

const ERROR_POR_DEFECTO = 'No pudimos conectar con el servidor. Revisá que el backend esté corriendo.'

type EstadoApiResource<T> = {
  data: T | null
  loading: boolean
  error: string
  refetch: () => void
  setData: (valor: T | null | ((actual: T | null) => T | null)) => void
}

/**
 * Loads data from the API and keeps loading and error state in one place.
 *
 * Screens use a `clave` instead of a dependency array: the effect reloads
 * when the key changes, and the loader itself is read from a ref so it
 * always runs the latest version without re-triggering the effect on
 * every render.
 *
 * Reloads keep the data already on screen. `loading` is only true on the
 * first load, so refreshing after a save does not blank the table.
 */
export function useApiResource<T>(
  cargador: () => Promise<T>,
  clave: string | number = ''
): EstadoApiResource<T> {

  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [intentos, setIntentos] = useState(0)

  const refCargador = useRef(cargador)

  // Se actualiza después de cada render para que el efecto de carga
  // siempre use la versión más reciente del cargador.
  useEffect(() => {
    refCargador.current = cargador
  })

  const refTieneDatos = useRef(false)

  useEffect(() => {
    let vigente = true

    refCargador.current()
      .then(resultado => {
        if (!vigente) return
        refTieneDatos.current = true
        setData(resultado)
        setLoading(false)
      })
      .catch((fallo: unknown) => {
        if (!vigente) return
        setError(fallo instanceof Error && fallo.message ? fallo.message : ERROR_POR_DEFECTO)
        setLoading(false)
      })

    return () => { vigente = false }
  }, [clave, intentos])

  // El error se borra acá y no en el efecto: así la pantalla no queda
  // mostrando un mensaje viejo mientras corre el pedido que lo limpió.
  const refetch = useCallback(() => {
    setError('')
    setIntentos(actual => actual + 1)
  }, [])

  // Acepta un updater funcional para poder reemplazar un elemento de la
  // lista sin traerla a memoria, como hace el catálogo con setProducts.
  const actualizar = useCallback((valor: T | null | ((actual: T | null) => T | null)) => {
    setData(actual => typeof valor === 'function'
      ? (valor as (interno: T | null) => T | null)(actual)
      : valor)
  }, [])

  return { data, loading, error, refetch, setData: actualizar }
}
