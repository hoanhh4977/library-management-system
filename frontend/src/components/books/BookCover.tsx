import { BookOpen } from "@phosphor-icons/react";

/** Cover image with a graceful placeholder for books that don't have one yet
 * (e.g. added manually by Admin without a cover URL). */
export function BookCover({
  src,
  title,
  size = "md",
}: {
  src: string | null;
  title: string;
  size?: "sm" | "md";
}) {
  const dims = size === "sm" ? "h-12 w-9" : "h-full w-full";

  if (!src) {
    return (
      <div
        className={`${dims} flex flex-none items-center justify-center rounded-md bg-muted text-muted-foreground`}
      >
        <BookOpen size={size === "sm" ? 16 : 28} aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`Bìa sách ${title}`}
      loading="lazy"
      className={`${dims} flex-none rounded-md object-cover`}
    />
  );
}
