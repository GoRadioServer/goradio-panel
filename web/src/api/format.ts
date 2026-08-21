import type { TrackSource } from './types'

/** "3:07" / "1:02:11". Callers guard the unknown-duration (0) case. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--'
  const s = Math.floor(seconds % 60)
  const m = Math.floor((seconds / 60) % 60)
  const h = Math.floor(seconds / 3600)
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return h > 0 ? `${h}:${mm}:${String(s).padStart(2, '0')}` : `${mm}:${String(s).padStart(2, '0')}`
}

/** Coarse uptime for a stat tile: "6d 4h", "3h 12m", "48s". */
export function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${Math.floor(seconds)}s`
}

/** The display title for a track, falling back to its raw location. */
export function trackTitle(source: TrackSource | null | undefined): string {
  if (!source) return 'Unknown'
  if (source.display_title) return source.display_title
  // A bare location is usually a path -- the basename is the useful part.
  const base = source.location.split('/').pop() || source.location
  return base
}

/** Artist line, or the raw location when there's no artist metadata. */
export function trackSubtitle(source: TrackSource | null | undefined): string {
  if (!source) return ''
  if (source.display_artist) return source.display_artist
  if (source.display_title) return source.location
  return source.location
}

/** "APPEND", "PLAY_NEXT" -- proto enum names trimmed for display. */
export function shortEnum(value: string): string {
  return value.replace(/^(QUEUE_MODE_|TRACK_SOURCE_TYPE_|EVENT_TYPE_)/, '')
}
