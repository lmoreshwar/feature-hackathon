import { FilterQuery } from 'mongoose';
import { SearchDto, SortDirection } from '../dto/search.dto';

export interface BuildSearchQueryOptions<T> {
  searchableFields?: string[];
  allowedFilterFields?: string[];
  baseFilter?: FilterQuery<T>;
}

export interface BuiltSearchQuery<T> {
  filter: FilterQuery<T>;
  sort: Record<string, 1 | -1>;
  skip: number;
  limit: number;
  pageIndex: number;
  pageSize: number;
}

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const directionToMongo = (direction: SortDirection): 1 | -1 =>
  direction === 'asc' ? 1 : -1;

export function buildSearchQuery<T>(
  dto: SearchDto,
  options: BuildSearchQueryOptions<T> = {},
): BuiltSearchQuery<T> {
  const pageIndex = Math.max(1, Math.floor(dto.pageIndex ?? 1) || 1);
  const pageSize = Math.max(
    1,
    Math.min(100, Math.floor(dto.pageSize ?? 10) || 10),
  );
  const skip = (pageIndex - 1) * pageSize;

  const filter: FilterQuery<T> = { ...(options.baseFilter ?? {}) } as FilterQuery<T>;

  const searchTerm = dto.search?.trim();
  if (searchTerm && options.searchableFields && options.searchableFields.length > 0) {
    const escaped = escapeRegex(searchTerm);
    const orClauses = options.searchableFields.map((field) => ({
      [field]: { $regex: escaped, $options: 'i' },
    }));
    (filter as Record<string, unknown>).$or = orClauses;
  }

  if (dto.filters && typeof dto.filters === 'object') {
    const allowed = options.allowedFilterFields;
    Object.entries(dto.filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      if (allowed && !allowed.includes(key)) {
        return;
      }
      (filter as Record<string, unknown>)[key] = value;
    });
  }

  const sort: Record<string, 1 | -1> = {};
  if (dto.sort && typeof dto.sort === 'object') {
    Object.entries(dto.sort).forEach(([key, direction]) => {
      if (direction === 'asc' || direction === 'desc') {
        sort[key] = directionToMongo(direction);
      }
    });
  }
  if (Object.keys(sort).length === 0) {
    sort.createdAt = -1;
  }

  return { filter, sort, skip, limit: pageSize, pageIndex, pageSize };
}

export function paginate<T>(
  items: T[],
  total: number,
  pageIndex: number,
  pageSize: number,
) {
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  return { items, pageIndex, pageSize, total, totalPages };
}
