import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string | number | undefined;
  icon: string;
  trend?: string;
  iconBg?: string;
  iconColor?: string;
  className?: string;
}

export function KpiCard({
  title,
  value,
  icon,
  trend,
  iconBg = "bg-primary-fixed",
  iconColor = "text-primary",
  className,
}: KpiCardProps) {
  return (
    <div className={cn("bg-white p-lg rounded-xl border border-outline-variant card-shadow flex flex-col justify-between card-hover", className)}>
      <div className="flex justify-between items-start">
        <div className={cn("p-sm rounded-lg", iconBg)}>
          <Icon name={icon} size={24} className={iconColor} />
        </div>
        {trend && (
          <span className="text-on-tertiary-container font-label-sm text-label-sm flex items-center gap-xs">
            <Icon name="trending_up" size={14} />
            {trend}
          </span>
        )}
      </div>
      <div className="mt-md">
        <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{title}</p>
        <h3 className="font-headline-lg text-headline-lg font-black text-primary mt-xs">{value ?? "—"}</h3>
      </div>
    </div>
  );
}
