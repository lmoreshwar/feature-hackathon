import { Observable } from 'rxjs';

import { PaginatedResult, SearchRequest, SortDirection } from '../../core/models';

/**
 * Stateful helper that mirrors the backend's POST `/search` contract:
 * `{ pageIndex, pageSize, search, filters, sort }`. Pages bind their
 * `nz-table` directly to this state and call `load()` whenever any input
 * changes. Centralising it here means new list screens drop the boilerplate
 * to a single line while keeping the contract identical across pages.
 */
export class SearchState<T> {
  pageIndex = 1;
  pageSize = 10;
  search = '';
  filters: Record<string, unknown> = {};
  sort: Record<string, SortDirection> = { createdAt: 'desc' };

  items: T[] = [];
  total = 0;
  totalPages = 0;
  loading = false;

  constructor(
    private readonly fetcher: (req: SearchRequest) => Observable<PaginatedResult<T>>,
  ) {}

  toRequest(): SearchRequest {
    const filters: Record<string, unknown> = {};
    Object.entries(this.filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        filters[key] = value;
      }
    });

    return {
      pageIndex: this.pageIndex,
      pageSize: this.pageSize,
      search: this.search?.trim() || undefined,
      filters,
      sort: this.sort,
    };
  }

  load(onSuccess?: (page: PaginatedResult<T>) => void): Observable<PaginatedResult<T>> {
    this.loading = true;
    const stream = this.fetcher(this.toRequest());
    stream.subscribe({
      next: (page) => {
        this.items = page.items;
        this.total = page.total;
        this.totalPages = page.totalPages;
        this.loading = false;
        onSuccess?.(page);
      },
      error: () => {
        this.items = [];
        this.total = 0;
        this.totalPages = 0;
        this.loading = false;
      },
    });
    return stream;
  }

  resetToFirstPage(): void {
    this.pageIndex = 1;
  }
}
