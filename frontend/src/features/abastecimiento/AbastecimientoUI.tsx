import { NavLink } from 'react-router-dom'
import type { FiltrosAbastecimiento } from '../../shared/services/abastecimiento'
import type { Proveedor } from '../proveedores/proveedores'
import { estadoTexto } from './calculos'

export function NavegacionAbastecimiento() {
  return <nav className="category-tabs supply-nav" aria-label="Abastecimiento">{[['/reposicion', 'Reposición'], ['/pedidos', 'Pedidos'], ['/compras', 'Compras'], ['/recepciones', 'Recepciones']].map(([to, label]) => <NavLink className={({ isActive }) => isActive ? 'selected' : ''} to={to} key={to}>{label}</NavLink>)}</nav>
}
export function FiltrosAbastecimientoUI({ filtros, onChange, proveedores, estados }: { filtros: FiltrosAbastecimiento; onChange: (filtros: FiltrosAbastecimiento) => void; proveedores: Proveedor[]; estados?: string[] }) {
  const field = (key: keyof FiltrosAbastecimiento, value: string) => onChange({ ...filtros, [key]: value, page: 1 })
  return <div className="filters supply-filters"><label>Proveedor<select aria-label="Proveedor" value={filtros.proveedorId ?? ''} onChange={e => field('proveedorId', e.target.value)}><option value="">Todos los proveedores</option>{proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}{p.activo ? '' : ' (inactivo)'}</option>)}</select></label>{estados && <label>Estado<select value={filtros.estado ?? ''} onChange={e => field('estado', e.target.value)}><option value="">Todos los estados</option>{estados.map(e => <option key={e} value={e}>{estadoTexto(e)}</option>)}</select></label>}<label>Desde<input type="date" value={filtros.desde ?? ''} onChange={e => field('desde', e.target.value)}/></label><label>Hasta<input type="date" value={filtros.hasta ?? ''} onChange={e => field('hasta', e.target.value)}/></label></div>
}
