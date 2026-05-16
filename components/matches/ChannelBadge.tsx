import { getChannelConfig } from "@/lib/channels";
import { cn } from "@/lib/utils";

interface ChannelBadgeProps {
  channel: string;
  size?: "sm" | "md" | "lg";
  showEmoji?: boolean;
}

export function ChannelBadge({ channel, size = "sm", showEmoji = true }: ChannelBadgeProps) {
  const config = getChannelConfig(channel);

  const sizeClass = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-1.5 font-bold",
  }[size];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold border tracking-wide",
        config.color,
        config.textColor,
        config.borderColor,
        sizeClass
      )}
    >
      {showEmoji && <span>{config.emoji}</span>}
      <span>{config.shortName}</span>
    </span>
  );
}
