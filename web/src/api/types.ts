export interface StationSummary {
  slug: string
  name: string
  listener_count: number
  logo_url: string
  metadata: Record<string, string> | null
}

export interface TrackSource {
  type: string
  location: string
  display_title: string
  display_artist: string
  cover_art_url: string
}

export interface QueuedItemStatus {
  queue_id: string
  source: TrackSource | null
  mode: string
  duration_seconds: string
}

export interface HistoryEntryStatus extends QueuedItemStatus {
  reason: string
  ended_at_unix_ms: string
}

export interface StationStatus {
  slug: string
  name: string
  is_registered: boolean
  current_track: QueuedItemStatus | null
  is_silence: boolean
  queue: QueuedItemStatus[]
  listener_count: string
  uptime_seconds: string
  current_track_elapsed_seconds: string
  history: HistoryEntryStatus[]
  logo_url: string
}

export type QueueMode = 'APPEND' | 'PLAY_NEXT' | 'PLAY_NOW_INTERRUPT'
export type TrackSourceType = 'HTTP_URL' | 'LOCAL_FILE'

export interface QueueTrackRequest {
  source: {
    type?: TrackSourceType
    location: string
    display_title?: string
    display_artist?: string
    cover_art_url?: string
  }
  mode?: QueueMode
}

export interface QueueTrackResponse {
  queue_id: string
  queue_position: number
  status: string
}

export interface RemoveFromQueueResponse {
  removed: boolean
}

export interface ClearQueueResponse {
  removed_count: number
  stopped_current: boolean
}

export interface SkipResponse {
  skipped: boolean
}

export interface SkipToResponse {
  removed_count: number
  interrupted_current: boolean
}

export interface SeekResponse {
  seeked: boolean
  position_seconds: number
}

export interface ListenerStatPoint {
  ts: string
  listener_count: number
}

export interface StationEvent {
  slug: string
  type: string
  timestamp_unix_ms: string
  track_started?: { queue_id: string; source: TrackSource; duration_seconds: string }
  track_ended?: { queue_id: string; reason: string }
  queue_updated?: { queue_length: number }
  listener_count_changed?: { listener_count: string }
  error?: { message: string; code: string }
  queue_low?: { queue_length: number; threshold: number }
}
