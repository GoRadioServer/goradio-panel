import { useMutation } from '@tanstack/react-query'
import { apiJSON } from '../api/client'
import type { MintTokenRequest, MintTokenResponse } from '../api/types'

export function useMintToken() {
  return useMutation({
    mutationFn: (req: MintTokenRequest) =>
      apiJSON<MintTokenResponse>('/api/tokens', { method: 'POST', body: JSON.stringify(req) }),
  })
}
