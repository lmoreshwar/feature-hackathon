import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import {
  ApiEnvelope,
  CreateTestCasePayload,
  EMPTY_PAGE,
  ITestCase,
  PaginatedResult,
  SearchRequest,
  UpdateTestCasePayload,
} from '../models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class TestCasesService {
  private readonly api = inject(ApiService);
  private readonly base = '/test-cases';

  search(request: SearchRequest): Observable<PaginatedResult<ITestCase>> {
    return this.api
      .post<ApiEnvelope<PaginatedResult<ITestCase>>, SearchRequest>(
        `${this.base}/search`,
        request,
      )
      .pipe(map((res) => res.data ?? EMPTY_PAGE<ITestCase>()));
  }

  listBySuite(testSuiteId: string): Observable<ITestCase[]> {
    return this.api
      .get<ApiEnvelope<ITestCase[]>>(`${this.base}/by-suite/${testSuiteId}`)
      .pipe(map((res) => res.data ?? []));
  }

  getById(id: string): Observable<ITestCase | null> {
    return this.api
      .get<ApiEnvelope<ITestCase>>(`${this.base}/${id}`)
      .pipe(map((res) => res.data ?? null));
  }

  create(payload: CreateTestCasePayload): Observable<ITestCase | null> {
    return this.api
      .post<ApiEnvelope<ITestCase>, CreateTestCasePayload>(this.base, payload)
      .pipe(map((res) => res.data ?? null));
  }

  bulkCreate(payload: CreateTestCasePayload[]): Observable<ITestCase[]> {
    return this.api
      .post<ApiEnvelope<ITestCase[]>, { testCases: CreateTestCasePayload[] }>(
        `${this.base}/bulk`,
        { testCases: payload },
      )
      .pipe(map((res) => res.data ?? []));
  }

  update(
    id: string,
    payload: UpdateTestCasePayload,
  ): Observable<ITestCase | null> {
    return this.api
      .patch<ApiEnvelope<ITestCase>, UpdateTestCasePayload>(
        `${this.base}/${id}`,
        payload,
      )
      .pipe(map((res) => res.data ?? null));
  }

  approve(id: string): Observable<ITestCase | null> {
    return this.api
      .post<ApiEnvelope<ITestCase>>(`${this.base}/${id}/approve`)
      .pipe(map((res) => res.data ?? null));
  }

  reject(id: string): Observable<ITestCase | null> {
    return this.api
      .post<ApiEnvelope<ITestCase>>(`${this.base}/${id}/reject`)
      .pipe(map((res) => res.data ?? null));
  }

  needsReview(id: string): Observable<ITestCase | null> {
    return this.api
      .post<ApiEnvelope<ITestCase>>(`${this.base}/${id}/needs-review`)
      .pipe(map((res) => res.data ?? null));
  }

  remove(id: string): Observable<void> {
    return this.api
      .delete<ApiEnvelope<unknown>>(`${this.base}/${id}`)
      .pipe(map(() => undefined));
  }
}
