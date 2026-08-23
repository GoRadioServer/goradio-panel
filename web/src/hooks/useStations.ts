import { useQuery } from '@tanstack/react-query'
import { apiJSON } from '../api/client'
import { apiPath } from '../api/paths'
import type { StationSummary } from '../api/types'

export function useStations(serverId: string) {
  return useQuery({
    queryKey: ['stations', serverId],
    queryFn: () => apiJSON<StationSummary[]>(apiPath(serverId, '/stations')),
    enabled: serverId !== '',
    // Belt-and-braces fallback even while SSE is connected on a station
    // detail page -- cheap, and covers the dashboard where nothing opens
    // an event stream.
    refetchInterval: 10_000,
  })
}
