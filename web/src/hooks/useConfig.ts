import { useQuery } from '@tanstack/react-query'
import { apiJSON } from '../api/client'
import { apiPath } from '../api/paths'

interface PanelConfig {
  http_base_url: string
}

// Per-server deployment config the frontend needs but can't derive --
// currently just that server's public HTTP base, for building station
// listen URLs.
export function useConfig(serverId: string) {
  return useQuery({
    queryKey: ['config', serverId],
    queryFn: () => apiJSON<PanelConfig>(apiPath(serverId, '/config')),
    enabled: serverId !== '',
    staleTime: Infinity, // static for the lifetime of the panel process
  })
}
