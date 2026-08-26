import { useEffect, useRef } from 'react'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language'
import { lua } from '@codemirror/legacy-modes/mode/lua'
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete'
import { tags as t } from '@lezer/highlight'
import { completeLua } from './luaCompletions'

const luaLanguage = StreamLanguage.define(lua)

// Colors picked for contrast against this app's dark palette (index.css's
// :root tokens) -- CodeMirror's own default highlight style assumes a
// light background and is hard to read here.
const luaHighlightStyle = HighlightStyle.define([
  { tag: t.comment, color: 'var(--text-faint)', fontStyle: 'italic' },
  { tag: t.keyword, color: 'var(--accent-soft)', fontWeight: '600' },
  { tag: [t.string, t.special(t.string)], color: '#7ee787' },
  { tag: t.number, color: '#f0a35e' },
  { tag: [t.bool, t.null], color: 'var(--accent-soft)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.propertyName], color: '#79c0ff' },
  { tag: t.variableName, color: 'var(--text)' },
  { tag: [t.operator, t.punctuation, t.bracket], color: 'var(--text-dim)' },
])

// Matches this app's dark palette -- there's no light theme to also
// support, this app is dark-only.
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
    // The scrollable element is .cm-scroller, but it only actually scrolls
    // if .cm-editor (the "&" root) has a bounded height for it to overflow
    // within -- setting the height on an outer wrapper div instead (as an
    // earlier version of this file did) leaves .cm-editor free to grow to
    // fit all its content, so there's nothing to scroll.
    '&, .cm-scroller': { height: '100%' },
    '.cm-scroller': { overflow: 'auto' },
    '.cm-tooltip-autocomplete': {
      backgroundColor: 'var(--surface-2)',
      border: '1px solid var(--border-strong)',
    },
    '.cm-tooltip-autocomplete ul li[aria-selected]': {
      backgroundColor: 'var(--accent-bg)',
      color: 'var(--text)',
    },
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
          closeBrackets(),
          autocompletion(),
          keymap.of([...closeBracketsKeymap, ...completionKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
          luaLanguage,
          luaLanguage.data.of({ autocomplete: completeLua }),
          syntaxHighlighting(luaHighlightStyle),
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

  return <div ref={containerRef} style={{ height }} />
}
