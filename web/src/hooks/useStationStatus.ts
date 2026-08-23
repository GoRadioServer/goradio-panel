import { useQuery } from '@tanstack/react-query'
import { apiJSON } from '../api/client'
import { stationApiPath } from '../api/paths'
import type { StationStatus } from '../api/types'

export function useStationStatus(serverId: string, slug: string) {
  return useQuery({
    queryKey: ['station', serverId, slug],
    queryFn: () => apiJSON<StationStatus>(stationApiPath(serverId, slug)),
    enabled: serverId !== '' && slug !== '',
    // SSE (useStationEvents) keeps this current between polls; this is
    // just the initial load plus a slow resilience fallback.
    refetchInterval: 15_000,
  })
}
