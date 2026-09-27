/**
 * Offset pagination primitives shared by every list endpoint and repository.
 * Page numbers are 1-based. Sizes are clamped to a hard ceiling so a client
 * cannot request an unbounded scan.
 */

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export interface PageRequest {
  /** 1-based page number. */
  page: number;
  pageSize: number;
}

export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Coerce untrusted/optional paging input into a safe `PageRequest`:
 * page ≥ 1, 1 ≤ pageSize ≤ MAX_PAGE_SIZE, integers only.
 */
export function normalizePageRequest(input?: Partial<PageRequest> | null): PageRequest {
  const rawPage = input?.page;
  const rawSize = input?.pageSize;
  const page =
    typeof rawPage === 'number' && Number.isFinite(rawPage) && rawPage >= 1
      ? Math.floor(rawPage)
      : 1;
  const pageSize =
    typeof rawSize === 'number' && Number.isFinite(rawSize) && rawSize >= 1
      ? Math.min(Math.floor(rawSize), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
  return { page, pageSize };
}

/** Zero-based row offset for a (already normalized) page request. */
export function pageOffset(request: PageRequest): number {
  return (request.page - 1) * request.pageSize;
}

/** Assemble a `PageResult` from the fetched slice and the total row count. */
export function buildPageResult<T>(
  items: T[],
  totalItems: number,
  request: PageRequest,
): PageResult<T> {
  const totalPages = request.pageSize > 0 ? Math.ceil(totalItems / request.pageSize) : 0;
  return {
    items,
    page: request.page,
    pageSize: request.pageSize,
    totalItems,
    totalPages,
    hasNext: request.page < totalPages,
    hasPrevious: request.page > 1,
  };
}
