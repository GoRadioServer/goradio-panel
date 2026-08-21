import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiJSON } from '../api/client'
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
function useInvalidateStation(slug: string) {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['station', slug] })
    queryClient.invalidateQueries({ queryKey: ['stations'] })
  }
}

export function useQueueTrack(slug: string) {
  const invalidate = useInvalidateStation(slug)
  return useMutation({
    mutationFn: (req: QueueTrackRequest) =>
      apiJSON<QueueTrackResponse>(`/api/stations/${encodeURIComponent(slug)}/queue`, {
        method: 'POST',
        body: JSON.stringify(req),
      }),
    onSuccess: invalidate,
  })
}

export function useRemoveFromQueue(slug: string) {
  const invalidate = useInvalidateStation(slug)
  return useMutation({
    mutationFn: (queueId: string) =>
      apiJSON<RemoveFromQueueResponse>(
        `/api/stations/${encodeURIComponent(slug)}/queue/${encodeURIComponent(queueId)}`,
        { method: 'DELETE' },
      ),
    onSuccess: invalidate,
  })
}

export function useClearQueue(slug: string) {
  const invalidate = useInvalidateStation(slug)
  return useMutation({
    mutationFn: (stopCurrent: boolean) =>
      apiJSON<ClearQueueResponse>(`/api/stations/${encodeURIComponent(slug)}/queue/clear`, {
        method: 'POST',
        body: JSON.stringify({ stop_current: stopCurrent }),
      }),
    onSuccess: invalidate,
  })
}

export function useSkip(slug: string) {
  const invalidate = useInvalidateStation(slug)
  return useMutation({
    mutationFn: () =>
      apiJSON<SkipResponse>(`/api/stations/${encodeURIComponent(slug)}/skip`, { method: 'POST' }),
    onSuccess: invalidate,
  })
}

export function useSkipTo(slug: string) {
  const invalidate = useInvalidateStation(slug)
  return useMutation({
    mutationFn: (queueId: string) =>
      apiJSON<SkipToResponse>(
        `/api/stations/${encodeURIComponent(slug)}/skip-to/${encodeURIComponent(queueId)}`,
        { method: 'POST' },
      ),
    onSuccess: invalidate,
  })
}

export function useSeek(slug: string) {
  const invalidate = useInvalidateStation(slug)
  return useMutation({
    mutationFn: (positionSeconds: number) =>
      apiJSON<SeekResponse>(`/api/stations/${encodeURIComponent(slug)}/seek`, {
        method: 'POST',
        body: JSON.stringify({ position_seconds: Math.round(positionSeconds) }),
      }),
    onSuccess: invalidate,
  })
}

export function useUnregisterStation(slug: string) {
  const invalidate = useInvalidateStation(slug)
  return useMutation({
    mutationFn: () =>
      apiJSON<void>(`/api/stations/${encodeURIComponent(slug)}/unregister`, { method: 'POST' }),
    onSuccess: invalidate,
  })
}
