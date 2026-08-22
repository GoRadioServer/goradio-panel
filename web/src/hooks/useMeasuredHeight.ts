import { useCallback, useRef, useState } from 'react'

// Tracks the live rendered height of whatever element the returned ref
// gets attached to. Used to size a sibling (e.g. a station logo) to
// exactly match a text block's real height, which varies with
// content/viewport width and can't be predicted from CSS alone.
//
// This is a *callback* ref rather than a plain useRef + useEffect on
// purpose: the target element here only starts existing a few renders
// after this hook is first called (StationPage renders a "Loading…"
// placeholder first, before the real header with this ref mounts), and
// a useEffect with an empty dependency array only ever runs once, tied
// to that first render -- by the time the real element exists, the
// effect has already fired (against a still-null ref) and won't run
// again. A callback ref instead fires every time React actually attaches
// or detaches the DOM node, so it reliably catches the element whenever
// it shows up.
export function useMeasuredHeight<T extends HTMLElement>(fallback: number) {
  const [height, setHeight] = useState(fallback)
  const observerRef = useRef<ResizeObserver | null>(null)

  const ref = useCallback((node: T | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    if (!node) return

    const observer = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height
      if (h) setHeight(Math.round(h))
    })
    observer.observe(node)
    observerRef.current = observer
  }, [])

  return [ref, height] as const
}
