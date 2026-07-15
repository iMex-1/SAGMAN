import { cn } from "@/lib/utils";

interface IconProps {
  name: string;
  className?: string;
  filled?: boolean;
  size?: number;
}

export function Icon({ name, className, filled, size = 24 }: IconProps) {
  return (
    <span
      className={cn("material-symbols-outlined", className)}
      style={{
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size >= 40 ? 48 : 24}`,
        fontSize: size,
        width: size,
        height: size,
      }}
    >
      {name}
    </span>
  );
}
