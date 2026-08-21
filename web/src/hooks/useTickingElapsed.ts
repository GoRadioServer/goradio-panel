import { useEffect, useRef, useState } from 'react'

// useTickingElapsed turns a server-reported elapsed-seconds snapshot
// (only as fresh as the last poll/SSE-triggered refetch) into a smoothly
// advancing clock: it resyncs to the authoritative server value the
// instant a new one arrives (a track skip/change is reflected
// immediately, not on the next tick), and interpolates from there using
// the browser's own clock in between server updates instead of sitting
// frozen until the next fetch.
//
// resyncKey should change whenever the *identity* of what's playing
// changes (e.g. a track's queue_id) -- guards against the rare case where
// a skip lands on a new track whose reported elapsed seconds happens to
// match the old one, which wouldn't otherwise trigger a resync.
export function useTickingElapsed(
  serverElapsed: number,
  durationSeconds: number,
  active: boolean,
  resyncKey: string | number | null = null,
): number {
  const [elapsed, setElapsed] = useState(serverElapsed)
  const syncRef = useRef<{ value: number; at: number } | null>(null)

  useEffect(() => {
    syncRef.current = { value: serverElapsed, at: Date.now() }
    setElapsed(serverElapsed)
  }, [serverElapsed, resyncKey])

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => {
      const sync = syncRef.current
      if (!sync) return
      setElapsed(sync.value + (Date.now() - sync.at) / 1000)
    }, 250)
    return () => clearInterval(id)
  }, [active])

  return durationSeconds > 0 ? Math.min(elapsed, durationSeconds) : elapsed
}
