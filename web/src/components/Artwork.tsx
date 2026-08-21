import { useState } from 'react'
import { IconRadio } from './icons'

interface Props {
  src: string | undefined
  alt: string
  size: number
  radius?: number
}

// A station logo or track cover art image, falling back to the plain
// icon mark when there's no URL or it fails to load -- these come from
// controller-supplied metadata the panel never validates, so a broken
// link is expected, not exceptional.
export function Artwork({ src, alt, size, radius }: Props) {
  const [failed, setFailed] = useState(false)
  const style = {
    width: size,
    height: size,
    borderRadius: radius ?? (size <= 24 ? 5 : 8),
  }

  if (!src || failed) {
    return (
      <div className="artwork-fallback" style={style}>
        <IconRadio size={Math.round(size * 0.5)} />
      </div>
    )
  }

  return (
    <img
      className="artwork-img"
      src={src}
      alt={alt}
      style={style}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}
