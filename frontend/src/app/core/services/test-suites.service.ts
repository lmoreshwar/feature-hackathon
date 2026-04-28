import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import {
  ApiEnvelope,
  CreateTestSuitePayload,
  EMPTY_PAGE,
  ITestSuite,
  PaginatedResult,
  SearchRequest,
  UpdateTestSuitePayload,
} from '../models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class TestSuitesService {
  private readonly api = inject(ApiService);
  private readonly base = '/test-suites';

  search(request: SearchRequest): Observable<PaginatedResult<ITestSuite>> {
    return this.api
      .post<ApiEnvelope<PaginatedResult<ITestSuite>>, SearchRequest>(
        `${this.base}/search`,
        request,
      )
      .pipe(map((res) => res.data ?? EMPTY_PAGE<ITestSuite>()));
  }

  listByFeature(featureId: string): Observable<ITestSuite[]> {
    return this.api
      .get<ApiEnvelope<ITestSuite[]>>(`${this.base}/by-feature/${featureId}`)
      .pipe(map((res) => res.data ?? []));
  }

  getById(id: string): Observable<ITestSuite | null> {
    return this.api
      .get<ApiEnvelope<ITestSuite>>(`${this.base}/${id}`)
      .pipe(map((res) => res.data ?? null));
  }

  create(payload: CreateTestSuitePayload): Observable<ITestSuite | null> {
    return this.api
      .post<ApiEnvelope<ITestSuite>, CreateTestSuitePayload>(this.base, payload)
      .pipe(map((res) => res.data ?? null));
  }

  update(
    id: string,
    payload: UpdateTestSuitePayload,
  ): Observable<ITestSuite | null> {
    return this.api
      .patch<ApiEnvelope<ITestSuite>, UpdateTestSuitePayload>(
        `${this.base}/${id}`,
        payload,
      )
      .pipe(map((res) => res.data ?? null));
  }

  archive(id: string): Observable<ITestSuite | null> {
    return this.api
      .post<ApiEnvelope<ITestSuite>>(`${this.base}/${id}/archive`)
      .pipe(map((res) => res.data ?? null));
  }

  remove(id: string): Observable<void> {
    return this.api
      .delete<ApiEnvelope<unknown>>(`${this.base}/${id}`)
      .pipe(map(() => undefined));
  }
}
