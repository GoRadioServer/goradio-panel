import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiJSON } from '../api/client'

export interface PanelUser {
  id: number
  username: string
  created_at: string
  self: boolean
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => apiJSON<PanelUser[]>('/api/users'),
  })
}

function useInvalidateUsers() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['users'] })
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: (req: { username: string; password: string }) =>
      apiJSON<void>('/api/users', { method: 'POST', body: JSON.stringify(req) }),
    onSuccess: invalidate,
  })
}

export function useDeleteUser() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: (id: number) => apiJSON<void>(`/api/users/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}

export function useSetPassword() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      apiJSON<void>(`/api/users/${id}/password`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      }),
    onSuccess: invalidate,
  })
}
