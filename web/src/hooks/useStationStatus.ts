import { useQuery } from '@tanstack/react-query'
import { apiJSON } from '../api/client'
import type { StationStatus } from '../api/types'

export function useStationStatus(slug: string) {
  return useQuery({
    queryKey: ['station', slug],
    queryFn: () => apiJSON<StationStatus>(`/api/stations/${encodeURIComponent(slug)}`),
    // SSE (useStationEvents) keeps this current between polls; this is
    // just the initial load plus a slow resilience fallback.
    refetchInterval: 15_000,
  })
}
