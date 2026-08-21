import { useState, type FormEvent } from 'react'
import { useCreateUser, useDeleteUser, useSetPassword, useUsers, type PanelUser } from '../hooks/useUsers'
import { IconPlus, IconTrash, IconUsers } from '../components/icons'

function formatCreated(iso: string): string {
  if (!iso) return 'unknown'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? 'unknown' : d.toLocaleDateString()
}

function AddUserForm() {
  const createUser = useCreateUser()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    createUser.mutate(
      { username, password },
      {
        onSuccess: () => {
          setUsername('')
          setPassword('')
        },
      },
    )
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="form-row">
        <div className="field">
          <label htmlFor="new-username">Username</label>
          <input
            id="new-username"
            required
            autoComplete="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="new-password">Password</label>
          <input
            id="new-password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit" disabled={createUser.isPending}>
          {createUser.isPending ? <span className="spinner" /> : <IconPlus size={14} />}
          Add user
        </button>
      </div>
      <div className="field-hint" style={{ marginTop: 9 }}>
        At least 8 characters. Every account has full admin access to this panel.
      </div>
      {createUser.isError && (
        <p className="error-text">{(createUser.error as Error).message}</p>
      )}
    </form>
  )
}

function UserRow({ user }: { user: PanelUser }) {
  const deleteUser = useDeleteUser()
  const setPasswordMut = useSetPassword()
  const [changing, setChanging] = useState(false)
  const [password, setPassword] = useState('')

  function submitPassword(e: FormEvent) {
    e.preventDefault()
    setPasswordMut.mutate(
      { id: user.id, password },
      {
        onSuccess: () => {
          setPassword('')
          setChanging(false)
        },
      },
    )
  }

  return (
    <div className="row" style={{ flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="row-main">
          <span className="row-title">{user.username}</span>
          {user.self && <span className="badge accent">you</span>}
        </div>
        <div className="row-sub">added {formatCreated(user.created_at)}</div>
      </div>

      <div className="row-actions">
        <button className="secondary sm" onClick={() => setChanging((v) => !v)}>
          {changing ? 'Cancel' : 'Change password'}
        </button>
        <button
          className="danger sm"
          disabled={user.self || deleteUser.isPending}
          title={user.self ? "You can't delete your own account" : 'Delete user'}
          onClick={() => {
            if (confirm(`Delete user "${user.username}"?`)) deleteUser.mutate(user.id)
          }}
        >
          <IconTrash size={13} />
        </button>
      </div>

      {changing && (
        <form onSubmit={submitPassword} style={{ flexBasis: '100%', marginTop: 10 }}>
          <div className="form-row">
            <div className="field">
              <label htmlFor={`pw-${user.id}`}>New password for {user.username}</label>
              <input
                id={`pw-${user.id}`}
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button type="submit" disabled={setPasswordMut.isPending}>
              Save
            </button>
          </div>
          {setPasswordMut.isError && (
            <p className="error-text">{(setPasswordMut.error as Error).message}</p>
          )}
        </form>
      )}

      {deleteUser.isError && (
        <p className="error-text" style={{ flexBasis: '100%' }}>
          {(deleteUser.error as Error).message}
        </p>
      )}
    </div>
  )
}

export function UsersPage() {
  const { data: users, isLoading, isError } = useUsers()

  if (isLoading) {
    return (
      <div className="center-note">
        <span className="spinner" /> Loading users…
      </div>
    )
  }
  if (isError) return <p className="error-text">Failed to load users.</p>

  const list = users ?? []

  return (
    <>
      <div className="page-head">
        <div className="page-icon">
          <IconUsers size={20} />
        </div>
        <div className="page-titles">
          <div className="page-title-row">
            <h1 className="page-title">Users</h1>
          </div>
          <div className="page-meta">Accounts that can sign in to this panel</div>
        </div>
      </div>

      <div className="stack">
        <div className="card">
          <div className="card-head">
            <span className="card-title">Accounts · {list.length}</span>
          </div>
          <div className="card-body flush">
            <div className="rows">
              {list.map((u) => (
                <UserRow key={u.id} user={u} />
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="card-title">Add a user</span>
          </div>
          <div className="card-body">
            <AddUserForm />
          </div>
        </div>
      </div>
    </>
  )
}
