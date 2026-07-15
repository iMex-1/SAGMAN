import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  className?: string
}

const sizeMap = { sm: 32, md: 40, lg: 56, xl: 80 }

export function Logo({ size = 'md', showText = false, className }: LogoProps) {
  const px = sizeMap[size]

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <Image
        src="/images/sagmanLogo.png"
        alt="SAGMAN AUTO"
        width={px}
        height={px}
        className="object-contain"
      />

      {showText && (
        <div>
          <div className="text-lg font-black tracking-wide leading-none text-foreground">
            SAGMAN AUTO
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground leading-none mt-0.5">
            Auto Service
          </div>
        </div>
      )}
    </div>
  )
}
