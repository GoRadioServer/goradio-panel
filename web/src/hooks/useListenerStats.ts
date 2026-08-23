import { useQuery } from '@tanstack/react-query'
import { apiJSON } from '../api/client'
import { stationApiPath } from '../api/paths'
import type { ListenerStatPoint } from '../api/types'

export function useListenerStats(serverId: string, slug: string) {
  return useQuery({
    queryKey: ['stationStats', serverId, slug],
    queryFn: () => apiJSON<ListenerStatPoint[]>(stationApiPath(serverId, slug, '/stats')),
    enabled: serverId !== '' && slug !== '',
    refetchInterval: 30_000,
  })
}
