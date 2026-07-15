import { cn } from "@/lib/utils";

interface DesignCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}

export function DesignCard({ children, className, padding = true }: DesignCardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-outline-variant card-shadow",
        padding && "p-lg",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface DesignCardHeaderProps {
  children: React.ReactNode;
  className?: string;
  border?: boolean;
}

export function DesignCardHeader({ children, className, border = true }: DesignCardHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between",
        border && "border-b border-outline-variant",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface DesignCardTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function DesignCardTitle({ children, className }: DesignCardTitleProps) {
  return (
    <h4 className={cn("font-title-md text-title-md text-primary font-bold", className)}>
      {children}
    </h4>
  );
}
