import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiJSON } from '../api/client'
import { apiPath } from '../api/paths'
import type { CreateStationRequest, CreateStationResponse, StationSummary } from '../api/types'

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

// Registers a station directly from the panel, with no controller behind
// it. See CreateStationModal for the disclaimer shown alongside this --
// the audio server has no logic of its own, so a panel-created station
// only ever plays what's manually queued until a real controller
// registers the same slug and takes over.
export function useCreateStation(serverId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (req: CreateStationRequest) =>
      apiJSON<CreateStationResponse>(apiPath(serverId, '/stations'), {
        method: 'POST',
        body: JSON.stringify(req),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stations', serverId] }),
  })
}
