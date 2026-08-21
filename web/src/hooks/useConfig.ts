import { useQuery } from '@tanstack/react-query'
import { apiJSON } from '../api/client'

interface PanelConfig {
  http_base_url: string
}

export function useConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: () => apiJSON<PanelConfig>('/api/config'),
    staleTime: Infinity, // static for the lifetime of the panel process
  })
}
