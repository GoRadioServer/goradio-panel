import { useEffect, useRef, useState } from 'react'
import {
  useDeleteManagedStation,
  useRestartStation,
  useSaveScript,
  useStartStation,
  useStationProcess,
  useStationScript,
  useStopStation,
} from '../hooks/useManagedStation'
import type { StationProcessState } from '../api/types'
import { ScriptEditor } from './ScriptEditor'
import { IconCheck, IconPlay, IconRepeat, IconStop, IconTrash } from './icons'

function StateBadge({ state }: { state: StationProcessState }) {
  if (state === 'running') {
    return (
      <span className="badge success">
        <span className="dot pulse" /> Running
      </span>
    )
  }
  if (state === 'crashed') return <span className="badge danger">Crashed</span>
  return <span className="badge">Stopped</span>
}

// The Controller section of a station's edit page -- only rendered for a
// panel-managed station (useStationProcess returns null for any other
// kind, e.g. one registered by an external controller). Render with a
// `key={slug}` from the caller so navigating between two managed
// stations' edit pages remounts this and re-seeds the editor, rather than
// carrying stale content across.
export function ControllerSection({
  serverId,
  slug,
  onDeleted,
}: {
  serverId: string
  slug: string
  onDeleted?: () => void
}) {
  const { data: process } = useStationProcess(serverId, slug)
  const { data: script } = useStationScript(serverId, slug)
  const saveScript = useSaveScript(serverId, slug)
  const start = useStartStation(serverId, slug)
  const stop = useStopStation(serverId, slug)
  const restart = useRestartStation(serverId, slug)
  const deleteStation = useDeleteManagedStation(serverId, slug)

  const [content, setContent] = useState('')
  const [dirty, setDirty] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const seeded = useRef(false)
  const logRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    if (script && !seeded.current) {
      setContent(script.content)
      seeded.current = true
    }
  }, [script])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [process?.log_tail])

  if (!process) return null

  function onSave() {
    saveScript.mutate(content, {
      onSuccess: () => {
        setDirty(false)
        setJustSaved(true)
        setTimeout(() => setJustSaved(false), 2500)
      },
    })
  }

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Controller</span>
        <StateBadge state={process.state} />
      </div>
      <div className="card-body">
        {process.state === 'crashed' && (
          <p className="error-text" style={{ marginTop: 0 }}>
            Exited with code {process.exit_code}
            {process.exit_error ? `: ${process.exit_error}` : ''} -- check the output below.
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button
            className="secondary sm"
            disabled={process.state === 'running' || start.isPending}
            onClick={() => start.mutate()}
          >
            <IconPlay size={13} />
            Start
          </button>
          <button
            className="secondary sm"
            disabled={process.state !== 'running' || stop.isPending}
            onClick={() => stop.mutate()}
          >
            <IconStop size={13} />
            Stop
          </button>
          <button className="secondary sm" disabled={restart.isPending} onClick={() => restart.mutate()}>
            <IconRepeat size={13} />
            Restart
          </button>
          <button
            className="danger sm"
            style={{ marginLeft: 'auto' }}
            disabled={deleteStation.isPending}
            onClick={() => {
              if (
                confirm(
                  `Delete managed station "${slug}"? This stops its process, unregisters it, and deletes its script. This can't be undone.`,
                )
              ) {
                deleteStation.mutate(undefined, { onSuccess: onDeleted })
              }
            }}
          >
            <IconTrash size={13} />
            Delete station
          </button>
        </div>

        <ScriptEditor
          value={content}
          onChange={(v) => {
            setContent(v)
            setDirty(true)
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <button disabled={!dirty || saveScript.isPending} onClick={onSave}>
            {saveScript.isPending ? <span className="spinner" /> : <IconCheck size={13} />}
            Save
          </button>
          {justSaved && <span className="field-hint">Saved -- click Restart to apply.</span>}
          {saveScript.isError && (
            <span className="error-text">{(saveScript.error as Error).message}</span>
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          <div className="field-hint" style={{ marginBottom: 6 }}>
            Recent output
          </div>
          <pre
            ref={logRef}
            className="mono"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 12px',
              fontSize: 12,
              maxHeight: 220,
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              margin: 0,
            }}
          >
            {process.log_tail.length > 0 ? process.log_tail.join('\n') : 'No output yet.'}
          </pre>
        </div>
      </div>
    </div>
  )
}
