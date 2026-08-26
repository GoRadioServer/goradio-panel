import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, apiJSON } from '../api/client'
import { stationApiPath } from '../api/paths'
import type { StationProcess, StationScript } from '../api/types'

// A slug the panel doesn't manage 404s -- surfaced as `data === null`,
// not a query error, so callers can tell "not managed" from "the panel
// is unreachable" and render accordingly (no Controller section vs. an
// actual error state).
async function fetchProcessOrNull(path: string): Promise<StationProcess | null> {
  try {
    return await apiJSON<StationProcess>(path)
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null
    throw e
  }
}

export function useStationProcess(serverId: string, slug: string) {
  return useQuery({
    queryKey: ['station-process', serverId, slug],
    queryFn: () => fetchProcessOrNull(stationApiPath(serverId, slug, '/process')),
    enabled: serverId !== '' && slug !== '',
    refetchInterval: 3000,
  })
}

function useProcessAction(serverId: string, slug: string, action: 'start' | 'stop' | 'restart') {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiJSON<StationProcess>(stationApiPath(serverId, slug, `/process/${action}`), { method: 'POST' }),
    onSuccess: (data) => queryClient.setQueryData(['station-process', serverId, slug], data),
  })
}

export function useStartStation(serverId: string, slug: string) {
  return useProcessAction(serverId, slug, 'start')
}

export function useStopStation(serverId: string, slug: string) {
  return useProcessAction(serverId, slug, 'stop')
}

export function useRestartStation(serverId: string, slug: string) {
  return useProcessAction(serverId, slug, 'restart')
}

export function useStationScript(serverId: string, slug: string) {
  return useQuery({
    queryKey: ['station-script', serverId, slug],
    queryFn: () => apiJSON<StationScript>(stationApiPath(serverId, slug, '/script')),
    enabled: serverId !== '' && slug !== '',
  })
}

export function useSaveScript(serverId: string, slug: string) {
  return useMutation({
    mutationFn: (content: string) =>
      apiJSON<void>(stationApiPath(serverId, slug, '/script'), {
        method: 'PUT',
        body: JSON.stringify({ content }),
      }),
  })
}

export function useDeleteManagedStation(serverId: string, slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiJSON<void>(stationApiPath(serverId, slug, ''), { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stations', serverId] })
      queryClient.removeQueries({ queryKey: ['station-process', serverId, slug] })
      queryClient.removeQueries({ queryKey: ['station-script', serverId, slug] })
    },
  })
}
