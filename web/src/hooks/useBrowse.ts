import { useQuery } from '@tanstack/react-query'
import { apiJSON } from '../api/client'
import { browseApiPath } from '../api/paths'
import type { DirectoryEntry } from '../api/types'

/** Lists one directory under a server's audio_root -- path='' is the root. */
export function useBrowse(serverId: string, path: string) {
  return useQuery({
    queryKey: ['browse', serverId, path],
    queryFn: () => apiJSON<DirectoryEntry[]>(browseApiPath(serverId, path)),
    enabled: serverId !== '',
  })
}
