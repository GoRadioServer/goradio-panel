import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete'

// Kept in sync by hand with goradio's lua-types/radio.lua -- there's no
// shared source to generate this from across the two repos, so a new
// radio.* function added there needs a matching entry added here too.
interface RadioMember {
  name: string
  signature: string
  info: string
}

const radioFunctions: RadioMember[] = [
  {
    name: 'register',
    signature: 'register(slug, name?, description?, options?)',
    info: 'Registers (or re-registers) a station. Call once, typically at the top of your script. Idempotent by slug.',
  },
  {
    name: 'unregister',
    signature: 'unregister()',
    info: "Removes this station from the audio server: stops its player, disconnects listeners. Doesn't persist -- a later register() starts fresh.",
  },
  {
    name: 'queue',
    signature: 'queue(source, mode?)',
    info: 'Queues something to play. mode: "APPEND" (default) | "PLAY_NEXT" | "PLAY_NOW_INTERRUPT". source is a location string or a {location, title, artist, cover_art} table.',
  },
  {
    name: 'dequeue',
    signature: 'dequeue(queue_id)',
    info: "Removes one still-pending item. Returns false (not an error) if queue_id wasn't found.",
  },
  {
    name: 'clear_queue',
    signature: 'clear_queue(stop_current?)',
    info: 'Removes every pending item. stop_current = true also interrupts whatever is currently playing.',
  },
  {
    name: 'skip',
    signature: 'skip()',
    info: 'Interrupts whatever is currently playing; the rest of the queue is untouched.',
  },
  {
    name: 'skip_to',
    signature: 'skip_to(queue_id)',
    info: 'Jumps playback straight to a specific pending item, dropping everything ahead of it.',
  },
  {
    name: 'pause',
    signature: 'pause()',
    info: 'Pauses the current track in place -- falls back to silence until resume().',
  },
  { name: 'resume', signature: 'resume()', info: 'Resumes a paused track from exactly where it was paused.' },
  {
    name: 'seek',
    signature: 'seek(position_seconds)',
    info: 'Jumps the current track to an absolute position, clamped to [0, duration].',
  },
  {
    name: 'seek_by',
    signature: 'seek_by(delta_seconds)',
    info: 'Jumps the current track by a signed delta from its current position.',
  },
  { name: 'status', signature: 'status()', info: "An on-demand snapshot of the registered station's current state." },
  {
    name: 'list_stations',
    signature: 'list_stations()',
    info: "Lists every station this token authorizes -- not just this script's own.",
  },
  { name: 'server_info', signature: 'server_info()', info: "Reports the audio server's build version." },
  {
    name: 'list_directory',
    signature: 'list_directory(path?)',
    info: 'Lists one directory under audio_root, filtered by this token\'s own "dirs" claim. Defaults to the root.',
  },
  { name: 'every', signature: 'every(seconds, fn)', info: 'Calls fn repeatedly, once every `seconds`.' },
  { name: 'after', signature: 'after(seconds, fn)', info: 'Calls fn once, after `seconds`, then never again.' },
  {
    name: 'on_track_started',
    signature: 'on_track_started(function(track) ... end)',
    info: 'fn is called every time a queued item starts playing.',
  },
  {
    name: 'on_track_ended',
    signature: 'on_track_ended(function(track) ... end)',
    info: 'fn is called every time a track finishes ("completed" or "interrupted").',
  },
  {
    name: 'on_error',
    signature: 'on_error(function(err) ... end)',
    info: 'fn is called when something goes wrong, e.g. a queued item that failed to transcode.',
  },
  {
    name: 'on_queue_low',
    signature: 'on_queue_low(function(ev) ... end)',
    info: 'Edge-triggered: fires once when the queue drops to/below low_queue_threshold (set via register options).',
  },
  {
    name: 'on_register',
    signature: 'on_register(function() ... end)',
    info: "Fires every time the engine automatically re-registers after a reconnect -- the only reliable place to re-prime a queue a server restart may have wiped. Never fires for your own register() call.",
  },
  {
    name: 'args',
    signature: 'args',
    info: 'CLI args after --config/--script, e.g. {"myfm", "My FM"} -- a table, not a function.',
  },
]

const luaKeywords = [
  'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function', 'goto',
  'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return', 'then', 'true', 'until', 'while',
]

const stdlib: RadioMember[] = [
  { name: 'print', signature: 'print(...)', info: 'Writes to stdout (captured in this station\'s Recent output).' },
  { name: 'string.format', signature: 'string.format(fmt, ...)', info: 'printf-style string formatting.' },
  { name: 'string.rep', signature: 'string.rep(s, n)', info: 'Repeats a string n times.' },
  { name: 'math.random', signature: 'math.random(m, n)', info: 'Random integer in [m, n], or a float in [0,1) with no args.' },
  { name: 'math.randomseed', signature: 'math.randomseed(x)', info: 'Seeds the random number generator.' },
  { name: 'os.time', signature: 'os.time()', info: 'Current Unix timestamp.' },
  { name: 'table.insert', signature: 'table.insert(t, v)', info: 'Appends v to array-like table t.' },
  { name: 'tostring', signature: 'tostring(v)', info: 'Converts v to a string.' },
  { name: 'tonumber', signature: 'tonumber(v)', info: 'Converts v to a number, or nil if it can\'t be.' },
  { name: 'pairs', signature: 'pairs(t)', info: 'Iterates every key/value pair in t, in unspecified order.' },
  { name: 'ipairs', signature: 'ipairs(t)', info: 'Iterates the array part of t in order, from index 1.' },
]

// A CodeMirror CompletionSource for the radio.* API plus common Lua
// keywords/stdlib -- registered on the Lua language's own `data` facet in
// ScriptEditor.tsx, so `autocompletion()` picks it up automatically.
export function completeLua(context: CompletionContext): CompletionResult | null {
  const member = context.matchBefore(/radio\.\w*/)
  if (member) {
    return {
      from: member.from + 'radio.'.length,
      options: radioFunctions.map((f) => ({
        label: f.name,
        type: f.name === 'args' ? 'property' : 'function',
        detail: f.signature,
        info: f.info,
        boost: 1,
      })),
    }
  }

  const word = context.matchBefore(/[\w.]*/)
  if (!word || (word.from === word.to && !context.explicit)) return null

  return {
    from: word.from,
    options: [
      {
        label: 'radio',
        type: 'namespace',
        detail: 'the GoRadio Lua API',
        info: 'radio.register, radio.queue, radio.on_track_started, ... -- type "radio." to see all of them.',
        boost: 2,
      },
      ...luaKeywords.map((k) => ({ label: k, type: 'keyword' })),
      ...stdlib.map((f) => ({ label: f.name, type: 'function', detail: f.signature, info: f.info })),
    ],
  }
}
