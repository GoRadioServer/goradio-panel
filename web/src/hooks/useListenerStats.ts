import { useQuery } from '@tanstack/react-query'
import { apiJSON } from '../api/client'
import type { ListenerStatPoint } from '../api/types'

export function useListenerStats(slug: string) {
  return useQuery({
    queryKey: ['stationStats', slug],
    queryFn: () => apiJSON<ListenerStatPoint[]>(`/api/stations/${encodeURIComponent(slug)}/stats`),
    refetchInterval: 30_000,
  })
}
