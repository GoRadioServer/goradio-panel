import { useMemo } from 'react'
import type { StationSummary } from '../api/types'

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
