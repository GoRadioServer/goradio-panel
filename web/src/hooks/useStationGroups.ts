import { useMemo, useState } from 'react'
import type { StationSummary } from '../api/types'
import { useServers } from './useServers'

export const UNGROUPED_LABEL = 'Ungrouped'

// Every metadata key seen across any station -- e.g. "type", "game". Not a
// fixed list: the audio server treats station metadata as freeform, so any
// operator can set whatever keys they want.
export function useMetadataKeys(stations: StationSummary[]): string[] {
  return useMemo(() => {
    const keys = new Set<string>()
    for (const s of stations) {
      for (const k of Object.keys(s.metadata ?? {})) keys.add(k)
    }
    return Array.from(keys).sort()
  }, [stations])
}

// Buckets stations by the value of one metadata key, or null when no key is
// selected. Stations missing the key (or with it set to "") fall into an
// "Ungrouped" bucket sorted last, rather than being dropped from the list.
//
// Shared by the dashboard grid and the sidebar station list so the two can't
// disagree about which group a station belongs to.
export function useStationGroups(
  stations: StationSummary[],
  groupBy: string,
): [string, StationSummary[]][] | null {
  return useMemo(() => {
    if (!groupBy) return null
    const byValue = new Map<string, StationSummary[]>()
    for (const s of stations) {
      const value = s.metadata?.[groupBy] || UNGROUPED_LABEL
      if (!byValue.has(value)) byValue.set(value, [])
      byValue.get(value)!.push(s)
    }
    return Array.from(byValue.entries()).sort(([a], [b]) => {
      if (a === UNGROUPED_LABEL) return 1
      if (b === UNGROUPED_LABEL) return -1
      return a.localeCompare(b)
    })
  }, [stations, groupBy])
}

/**
 * The current grouping key for one server's station list, seeded from that
 * server's configured `default_grouping`.
 *
 * The seed is applied when the server's config first arrives and again on
 * every server switch, but never afterwards -- so a grouping the operator
 * picks by hand holds for as long as they stay on that server, rather than
 * being snapped back to the configured default on the next render.
 *
 * Callers hold their own instance: the sidebar and the dashboard start
 * from the same configured default but can then be changed independently.
 */
export function useGroupBy(serverId: string): [string, (value: string) => void] {
  const { data: servers } = useServers()
  const server = servers?.find((s) => s.id === serverId)

  const [groupBy, setGroupBy] = useState('')
  // null until a server's default has actually been applied, so the seed
  // isn't considered done while /api/servers is still in flight.
  const [seededFor, setSeededFor] = useState<string | null>(null)

  if (server && seededFor !== serverId) {
    setSeededFor(serverId)
    setGroupBy(server.default_grouping || '')
  }

  return [groupBy, setGroupBy]
}

/**
 * The keys to offer in a "group by" control. The configured default is
 * included even when no station currently carries it -- otherwise a server
 * grouped by a key its stations have temporarily stopped reporting would
 * show every station as "Ungrouped" with no control on screen to undo it.
 */
export function useGroupByOptions(metadataKeys: string[], groupBy: string): string[] {
  return useMemo(() => {
    if (!groupBy || metadataKeys.includes(groupBy)) return metadataKeys
    return [...metadataKeys, groupBy].sort()
  }, [metadataKeys, groupBy])
}
