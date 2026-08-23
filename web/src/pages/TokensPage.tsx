import { useState, type FormEvent } from 'react'
import { useStations } from '../hooks/useStations'
import { useMintToken } from '../hooks/useTokens'
import { IconCheck, IconCopy, IconKey } from '../components/icons'
import { useServerId } from '../hooks/useServers'

type Scope = 'all' | 'specific'

export function TokensPage() {
  const serverId = useServerId()
  const { data: stations } = useStations(serverId)
  const mintToken = useMintToken(serverId)

  const [scope, setScope] = useState<Scope>('all')
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([])
  const [subject, setSubject] = useState('')
  const [ttl, setTtl] = useState('24h')
  const [readOnly, setReadOnly] = useState(false)
  const [copied, setCopied] = useState(false)

  function toggleSlug(slug: string) {
    setSelectedSlugs((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]))
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setCopied(false)
    mintToken.mutate({
      slugs: scope === 'all' ? ['*'] : selectedSlugs,
      subject: subject.trim() || undefined,
      ttl: ttl.trim() || undefined,
      read_only: readOnly,
    })
  }

  async function copyToken() {
    if (!mintToken.data) return
    await navigator.clipboard.writeText(mintToken.data.token)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const canSubmit = scope === 'all' || selectedSlugs.length > 0

  return (
    <>
      <div className="page-head">
        <div className="page-icon">
          <IconKey size={20} />
        </div>
        <div className="page-titles">
          <div className="page-title-row">
            <h1 className="page-title">Tokens</h1>
          </div>
          <div className="page-meta">
            Mint audio-server JWTs for station controllers and observers, same as{' '}
            <code>radio tokengen</code>
          </div>
        </div>
      </div>

      <div className="stack">
        <div className="card">
          <div className="card-head">
            <span className="card-title">Generate a token</span>
          </div>
          <div className="card-body">
            <form onSubmit={onSubmit}>
              <div className="field">
                <label htmlFor="scope">Scope</label>
                <select id="scope" value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
                  <option value="all">All stations (*)</option>
                  <option value="specific">Specific stations</option>
                </select>
              </div>

              {scope === 'specific' && (
                <div className="field" style={{ marginTop: 11 }}>
                  <label>Stations</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {(stations ?? []).map((s) => (
                      <label className="checkline" key={s.slug}>
                        <input
                          type="checkbox"
                          checked={selectedSlugs.includes(s.slug)}
                          onChange={() => toggleSlug(s.slug)}
                        />
                        {s.name}
                      </label>
                    ))}
                    {stations?.length === 0 && <span className="field-hint">No stations registered yet.</span>}
                  </div>
                </div>
              )}

              <div className="form-row" style={{ marginTop: 11 }}>
                <div className="field">
                  <label htmlFor="subject">Subject (optional)</label>
                  <input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="goradio-panel"
                  />
                </div>
                <div className="field">
                  <label htmlFor="ttl">TTL</label>
                  <input id="ttl" value={ttl} onChange={(e) => setTtl(e.target.value)} placeholder="24h" />
                </div>
              </div>
              <div className="field-hint" style={{ marginTop: 5 }}>
                Go duration format -- "30m", "24h", "168h" (a week).
              </div>

              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <label className="checkline">
                  <input type="checkbox" checked={readOnly} onChange={(e) => setReadOnly(e.target.checked)} />
                  Read-only (GetStatus / SubscribeEvents only, no queue/skip/etc)
                </label>
                <button type="submit" disabled={mintToken.isPending || !canSubmit}>
                  {mintToken.isPending ? <span className="spinner" /> : <IconKey size={14} />}
                  Generate token
                </button>
              </div>

              {mintToken.isError && (
                <p className="error-text" style={{ marginBottom: 0, marginTop: 10 }}>
                  {(mintToken.error as Error).message}
                </p>
              )}
            </form>
          </div>
        </div>

        {mintToken.data && (
          <div className="card">
            <div className="card-head">
              <span className="card-title">Generated token</span>
              <span className="field-hint">expires {new Date(mintToken.data.expires_at).toLocaleString()}</span>
            </div>
            <div className="card-body">
              <div className="token-box mono">{mintToken.data.token}</div>
              <button className="secondary sm" style={{ marginTop: 10 }} onClick={copyToken}>
                {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
                {copied ? 'Copied' : 'Copy to clipboard'}
              </button>
              <p className="field-hint" style={{ marginTop: 10, marginBottom: 0 }}>
                Paste this into a controller's config (e.g. <code>station.yaml</code>'s{' '}
                <code>auth.jwt</code>) or an observer's Authorization header. Shown once here --
                the panel doesn't store minted tokens.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
