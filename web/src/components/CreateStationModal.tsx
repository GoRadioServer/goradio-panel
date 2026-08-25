import { useState, type FormEvent } from 'react'
import { useCreateStation } from '../hooks/useStations'
import { Modal } from './Modal'
import { IconPlus } from './icons'

export function CreateStationModal({ serverId, onClose }: { serverId: string; onClose: () => void }) {
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [logoUrl, setLogoUrl] = useState('')

  const createStation = useCreateStation(serverId)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    createStation.mutate(
      {
        slug: slug.trim(),
        name: name.trim() || slug.trim(),
        description: description.trim() || undefined,
        logo_url: logoUrl.trim() || undefined,
      },
      { onSuccess: onClose },
    )
  }

  return (
    <Modal title="New station" onClose={onClose}>
      <div className="notice notice-warn" style={{ marginBottom: 14 }}>
        This registers a station on the audio server directly — it has no
        controller and no logic behind it. It won't queue anything on its
        own; it just sits there until you (or anyone with a queue-capable
        token) manually queue tracks, e.g. from the{' '}
        <strong>Media Browser</strong>. If a real station controller
        registers this same slug later, it takes over cleanly — this is
        the same registration a controller itself would perform.
      </div>

      <form onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="new-station-slug">Slug</label>
          <input
            id="new-station-slug"
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="my-station"
          />
        </div>

        <div className="field" style={{ marginTop: 11 }}>
          <label htmlFor="new-station-name">Name (optional)</label>
          <input
            id="new-station-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={slug || 'My Station'}
          />
        </div>

        <div className="field" style={{ marginTop: 11 }}>
          <label htmlFor="new-station-description">Description (optional)</label>
          <input
            id="new-station-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="field" style={{ marginTop: 11 }}>
          <label htmlFor="new-station-logo">Logo URL (optional)</label>
          <input
            id="new-station-logo"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://example.com/logo.png"
          />
        </div>

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" disabled={createStation.isPending || slug.trim() === ''}>
            {createStation.isPending ? <span className="spinner" /> : <IconPlus size={14} />}
            Create station
          </button>
        </div>

        {createStation.isError && (
          <p className="error-text" style={{ marginTop: 10, marginBottom: 0 }}>
            {(createStation.error as Error).message}
          </p>
        )}
      </form>
    </Modal>
  )
}
