import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import {
  ApiEnvelope,
  CreateMappingPayload,
  EMPTY_PAGE,
  ITestCaseElementMapping,
  PaginatedResult,
  PushToGitPayload,
  ScriptType,
  SearchRequest,
  UpdateMappingPayload,
} from '../models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class MappingsService {
  private readonly api = inject(ApiService);
  private readonly base = '/testcase-mappings';

  search(
    request: SearchRequest,
  ): Observable<PaginatedResult<ITestCaseElementMapping>> {
    return this.api
      .post<
        ApiEnvelope<PaginatedResult<ITestCaseElementMapping>>,
        SearchRequest
      >(`${this.base}/search`, request)
      .pipe(map((res) => res.data ?? EMPTY_PAGE<ITestCaseElementMapping>()));
  }

  getByTestCase(
    testCaseId: string,
  ): Observable<ITestCaseElementMapping | null> {
    return this.api
      .get<ApiEnvelope<ITestCaseElementMapping>>(
        `${this.base}/by-test-case/${testCaseId}`,
      )
      .pipe(map((res) => res.data ?? null));
  }

  getById(id: string): Observable<ITestCaseElementMapping | null> {
    return this.api
      .get<ApiEnvelope<ITestCaseElementMapping>>(`${this.base}/${id}`)
      .pipe(map((res) => res.data ?? null));
  }

  upsert(
    payload: CreateMappingPayload,
  ): Observable<ITestCaseElementMapping | null> {
    return this.api
      .post<ApiEnvelope<ITestCaseElementMapping>, CreateMappingPayload>(
        this.base,
        payload,
      )
      .pipe(map((res) => res.data ?? null));
  }

  update(
    id: string,
    payload: UpdateMappingPayload,
  ): Observable<ITestCaseElementMapping | null> {
    return this.api
      .patch<ApiEnvelope<ITestCaseElementMapping>, UpdateMappingPayload>(
        `${this.base}/${id}`,
        payload,
      )
      .pipe(map((res) => res.data ?? null));
  }

  generateScript(
    id: string,
    scriptType?: ScriptType,
  ): Observable<ITestCaseElementMapping | null> {
    return this.api
      .post<ApiEnvelope<ITestCaseElementMapping>, { scriptType?: ScriptType }>(
        `${this.base}/${id}/generate-script`,
        scriptType ? { scriptType } : {},
      )
      .pipe(map((res) => res.data ?? null));
  }

  pushToGit(
    id: string,
    payload: PushToGitPayload = {},
  ): Observable<ITestCaseElementMapping | null> {
    return this.api
      .post<ApiEnvelope<ITestCaseElementMapping>, PushToGitPayload>(
        `${this.base}/${id}/push-to-git`,
        payload,
      )
      .pipe(map((res) => res.data ?? null));
  }

  remove(id: string): Observable<void> {
    return this.api
      .delete<ApiEnvelope<unknown>>(`${this.base}/${id}`)
      .pipe(map(() => undefined));
  }
}
