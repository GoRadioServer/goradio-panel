import { useMutation } from '@tanstack/react-query'
import { apiJSON } from '../api/client'
import { apiPath } from '../api/paths'
import type { MintTokenRequest, MintTokenResponse } from '../api/types'

// Tokens are signed with the target server's own jwt_secret, so minting is
// scoped to one server -- a token minted here is not valid on any other.
export function useMintToken(serverId: string) {
  return useMutation({
    mutationFn: (req: MintTokenRequest) =>
      apiJSON<MintTokenResponse>(apiPath(serverId, '/tokens'), {
        method: 'POST',
        body: JSON.stringify(req),
      }),
  })
}
