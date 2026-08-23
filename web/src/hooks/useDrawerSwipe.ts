import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

/** How far in from the left edge a swipe may start to count as "open the drawer". */
const EDGE_ZONE_PX = 28
/** Movement needed before we commit to treating a gesture as horizontal or vertical. */
const DIRECTION_LOCK_PX = 8
/** A gesture shorter than this that travelled far enough counts as a flick. */
const FLICK_MS = 250
const FLICK_DISTANCE_PX = 40
/** Only active where the drawer exists -- must match the CSS breakpoint. */
export const DRAWER_QUERY = '(max-width: 860px)'

interface Options {
  open: boolean
  setOpen: (open: boolean) => void
}

/** An in-progress drag: how far the drawer is pulled out, and of what width. */
export interface DrawerDrag {
  /** -width when fully closed, 0 when fully open. */
  offset: number
  /** The drawer's measured width, so callers can derive progress. */
  width: number
}

/**
 * Lets the mobile nav drawer be dragged in from the left edge and back out
 * again, following the finger rather than just snapping on tap.
 *
 * Returns the live drag while one is in progress, or null when idle. The
 * caller applies the offset as a transform and suppresses the drawer's CSS
 * transition meanwhile.
 *
 * Listeners are attached natively rather than via React's onTouch* props
 * because the move handler has to call preventDefault to stop the page
 * scrolling under the drag, and React's synthetic touch listeners are
 * registered as passive, where preventDefault is a no-op.
 */
export function useDrawerSwipe(
  sidebarRef: RefObject<HTMLElement | null>,
  { open, setOpen }: Options,
): DrawerDrag | null {
  const [drag, setDrag] = useState<DrawerDrag | null>(null)

  // Gesture bookkeeping lives in refs, not effect-local variables: a drag
  // in progress has to survive anything that re-renders or re-runs the
  // effect, otherwise the handlers that finish the gesture would see a
  // freshly-reset `active` and bail out, stranding the inline transform
  // and leaving the drawer stuck ignoring `open`.
  const g = useRef({
    startX: 0,
    startY: 0,
    startedAt: 0,
    width: 0,
    base: 0,
    axis: 'none' as 'none' | 'horizontal' | 'vertical',
    active: false,
    openAtStart: false,
  })

  // Read inside the handlers so they never need re-attaching; written in
  // an effect rather than during render.
  const openRef = useRef(open)
  const setOpenRef = useRef(setOpen)
  useEffect(() => {
    openRef.current = open
    setOpenRef.current = setOpen
  }, [open, setOpen])

  // A drag offset only ever describes a gesture in progress, so whenever
  // the drawer's open state changes by any means -- the menu button, the
  // backdrop, Escape, a route change -- the drag is stale by definition.
  // Dropping it makes those controls authoritative: none of them can leave
  // an inline transform pinning the drawer against its own state.
  //
  // Adjusted during render rather than in an effect so the stale offset is
  // gone in the same commit that flips the state, with no frame in between
  // showing the drawer in the wrong place. The gesture itself is abandoned
  // by the openAtStart check in the handlers below.
  const [lastOpen, setLastOpen] = useState(open)
  if (open !== lastOpen) {
    setLastOpen(open)
    setDrag(null)
  }

  useEffect(() => {
    const isMobile = () => window.matchMedia(DRAWER_QUERY).matches

    const onTouchStart = (e: TouchEvent) => {
      g.current.active = false
      g.current.axis = 'none'
      if (!isMobile() || e.touches.length !== 1) return

      const touch = e.touches[0]
      const open = openRef.current
      // Closed: only an edge swipe should pull it in, otherwise every
      // horizontal drag in the page (a chart, a scrolling list) would
      // fight the drawer. Open: anywhere is fair game to push it back.
      if (!open && touch.clientX > EDGE_ZONE_PX) return

      const width = sidebarRef.current?.getBoundingClientRect().width || 270
      g.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startedAt: Date.now(),
        width,
        base: open ? 0 : -width,
        axis: 'none',
        active: true,
        openAtStart: open,
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!g.current.active || e.touches.length !== 1) return
      // The drawer was opened or closed by something else mid-gesture, so
      // this drag's starting premise (and its base offset) no longer hold.
      if (openRef.current !== g.current.openAtStart) {
        g.current.active = false
        setDrag(null)
        return
      }
      const touch = e.touches[0]
      const dx = touch.clientX - g.current.startX
      const dy = touch.clientY - g.current.startY

      if (g.current.axis === 'none') {
        if (Math.abs(dx) < DIRECTION_LOCK_PX && Math.abs(dy) < DIRECTION_LOCK_PX) return
        // A mostly-vertical gesture is a scroll; hand it back to the page
        // and stay out of the way for the rest of this touch.
        g.current.axis = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical'
        if (g.current.axis === 'vertical') {
          g.current.active = false
          return
        }
      }

      e.preventDefault()
      const { width, base } = g.current
      setDrag({ offset: Math.max(-width, Math.min(0, base + dx)), width })
    }

    const onTouchEnd = (e: TouchEvent) => {
      const { active, axis, startX, startedAt, width, base, openAtStart } = g.current
      g.current.active = false
      // Cleared unconditionally, even for a gesture we never took over: a
      // stale inline transform would pin the drawer open or shut and make
      // the menu button appear to do nothing.
      setDrag(null)
      if (!active || axis !== 'horizontal') return
      // Something else already settled the state mid-gesture; don't
      // second-guess it with a stale reading.
      if (openRef.current !== openAtStart) return

      const dx = (e.changedTouches[0]?.clientX ?? startX) - startX
      const flicked = Date.now() - startedAt < FLICK_MS && Math.abs(dx) > FLICK_DISTANCE_PX

      // A quick flick goes with its direction; a slow drag settles to
      // whichever side it ended up nearer.
      const offset = Math.max(-width, Math.min(0, base + dx))
      setOpenRef.current(flicked ? dx > 0 : offset > -width / 2)
    }

    const onTouchCancel = () => {
      g.current.active = false
      setDrag(null)
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onTouchEnd)
    document.addEventListener('touchcancel', onTouchCancel)
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchCancel)
    }
    // Attached once for the component's lifetime -- open/setOpen are read
    // through refs, so a toggle mid-gesture can't tear these down and lose
    // the drag in progress.
  }, [sidebarRef])

  return drag
}
