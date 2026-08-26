import { useNavigate, useParams } from 'react-router-dom'
import { ControllerSection } from '../components/ControllerSection'
import { IconPencil } from '../components/icons'
import { serverRoute } from '../api/paths'
import { useServerId } from '../hooks/useServers'
import { useStationProcess } from '../hooks/useManagedStation'

export function EditStationPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const serverId = useServerId()
  const navigate = useNavigate()
  const { data: process, isLoading } = useStationProcess(serverId, slug)

  return (
    <>
      <div className="page-head">
        <div className="page-icon">
          <IconPencil size={20} />
        </div>
        <div className="page-titles">
          <div className="page-title-row">
            <h1 className="page-title">Edit {process?.name ?? slug}</h1>
          </div>
          <div className="page-meta">
            <span className="chip">{slug}</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="center-note">
          <span className="spinner" /> Loading…
        </div>
      ) : process ? (
        <ControllerSection
          key={slug}
          serverId={serverId}
          slug={slug}
          onDeleted={() => navigate(serverRoute(serverId))}
        />
      ) : (
        <p className="error-text">
          "{slug}" isn't a station this panel manages, so there's nothing here to edit.
        </p>
      )}
    </>
  )
}
