import { useEffect } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { apiJSON } from '../api/client'
import type { StationEvent } from '../api/types'

interface SSETokenResponse {
  token: string
  expires_at: string
}

// useStationEvents keeps a station's detail/stats queries fresh by
// invalidating them the moment something actually changes (per the
// TRACK_STARTED/TRACK_ENDED/QUEUE_UPDATED/LISTENER_COUNT_CHANGED events),
// instead of polling GetStatus on a fixed interval regardless of activity.
// Auth uses a short-lived, single-purpose SSE token (see the panel's SSE
// auth design note) minted fresh on every (re)connect, since EventSource
// can't send an Authorization header.
export function useStationEvents(slug: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    let cancelled = false
    let es: EventSource | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    async function connect() {
      if (cancelled) return
      try {
        const { token } = await apiJSON<SSETokenResponse>(
          `/api/sse-token?slug=${encodeURIComponent(slug)}`,
        )
        if (cancelled) return

        es = new EventSource(
          `/api/stations/${encodeURIComponent(slug)}/events?token=${encodeURIComponent(token)}`,
        )
        es.onmessage = (e) => {
          const evt = JSON.parse(e.data) as StationEvent
          applyEvent(queryClient, slug, evt)
        }
        es.onerror = () => {
          es?.close()
          es = null
          if (!cancelled) retryTimer = setTimeout(connect, 3000)
        }
      } catch {
        if (!cancelled) retryTimer = setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      cancelled = true
      es?.close()
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [slug, queryClient])
}

function applyEvent(queryClient: QueryClient, slug: string, evt: StationEvent) {
  switch (evt.type) {
    case 'EVENT_TYPE_TRACK_STARTED':
    case 'EVENT_TYPE_TRACK_ENDED':
    case 'EVENT_TYPE_QUEUE_UPDATED':
    case 'EVENT_TYPE_SILENCE_STARTED':
    case 'EVENT_TYPE_SILENCE_ENDED':
    case 'EVENT_TYPE_QUEUE_LOW':
    case 'EVENT_TYPE_ERROR':
      queryClient.invalidateQueries({ queryKey: ['station', slug] })
      break
    case 'EVENT_TYPE_LISTENER_COUNT_CHANGED':
      queryClient.invalidateQueries({ queryKey: ['station', slug] })
      queryClient.invalidateQueries({ queryKey: ['stationStats', slug] })
      break
    default:
      break
  }
}
