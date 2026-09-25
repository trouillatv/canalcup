import Link from "next/link";
import { cn } from "@/lib/utils";

interface SectionProps {
  title: string;
  action?: { label: string; href: string };
  children: React.ReactNode;
  className?: string;
}

export function Section({ title, action, children, className }: SectionProps) {
  return (
    <section className={cn(className)}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-primary uppercase tracking-wider">
          {title}
        </h2>
        {action && (
          <Link
            href={action.href}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {action.label} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
