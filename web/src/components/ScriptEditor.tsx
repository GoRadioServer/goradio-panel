import { useEffect, useRef } from 'react'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { StreamLanguage } from '@codemirror/language'
import { lua } from '@codemirror/legacy-modes/mode/lua'

// Matches this app's dark palette (web/src/index.css's :root tokens) --
// there's no light theme to also support, this app is dark-only.
const panelTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'var(--bg)',
      color: 'var(--text)',
      fontSize: '13px',
      border: '1px solid var(--border-strong)',
      borderRadius: 'var(--radius-sm)',
    },
    '.cm-content': { fontFamily: 'var(--mono)', padding: '10px 0' },
    '.cm-gutters': {
      backgroundColor: 'var(--surface)',
      color: 'var(--text-faint)',
      border: 'none',
      borderRight: '1px solid var(--border)',
    },
    '.cm-activeLine': { backgroundColor: 'var(--surface-2)' },
    '.cm-activeLineGutter': { backgroundColor: 'var(--surface-2)', color: 'var(--text-dim)' },
    '.cm-cursor': { borderLeftColor: 'var(--accent-soft)' },
    '&.cm-focused': { outline: 'none', borderColor: 'var(--accent-border)' },
    '.cm-scroller': { overflow: 'auto' },
  },
  { dark: true },
)

interface Props {
  value: string
  onChange: (value: string) => void
  height?: string
  readOnly?: boolean
}

export function ScriptEditor({ value, onChange, height = '360px', readOnly = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  // Avoids feeding a change back into the editor as a new `value` prop --
  // onChange fires synchronously from the update listener, so this ref is
  // always current by the time the effect below re-checks it.
  const valueRef = useRef(value)

  useEffect(() => {
    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          StreamLanguage.define(lua),
          panelTheme,
          EditorView.editable.of(!readOnly),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              const next = update.state.doc.toString()
              valueRef.current = next
              onChange(next)
            }
          }),
        ],
      }),
      parent: containerRef.current!,
    })
    viewRef.current = view
    return () => view.destroy()
    // Mounts once; `value` after that point is driven by our own
    // onChange, not re-synced from the prop (see the effect below for the
    // one case that does need to push an external value in).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Only pushes value into the editor when it changes for a reason other
  // than the user typing (e.g. switching to a different station's
  // script) -- comparing against valueRef, not the CodeMirror doc, avoids
  // a redundant transaction on every keystroke.
  useEffect(() => {
    if (value === valueRef.current) return
    const view = viewRef.current
    if (!view) return
    valueRef.current = value
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
  }, [value])

  return <div ref={containerRef} style={{ height, overflow: 'hidden' }} />
}
