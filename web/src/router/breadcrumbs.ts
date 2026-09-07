import { useMatches } from "react-router-dom";

export interface Crumb {
  label: string;
  to?: string;
}

interface BreadcrumbHandle {
  breadcrumb: (data: unknown) => Crumb[];
}

export function breadcrumbHandle<T>(factory: (data: T) => Crumb[]) {
  return {
    breadcrumb: (data: unknown) => (data ? factory(data as T) : []),
  } satisfies BreadcrumbHandle;
}

export function useRouteBreadcrumbs(): Crumb[] {
  return useMatches().flatMap((match) => {
    const handle = match.handle as Partial<BreadcrumbHandle> | undefined;
    return handle?.breadcrumb?.(match.data) ?? [];
  });
}
