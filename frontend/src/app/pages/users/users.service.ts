import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import {
  CreateUserPayload,
  DeleteUserResponse,
  ListUsersResponse,
  PaginatedUsers,
  UpdateUserPayload,
  UserRecord,
  UserResponse,
} from './users.models';

export interface ListUsersQuery {
  page?: number;
  limit?: number;
  search?: string;
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly api = inject(ApiService);

  list(query: ListUsersQuery = {}): Observable<PaginatedUsers> {
    return this.api
      .get<ListUsersResponse>('/users', {
        page: query.page,
        limit: query.limit,
        search: query.search?.trim() || undefined,
      })
      .pipe(map((res) => res.data ?? { items: [], page: 1, limit: 10, total: 0, totalPages: 0 }));
  }

  create(payload: CreateUserPayload): Observable<UserRecord | null> {
    return this.api
      .post<UserResponse, CreateUserPayload>('/users', payload)
      .pipe(map((res) => res.data ?? null));
  }

  update(id: string, payload: UpdateUserPayload): Observable<UserRecord | null> {
    return this.api
      .patch<UserResponse, UpdateUserPayload>(`/users/${id}`, payload)
      .pipe(map((res) => res.data ?? null));
  }

  remove(id: string): Observable<void> {
    return this.api.delete<DeleteUserResponse>(`/users/${id}`).pipe(map(() => undefined));
  }
}
