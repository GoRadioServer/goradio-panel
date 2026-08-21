import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { IconX } from './icons'

interface Props {
  title: string
  onClose: () => void
  children: React.ReactNode
}

export function Modal({ title, onClose, children }: Props) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal card" role="dialog" aria-modal="true" aria-label={title}>
        <div className="card-head">
          <span className="card-title">{title}</span>
          <button className="ghost sm" onClick={onClose} title="Close" aria-label="Close">
            <IconX size={15} />
          </button>
        </div>
        <div className="card-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
