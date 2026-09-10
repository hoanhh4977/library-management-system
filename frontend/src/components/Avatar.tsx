const SIZE_CLASSES = { sm: "h-8 w-8 text-xs", md: "h-9 w-9 text-sm", lg: "h-11 w-11 text-base" } as const;

/** Initials avatar — ref: Bookary member/borrower rows. No real photo backend exists,
 * so we use a colored initial rather than fabricating a placeholder headshot. */
export function Avatar({ name, size = "md" }: { name: string; size?: keyof typeof SIZE_CLASSES }) {
  return (
    <span
      className={`flex flex-none items-center justify-center rounded-full bg-accent font-semibold text-accent-foreground ${SIZE_CLASSES[size]}`}
      aria-hidden="true"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
