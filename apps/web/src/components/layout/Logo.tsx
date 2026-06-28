import { cn } from '@/lib/utils'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  className?: string
}

const sizeMap = { sm: 32, md: 40, lg: 56, xl: 80 }

/**
 * SAGMAN gear logo — white, blue, red brand colors.
 * Uses an inline SVG so no external dependencies are needed.
 */
export function Logo({ size = 'md', showText = false, className }: LogoProps) {
  const px = sizeMap[size]

  // Pre-compute 8 evenly-spaced tooth rectangles around a circle of radius 38
  const teeth = Array.from({ length: 8 }, (_, i) => {
    const angleDeg = i * 45
    const angleRad = (angleDeg * Math.PI) / 180
    const cx = 50 + 38 * Math.cos(angleRad)
    const cy = 50 + 38 * Math.sin(angleRad)
    return { cx, cy, angleDeg }
  })

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <svg
        width={px}
        height={px}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="SAGMAN logo"
      >
        {/* Gear teeth — 8 rounded rectangles rotated around the body */}
        {teeth.map(({ cx, cy, angleDeg }) => (
          <rect
            key={angleDeg}
            x={cx - 8}
            y={cy - 8}
            width={16}
            height={16}
            rx="3.5"
            fill="#1e40af"
            transform={`rotate(${angleDeg}, ${cx}, ${cy})`}
          />
        ))}

        {/* Main gear body */}
        <circle cx="50" cy="50" r="30" fill="#1e40af" />

        {/* White ring — creates a border between body and center */}
        <circle cx="50" cy="50" r="19" fill="white" />

        {/* Red center hub */}
        <circle cx="50" cy="50" r="11" fill="#dc2626" />

        {/* Subtle shine highlight */}
        <circle cx="44" cy="44" r="3.5" fill="rgba(255,255,255,0.38)" />
      </svg>

      {showText && (
        <div>
          <div className="text-lg font-black tracking-wide leading-none text-foreground">
            SAGMAN
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground leading-none mt-0.5">
            Auto Repairs
          </div>
        </div>
      )}
    </div>
  )
}
