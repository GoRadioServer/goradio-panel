import { useQuery } from '@tanstack/react-query'
import { apiJSON } from '../api/client'
import type { StationSummary } from '../api/types'

export function useStations() {
  return useQuery({
    queryKey: ['stations'],
    queryFn: () => apiJSON<StationSummary[]>('/api/stations'),
    // Belt-and-braces fallback even while SSE is connected on a station
    // detail page -- cheap, and covers the dashboard where nothing opens
    // an event stream.
    refetchInterval: 10_000,
  })
}
