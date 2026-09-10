import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface PageHeaderConfig {
  title: string;
  subtitle?: string;
  search?: { value: string; onChange: (value: string) => void; placeholder?: string };
  action?: ReactNode;
}

const PageHeaderSetterContext = createContext<((config: PageHeaderConfig | null) => void) | null>(null);
const PageHeaderValueContext = createContext<PageHeaderConfig | null>(null);

/** Wraps StaffLayout's content area so pages can push their title/search/CTA up into
 * the shared white topbar (ref: Bookary — one topbar shell, per-page content). */
export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<PageHeaderConfig | null>(null);
  return (
    <PageHeaderSetterContext.Provider value={setConfig}>
      <PageHeaderValueContext.Provider value={config}>{children}</PageHeaderValueContext.Provider>
    </PageHeaderSetterContext.Provider>
  );
}

export function usePageHeaderValue() {
  return useContext(PageHeaderValueContext);
}

/** Call from a page component to populate the shared topbar. Re-registers whenever
 * the passed fields change; clears itself on unmount. */
export function usePageHeader(config: PageHeaderConfig) {
  const setConfig = useContext(PageHeaderSetterContext);
  const { title, subtitle, action } = config;
  const search = config.search;

  const memoConfig = useMemo(
    () => ({ title, subtitle, action, search }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [title, subtitle, action, search?.value, search?.onChange, search?.placeholder],
  );

  useEffect(() => {
    setConfig?.(memoConfig);
    return () => setConfig?.(null);
  }, [setConfig, memoConfig]);
}
