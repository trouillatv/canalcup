// <Flag> — rend une IMAGE de drapeau (flagcdn.com) qui s'affiche partout
// (Windows / Smart TV inclus), au lieu de l'emoji qui n'a pas de glyphe sur
// certains OS. Fallback sur l'emoji/texte si le pays n'est pas résolu.
//
// `className` dimensionne l'image (ex. "h-10 w-auto rounded-sm shadow").
// `emojiClassName` (optionnel) dimensionne le fallback emoji (taille de police).

import { flagImgUrl, teamFlag } from "@/lib/utils";

export function Flag({
  flag,
  name,
  className,
  emojiClassName,
}: {
  flag?: string | null;
  name: string;
  className?: string;
  emojiClassName?: string;
}) {
  const url = flagImgUrl(flag, name);
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt=""
        aria-hidden
        loading="lazy"
        className={`inline-block object-cover ${className ?? ""}`}
      />
    );
  }
  return <span className={emojiClassName ?? className}>{teamFlag(flag, name)}</span>;
}
