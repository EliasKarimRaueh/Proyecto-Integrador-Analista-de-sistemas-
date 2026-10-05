import { Link } from 'react-router-dom'
import { Encabezado, ErrorCarga, EstadoStock } from '../../shared/components/OperacionesUI'
import { Icon, type IconName } from '../../shared/components/Icon'
import { useApiResource } from '../../shared/hooks/useApiResource'
import { fetchStock, fetchVentas } from '../../shared/services/operaciones'
import { rangoDelDia, cantidadFormato, unidadCorta } from '../../shared/lib/operaciones'

const modules: { to: string; title: string; description: string; icon: IconName }[] = [
  { to: '/caja', title: 'Caja y mostrador', description: 'Vendé por kilos o unidades con precios y ofertas vigentes.', icon: 'bag' },
  { to: '/stock', title: 'Inventario', description: 'Controlá existencias, ingresos, ajustes y bajas justificadas.', icon: 'archive' },
  { to: '/desposte', title: 'Desposte', description: 'Transformá pollo entero en cortes y registrá la merma.', icon: 'box' },
  { to: '/ventas', title: 'Historial de ventas', description: 'Consultá comprobantes y los artículos vendidos.', icon: 'calendar' },
  { to: '/productos', title: 'Productos y precios', description: 'Mantené actualizado el catálogo y las listas de precios.', icon: 'tag' },
  { to: '/ofertas', title: 'Ofertas', description: 'Armá promociones y administrá sus productos.', icon: 'percent' },
]
export function HomePage() {
  const stock = useApiResource(fetchStock)
  const hoy = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const ventas = useApiResource(() => fetchVentas({ limite: 5, ...rangoDelDia(hoy, hoy) }), hoy)
  const alertas = (stock.data ?? []).filter(p => p.estado !== 'Normal').sort((a, b) => Number(b.estado === 'Crítico') - Number(a.estado === 'Crítico'))
  return <section>
    <Encabezado title="Tu mostrador, bajo control" description="Ventas e inventario conectados en un solo lugar." actions={<Link className="button primary" to="/caja"><Icon name="plus"/>Nueva venta</Link>}/>
    <ErrorCarga error={stock.error} retry={stock.refetch}/><ErrorCarga error={ventas.error} retry={ventas.refetch}/>
    <div className="stats-grid"><div className="stat"><span className="stat-icon yellow"><Icon name="bag" size={24}/></span><div><span>Ventas de hoy</span><strong>{ventas.loading || ventas.error ? '—' : ventas.data?.count ?? 0}</strong></div></div><div className="stat"><span className="stat-icon green"><Icon name="box" size={24}/></span><div><span>Productos activos</span><strong>{stock.loading || stock.error ? '—' : stock.data?.length ?? 0}</strong></div></div><div className="stat"><span className="stat-icon gray"><Icon name="archive" size={24}/></span><div><span>Alertas de reposición</span><strong>{stock.loading || stock.error ? '—' : alertas.length}</strong></div></div></div>
    {!stock.loading && !stock.error && alertas.length > 0 && <div className="catalog-panel dashboard-alerts"><div className="catalog-title"><div><h2>Productos que requieren atención</h2><p>Revisá los límites y las existencias antes de reponer.</p></div><Link className="button" to="/stock">Ver inventario</Link></div>{alertas.slice(0, 5).map(p => <div className="dashboard-alert-row" key={p.id}><div><strong>{p.nombre}</strong><small>{cantidadFormato(p.stockActual)} {unidadCorta(p.unidadVenta)} disponibles</small></div><EstadoStock estado={p.estado}/></div>)}</div>}
    <div className="module-grid operational-modules">{modules.map(({ to, title, description, icon }) => <Link className="module-card" key={to} to={to}><Icon name={icon} size={26}/><h2>{title}</h2><p>{description}</p><span>Ir al módulo →</span></Link>)}</div>
  </section>
}
