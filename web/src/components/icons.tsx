// Minimal 16px stroke icon set, sized/coloured by the surrounding text.
type Props = { size?: number }

function Svg({ size = 16, children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {children}
    </svg>
  )
}

export const IconRadio = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="2" />
    <path d="M8.5 15.5a5 5 0 0 1 0-7M15.5 8.5a5 5 0 0 1 0 7M5.5 18.5a9 9 0 0 1 0-13M18.5 5.5a9 9 0 0 1 0 13" />
  </Svg>
)

export const IconStack = (p: Props) => (
  <Svg {...p}>
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3 13 9 5 9-5" />
  </Svg>
)

export const IconPlay = (p: Props) => (
  <Svg {...p}>
    <path d="M7 4.5v15l12-7.5-12-7.5Z" fill="currentColor" stroke="none" />
  </Svg>
)

export const IconStop = (p: Props) => (
  <Svg {...p}>
    <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" fill="currentColor" stroke="none" />
  </Svg>
)

export const IconSkip = (p: Props) => (
  <Svg {...p}>
    <path d="M5 5v14l10-7-10-7Z" fill="currentColor" stroke="none" />
    <path d="M18 5v14" />
  </Svg>
)

export const IconTrash = (p: Props) => (
  <Svg {...p}>
    <path d="M4 7h16M10 4h4M9 7v12M15 7v12M6 7l1 13h10l1-13" />
  </Svg>
)

export const IconRepeat = (p: Props) => (
  <Svg {...p}>
    <path d="M4 10V8a3 3 0 0 1 3-3h13" />
    <path d="m17 2 3 3-3 3" />
    <path d="M20 14v2a3 3 0 0 1-3 3H4" />
    <path d="m7 22-3-3 3-3" />
  </Svg>
)

export const IconVolume = (p: Props) => (
  <Svg {...p}>
    <path d="M11 5 6 9H3v6h3l5 4V5Z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
  </Svg>
)

export const IconVolumeMuted = (p: Props) => (
  <Svg {...p}>
    <path d="M11 5 6 9H3v6h3l5 4V5Z" />
    <path d="m15 9 5 6M20 9l-5 6" />
  </Svg>
)

export const IconUsers = (p: Props) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20a6 6 0 0 1 12 0" />
    <path d="M16 5.5a3.2 3.2 0 0 1 0 5M18 20a6 6 0 0 0-2.5-4.9" />
  </Svg>
)

export const IconClock = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
)

export const IconList = (p: Props) => (
  <Svg {...p}>
    <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
  </Svg>
)

export const IconChart = (p: Props) => (
  <Svg {...p}>
    <path d="M4 20V4M4 20h16" />
    <path d="m7 15 3.5-4 3 2.5L20 7" />
  </Svg>
)

export const IconPlus = (p: Props) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

export const IconSignOut = (p: Props) => (
  <Svg {...p}>
    <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
    <path d="m15 8 4 4-4 4M19 12H9" />
  </Svg>
)

export const IconChevron = (p: Props) => (
  <Svg {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
)

export const IconMenu = (p: Props) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
)

export const IconChevronDown = (p: Props) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
)

export const IconPower = (p: Props) => (
  <Svg {...p}>
    <path d="M12 4v8" />
    <path d="M7.5 7a7 7 0 1 0 9 0" />
  </Svg>
)

export const IconX = (p: Props) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
)

export const IconKey = (p: Props) => (
  <Svg {...p}>
    <circle cx="8" cy="15" r="4" />
    <path d="m10.8 12.2 8.7-8.7M15 8l2.3 2.3M18 5l1.7 1.7" />
  </Svg>
)

export const IconCopy = (p: Props) => (
  <Svg {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </Svg>
)

export const IconCheck = (p: Props) => (
  <Svg {...p}>
    <path d="m5 13 4 4L19 7" />
  </Svg>
)

export const IconFolder = (p: Props) => (
  <Svg {...p}>
    <path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6Z" />
  </Svg>
)

export const IconMusicNote = (p: Props) => (
  <Svg {...p}>
    <path d="M9 18V5l11-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="17" cy="16" r="3" />
  </Svg>
)

export const IconPencil = (p: Props) => (
  <Svg {...p}>
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19 3 20l1-4Z" />
    <path d="M14.5 5.5 18 9" />
  </Svg>
)
