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

export interface MappingStepSuggestion {
  stepIndex: number;
  step: string;
  elementId: string | null;
  elementName?: string;
  selector?: string;
  confidence?: number;
  reason?: string;
}

export interface MappingSuggestionResult {
  testCaseId: string;
  featureId: string;
  testSuiteId: string;
  steps: MappingStepSuggestion[];
  elementIds: string[];
}

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

  suggest(testCaseId: string): Observable<MappingSuggestionResult | null> {
    return this.api
      .post<ApiEnvelope<MappingSuggestionResult>, { testCaseId: string }>(
        `${this.base}/suggest`,
        { testCaseId },
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

  bulkGenerateForFeature(
    featureId: string,
    scriptType: ScriptType = 'PLAYWRIGHT',
  ): Observable<BulkGenerateResult> {
    return this.api
      .post<
        ApiEnvelope<BulkGenerateResult>,
        { featureId: string; scriptType: ScriptType }
      >(`${this.base}/bulk-generate-for-feature`, { featureId, scriptType })
      .pipe(
        map((res) => {
          if (!res.data) {
            throw new Error(res.message ?? 'Empty response from server');
          }
          return res.data;
        }),
      );
  }

  bulkPushToGit(mappingIds: string[]): Observable<BulkPushResult> {
    return this.api
      .post<ApiEnvelope<BulkPushResult>, { mappingIds: string[] }>(
        `${this.base}/bulk-push-to-git`,
        { mappingIds },
      )
      .pipe(map((res) => res.data ?? { pushed: 0, skipped: 0 }));
  }

  remove(id: string): Observable<void> {
    return this.api
      .delete<ApiEnvelope<unknown>>(`${this.base}/${id}`)
      .pipe(map(() => undefined));
  }
}

export interface BulkPomFile {
  className: string;
  fileName: string;
  content: string;
  pageUrl: string;
  pageName: string;
  elementCount: number;
}

export interface BulkSpecFile {
  mappingId: string;
  testCaseId: string;
  testCaseTitle: string;
  fileName: string;
  content: string;
  isStub: boolean;
  elementsUsed: number;
}

export interface BulkGenerateResult {
  featureId: string;
  scriptType: ScriptType;
  pomFiles: BulkPomFile[];
  specFiles: BulkSpecFile[];
  processed: number;
  skipped: number;
  warnings: string[];
}

export interface BulkPushResult {
  pushed: number;
  skipped: number;
}
