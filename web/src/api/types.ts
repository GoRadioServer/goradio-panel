export interface ReleaseInfo {
  version: string
  url: string
  published_at: string
}

export interface VersionInfo {
  /** What this audio server reports running; '' if it's unreachable or predates the version RPC. */
  version: string
  /** Newest upstream release, or null when update checks are off or GitHub hasn't answered. */
  latest: ReleaseInfo | null
  update_available: boolean
}

export interface AudioServerInfo {
  id: string
  name: string
  http_base_url: string
  default: boolean
  /** Station metadata key the UI groups by on first load; '' for none. */
  default_grouping: string
}

export interface StationSummary {
  slug: string
  name: string
  listener_count: number
  logo_url: string
  metadata: Record<string, string> | null
  // Live-monitoring state from the panel's own event watcher, not the
  // audio server itself -- offline means the panel has lost its
  // SubscribeEvents connection to this station, not that the station
  // is unhealthy.
  offline: boolean
  silence: boolean
  // The station's current track, or null when nothing is playing. Shaped
  // like TrackSource so the same title/subtitle helpers apply.
  now_playing: TrackSource | null
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
  metadata: Record<string, string> | null
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

export interface MintTokenRequest {
  slugs: string[]
  // Directories under audio_root this token may queue/browse, recursively
  // (an entry of "GTASA/KROSE" also covers everything under it). Omit or
  // leave empty for an unrestricted token.
  dirs?: string[]
  subject?: string
  ttl?: string
  read_only: boolean
}

export interface MintTokenResponse {
  token: string
  expires_at: string
}

export interface CreateStationRequest {
  slug: string
  name: string
  description?: string
  logo_url?: string
}

export interface CreateStationResponse {
  slug: string
  stream_url: string
  // True if this slug was already registered (by a controller or a
  // previous panel registration) and got updated in place rather than
  // created fresh.
  re_registered: boolean
}

export interface DirectoryEntry {
  name: string
  is_dir: boolean
  // "/"-separated, relative to audio_root -- usable directly as a
  // QueueTrackRequest source.location for a LOCAL_FILE source.
  path: string
  size_bytes: number
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
