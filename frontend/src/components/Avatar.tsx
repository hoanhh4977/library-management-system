import { useMemo } from "react";
import { createAvatar } from "@dicebear/core";
import { notionists } from "@dicebear/collection";

const SIZE_CLASSES = { sm: "h-8 w-8", md: "h-9 w-9", lg: "h-11 w-11" } as const;

// Forest-green/lime/teal tones pulled from the app's own chart palette (index.css
// --color-chart-1/2/3, plus a couple of neutral sages) so generated avatars read as
// part of the Bookary theme instead of DiceBear's default rainbow background set.
const BACKGROUND_PALETTE = ["0d4d3c", "2dd4bf", "a8d94f", "cfe0d9", "e7f6ec"];

/** Illustrated avatar, generated deterministically from `name` — ref: Notion/Slack
 * member rows. No real photo backend exists for demo accounts, so rather than a
 * stock headshot (which would misrepresent a real person's photo as this user's own)
 * this renders a drawn, non-photographic character via DiceBear's "notionists" style,
 * seeded so the same person always gets the same avatar. */
export function Avatar({ name, size = "md" }: { name: string; size?: keyof typeof SIZE_CLASSES }) {
  const dataUri = useMemo(
    () =>
      createAvatar(notionists, {
        seed: name,
        backgroundColor: BACKGROUND_PALETTE,
        backgroundType: ["solid"],
      }).toDataUri(),
    [name],
  );

  return (
    <span className={`flex flex-none overflow-hidden rounded-full bg-muted ${SIZE_CLASSES[size]}`} aria-hidden="true">
      <img src={dataUri} alt="" className="h-full w-full" />
    </span>
  );
}
