import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconChevronDown } from './icons'

export interface SplitButtonOption {
  label: string
  hint?: string
  onSelect: () => void
}

interface Props {
  children: React.ReactNode
  /** The default action, fired by clicking the main body of the button. */
  onClick: () => void
  options: SplitButtonOption[]
  disabled?: boolean
  /** Button variant classes, matching the plain <button> styles. */
  variant?: string
  title?: string
  menuLabel?: string
}

// A button whose main body performs the default action, with an attached
// caret opening the less-common variants of that same action.
//
// The menu renders through a portal in viewport coordinates rather than
// as an absolutely-positioned child: these buttons sit inside the queue
// and history lists, which are their own scroll containers, and a normal
// absolute menu would be clipped at their edges. The trade-off is that a
// fixed-position menu can't follow its anchor, so any scroll or resize
// closes it.
export function SplitButton({
  children,
  onClick,
  options,
  disabled,
  variant = 'secondary sm',
  title,
  menuLabel = 'More options',
}: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const caretRef = useRef<HTMLButtonElement>(null)

  // Runs once the menu is in the DOM but still hidden, so its real height is
  // measurable: rows near the bottom of a long list don't have room to open
  // downwards, and a fixed-position menu would just run off the viewport.
  useLayoutEffect(() => {
    if (!open || !caretRef.current || !menuRef.current) return
    const anchor = caretRef.current.getBoundingClientRect()
    const menuHeight = menuRef.current.offsetHeight
    const fitsBelow = window.innerHeight - anchor.bottom >= menuHeight + 12
    setPos({
      top: fitsBelow ? anchor.bottom + 5 : anchor.top - menuHeight - 5,
      right: window.innerWidth - anchor.right,
    })
  }, [open])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const close = () => setOpen(false)

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    // Capture phase so scrolling any ancestor list closes it, not just window.
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <div className="split-button" ref={wrapRef}>
      <button className={`${variant} split-main`} disabled={disabled} title={title} onClick={onClick}>
        {children}
      </button>
      <button
        ref={caretRef}
        className={`${variant} split-caret`}
        disabled={disabled}
        aria-label={menuLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setPos(null) // re-measure on each open; the row may have moved
          setOpen((v) => !v)
        }}
      >
        <IconChevronDown size={13} />
      </button>

      {open &&
        createPortal(
          <div
            className="split-menu"
            role="menu"
            ref={menuRef}
            style={{
              top: pos?.top ?? 0,
              right: pos?.right ?? 0,
              // Hidden for the measuring pass only -- laid out, so its
              // height is real, but not yet painted in the wrong spot.
              visibility: pos ? 'visible' : 'hidden',
            }}
          >
            {options.map((opt) => (
              <button
                key={opt.label}
                className="split-menu-item"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  opt.onSelect()
                }}
              >
                <span className="split-menu-label">{opt.label}</span>
                {opt.hint && <span className="split-menu-hint">{opt.hint}</span>}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}
