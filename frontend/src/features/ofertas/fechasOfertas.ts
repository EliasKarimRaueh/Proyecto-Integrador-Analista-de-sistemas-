import { formatearFecha } from '../../shared/lib/money'

export function fechaInputOferta(iso: string | null | undefined) {
  if (!iso) return ''
  // Los registros antiguos representaban días de calendario con medianoche UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso) || /T(?:00:00:00|23:59:59)(?:\.\d+)?Z$/.test(iso)) return iso.slice(0, 10)
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
}
export const fechaTextoOferta = (iso: string | null | undefined) => iso ? formatearFecha(fechaInputOferta(iso)) : 'Sin fecha de fin'
