import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiJSON } from '../api/client'
import { apiPath } from '../api/paths'
import type { CreateStationRequest, StationProcess, StationSummary } from '../api/types'

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

// Creates a panel-managed station: the panel writes a starter Lua script
// and spawns `radio station` for it immediately (see CreateStationModal
// for the disclaimer shown alongside this).
export function useCreateStation(serverId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (req: CreateStationRequest) =>
      apiJSON<StationProcess>(apiPath(serverId, '/stations'), {
        method: 'POST',
        body: JSON.stringify(req),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stations', serverId] }),
  })
}
