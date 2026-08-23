// Path builders for the server-scoped API and routes. Everything that
// acts on a station is scoped to one audio server, because a slug is only
// unique within a server -- centralised here so no call site has to
// remember to encode the server segment.

/** An API path under /api/servers/{serverId}. */
export function apiPath(serverId: string, suffix = ''): string {
  return `/api/servers/${encodeURIComponent(serverId)}${suffix}`
}

/** An API path for one station on one server. */
export function stationApiPath(serverId: string, slug: string, suffix = ''): string {
  return apiPath(serverId, `/stations/${encodeURIComponent(slug)}${suffix}`)
}

/** The in-app route for a server's dashboard. */
export function serverRoute(serverId: string): string {
  return `/servers/${encodeURIComponent(serverId)}`
}

/** The in-app route for one station on one server. */
export function stationRoute(serverId: string, slug: string): string {
  return `${serverRoute(serverId)}/stations/${encodeURIComponent(slug)}`
}
