// Composant Button unifié — 4 variants stricts, 3 tailles, touch-target
// 44px minimum (sm), accessibilité de base (focus-visible ring jaune).
// À utiliser PARTOUT à la place des classes ad-hoc bg-canal-yellow/* .
//
// Variants :
//   primary     : bg-canal-yellow text-canal-black   (1 par section max)
//   secondary   : border-canal-yellow text-canal-yellow (actions optionnelles)
//   ghost       : text-canal-gray-muted hover:text-white (liens, refresh)
//   destructive : red text + border (quitter, annuler, reset)
//
// Sizes :
//   sm : h-9 (36px) — actions tertiaires uniquement, jamais critiques
//   md : h-11 (44px) — touch target standard mobile
//   lg : h-12 (48px) — action principale d'un écran (CTA empty state)

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-canal-yellow text-canal-black hover:bg-canal-yellow-hover " +
    "disabled:bg-canal-yellow/40 disabled:text-canal-black/60",
  secondary:
    "border border-canal-yellow/30 bg-canal-yellow/10 text-canal-yellow " +
    "hover:bg-canal-yellow/20 hover:border-canal-yellow/50 " +
    "disabled:opacity-50",
  ghost:
    "text-canal-gray-muted hover:text-white hover:bg-canal-gray-mid/60 " +
    "disabled:opacity-50",
  destructive:
    "border border-red-500/30 bg-red-950/30 text-red-400 " +
    "hover:bg-red-950/50 hover:border-red-500/50 " +
    "disabled:opacity-50",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-xs font-bold gap-1.5",
  md: "min-h-[44px] px-4 text-sm font-bold gap-2",
  lg: "min-h-[48px] px-5 text-base font-black gap-2",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingText?: string;
  fullWidth?: boolean;
  /** Icone à gauche du texte. */
  leftIcon?: React.ReactNode;
  /** Icone à droite du texte. */
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      loadingText,
      fullWidth = false,
      leftIcon,
      rightIcon,
      className,
      children,
      disabled,
      ...rest
    },
    ref
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          // base
          "inline-flex items-center justify-center rounded-xl",
          "transition-colors select-none whitespace-nowrap",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canal-yellow/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canal-black",
          "disabled:cursor-not-allowed",
          // size
          SIZE_CLASSES[size],
          // variant
          VARIANT_CLASSES[variant],
          // full width
          fullWidth && "w-full",
          className
        )}
        {...rest}
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" size={size === "sm" ? 12 : 14} />
            {loadingText ?? children}
          </>
        ) : (
          <>
            {leftIcon}
            {children}
            {rightIcon}
          </>
        )}
      </button>
    );
  }
);
