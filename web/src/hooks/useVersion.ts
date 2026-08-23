import { useQuery } from '@tanstack/react-query'
import { apiJSON } from '../api/client'
import { apiPath } from '../api/paths'
import type { VersionInfo } from '../api/types'

// The audio server's reported version plus the latest upstream release.
// The release side is served from the backend's cache, so this is cheap;
// the poll is slow because neither value changes often (a server version
// only on redeploy).
export function useVersion(serverId: string) {
  return useQuery({
    queryKey: ['version', serverId],
    queryFn: () => apiJSON<VersionInfo>(apiPath(serverId, '/version')),
    enabled: serverId !== '',
    refetchInterval: 5 * 60_000,
  })
}
