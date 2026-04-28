import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import {
  ApiEnvelope,
  CreateExecutionPayload,
  EMPTY_PAGE,
  ITestExecution,
  PaginatedResult,
  SearchRequest,
  UpdateExecutionPayload,
} from '../models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class ExecutionsService {
  private readonly api = inject(ApiService);
  private readonly base = '/test-executions';

  search(request: SearchRequest): Observable<PaginatedResult<ITestExecution>> {
    return this.api
      .post<ApiEnvelope<PaginatedResult<ITestExecution>>, SearchRequest>(
        `${this.base}/search`,
        request,
      )
      .pipe(map((res) => res.data ?? EMPTY_PAGE<ITestExecution>()));
  }

  getById(id: string): Observable<ITestExecution | null> {
    return this.api
      .get<ApiEnvelope<ITestExecution>>(`${this.base}/${id}`)
      .pipe(map((res) => res.data ?? null));
  }

  trigger(payload: CreateExecutionPayload): Observable<ITestExecution | null> {
    return this.api
      .post<ApiEnvelope<ITestExecution>, CreateExecutionPayload>(
        this.base,
        payload,
      )
      .pipe(map((res) => res.data ?? null));
  }

  update(
    id: string,
    payload: UpdateExecutionPayload,
  ): Observable<ITestExecution | null> {
    return this.api
      .patch<ApiEnvelope<ITestExecution>, UpdateExecutionPayload>(
        `${this.base}/${id}`,
        payload,
      )
      .pipe(map((res) => res.data ?? null));
  }

  cancel(id: string): Observable<ITestExecution | null> {
    return this.api
      .post<ApiEnvelope<ITestExecution>>(`${this.base}/${id}/cancel`)
      .pipe(map((res) => res.data ?? null));
  }

  remove(id: string): Observable<void> {
    return this.api
      .delete<ApiEnvelope<unknown>>(`${this.base}/${id}`)
      .pipe(map(() => undefined));
  }
}
