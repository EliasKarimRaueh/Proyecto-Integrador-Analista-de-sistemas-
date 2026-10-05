import type { ReactNode } from 'react'
import { Icon } from './Icon'

export function Encabezado({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return <><div className="breadcrumb">Gestión <Icon name="arrow" size={14} /><span>{title}</span></div><div className="page-heading"><div><h1>{title}</h1><p>{description}</p></div><div className="operation-actions">{actions}</div></div></>
}
export function ErrorCarga({ error, retry }: { error: string; retry?: () => void }) {
  if (!error) return null
  return <div className="notice error" role="alert"><span>{error}</span>{retry && <button className="button" onClick={retry}>Reintentar</button>}</div>
}
export function Vacio({ children }: { children: ReactNode }) {
  return <div className="empty-state"><Icon name="archive" size={28}/><p>{children}</p></div>
}
export function Paginacion({ page, count, limit = 20, onChange, disabled }: { page: number; count: number; limit?: number; onChange: (page: number) => void; disabled?: boolean }) {
  const pages = Math.max(1, Math.ceil(count / limit))
  return <div className="table-footer"><span>{count} registros · Página {page} de {pages}</span><div className="operation-actions"><button className="button" disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>Anterior</button><button className="button" disabled={disabled || page >= pages} onClick={() => onChange(page + 1)}>Siguiente</button></div></div>
}
export function EstadoStock({ estado }: { estado: string }) {
  return <span className={`stock-status ${estado === 'Crítico' ? 'critical' : estado === 'Normal' ? 'normal' : 'near'}`}><span/>{estado}</span>
}
