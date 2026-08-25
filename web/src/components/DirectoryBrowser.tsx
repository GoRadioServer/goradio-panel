import { Fragment, useState } from 'react'
import { useBrowse } from '../hooks/useBrowse'
import { IconFolder, IconMusicNote } from './icons'
import type { DirectoryEntry } from '../api/types'

interface Props {
  serverId: string
  /** 'queue' makes files clickable (onSelectFile); 'scope' makes folders
   *  checkbox-selectable (selectedDirs/onToggleDir) instead. Both modes
   *  navigate on a folder click, since finding a nested folder is useful
   *  either way. */
  mode: 'queue' | 'scope'
  onSelectFile?: (entry: DirectoryEntry) => void
  selectedDirs?: string[]
  onToggleDir?: (path: string) => void
}

const crumbLinkStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  font: 'inherit',
  color: 'inherit',
  cursor: 'pointer',
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DirectoryBrowser({ serverId, mode, onSelectFile, selectedDirs, onToggleDir }: Props) {
  const [currentPath, setCurrentPath] = useState('')
  const { data: entries, isLoading, isError } = useBrowse(serverId, currentPath)

  const segments = currentPath === '' ? [] : currentPath.split('/')
  const crumbs = segments.map((name, i) => ({
    name,
    path: segments.slice(0, i + 1).join('/'),
  }))

  return (
    <div>
      <div className="crumbs" style={{ marginBottom: 10 }}>
        {currentPath === '' ? (
          <span className="crumb-current">Root</span>
        ) : (
          <button type="button" onClick={() => setCurrentPath('')} style={crumbLinkStyle}>
            Root
          </button>
        )}
        {crumbs.map((c, i) => (
          <Fragment key={c.path}>
            <span className="crumb-sep">›</span>
            {i === crumbs.length - 1 ? (
              <span className="crumb-current">{c.name}</span>
            ) : (
              <button type="button" onClick={() => setCurrentPath(c.path)} style={crumbLinkStyle}>
                {c.name}
              </button>
            )}
          </Fragment>
        ))}
      </div>

      <div className="card">
        <div className="card-body flush scroll-list">
          {isLoading && <div className="empty">Loading…</div>}
          {isError && <div className="empty">Couldn't reach that directory — check the connection or your token's directory scope.</div>}
          {!isLoading && !isError && entries?.length === 0 && <div className="empty">Empty directory.</div>}

          {!isLoading &&
            !isError &&
            entries?.map((entry) => {
              const selected = mode === 'scope' && entry.is_dir && (selectedDirs?.includes(entry.path) ?? false)
              const clickable = entry.is_dir || mode === 'queue'
              return (
                <div
                  key={entry.path}
                  className="row"
                  style={{ cursor: clickable ? 'pointer' : 'default', opacity: !entry.is_dir && mode === 'scope' ? 0.55 : 1 }}
                  onClick={() => {
                    if (entry.is_dir) {
                      setCurrentPath(entry.path)
                    } else if (mode === 'queue') {
                      onSelectFile?.(entry)
                    }
                  }}
                >
                  <div className="row-main">
                    {mode === 'scope' && entry.is_dir && (
                      <input
                        type="checkbox"
                        checked={selected}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => onToggleDir?.(entry.path)}
                      />
                    )}
                    {entry.is_dir ? <IconFolder size={15} /> : <IconMusicNote size={15} />}
                    <span className="row-title">{entry.name}</span>
                  </div>
                  {!entry.is_dir && <span className="row-sub mono">{formatSize(entry.size_bytes)}</span>}
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
}
