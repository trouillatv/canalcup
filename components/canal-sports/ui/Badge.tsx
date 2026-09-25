import { cn } from "@/lib/utils";

export type BadgeVariant = "default" | "muted" | "success" | "warning" | "danger";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: "bg-primary/10 text-primary border-primary/30",
  muted: "bg-muted text-muted-foreground border-border",
  success: "bg-canal-green/10 text-canal-green border-canal-green/30",
  warning: "bg-primary/10 text-primary border-primary/30",
  danger: "bg-canal-red/10 text-canal-red border-canal-red/30",
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
        VARIANT_CLASSES[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
