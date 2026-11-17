import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Icon } from './Icon'

type ModalProps = {
  title: string
  onClose: () => void
  /** Small label above the title. Hidden when not provided. */
  eyebrow?: string
  children: ReactNode
  busy?: boolean
  className?: string
}

export function Modal({ title, onClose, eyebrow, children, busy = false, className }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const dialog = ref.current!
    dialog.showModal()
    return () => { dialog.close(); previous?.focus() }
  }, [])
  return (
    <dialog ref={ref} className={`modal ${className ?? ''}`.trim()} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
      <div className="modal-heading">
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h2 id={titleId}>{title}</h2>
        </div>
        <button className="icon-button" disabled={busy} onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button>
      </div>
      {children}
    </dialog>
  )
}
