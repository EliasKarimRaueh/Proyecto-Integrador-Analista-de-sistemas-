import { useEffect, useRef, type ReactNode } from 'react'
import { Icon } from './Icon'

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const dialog = ref.current!
    dialog.showModal()
    return () => { dialog.close(); previous?.focus() }
  }, [])
  return (
    <dialog ref={ref} className="modal" aria-labelledby="modal-title" onCancel={onClose}>
      <div className="modal-heading"><div><span className="eyebrow">CATÁLOGO DE PRODUCTOS</span><h2 id="modal-title">{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button></div>
      {children}
    </dialog>
  )
}

