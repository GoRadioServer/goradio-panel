import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { apiJSON } from '../api/client'
import type { AudioServerInfo } from '../api/types'

const LAST_SERVER_KEY = 'goradio-panel.lastServer'

export function useServers() {
  return useQuery({
    queryKey: ['servers'],
    queryFn: () => apiJSON<AudioServerInfo[]>('/api/servers'),
    staleTime: Infinity, // fixed for the lifetime of the panel process
  })
}

// The audio server the current route addresses. Every server-scoped page
// sits under /servers/:server, so this is just the route param -- '' on
// the routes that aren't scoped, where callers should not be fetching
// server data at all (the hooks that take it are disabled on '').
export function useServerId(): string {
  const { server = '' } = useParams<{ server: string }>()
  return server
}

// The server the sidebar should present as current. Same as useServerId on
// a scoped route; on an unscoped one (/users) it falls back to the last
// server actually visited, so navigating to Users and back doesn't silently
// drop you onto a different server's station list.
export function useCurrentServerId(): string {
  const routeServer = useServerId()
  const { data: servers } = useServers()

  useEffect(() => {
    if (!routeServer) return
    try {
      localStorage.setItem(LAST_SERVER_KEY, routeServer)
    } catch {
      // Private mode / storage disabled: falling back to the default
      // server is fine, this is only a convenience.
    }
  }, [routeServer])

  if (routeServer) return routeServer
  if (!servers || servers.length === 0) return ''

  let remembered: string | null = null
  try {
    remembered = localStorage.getItem(LAST_SERVER_KEY)
  } catch {
    remembered = null
  }
  if (remembered && servers.some((s) => s.id === remembered)) return remembered

  return (servers.find((s) => s.default) ?? servers[0]).id
}
