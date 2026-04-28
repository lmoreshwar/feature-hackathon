export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: unknown;
}

export interface IBaseCollection {
  _id: string;
  createdAt: number;
  updatedAt: number;
}

export type SortDirection = 'asc' | 'desc';

export interface SearchRequest {
  pageIndex?: number;
  pageSize?: number;
  search?: string;
  filters?: Record<string, unknown>;
  sort?: Record<string, SortDirection>;
}

export interface PaginatedResult<T> {
  items: T[];
  pageIndex: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const EMPTY_PAGE = <T>(): PaginatedResult<T> => ({
  items: [],
  pageIndex: 1,
  pageSize: 10,
  total: 0,
  totalPages: 0,
});

export interface IReferenceInfo {
  jiraId?: string;
  testLinkId?: string;
  confluenceUrl?: string;
  requirementText?: string;
}
