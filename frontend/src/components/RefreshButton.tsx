import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { ArrowClockwise } from "@phosphor-icons/react";

/** Global "làm mới" button in the shared topbar — refetches every query the
 * current page has mounted (loans, requests, books, whatever's on screen)
 * instead of scattering a separate refresh icon on every individual panel. */
export function RefreshButton() {
  const queryClient = useQueryClient();
  const isFetching = useIsFetching() > 0;

  return (
    <button
      type="button"
      onClick={() => void queryClient.refetchQueries({ type: "active" })}
      disabled={isFetching}
      aria-label="Làm mới dữ liệu"
      title="Làm mới dữ liệu"
      className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:cursor-wait"
    >
      <ArrowClockwise size={18} className={isFetching ? "animate-spin" : ""} aria-hidden="true" />
    </button>
  );
}
