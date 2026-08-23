import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiJSON } from '../api/client'
import { stationApiPath } from '../api/paths'
import type {
  ClearQueueResponse,
  QueueTrackRequest,
  QueueTrackResponse,
  RemoveFromQueueResponse,
  SeekResponse,
  SkipResponse,
  SkipToResponse,
} from '../api/types'

// Every mutation invalidates both this station's detail query and the
// dashboard's station list, since queue/skip/unregister actions change
// what both show.
function useInvalidateStation(serverId: string, slug: string) {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['station', serverId, slug] })
    queryClient.invalidateQueries({ queryKey: ['stations', serverId] })
  }
}

export function useQueueTrack(serverId: string, slug: string) {
  const invalidate = useInvalidateStation(serverId, slug)
  return useMutation({
    mutationFn: (req: QueueTrackRequest) =>
      apiJSON<QueueTrackResponse>(stationApiPath(serverId, slug, '/queue'), {
        method: 'POST',
        body: JSON.stringify(req),
      }),
    onSuccess: invalidate,
  })
}

export function useRemoveFromQueue(serverId: string, slug: string) {
  const invalidate = useInvalidateStation(serverId, slug)
  return useMutation({
    mutationFn: (queueId: string) =>
      apiJSON<RemoveFromQueueResponse>(
        stationApiPath(serverId, slug, `/queue/${encodeURIComponent(queueId)}`),
        { method: 'DELETE' },
      ),
    onSuccess: invalidate,
  })
}

export function useClearQueue(serverId: string, slug: string) {
  const invalidate = useInvalidateStation(serverId, slug)
  return useMutation({
    mutationFn: (stopCurrent: boolean) =>
      apiJSON<ClearQueueResponse>(stationApiPath(serverId, slug, '/queue/clear'), {
        method: 'POST',
        body: JSON.stringify({ stop_current: stopCurrent }),
      }),
    onSuccess: invalidate,
  })
}

export function useSkip(serverId: string, slug: string) {
  const invalidate = useInvalidateStation(serverId, slug)
  return useMutation({
    mutationFn: () =>
      apiJSON<SkipResponse>(stationApiPath(serverId, slug, '/skip'), { method: 'POST' }),
    onSuccess: invalidate,
  })
}

export function useSkipTo(serverId: string, slug: string) {
  const invalidate = useInvalidateStation(serverId, slug)
  return useMutation({
    mutationFn: (queueId: string) =>
      apiJSON<SkipToResponse>(
        stationApiPath(serverId, slug, `/skip-to/${encodeURIComponent(queueId)}`),
        { method: 'POST' },
      ),
    onSuccess: invalidate,
  })
}

export function useSeek(serverId: string, slug: string) {
  const invalidate = useInvalidateStation(serverId, slug)
  return useMutation({
    mutationFn: (positionSeconds: number) =>
      apiJSON<SeekResponse>(stationApiPath(serverId, slug, '/seek'), {
        method: 'POST',
        body: JSON.stringify({ position_seconds: Math.round(positionSeconds) }),
      }),
    onSuccess: invalidate,
  })
}

export function useUnregisterStation(serverId: string, slug: string) {
  const invalidate = useInvalidateStation(serverId, slug)
  return useMutation({
    mutationFn: () =>
      apiJSON<void>(stationApiPath(serverId, slug, '/unregister'), { method: 'POST' }),
    onSuccess: invalidate,
  })
}
